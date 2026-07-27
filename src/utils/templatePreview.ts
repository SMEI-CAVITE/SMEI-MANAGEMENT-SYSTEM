import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
// @ts-ignore
import ImageModule from "docxtemplater-image-module-free";
import ExcelJS from "exceljs";
import * as XLSX from "xlsx";

function base64Parser(dataUrl: string) {
  if (typeof dataUrl !== "string") return dataUrl;
  const regex = /^data:.+;base64,/;
  if (regex.test(dataUrl)) {
    const base64 = dataUrl.replace(regex, "");
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
  return dataUrl;
}

// Merge split placeholders like {{PART1</w:t>...<w:t>PART2}} in Word XML safely and robustly
function cleanSplitPlaceholders(xml: string): string {
  let cleaned = xml.replace(/<w:proofErr\b[^>]*\/>/g, "");
  
  // Step 1: Merge split start and end brace characters separated by run/text boundaries
  cleaned = cleaned.replace(/\{<\/w:t>(?:<[^>]+>|\s)*?<w:t\b[^>]*>\{/g, "{{");
  cleaned = cleaned.replace(/\}<\/w:t>(?:<[^>]+>|\s)*?<w:t\b[^>]*>\}/g, "}}");
  
  // Also merge split double parentheses
  cleaned = cleaned.replace(/\(<\/w:t>(?:<[^>]+>|\s)*?<w:t\b[^>]*>\(/g, "((");
  cleaned = cleaned.replace(/\)<\/w:t>(?:<[^>]+>|\s)*?<w:t\b[^>]*>\)/g, "))");
  
  // Step 2: Strip any intervening run/text boundaries inside curly braces/parentheses
  cleaned = cleaned.replace(/\{\{((?:(?!\{\{)[\s\S])*?)\}\}/g, (match, p1) => {
    const stripped = p1.replace(/<\/w:t>[\s\S]*?<w:t\b[^>]*>/g, "");
    return `{{${stripped}}}`;
  });
  cleaned = cleaned.replace(/\(\(((?:(?!\(\()[\s\S])*?)\)\)/g, (match, p1) => {
    const stripped = p1.replace(/<\/w:t>[\s\S]*?<w:t\b[^>]*>/g, "");
    return `((${stripped}))`;
  });
  cleaned = cleaned.replace(/\(\(((?:(?!\(\()[\s\S])*?)\}\}/g, (match, p1) => {
    const stripped = p1.replace(/<\/w:t>[\s\S]*?<w:t\b[^>]*>/g, "");
    return `{{${stripped}}}`;
  });

  // Step 3: Backward-compatibility check using splitRegex
  const splitRegex = /(\{\{[^}]+?)<\/w:t><\/w:r>(?:<w:proofErr\b[^>]*\/>)?<w:r\b[^>]*>(?:<w:rPr>[^]*?<\/w:rPr>)?<w:t\b[^>]*>([^}]*?\}\})/g;
  let prevCleaned;
  do {
    prevCleaned = cleaned;
    cleaned = cleaned.replace(splitRegex, "$1$2");
  } while (cleaned !== prevCleaned);
  return cleaned;
}

// Recursively sanitizes all values in a data object so that undefined, null, or NaN values are replaced with empty strings ("").
export function sanitizeRenderData(val: any): any {
  if (val === undefined || val === null) {
    return "";
  }
  if (typeof val === "number" && isNaN(val)) {
    return "";
  }
  if (Array.isArray(val)) {
    return val.map(sanitizeRenderData);
  }
  if (typeof val === "object" && !(val instanceof Date)) {
    const cleaned: Record<string, any> = {};
    for (const key of Object.keys(val)) {
      cleaned[key] = sanitizeRenderData(val[key]);
    }
    return cleaned;
  }
  return val;
}

// Resolve ExcelJS shared formulas
function resolveSharedFormulas(worksheet: ExcelJS.Worksheet) {
  const sharedMasters: { cell: ExcelJS.Cell; formula: string; ref: string }[] = [];
  for (let r = 1; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    row.eachCell({ includeEmpty: true }, (cell) => {
      const val = cell.value;
      if (val && typeof val === "object" && (val as any).shareType === "shared" && (val as any).formula && (val as any).ref) {
        sharedMasters.push({
          cell,
          formula: (val as any).formula,
          ref: (val as any).ref
        });
      }
    });
  }
  sharedMasters.forEach(({ cell, formula, ref }) => {
    const [start, end] = ref.split(":");
    if (!start) return;
    const startCell = worksheet.getCell(start);
    const endCell = end ? worksheet.getCell(end) : startCell;
    const startRow = Number(startCell.row);
    const startCol = Number(startCell.col);
    const endRow = Number(endCell.row);
    const endCol = Number(endCell.col);

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const targetCell = worksheet.getCell(r, c);
        if (targetCell.address === cell.address) continue;
        const offsetRow = r - startRow;
        const offsetCol = c - startCol;
        targetCell.value = {
          formula,
          result: undefined,
          shareType: "shared",
          ref
        } as any;
      }
    }
  });
}

// Extract placeholders from Docx
export function extractDocxPlaceholders(zip: PizZip): string[] {
  const placeholders = new Set<string>();
  Object.keys(zip.files).forEach((filename) => {
    if (filename.endsWith(".xml")) {
      const xmlText = zip.files[filename].asText();
      const matches = xmlText.match(/\{\{([^}]+)\}\}/g) || [];
      matches.forEach((m) => {
        let clean = m.replace(/[\{\}]/g, "").trim();
        if (clean.startsWith("#") || clean.startsWith("/") || clean.startsWith("^")) {
          clean = clean.substring(1).trim();
        }
        if (clean) {
          placeholders.add(clean);
        }
      });
    }
  });
  return Array.from(placeholders);
}

// Extract placeholders from Excel
export function extractXlsxPlaceholders(workbook: ExcelJS.Workbook): string[] {
  const placeholders = new Set<string>();
  workbook.eachSheet((sheet) => {
    sheet.eachRow({ includeEmpty: true }, (row) => {
      row.eachCell({ includeEmpty: true }, (cell) => {
        const val = cell.value;
        if (typeof val === "string") {
          const matches = val.match(/\{\{([^}]+)\}\}/g) || [];
          matches.forEach((m) => {
            const clean = m.replace(/[\{\}]/g, "").trim();
            if (clean) placeholders.add(clean);
          });
        }
      });
    });
  });
  return Array.from(placeholders);
}

// Validate missing placeholders
export function validatePlaceholders(
  templatePlaceholders: string[],
  data: Record<string, any>,
  items: any[] = []
): string[] {
  const warnings: string[] = [];
  const lowercaseDataKeys = new Set(Object.keys(data).map((k) => k.toLowerCase()));
  const itemKeys = items.length > 0 ? new Set(Object.keys(items[0]).map((k) => k.toLowerCase())) : new Set<string>();

  templatePlaceholders.forEach((placeholder) => {
    const cleanPh = placeholder.replace(/^(items?\.)/, "").trim();
    const phLower = cleanPh.toLowerCase();

    const isRootFound = lowercaseDataKeys.has(phLower) || lowercaseDataKeys.has(placeholder.toLowerCase());
    const isItemFound =
      itemKeys.has(phLower) ||
      (phLower === "item_description" && itemKeys.has("description")) ||
      (phLower === "qty" && itemKeys.has("quantity")) ||
      (phLower === "unit" && itemKeys.has("unit")) ||
      (phLower === "remarks" && itemKeys.has("remarks"));

    if (!isRootFound && !isItemFound) {
      if (!["s", "index", "shops", "items"].includes(phLower)) {
        warnings.push(`Missing placeholder: ${placeholder}`);
      }
    }
  });
  return warnings;
}

const templateCache = new Map<string, ArrayBuffer>();

async function fetchTemplateCached(templateName: string): Promise<ArrayBuffer> {
  const templatePath = `/templates/${templateName}`;
  const cached = templateCache.get(templatePath);
  if (cached) {
    console.log(`[Template Cache] Serving cached template for: ${templatePath}`);
    return cached.slice(0);
  }

  console.log(`[Runtime Template Load] Fetching template from path: ${templatePath}`);
  const fetchUrl = `${templatePath}?t=${Date.now()}`;
  const response = await fetch(fetchUrl, { cache: "no-store" });
  const contentType = response.headers.get("content-type") || "";

  if (!response.ok || contentType.includes("text/html")) {
    throw new Error(`Unable to load template directly from '${templatePath}'. Server returned error or HTML fallback instead of binary. Please verify public/templates/ directory.`);
  }

  const arrayBuffer = await response.arrayBuffer();
  // Check magic bytes PK to prevent cryptic loading errors
  const bytes = new Uint8Array(arrayBuffer.slice(0, 4));
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4B) {
    throw new Error(`Invalid file format for template '${templateName}'. Expected a valid Office/ZIP document but received invalid binary.`);
  }

  templateCache.set(templatePath, arrayBuffer);
  return arrayBuffer.slice(0);
}

// Generate Docx Blob with exact same core engine
export async function generateDocxBlob(
  templateName: string,
  data: Record<string, any>
): Promise<{ blob: Blob; warnings: string[] }> {
  const arrayBuffer = await fetchTemplateCached(templateName);
  const zip = new PizZip(arrayBuffer);

  // Apply XML level corrections
  if (templateName === "CANVASS_TEMPLATE.docx") {
    let docXml = zip.files["word/document.xml"].asText();
    docXml = cleanSplitPlaceholders(docXml);
    docXml = docXml.replace(/\(\(/g, "{{").replace(/\)\)/g, "}}");

    // Detect number of suppliers from data with robust enterprise validation
    let numSuppliers = 0;
    while (true) {
      const val = data[`shop_name${numSuppliers + 1}`];
      if (val !== undefined && val !== null && typeof val === "string" && val.trim() !== "") {
        numSuppliers++;
      } else {
        break;
      }
    }
    // Fallback: if no valid suppliers are found, default to 1 to avoid division by zero or empty grid
    if (numSuppliers === 0) {
      numSuppliers = 1;
    }

    // Perform XML-level cloning and width scaling for 1 to N suppliers
    if (numSuppliers > 0) {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(docXml, "application/xml");
      const serializer = new XMLSerializer();

      const getElements = (parent: Element | Document, tagName: string): Element[] => {
        const ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
        const listNS = parent.getElementsByTagNameNS(ns, tagName);
        if (listNS && listNS.length > 0) {
          return Array.from(listNS);
        }
        const listPrefixed = parent.getElementsByTagName(`w:${tagName}`);
        return Array.from(listPrefixed);
      };

      const tables = getElements(xmlDoc, "tbl");
      const targetTable = tables.find(table => {
        const tableXml = serializer.serializeToString(table);
        return tableXml.includes("shop_name1");
      });

      if (targetTable) {
        const ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

        // 1. Dynamically update the table grid (tblGrid) to align cell counts and column widths
        const tblGridList = getElements(targetTable, "tblGrid");
        if (tblGridList.length > 0) {
          const tblGrid = tblGridList[0];
          while (tblGrid.firstChild) {
            tblGrid.removeChild(tblGrid.firstChild);
          }

          // First column (Label)
          const col0 = xmlDoc.createElementNS(ns, "w:gridCol");
          col0.setAttribute("w:w", "2830");
          tblGrid.appendChild(col0);

          // Supplier columns
          const supplierWidth = Math.round(5660 / numSuppliers);
          for (let i = 0; i < numSuppliers; i++) {
            const colS = xmlDoc.createElementNS(ns, "w:gridCol");
            colS.setAttribute("w:w", String(supplierWidth));
            tblGrid.appendChild(colS);
          }

          // Last column (Remarks)
          const colR = xmlDoc.createElementNS(ns, "w:gridCol");
          colR.setAttribute("w:w", "2830");
          tblGrid.appendChild(colR);
        }

        // 2. Process all rows of targetTable to dynamically clone the supplier cell
        const tableRows = getElements(targetTable, "tr");
        tableRows.forEach((row) => {
          const tcElements = getElements(row, "tc");

          // Remove any cell that contains suffix 2 or 3 to avoid duplicates and ensure dynamic columns
          tcElements.forEach((tc) => {
            const tcXml = serializer.serializeToString(tc);
            const containsOtherSupplier = 
              tcXml.includes("shop_name2") || tcXml.includes("shop_name3") ||
              tcXml.includes("contact_person2") || tcXml.includes("contact_person3") ||
              tcXml.includes("contact_no2") || tcXml.includes("contact_no3") ||
              tcXml.includes("work_duration2") || tcXml.includes("work_duration3") ||
              tcXml.includes("warranty2") || tcXml.includes("warranty3") ||
              tcXml.includes("payment_terms2") || tcXml.includes("payment_terms3") ||
              tcXml.includes("parts_shop2_price2") || tcXml.includes("parts_shop3_price3") ||
              tcXml.includes("total_shop2") || tcXml.includes("total_shop3") ||
              tcXml.includes("vat2") || tcXml.includes("vat3") ||
              tcXml.includes("total_amount2") || tcXml.includes("total_amount3");

            if (containsOtherSupplier) {
              tc.parentNode?.removeChild(tc);
            }
          });

          // Get the remaining cells after removal
          const updatedTcElements = getElements(row, "tc");
          if (updatedTcElements.length > 0) {
            // 1. Label cell (always index 0)
            const labelCell = updatedTcElements[0];
            if (labelCell) {
              const tcWList = getElements(labelCell, "tcW");
              if (tcWList.length > 0) {
                tcWList[0].setAttribute("w:w", "2830");
                tcWList[0].setAttribute("w:type", "dxa");
              }
            }

            // 2. Remarks cell (always the last column, index N+1)
            let remarksCell: Element;
            if (updatedTcElements.length >= 3) {
              remarksCell = updatedTcElements[updatedTcElements.length - 1];
            } else {
              // Remarks cell is missing, create one by cloning labelCell
              remarksCell = labelCell.cloneNode(true) as Element;
              // Clear text content
              const tList = getElements(remarksCell, "t");
              tList.forEach(t => { t.textContent = ""; });
              row.appendChild(remarksCell);
            }
            // Set Remarks cell width to 2830
            const remarksWList = getElements(remarksCell, "tcW");
            if (remarksWList.length > 0) {
              remarksWList[0].setAttribute("w:w", "2830");
              remarksWList[0].setAttribute("w:type", "dxa");
            }

            // 3. Supplier cell (always index 1 originally)
            let supplierCell: Element;
            if (updatedTcElements.length >= 2) {
              supplierCell = updatedTcElements[1];
            } else {
              // Supplier cell is missing, create one by cloning labelCell
              supplierCell = labelCell.cloneNode(true) as Element;
              const tList = getElements(supplierCell, "t");
              tList.forEach(t => { t.textContent = ""; });
              // Insert before remarksCell
              row.insertBefore(supplierCell, remarksCell);
            }

            // Set Supplier 1 cell width (standard total supplier width is ~5660 dxa)
            const supplierWidth = Math.round(5660 / numSuppliers);
            const supWList = getElements(supplierCell, "tcW");
            if (supWList.length > 0) {
              supWList[0].setAttribute("w:w", String(supplierWidth));
              supWList[0].setAttribute("w:type", "dxa");
            }

            // 4. Clone for other suppliers
            for (let i = 2; i <= numSuppliers; i++) {
              const clonedCell = supplierCell.cloneNode(true) as Element;
              
              // Adjust width of cloned cell
              const clonedWList = getElements(clonedCell, "tcW");
              if (clonedWList.length > 0) {
                clonedWList[0].setAttribute("w:w", String(supplierWidth));
                clonedWList[0].setAttribute("w:type", "dxa");
              }

              // Recursively find and modify all text nodes in <w:t> elements
              const tElements = getElements(clonedCell, "t");
              tElements.forEach((tElem) => {
                if (tElem.textContent) {
                  let txt = tElem.textContent;
                  
                  // Replace supplier fields with safe negative-lookahead replacements
                  txt = txt.replace(/contact_no1/g, `contact_no${i}`);
                  txt = txt.replace(/shop_name1/g, `shop_name${i}`);
                  txt = txt.replace(/contact_person1/g, `contact_person${i}`);
                  txt = txt.replace(/work_duration1/g, `work_duration${i}`);
                  txt = txt.replace(/warranty1/g, `warranty${i}`);
                  txt = txt.replace(/payment_terms1/g, `payment_terms${i}`);
                  txt = txt.replace(/parts_shop1_price1/g, `parts_shop${i}_price${i}`);
                  txt = txt.replace(/total_shop1/g, `total_shop${i}`);
                  txt = txt.replace(/vat1/g, `vat${i}`);
                  txt = txt.replace(/total_amount1/g, `total_amount${i}`);
                  
                  // Safely replace "contact_no" only when not followed by a digit (avoiding contact_no22)
                  txt = txt.replace(/contact_no(?!\d)/g, `contact_no${i}`);
                  
                  tElem.textContent = txt;
                }
              });

              // Insert cloned cell exactly before remarksCell
              row.insertBefore(clonedCell, remarksCell);
            }
          }
        });

        // 3. Dynamically clone the items row for each part inside partsList
        const updatedRows = getElements(targetTable, "tr");
        const itemsRow = updatedRows.find((row) => {
          const rowXml = serializer.serializeToString(row);
          return rowXml.includes("parts1") || rowXml.includes("parts_shop1_price1");
        });

        const partsList = data.partsList;
        if (itemsRow && Array.isArray(partsList) && partsList.length > 0) {
          const parentTable = itemsRow.parentNode;
          if (parentTable) {
            partsList.forEach((part, partIdx) => {
              const clonedRow = itemsRow.cloneNode(true) as Element;
              const tElements = getElements(clonedRow, "t");
              tElements.forEach((tElem) => {
                if (tElem.textContent) {
                  let txt = tElem.textContent;
                  if (txt.includes("parts1")) {
                    txt = txt.replace(/parts1/g, `part_desc_${partIdx}`);
                  }
                  for (let i = 1; i <= numSuppliers; i++) {
                    const pricePlaceholder = `parts_shop${i}_price${i}`;
                    if (txt.includes(pricePlaceholder)) {
                      txt = txt.replace(new RegExp(pricePlaceholder, "g"), `part_price_${i}_${partIdx}`);
                    }
                  }
                  tElem.textContent = txt;
                }
              });
              parentTable.insertBefore(clonedRow, itemsRow);
            });
            parentTable.removeChild(itemsRow);
          }
        }
      }

      docXml = serializer.serializeToString(xmlDoc);
    }

    docXml = docXml.replace(/\{\{([^{}]*?)\}\}/g, (match) => {
      return match.replace(/<[^>]+>/g, "").replace(/\s+/g, "");
    });
    zip.file("word/document.xml", docXml);
  } else {
    let docXml = zip.files["word/document.xml"].asText();
    docXml = cleanSplitPlaceholders(docXml);
    if (templateName === "TIMESTAMP_TEMPLATE.docx") {
      docXml = docXml.replace(/timestamp_photo/g, "%timestamp_photo");
    }
    if (templateName === "PIS_TEMPLATE_WORD.docx") {
      const hasGross = !!data.HAS_GROSS;
      const hasEwt = !!data.HAS_EWT;
      const hasTotal = !!data.HAS_TOTAL;

      const grossIdx = docXml.indexOf("<w:t>GROSS</w:t>");
      if (grossIdx !== -1) {
        let firstTrStart = -1;
        let idx = docXml.lastIndexOf("<w:tr", grossIdx);
        while (idx !== -1) {
          const nextChar = docXml[idx + 5];
          if (nextChar === " " || nextChar === ">") {
            firstTrStart = idx;
            break;
          }
          idx = docXml.lastIndexOf("<w:tr", idx - 1);
        }
        const totalPlaceholderIdx = docXml.indexOf("{{TOTAL}", grossIdx);
        if (firstTrStart !== -1 && totalPlaceholderIdx !== -1) {
          const secondTrEnd = docXml.indexOf("</w:tr>", totalPlaceholderIdx);
          if (secondTrEnd !== -1) {
            const originalRowsXml = docXml.substring(firstTrStart, secondTrEnd + "</w:tr>".length);
            
            let replacementRows = "";
            const activeLabels: string[] = [];
            const activeValues: string[] = [];

            const grossLabelRun = `<w:r><w:rPr><w:b/><w:color w:val="0000FF"/><w:spacing w:val="-2"/><w:position w:val="1"/><w:sz w:val="20"/></w:rPr><w:t>GROSS</w:t></w:r>`;
            const ewtLabelRun = `<w:r><w:rPr><w:b/><w:color w:val="0000FF"/></w:rPr><w:t>EWT</w:t></w:r><w:r><w:rPr><w:b/><w:color w:val="0000FF"/><w:spacing w:val="-1"/></w:rPr><w:t xml:space="preserve"> </w:t></w:r><w:r><w:rPr><w:b/><w:color w:val="0000FF"/><w:spacing w:val="-4"/></w:rPr><w:t>(${data.EWT_PERCENTAGE || "1%"})</w:t></w:r>`;
            const totalLabelRun = `<w:r><w:rPr><w:b/><w:color w:val="0000FF"/><w:spacing w:val="-2"/></w:rPr><w:t>TOTAL</w:t></w:r>`;

            const grossValueRun = `<w:r><w:rPr><w:color w:val="0000FF"/><w:spacing w:val="-2"/><w:sz w:val="20"/></w:rPr><w:t>{{GROSS}}</w:t></w:r>`;
            const ewtValueRun = `<w:r><w:rPr><w:color w:val="0000FF"/><w:spacing w:val="-2"/><w:sz w:val="20"/></w:rPr><w:t>{{EWT}}</w:t></w:r>`;
            const totalValueRun = `<w:r><w:rPr><w:color w:val="0000FF"/><w:spacing w:val="-2"/><w:sz w:val="20"/></w:rPr><w:t>{{TOTAL}}</w:t></w:r>`;

            const tabRun = `<w:r><w:rPr><w:color w:val="0000FF"/></w:rPr><w:tab/></w:r>`;

            if (hasGross) {
              activeLabels.push(grossLabelRun);
              activeValues.push(grossValueRun);
            }
            if (hasEwt) {
              activeLabels.push(ewtLabelRun);
              activeValues.push(ewtValueRun);
            }
            if (hasTotal) {
              activeLabels.push(totalLabelRun);
              activeValues.push(totalValueRun);
            }

            if (activeLabels.length > 0) {
              const labelsBody = activeLabels.join(tabRun);
              const valuesBody = activeValues.join(tabRun);

              let tabsXml1 = "";
              let tabsXml2 = "";

              if (activeLabels.length === 3) {
                tabsXml1 = `<w:tabs><w:tab w:val="left" w:pos="1860"/><w:tab w:val="left" w:pos="3941"/></w:tabs>`;
                tabsXml2 = `<w:tabs><w:tab w:val="left" w:pos="1951"/><w:tab w:val="left" w:pos="3836"/></w:tabs>`;
              } else if (activeLabels.length === 2) {
                tabsXml1 = `<w:tabs><w:tab w:val="left" w:pos="2800"/></w:tabs>`;
                tabsXml2 = `<w:tabs><w:tab w:val="left" w:pos="2800"/></w:tabs>`;
              }

              const row1Start = `<w:tr w:rsidR="00B0063D"><w:trPr><w:trHeight w:val="270"/></w:trPr><w:tc><w:tcPr><w:tcW w:w="11013" w:type="dxa"/><w:tcBorders><w:top w:val="single" w:sz="8" w:space="0" w:color="000000"/><w:bottom w:val="single" w:sz="8" w:space="0" w:color="000000"/></w:tcBorders></w:tcPr><w:p><w:pPr><w:pStyle w:val="TableParagraph"/>` + tabsXml1 + `<w:spacing w:line="250" w:lineRule="exact"/><w:ind w:right="181"/><w:jc w:val="right"/><w:rPr><w:b/></w:rPr></w:pPr>`;
              const row2Start = `<w:tr w:rsidR="00B0063D"><w:trPr><w:trHeight w:val="270"/></w:trPr><w:tc><w:tcPr><w:tcW w:w="11013" w:type="dxa"/><w:tcBorders><w:top w:val="single" w:sz="8" w:space="0" w:color="000000"/><w:bottom w:val="single" w:sz="8" w:space="0" w:color="000000"/></w:tcBorders></w:tcPr><w:p><w:pPr><w:pStyle w:val="TableParagraph"/>` + tabsXml2 + `<w:spacing w:before="12" w:line="238" w:lineRule="exact"/><w:ind w:right="65"/><w:jc w:val="right"/><w:rPr><w:sz w:val="20"/></w:rPr></w:pPr>`;

              const row1Xml = row1Start + labelsBody + `</w:p></w:tc></w:tr>`;
              const row2Xml = row2Start + valuesBody + `</w:p></w:tc></w:tr>`;

              replacementRows = row1Xml + row2Xml;
            }

            docXml = docXml.replace(originalRowsXml, replacementRows);
          }
        }
      }
    }
    zip.file("word/document.xml", docXml);
  }

  // extract template placeholders
  const templatePlaceholders = extractDocxPlaceholders(zip);
  const sanitizedData = sanitizeRenderData(data);
  const items = sanitizedData.items || [];
  const warnings = validatePlaceholders(templatePlaceholders, sanitizedData, items);

  const modules: any[] = [];
  const hasImages = templateName === "TIMESTAMP_TEMPLATE.docx" || 
                    templateName === "UNLOADING_LOADING_TEMPLATE.docx" ||
                    data.timestamp_photo || 
                    data.LOADING_IMAGE || 
                    data.UNLOADING_IMAGE;

  if (hasImages) {
    const imageOptions = {
      centered: true,
      fileType: "docx",
      getImage(tagValue: any) {
        return base64Parser(tagValue);
      },
      getSize(imgValue: any, tagName: string) {
        if (tagName === "LOADING_IMAGE" || tagName === "UNLOADING_IMAGE") {
          return [450, 300];
        }
        return [500, 350];
      }
    };
    modules.push(new ImageModule(imageOptions));
  }

  const doc = new Docxtemplater(zip, {
    delimiters: { start: "{{", end: "}}" },
    paragraphLoop: true,
    linebreaks: true,
    modules: modules,
    nullGetter(part: any) {
      return "";
    }
  });

  console.log("Rendering docx with final data object:", JSON.stringify(sanitizedData, null, 2));

  doc.render(sanitizedData);

  const outBlob = doc.getZip().generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

  return { blob: outBlob, warnings };
}

// Helper to parse sheets from workbook.xml and workbook.xml.rels
interface SheetInfo {
  name: string;
  sheetId: string;
  rId: string;
  targetPath: string;
}

function parseSheets(zip: PizZip): SheetInfo[] {
  const sheets: SheetInfo[] = [];
  const workbookXmlStr = zip.file("xl/workbook.xml")?.asText();
  const workbookRelsStr = zip.file("xl/_rels/workbook.xml.rels")?.asText();
  if (!workbookXmlStr || !workbookRelsStr) return sheets;

  // 1. Parse relationship targets
  const rels: Record<string, string> = {};
  const relMatches = workbookRelsStr.match(/<Relationship\s+[^>]+>/g) || [];
  for (const relTag of relMatches) {
    const typeMatch = relTag.match(/Type="([^"]+)"/);
    if (typeMatch && typeMatch[1].includes("relationships/worksheet")) {
      const idMatch = relTag.match(/Id="([^"]+)"/);
      const targetMatch = relTag.match(/Target="([^"]+)"/);
      if (idMatch && targetMatch) {
        const id = idMatch[1];
        let target = targetMatch[1];
        if (!target.startsWith("xl/")) {
          target = "xl/" + target;
        }
        rels[id] = target;
      }
    }
  }

  // 2. Parse sheet info
  const sheetTags = workbookXmlStr.match(/<sheet\s+[^>]+>/g) || [];
  for (const sheetTag of sheetTags) {
    const nameMatch = sheetTag.match(/name="([^"]+)"/);
    const sheetIdMatch = sheetTag.match(/sheetId="([^"]+)"/);
    const rIdMatch = sheetTag.match(/r:id="([^"]+)"/) || sheetTag.match(/\brId="([^"]+)"/);
    if (nameMatch && sheetIdMatch && rIdMatch) {
      const name = nameMatch[1];
      const sheetId = sheetIdMatch[1];
      const rId = rIdMatch[1];
      const targetPath = rels[rId];
      if (targetPath) {
        sheets.push({ name, sheetId, rId, targetPath });
      }
    }
  }
  return sheets;
}

// Generate Excel Blob + HTML with exact same core engine
export async function generateXlsxBlob(
  templateName: string,
  data: Record<string, any>,
  itemsKey: string,
  items: any[]
): Promise<{ blob: Blob; html: string; warnings: string[] }> {
  const arrayBuffer = await fetchTemplateCached(templateName);

  if (
    templateName === "PIS_TEMPLATE.xlsm" ||
    templateName === "RFS_TEMPLATE.xlsm" ||
    templateName === "HAZWASTE_TEMPLATE.xlsm" ||
    templateName === "UNLOADING_LOADING_TEMPLATE.xlsm" ||
    templateName === "TIME_STAMP_TEMPLATE.xlsm" ||
    templateName === "WASTE_MOVEMENT_TEMPLATE.xlsm" ||
    templateName === "PO_TEMPLATE.xlsm" ||
    templateName === "WEEKLY_MANIFEST_TEMPLATE.xlsm"
  ) {
    console.log(`[PizZip High-Fidelity Bypass] Handling ${templateName} via direct XML/ZIP manipulation.`);
    const originalZip = new PizZip(arrayBuffer);
    
    // 1. Process sharedStrings.xml
    let sharedStringsXml = originalZip.file("xl/sharedStrings.xml")?.asText() || "";
    
    if (templateName === "PIS_TEMPLATE.xlsm") {
      sharedStringsXml = replacePlaceholdersInSharedStrings(sharedStringsXml, data);
      let sheet1Xml = originalZip.file("xl/worksheets/sheet1.xml")?.asText() || "";
      if (sheet1Xml) {
        // Collect all payment entries
        const paymentList: Array<{ poNumber: string; purpose: string; gross: string; ewt: string; total: string }> = [];

        if (Array.isArray(data.payments) && data.payments.length > 0) {
          data.payments.forEach((p: any) => {
            paymentList.push({
              poNumber: p.poNumber || p.po_no || p.poNo || "",
              purpose: p.paymentPurpose || p.purpose || "",
              gross: p.gross > 0 ? (typeof p.gross === "string" ? p.gross : String(p.gross)) : (p.grossStr || ""),
              ewt: p.ewt > 0 ? (typeof p.ewt === "string" ? p.ewt : String(p.ewt)) : (p.ewtStr || ""),
              total: p.total > 0 ? (typeof p.total === "string" ? p.total : String(p.total)) : (p.totalStr || "")
            });
          });
        } else {
          let idx = 1;
          while (
            data[`PAYMENT_PURPOSE_${idx}`] !== undefined ||
            data[`GROSS_${idx}`] !== undefined ||
            data[`EWT_${idx}`] !== undefined ||
            data[`TOTAL_${idx}`] !== undefined ||
            data[`PO_NO_${idx}`] !== undefined
          ) {
            const purpose = data[`PAYMENT_PURPOSE_${idx}`] || "";
            const gross = data[`GROSS_${idx}`] || "";
            const ewt = data[`EWT_${idx}`] || "";
            const total = data[`TOTAL_${idx}`] || "";
            const poNumber = data[`PO_NO_${idx}`] || "";
            if (purpose || gross || ewt || total || poNumber) {
              paymentList.push({ poNumber, purpose, gross, ewt, total });
            }
            idx++;
          }
        }

        if (paymentList.length === 0) {
          // Clear payment labels and cells entirely to hide section
          sheet1Xml = injectCellValue(sheet1Xml, "K14", "", true); // GROSS Label
          sheet1Xml = injectCellValue(sheet1Xml, "N14", "", true); // EWT Label
          sheet1Xml = injectCellValue(sheet1Xml, "U14", "", true); // TOTAL Label
          sheet1Xml = injectCellValue(sheet1Xml, "K15", "", true); // GROSS 1
          sheet1Xml = injectCellValue(sheet1Xml, "N15", "", true); // EWT 1
          sheet1Xml = injectCellValue(sheet1Xml, "U15", "", true); // TOTAL 1
          sheet1Xml = injectCellValue(sheet1Xml, "K16", "", true); // GROSS 2
          sheet1Xml = injectCellValue(sheet1Xml, "N16", "", true); // EWT 2
          sheet1Xml = injectCellValue(sheet1Xml, "U16", "", true); // TOTAL 2
          sheet1Xml = injectCellValue(sheet1Xml, "K17", "", true); // GROSS 3
          sheet1Xml = injectCellValue(sheet1Xml, "N17", "", true); // EWT 3
          sheet1Xml = injectCellValue(sheet1Xml, "U17", "", true); // TOTAL 3
        } else {
          const totalPayments = paymentList.length;

          // If more than 4 payments, shift footer rows (>= 19) down by (totalPayments - 4)
          if (totalPayments > 4) {
            const shiftCount = totalPayments - 4;
            sheet1Xml = sheet1Xml.replace(/<row\s+([^>]*?)\br="(\d+)"/g, (match, p1, rStr) => {
              const rVal = parseInt(rStr, 10);
              if (rVal >= 19) {
                return `<row ${p1}r="${rVal + shiftCount}"`;
              }
              return match;
            });
            sheet1Xml = sheet1Xml.replace(/<c\s+([^>]*?)\br="([A-Z]+)(\d+)"/g, (match, p1, col, rStr) => {
              const rVal = parseInt(rStr, 10);
              if (rVal >= 19) {
                return `<c ${p1}r="${col}${rVal + shiftCount}"`;
              }
              return match;
            });
            sheet1Xml = sheet1Xml.replace(/<mergeCell\s+ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/g, (match, col1, r1Str, col2, r2Str) => {
              const r1 = parseInt(r1Str, 10);
              const r2 = parseInt(r2Str, 10);
              if (r1 >= 19 && r2 >= 19) {
                return `<mergeCell ref="${col1}${r1 + shiftCount}:${col2}${r2 + shiftCount}"/>`;
              }
              return match;
            });

            const createEmptyRowXml = (r: number) =>
              `<row r="${r}" spans="1:21"><c r="A${r}" s="2"/><c r="B${r}" s="2"/><c r="C${r}" s="2"/><c r="D${r}" s="2"/><c r="E${r}" s="2"/><c r="F${r}" s="2"/><c r="G${r}" s="2"/><c r="H${r}" s="66"/><c r="I${r}" s="66"/><c r="J${r}" s="2"/><c r="K${r}" s="2"/><c r="L${r}" s="2"/><c r="M${r}" s="2"/><c r="N${r}" s="2"/><c r="O${r}" s="2"/><c r="P${r}" s="2"/><c r="Q${r}" s="2"/><c r="R${r}" s="2"/><c r="S${r}" s="2"/><c r="T${r}" s="2"/><c r="U${r}" s="2"/></row>`;

            let newRowsXml = "";
            for (let r = 19; r <= 18 + shiftCount; r++) {
              newRowsXml += createEmptyRowXml(r);
            }

            const targetRowTag = `<row r="${19 + shiftCount}"`;
            sheet1Xml = sheet1Xml.replace(targetRowTag, newRowsXml + targetRowTag);
          }

          // Inject payment values into rows 15 to 14 + totalPayments
          for (let i = 0; i < totalPayments; i++) {
            const rowNum = 15 + i;
            const entry = paymentList[i];

            if (rowNum === 15) {
              if (entry.poNumber) sheet1Xml = injectCellValue(sheet1Xml, "A15", entry.poNumber, true);
              sheet1Xml = injectCellValue(sheet1Xml, "B15", entry.purpose || "", true);
              sheet1Xml = injectCellValue(sheet1Xml, "K15", entry.gross || "", true);
              sheet1Xml = injectCellValue(sheet1Xml, "N15", entry.ewt || "", true);
              sheet1Xml = injectCellValue(sheet1Xml, "U15", entry.total || "", true);
            } else if (rowNum === 16) {
              if (entry.poNumber) sheet1Xml = injectCellValue(sheet1Xml, "A16", entry.poNumber, true);
              sheet1Xml = injectCellValue(sheet1Xml, "B16", entry.purpose || "", true);
              sheet1Xml = injectCellValue(sheet1Xml, "K16", entry.gross || "", true);
              sheet1Xml = injectCellValue(sheet1Xml, "N16", entry.ewt || "", true);
              sheet1Xml = injectCellValue(sheet1Xml, "U16", entry.total || "", true);
            } else if (rowNum === 17) {
              if (entry.poNumber) sheet1Xml = injectCellValue(sheet1Xml, "A17", entry.poNumber, true);
              sheet1Xml = injectCellValue(sheet1Xml, "B17", entry.purpose || "", true);
              sheet1Xml = injectCellValue(sheet1Xml, "K17", entry.gross || "", true);
              sheet1Xml = injectCellValue(sheet1Xml, "N17", entry.ewt || "", true);
              sheet1Xml = injectCellValue(sheet1Xml, "U17", entry.total || "", true);
            } else {
              sheet1Xml = injectCellValue(sheet1Xml, `A${rowNum}`, entry.poNumber || "", true);
              sheet1Xml = injectCellValue(sheet1Xml, `C${rowNum}`, entry.purpose || "", true);
              sheet1Xml = injectCellValue(sheet1Xml, `K${rowNum}`, entry.gross || "", true);
              sheet1Xml = injectCellValue(sheet1Xml, `N${rowNum}`, entry.ewt || "", true);
              sheet1Xml = injectCellValue(sheet1Xml, `T${rowNum}`, entry.total || "", true);
              sheet1Xml = injectCellValue(sheet1Xml, `U${rowNum}`, entry.total || "", true);
            }
          }
        }
        originalZip.file("xl/worksheets/sheet1.xml", sheet1Xml);
      }
    } else if (templateName === "UNLOADING_LOADING_TEMPLATE.xlsm") {
      // 1. Replacements in sharedStrings.xml
      sharedStringsXml = sharedStringsXml.replace(/\{\{CONTROL_NO\}\}/g, data.CONTROL_NO || data.CA_NO || "");
      sharedStringsXml = sharedStringsXml.replace(/\{\{CA_NO\}\}/g, data.CA_NO || data.CONTROL_NO || "");
      if (data.SUBJECT_HEADER !== undefined) {
        sharedStringsXml = sharedStringsXml.replace(/\{\{SUBJECT_HEADER\}\}/g, data.SUBJECT_HEADER);
      }
      if (data.LOADING_TITLE !== undefined) {
        sharedStringsXml = sharedStringsXml.replace(/\{\{LOADING_TITLE\}\}/g, data.LOADING_TITLE);
      }
      if (data.UNLOADING_TITLE !== undefined) {
        sharedStringsXml = sharedStringsXml.replace(/\{\{UNLOADING_TITLE\}\}/g, data.UNLOADING_TITLE);
      }
      if (data.LOADING_DESCRIPTION !== undefined) {
        sharedStringsXml = sharedStringsXml.replace(/\{\{LOADING_DESCRIPTION\}\}/g, data.LOADING_DESCRIPTION);
      }
      if (data.UNLOADING_DESCRIPTION !== undefined) {
        sharedStringsXml = sharedStringsXml.replace(/\{\{UNLOADING_DESCRIPTION\}\}/g, data.UNLOADING_DESCRIPTION);
      }
      
      // Clear the image placeholder text from displaying in cells on top of images
      sharedStringsXml = sharedStringsXml.replace(/\{\{LOADING_IMAGE\}\}/g, "");
      sharedStringsXml = sharedStringsXml.replace(/\{\{UNLOADING_IMAGE\}\}/g, "");

      // 2. Inject images to xl/media/
      const FALLBACK_1X1_PNG = "iVBOR00KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
      
      let loadingBase64 = FALLBACK_1X1_PNG;
      if (data.LOADING_IMAGE && data.LOADING_IMAGE.includes("base64,")) {
        loadingBase64 = data.LOADING_IMAGE.split("base64,")[1];
      }
      
      let unloadingBase64 = FALLBACK_1X1_PNG;
      if (data.UNLOADING_IMAGE && data.UNLOADING_IMAGE.includes("base64,")) {
        unloadingBase64 = data.UNLOADING_IMAGE.split("base64,")[1];
      }

      // Convert base64 to Uint8Array/Buffer so that PizZip can write it as binary
      const loadingBuffer = typeof Buffer !== "undefined" 
        ? Buffer.from(loadingBase64, "base64") 
        : Uint8Array.from(atob(loadingBase64), c => c.charCodeAt(0));
        
      const unloadingBuffer = typeof Buffer !== "undefined" 
        ? Buffer.from(unloadingBase64, "base64") 
        : Uint8Array.from(atob(unloadingBase64), c => c.charCodeAt(0));

      originalZip.file("xl/media/image2.png", loadingBuffer);
      originalZip.file("xl/media/image3.png", unloadingBuffer);

      // 3. Inject relationships to xl/drawings/_rels/drawing1.xml.rels
      let drawingRelsXml = originalZip.file("xl/drawings/_rels/drawing1.xml.rels")?.asText() || "";
      if (drawingRelsXml && !drawingRelsXml.includes("rIdImg1")) {
        const rel1 = `<Relationship Id="rIdImg1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image2.png"/>`;
        const rel2 = `<Relationship Id="rIdImg2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image3.png"/>`;
        drawingRelsXml = drawingRelsXml.replace("</Relationships>", `${rel1}${rel2}</Relationships>`);
        originalZip.file("xl/drawings/_rels/drawing1.xml.rels", drawingRelsXml);
      }

      // 4. Inject picture elements to xl/drawings/drawing1.xml
      let drawingXml = originalZip.file("xl/drawings/drawing1.xml")?.asText() || "";
      if (drawingXml && !drawingXml.includes("LoadingPhoto")) {
        const loadingPicAnchor = `
          <xdr:twoCellAnchor editAs="oneCell">
            <xdr:from>
              <xdr:col>3</xdr:col>
              <xdr:colOff>0</xdr:colOff>
              <xdr:row>30</xdr:row>
              <xdr:rowOff>0</xdr:rowOff>
            </xdr:from>
            <xdr:to>
              <xdr:col>8</xdr:col>
              <xdr:colOff>0</xdr:colOff>
              <xdr:row>44</xdr:row>
              <xdr:rowOff>0</xdr:rowOff>
            </xdr:to>
            <xdr:pic>
              <xdr:nvPicPr>
                <xdr:cNvPr id="1001" name="LoadingPhoto"/>
                <xdr:cNvPicPr>
                  <a:picLocks noChangeAspect="1"/>
                </xdr:cNvPicPr>
              </xdr:nvPicPr>
              <xdr:blipFill>
                <a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rIdImg1"/>
                <a:stretch>
                  <a:fillRect/>
                </a:stretch>
              </xdr:blipFill>
              <xdr:spPr>
                <a:xfrm>
                  <a:off x="0" y="0"/>
                  <a:ext cx="0" cy="0"/>
                </a:xfrm>
                <a:prstGeom prst="rect">
                  <a:avLst/>
                </a:prstGeom>
              </xdr:spPr>
            </xdr:pic>
            <xdr:clientData/>
          </xdr:twoCellAnchor>
        `;

        const unloadingPicAnchor = `
          <xdr:twoCellAnchor editAs="oneCell">
            <xdr:from>
              <xdr:col>3</xdr:col>
              <xdr:colOff>0</xdr:colOff>
              <xdr:row>59</xdr:row>
              <xdr:rowOff>0</xdr:rowOff>
            </xdr:from>
            <xdr:to>
              <xdr:col>8</xdr:col>
              <xdr:colOff>0</xdr:colOff>
              <xdr:row>73</xdr:row>
              <xdr:rowOff>0</xdr:rowOff>
            </xdr:to>
            <xdr:pic>
              <xdr:nvPicPr>
                <xdr:cNvPr id="1002" name="UnloadingPhoto"/>
                <xdr:cNvPicPr>
                  <a:picLocks noChangeAspect="1"/>
                </xdr:cNvPicPr>
              </xdr:nvPicPr>
              <xdr:blipFill>
                <a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rIdImg2"/>
                <a:stretch>
                  <a:fillRect/>
                </a:stretch>
              </xdr:blipFill>
              <xdr:spPr>
                <a:xfrm>
                  <a:off x="0" y="0"/>
                  <a:ext cx="0" cy="0"/>
                </a:xfrm>
                <a:prstGeom prst="rect">
                  <a:avLst/>
                </a:prstGeom>
              </xdr:spPr>
            </xdr:pic>
            <xdr:clientData/>
          </xdr:twoCellAnchor>
        `;

        drawingXml = drawingXml.replace("</xdr:wsDr>", `${loadingPicAnchor}${unloadingPicAnchor}</xdr:wsDr>`);
        originalZip.file("xl/drawings/drawing1.xml", drawingXml);
      }
    } else if (templateName === "HAZWASTE_TEMPLATE.xlsm") {
      const firstItem = items[0] || {};
      
      // Replace general placeholders (CLIENT, MANIFEST, QUANTITY, DATE, MRR_NO, PREPARED_BY, etc.)
      sharedStringsXml = replacePlaceholdersInSharedStrings(sharedStringsXml, data);
      
      let sheet13Xml = originalZip.file("xl/worksheets/sheet13.xml")?.asText() || "";
      
      // Helper to ensure numeric values are written as true Excel numbers (not text) with no unnecessary decimal formatting
      const cleanNumeric = (val: any): any => {
        if (val === undefined || val === null || val === "" || isNaN(Number(val))) {
          return "";
        }
        return Number(val);
      };

      // Inject Item 1 in sheet13.xml (Row 7)
      const firstClass = firstItem.classification || "104";
      const firstDesc = firstItem.description || "";
      const firstQty = firstItem.qty !== undefined ? cleanNumeric(firstItem.qty) : "";
      const firstPct = firstItem.percentage !== undefined ? cleanNumeric(firstItem.percentage) / 100 : "";
      const firstHw = firstItem.haz_waste !== undefined ? cleanNumeric(firstItem.haz_waste) : "";
      const firstLt = firstItem.local_tsd !== undefined ? cleanNumeric(firstItem.local_tsd) : "";
      const firstNh = firstItem.non_haz !== undefined ? cleanNumeric(firstItem.non_haz) : "";
      const firstRem = firstItem.remarks || "";

      sheet13Xml = injectCellValue(sheet13Xml, "A7", firstClass, true); // Classification
      sheet13Xml = injectCellValue(sheet13Xml, "B7", firstDesc, true); // Description
      sheet13Xml = injectCellValue(sheet13Xml, "C7", firstQty, false); // Qty
      sheet13Xml = injectCellValue(sheet13Xml, "D7", firstPct, false); // Percentage
      sheet13Xml = injectCellValue(sheet13Xml, "E7", firstHw, false); // Haz Waste
      sheet13Xml = injectCellValue(sheet13Xml, "F7", firstLt, false); // Local TSD
      sheet13Xml = injectCellValue(sheet13Xml, "G7", firstNh, false); // Non Haz
      sheet13Xml = injectCellValue(sheet13Xml, "H7", firstRem, true); // Remarks

      // Inject Item 2 to 11 in sheet13.xml (Rows 8 to 17)
      for (let i = 1; i < 11; i++) {
        const rowNum = 7 + i;
        const item = items[i];
        
        const itemClass = item ? (item.classification || "104") : "";
        const desc = item ? (item.description || "") : "";
        const qty = item ? cleanNumeric(item.qty) : "";
        const pct = item ? (item.percentage !== undefined ? cleanNumeric(item.percentage) / 100 : "") : "";
        const hw = item ? cleanNumeric(item.haz_waste) : "";
        const lt = item ? cleanNumeric(item.local_tsd) : "";
        const nh = item ? cleanNumeric(item.non_haz) : "";
        const rem = item ? (item.remarks || "") : "";

        sheet13Xml = injectCellValue(sheet13Xml, `A${rowNum}`, itemClass, true); // Classification
        sheet13Xml = injectCellValue(sheet13Xml, `B${rowNum}`, desc, true); // Description
        sheet13Xml = injectCellValue(sheet13Xml, `C${rowNum}`, qty, false); // Qty
        sheet13Xml = injectCellValue(sheet13Xml, `D${rowNum}`, pct, false); // Percentage
        sheet13Xml = injectCellValue(sheet13Xml, `E${rowNum}`, hw, false); // Haz Waste
        sheet13Xml = injectCellValue(sheet13Xml, `F${rowNum}`, lt, false); // Local TSD
        sheet13Xml = injectCellValue(sheet13Xml, `G${rowNum}`, nh, false); // Non Haz
        sheet13Xml = injectCellValue(sheet13Xml, `H${rowNum}`, rem, true); // Remarks
      }

      // Inject Totals directly as numeric values into sheet13.xml to avoid string formatting issues
      sheet13Xml = injectCellValue(sheet13Xml, "C18", cleanNumeric(data.TOTAL_QTY), false);
      sheet13Xml = injectCellValue(sheet13Xml, "E18", cleanNumeric(data.TOTAL_HAZ_WASTE), false);
      sheet13Xml = injectCellValue(sheet13Xml, "F18", cleanNumeric(data.TOTAL_LOCAL_TSD), false);
      sheet13Xml = injectCellValue(sheet13Xml, "G18", cleanNumeric(data.TOTAL_NON_HAZ), false);

      originalZip.file("xl/worksheets/sheet13.xml", sheet13Xml);

      // Remove calculation chain to prevent corrupt formula chain repair warning in Excel
      originalZip.remove("xl/calcChain.xml");
      let workbookRelsXml = originalZip.file("xl/_rels/workbook.xml.rels")?.asText() || "";
      workbookRelsXml = workbookRelsXml.replace(/<Relationship[^>]+Type="[^"]+calcChain"[^>]*\/>/g, "");
      originalZip.file("xl/_rels/workbook.xml.rels", workbookRelsXml);
    } else if (templateName === "TIME_STAMP_TEMPLATE.xlsm") {
      // 1. Leave worksheet sheet1.xml clean without injecting metadata into lower cells (rows 41-50)

      // 2. Inject image to xl/media/
      const FALLBACK_1X1_PNG = "iVBOR00KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
      let timestampBase64 = FALLBACK_1X1_PNG;
      if (data.timestamp_photo && data.timestamp_photo.includes("base64,")) {
        timestampBase64 = data.timestamp_photo.split("base64,")[1];
      } else if (data.photoData && data.photoData.includes("base64,")) {
        timestampBase64 = data.photoData.split("base64,")[1];
      }

      const imgBuffer = typeof Buffer !== "undefined"
        ? Buffer.from(timestampBase64, "base64")
        : Uint8Array.from(atob(timestampBase64), c => c.charCodeAt(0));

      originalZip.file("xl/media/image2.png", imgBuffer);

      // Ensure [Content_Types].xml has PNG and JPEG image content types to prevent Excel repair warning
      let contentTypesXml = originalZip.file("[Content_Types].xml")?.asText() || "";
      if (contentTypesXml && !contentTypesXml.includes('Extension="png"')) {
        contentTypesXml = contentTypesXml.replace(
          '</Types>',
          '  <Default Extension="png" ContentType="image/png"/>\n  <Default Extension="jpeg" ContentType="image/jpeg"/>\n  <Default Extension="jpg" ContentType="image/jpeg"/>\n</Types>'
        );
        originalZip.file("[Content_Types].xml", contentTypesXml);
      }

      // 3. Create or update drawings relationship file: xl/drawings/_rels/drawing1.xml.rels
      let drawingRelsXml = originalZip.file("xl/drawings/_rels/drawing1.xml.rels")?.asText() || "";
      if (!drawingRelsXml) {
        drawingRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdImg1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image2.png"/>
</Relationships>`;
      } else if (!drawingRelsXml.includes('Id="rIdImg1"')) {
        drawingRelsXml = drawingRelsXml.replace(
          '</Relationships>',
          '  <Relationship Id="rIdImg1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image2.png"/>\n</Relationships>'
        );
      }
      originalZip.file("xl/drawings/_rels/drawing1.xml.rels", drawingRelsXml);

      // 4. Replace Rectangle 3 containing {{TIMESTAMP_IMAGE}} in xl/drawings/drawing1.xml with the exact original picture anchor
      let drawingXml = originalZip.file("xl/drawings/drawing1.xml")?.asText() || "";
      if (drawingXml) {
        if (!drawingXml.includes("xmlns:r=")) {
          drawingXml = drawingXml.replace(
            '<xdr:wsDr ',
            '<xdr:wsDr xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
          );
        }
        const imageAnchorRegex = /<xdr:twoCellAnchor>[^]*?\{\{TIMESTAMP_IMAGE\}\}[^]*?<\/xdr:twoCellAnchor>/g;
        const timestampPicAnchor = `
          <xdr:twoCellAnchor editAs="oneCell">
            <xdr:from>
              <xdr:col>0</xdr:col>
              <xdr:colOff>0</xdr:colOff>
              <xdr:row>5</xdr:row>
              <xdr:rowOff>133350</xdr:rowOff>
            </xdr:from>
            <xdr:to>
              <xdr:col>9</xdr:col>
              <xdr:colOff>723900</xdr:colOff>
              <xdr:row>15</xdr:row>
              <xdr:rowOff>0</xdr:rowOff>
            </xdr:to>
            <xdr:pic>
              <xdr:nvPicPr>
                <xdr:cNvPr id="1001" name="TimestampPhoto"/>
                <xdr:cNvPicPr>
                  <a:picLocks noChangeAspect="1"/>
                </xdr:cNvPicPr>
              </xdr:nvPicPr>
              <xdr:blipFill>
                <a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rIdImg1"/>
                <a:stretch>
                  <a:fillRect/>
                </a:stretch>
              </xdr:blipFill>
              <xdr:spPr>
                <a:xfrm>
                  <a:off x="0" y="0"/>
                  <a:ext cx="0" cy="0"/>
                </a:xfrm>
                <a:prstGeom prst="rect">
                  <a:avLst/>
                </a:prstGeom>
              </xdr:spPr>
            </xdr:pic>
            <xdr:clientData/>
          </xdr:twoCellAnchor>
        `;
        drawingXml = drawingXml.replace(imageAnchorRegex, timestampPicAnchor);
        originalZip.file("xl/drawings/drawing1.xml", drawingXml);
      }
    } else if (templateName === "WASTE_MOVEMENT_TEMPLATE.xlsm") {
      sharedStringsXml = replacePlaceholdersInSharedStrings(sharedStringsXml, data);
      
      // Remove calculation chain to prevent corrupt formula chain repair warning in Excel
      originalZip.remove("xl/calcChain.xml");
      let workbookRelsXml = originalZip.file("xl/_rels/workbook.xml.rels")?.asText() || "";
      workbookRelsXml = workbookRelsXml.replace(/<Relationship[^>]+Type="[^"]+calcChain"[^>]*\/>/g, "");
      originalZip.file("xl/_rels/workbook.xml.rels", workbookRelsXml);
    } else if (templateName === "PO_TEMPLATE.xlsm") {
      sharedStringsXml = replacePlaceholdersInSharedStrings(sharedStringsXml, data);
    } else if (templateName === "WEEKLY_MANIFEST_TEMPLATE.xlsm") {
      const recordsForSum = (items && items.length > 0) ? items : (data._records || []);
      if (data.TOTAL_QTY === undefined || data.TOTAL_QTY === null || data.TOTAL_QTY === "") {
        const sumKg = recordsForSum.reduce((sum: number, rec: any) => {
          if (rec && rec.quantity !== undefined && rec.quantity !== null && !isNaN(Number(rec.quantity))) {
            return sum + Number(rec.quantity) * 1000;
          }
          return sum;
        }, 0);
        const formatted = Number.isInteger(sumKg)
          ? sumKg.toLocaleString("en-US")
          : sumKg.toLocaleString("en-US", { maximumFractionDigits: 3 });
        data.TOTAL_QTY = formatted;
        data.TOTAL_QUANTITY = formatted;
        data.SUM_QTY = formatted;
      }
      sharedStringsXml = replacePlaceholdersInSharedStrings(sharedStringsXml, data);

      // 1. Fix style 19 alignment in styles.xml (Quantity cells) to right alignment
      let stylesXml = originalZip.file("xl/styles.xml")?.asText() || "";
      if (stylesXml) {
        stylesXml = stylesXml.replace(
          `<xf numFmtId="43" fontId="14" fillId="0" borderId="0" xfId="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>`,
          `<xf numFmtId="43" fontId="14" fillId="0" borderId="0" xfId="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>`
        );
        originalZip.file("xl/styles.xml", stylesXml);
      }

      // Helper function for date formatting
      const formatWeeklyDate = (dateStr: string | undefined | null): string => {
        if (!dateStr || !String(dateStr).trim()) return "";
        let str = String(dateStr).trim();
        const matchDdMmmYy = str.match(/^(\d{1,2})[-/ ]([A-Za-z]{3})[-/ ](\d{2,4})$/);
        if (matchDdMmmYy) {
          const day = matchDdMmmYy[1].padStart(2, "0");
          const m = matchDdMmmYy[2];
          const month = m.charAt(0).toUpperCase() + m.slice(1, 3).toLowerCase();
          const yr = matchDdMmmYy[3].slice(-2);
          return `${day}-${month}-${yr}`;
        }
        const d = new Date(str);
        if (!isNaN(d.getTime())) {
          const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          const day = String(d.getDate()).padStart(2, "0");
          const month = months[d.getMonth()];
          const year = String(d.getFullYear()).slice(-2);
          return `${day}-${month}-${year}`;
        }
        return str;
      };

      // 2. Process records in sheet1.xml
      let sheet1Xml = originalZip.file("xl/worksheets/sheet1.xml")?.asText() || "";
      if (sheet1Xml) {
        const records = (items && items.length > 0) ? items : (data._records || []);
        const totalRecords = records.length;
        const maxRow = 27 + Math.max(6, totalRecords);
        const overflow = totalRecords > 21 ? totalRecords - 21 : 0;

        if (overflow > 0) {
          // Shift rows 49+ down by overflow
          sheet1Xml = sheet1Xml.replace(/<row r="(\d+)"([^>]*)>/g, (match, rNumStr, rest) => {
            const rNum = parseInt(rNumStr);
            if (rNum >= 49) {
              return `<row r="${rNum + overflow}"${rest}>`;
            }
            return match;
          });

          // Shift cell references in rows 49+
          sheet1Xml = sheet1Xml.replace(/<c r="([A-Z]+)(\d+)"/g, (match, col, rNumStr) => {
            const rNum = parseInt(rNumStr);
            if (rNum >= 49) {
              return `<c r="${col}${rNum + overflow}"`;
            }
            return match;
          });

          // Update SUM formula range
          sheet1Xml = sheet1Xml.replace(/SUM\(G28:G50\)/g, `SUM(G28:G${27 + totalRecords})`);

          // Update print area in workbook.xml
          let wbXml = originalZip.file("xl/workbook.xml")?.asText() || "";
          if (wbXml) {
            wbXml = wbXml.replace(/\$B\$1:\$J\$60/g, `$B$1:$J$${60 + overflow}`);
            originalZip.file("xl/workbook.xml", wbXml);
          }
        }

        for (let r = 28; r <= maxRow; r++) {
          const idx = r - 28;
          const rec = records[idx];

          const rowRegex = new RegExp(`<row r="${r}"[^>]*>[\\s\\S]*?<\\/row>`);
          const rowMatch = sheet1Xml.match(rowRegex);

          const comp = rec ? escapeXml(rec.companyName || "") : "";
          const dateStr = rec ? escapeXml(formatWeeklyDate(rec.deliveryDate || rec.haulingDate || rec.transportDate)) : "";
          const tp = rec ? escapeXml(rec.tpNumber || "") : "";
          const ctrl = rec ? escapeXml(rec.controlNo || "") : "";
          const mf = rec ? escapeXml(rec.manifestNo || "") : "";

          let qtyXml = `<c r="G${r}" s="19" t="inlineStr"><is><t>-</t></is></c>`;
          if (rec && rec.quantity !== undefined && rec.quantity !== null && rec.quantity !== "" && !isNaN(Number(rec.quantity))) {
            const qtyKg = Number((Number(rec.quantity) * 1000).toFixed(3));
            qtyXml = `<c r="G${r}" s="19"><v>${qtyKg}</v></c>`;
          }

          const newRowXml = `<row r="${r}" spans="3:47" s="1" customFormat="1" ht="60.75" customHeight="1">` +
            `<c r="C${r}" s="15" t="s"><v>69</v></c>` + // Description fixed to "Waste Electrical & Electronic Equipment"
            `<c r="D${r}" s="16" t="inlineStr"><is><t>${comp}</t></is></c>` +
            `<c r="E${r}" s="17" t="inlineStr"><is><t>${dateStr}</t></is></c>` +
            `<c r="F${r}" s="18" t="inlineStr"><is><t>${tp}</t></is></c>` +
            `${qtyXml}` +
            `<c r="H${r}" s="20" t="inlineStr"><is><t>${ctrl}</t></is></c>` +
            `<c r="I${r}" s="20" t="inlineStr"><is><t>${mf}</t></is></c>` +
            `<c r="L${r}" s="2"/><c r="M${r}" s="2"/><c r="N${r}" s="2"/>` +
            `</row>`;

          if (rowMatch) {
            sheet1Xml = sheet1Xml.replace(rowRegex, newRowXml);
          } else {
            const prevRowRegex = new RegExp(`<row r="${r - 1}"[^>]*>[\\s\\S]*?<\\/row>`);
            const prevMatch = sheet1Xml.match(prevRowRegex);
            if (prevMatch) {
              sheet1Xml = sheet1Xml.replace(prevRowRegex, `${prevMatch[0]}\n${newRowXml}`);
            }
          }
        }

        originalZip.file("xl/worksheets/sheet1.xml", sheet1Xml);
      }
    } else {
      // RFS_TEMPLATE.xlsm
      // We substitute Item 1 in shared strings
      const item1 = items[0] || {};
      const item1Desc = item1.description || item1.item || "";
      const isItem1Italic = item1.isItalic || item1Desc === "*****NOTHING FOLLOWS*****";

      const rfsData = {
        ...data,
        QTY: item1.quantity !== undefined ? item1.quantity : "",
        UNIT: item1.unit || "",
        ITEM_DESCRIPTION: item1Desc,
        REMARKS: item1.remarks || ""
      };

      if (isItem1Italic && item1Desc) {
        sharedStringsXml = sharedStringsXml.replace(
          /<si><t>\{\{ITEM_DESCRIPTION\}\}<\/t><\/si>/g,
          `<si><r><rPr><i/></rPr><t>${escapeXml(item1Desc)}</t></r></si>`
        );
      }
      sharedStringsXml = replacePlaceholdersInSharedStrings(sharedStringsXml, rfsData);
      
      // Inject Item 2 to 12 in sheet1.xml
      let sheet1Xml = originalZip.file("xl/worksheets/sheet1.xml")?.asText() || "";
      for (let i = 1; i < 12; i++) {
        const rowNum = 13 + i;
        const item = items[i];
        const qty = item ? (item.quantity ?? "") : "";
        const unit = item ? (item.unit ?? "") : "";
        const desc = item ? (item.description || item.item || "") : "";
        const rem = item ? (item.remarks ?? "") : "";
        const isItalic = item ? (item.isItalic || desc === "*****NOTHING FOLLOWS*****") : false;

        sheet1Xml = injectCellValue(sheet1Xml, `I${rowNum}`, qty, false); // Qty
        sheet1Xml = injectCellValue(sheet1Xml, `K${rowNum}`, unit, true); // Unit
        sheet1Xml = injectCellValue(sheet1Xml, `M${rowNum}`, desc, true, isItalic); // Desc
        sheet1Xml = injectCellValue(sheet1Xml, `BB${rowNum}`, rem, true); // Remarks
      }
      originalZip.file("xl/worksheets/sheet1.xml", sheet1Xml);
    }
    
    originalZip.file("xl/sharedStrings.xml", sharedStringsXml);
    
    const finalBuffer = originalZip.generate({ type: "uint8array" });
    const outBlob = originalZip.generate({
      type: "blob",
      mimeType: "application/vnd.ms-excel.sheet.macroEnabled.12",
    });
    
    // Load for preview
    const previewWorkbook = new ExcelJS.Workbook();
    await previewWorkbook.xlsx.load(finalBuffer);
    const html = convertExcelToHtml(previewWorkbook);
    
    return {
      blob: outBlob,
      html,
      warnings: []
    };
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const templatePlaceholders = extractXlsxPlaceholders(workbook);
  const warnings = validatePlaceholders(templatePlaceholders, data, items);

  // Applycloning logic
  if (templateName === "CANVASS_TEMPLATE.xlsx") {
    const ws = workbook.worksheets[0];
    resolveSharedFormulas(ws);

    const shops = data.shops || [
      {
        name: data.SUPPLIER_NAME || "Supplier A",
        contact_person: data.CONTACT || "",
        contact_no: data.PHONE || "",
        work_duration: "",
        warranty: "",
        payment_terms: "",
        prices: items.map(it => it.supplierAPrice || 0),
        total: items.reduce((sum, it) => sum + ((it.supplierAPrice || 0) * (it.quantity || 0)), 0),
        vat: 0,
        total_amount: items.reduce((sum, it) => sum + ((it.supplierAPrice || 0) * (it.quantity || 0)), 0)
      },
      {
        name: "Supplier B",
        contact_person: "",
        contact_no: "",
        work_duration: "",
        warranty: "",
        payment_terms: "",
        prices: items.map(it => it.supplierBPrice || 0),
        total: items.reduce((sum, it) => sum + ((it.supplierBPrice || 0) * (it.quantity || 0)), 0),
        vat: 0,
        total_amount: items.reduce((sum, it) => sum + ((it.supplierBPrice || 0) * (it.quantity || 0)), 0)
      },
      {
        name: "Supplier C",
        contact_person: "",
        contact_no: "",
        work_duration: "",
        warranty: "",
        payment_terms: "",
        prices: items.map(it => it.supplierCPrice || 0),
        total: items.reduce((sum, it) => sum + ((it.supplierCPrice || 0) * (it.quantity || 0)), 0),
        vat: 0,
        total_amount: items.reduce((sum, it) => sum + ((it.supplierCPrice || 0) * (it.quantity || 0)), 0)
      }
    ];

    const N = shops.length;

    // Col cloner
    if (N > 2) {
      for (let s = 2; s < N; s++) {
        const targetColIdx = 5 + s;
        ws.spliceColumns(targetColIdx, 0, []);
        ws.getColumn(targetColIdx).width = ws.getColumn(6).width;

        for (let r = 1; r <= ws.rowCount; r++) {
          const fromCell = ws.getRow(r).getCell(6);
          const toCell = ws.getRow(r).getCell(targetColIdx);
          toCell.style = JSON.parse(JSON.stringify(fromCell.style || {}));
          
          const val = fromCell.value;
          if (typeof val === "string") {
            const newVal = val.replace(/_name2\}\}/g, `_name${s + 1}}}`)
                            .replace(/_person2\}\}/g, `_person${s + 1}}}`)
                            .replace(/_no2\}\}/g, `_no${s + 1}}}`)
                            .replace(/_duration2\}\}/g, `_duration${s + 1}}}`)
                            .replace(/_terms2\}\}/g, `_terms${s + 1}}}`)
                            .replace(/_price2\}\}/g, `_price${s + 1}}}`)
                            .replace(/_shop2\}\}/g, `_shop${s + 1}}}`)
                            .replace(/_amount2\}\}/g, `_amount${s + 1}}}`)
                            .replace(/_warranty2\}\}/g, `_warranty${s + 1}}}`)
                            .replace(/vat2\}\}/g, `vat${s + 1}}}`)
                            .replace(/parts_shop2_price2\}\}/g, `parts_shop${s + 1}_price${s + 1}}}`)
                            .replace(/total_shop2\}\}/g, `total_shop${s + 1}}}`)
                            .replace(/total_amount2\}\}/g, `total_amount${s + 1}}}`);
            toCell.value = newVal;
          } else {
            toCell.value = val;
          }
        }
      }
    }

    // Row cloner
    const repeatingRowIndex = 17;
    const itemsCount = items.length;
    if (itemsCount > 1) {
      ws.duplicateRow(repeatingRowIndex, itemsCount - 1, true);
    }

    for (let i = 0; i < itemsCount; i++) {
      const currentRowIdx = repeatingRowIndex + i;
      const row = ws.getRow(currentRowIdx);
      const itemData = items[i];

      row.getCell(1).value = i + 1;
      row.getCell(2).value = itemData.item || "";
      row.getCell(3).value = itemData.quantity || 0;
      row.getCell(4).value = itemData.unit || "";

      for (let s = 0; s < N; s++) {
        const colIdx = 5 + s;
        const shop = shops[s];
        row.getCell(colIdx).value = shop.prices[i] !== undefined ? shop.prices[i] : 0;
      }
    }

    // Shop headers
    for (let s = 0; s < N; s++) {
      const colIdx = 5 + s;
      const shop = shops[s];
      ws.getCell(8, colIdx).value = `SHOP ${s + 1}`;
      ws.getCell(9, colIdx).value = shop.name || "";
      ws.getCell(10, colIdx).value = shop.contact_person || "";
      ws.getCell(11, colIdx).value = shop.contact_no || "";
      ws.getCell(12, colIdx).value = shop.work_duration || "";
      ws.getCell(13, colIdx).value = shop.warranty || "";
      ws.getCell(14, colIdx).value = shop.payment_terms || "";
    }

    const totalRowIdx = repeatingRowIndex + itemsCount;
    const vatRowIdx = totalRowIdx + 1;
    const grandRowIdx = vatRowIdx + 1;

    for (let s = 0; s < N; s++) {
      const colIdx = 5 + s;
      const shop = shops[s];
      ws.getCell(totalRowIdx, colIdx).value = shop.total || 0;
      ws.getCell(vatRowIdx, colIdx).value = shop.vat || 0;
      ws.getCell(grandRowIdx, colIdx).value = shop.total_amount || 0;
    }

    // General replacements
    for (let r = 1; r <= ws.rowCount; r++) {
      if (r >= repeatingRowIndex && r <= grandRowIdx) continue;
      const row = ws.getRow(r);
      row.eachCell({ includeEmpty: true }, (cell) => {
        if (cell.isMerged && cell.master && cell.address !== cell.master.address) return;
        const val = cell.value;
        if (typeof val === "string") {
          let cellStr = val;
          const matches = cellStr.match(/\{\{([^}]+)\}\}/g);
          if (matches) {
            matches.forEach((m) => {
              const key = m.replace(/[\{\}]/g, "").trim();
              const replacedVal = data[key] !== undefined ? data[key] : "";
              cellStr = cellStr.replace(m, String(replacedVal));
            });
            cell.value = (isNaN(Number(cellStr)) || cellStr.trim() === "" || cellStr.startsWith("0") && cellStr.length > 1) ? cellStr : Number(cellStr);
          }
        }
      });
    }
  } else {
    // General excel template cloner
    workbook.eachSheet((worksheet) => {
      resolveSharedFormulas(worksheet);

      // Scan and replace custom placeholders and images
      let loadingImgCell: { row: number; col: number } | null = null;
      let unloadingImgCell: { row: number; col: number } | null = null;

      for (let r = 1; r <= worksheet.rowCount; r++) {
        const row = worksheet.getRow(r);
        row.eachCell({ includeEmpty: true }, (cell, cNum) => {
          const val = cell.value;
          if (typeof val === "string") {
            if (val.includes("{{LOADING_IMAGE}}")) {
              loadingImgCell = { row: r, col: cNum };
              cell.value = "";
            } else if (val.includes("{{UNLOADING_IMAGE}}")) {
              unloadingImgCell = { row: r, col: cNum };
              cell.value = "";
            } else if (val.includes("{{LOADING_TITLE")) {
              const replaced = val.replace("{{LOADING_TITLE", data.LOADING_TITLE || "");
              cell.value = replaced;
            } else if (val.includes("{{UNLOADING_TITLE")) {
              const replaced = val.replace("{{UNLOADING_TITLE", data.UNLOADING_TITLE || "");
              cell.value = replaced;
            }
          }
        });
      }

      if (loadingImgCell && data.LOADING_IMAGE && data.LOADING_IMAGE.startsWith("data:image/")) {
        try {
          const base64Data = data.LOADING_IMAGE.split(",")[1];
          const imageId = workbook.addImage({
            base64: base64Data,
            extension: "png",
          });
          worksheet.addImage(imageId, {
            tl: { col: 3, row: 30 } as any,
            br: { col: 8, row: 44 } as any,
            editAs: "oneCell"
          });
        } catch (e) {
          console.error("Failed to add loading image to Excel", e);
        }
      }

      if (unloadingImgCell && data.UNLOADING_IMAGE && data.UNLOADING_IMAGE.startsWith("data:image/")) {
        try {
          const base64Data = data.UNLOADING_IMAGE.split(",")[1];
          const imageId = workbook.addImage({
            base64: base64Data,
            extension: "png",
          });
          worksheet.addImage(imageId, {
            tl: { col: 3, row: 59 } as any,
            br: { col: 8, row: 73 } as any,
            editAs: "oneCell"
          });
        } catch (e) {
          console.error("Failed to add unloading image to Excel", e);
        }
      }

      let repeatingRowIndex = -1;
      for (let r = 1; r <= worksheet.rowCount; r++) {
        const row = worksheet.getRow(r);
        let isRepeatingRow = false;
        row.eachCell({ includeEmpty: true }, (cell) => {
          const val = cell.value;
          if (typeof val === "string" && (
            val.includes("{{item.") || 
            val.includes("{{items.") || 
            val.includes("{{QTY}}") || 
            val.includes("{{ITEM_DESCRIPTION}}") ||
            val.includes("{{UNIT}}") ||
            val.toLowerCase().includes("{{qty") ||
            val.toLowerCase().includes("{{unit") ||
            val.toLowerCase().includes("{{item_description")
          )) {
            isRepeatingRow = true;
          }
        });
        if (isRepeatingRow) {
          repeatingRowIndex = r;
          break;
        }
      }

      if (repeatingRowIndex !== -1 && items && items.length > 0) {
        const rowToCopy = worksheet.getRow(repeatingRowIndex);
        const templateCells: { colNumber: number; value: any; style: any }[] = [];
        rowToCopy.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          templateCells.push({
            colNumber,
            value: cell.value,
            style: cell.style
          });
        });

        if (items.length > 1) {
          worksheet.duplicateRow(repeatingRowIndex, items.length - 1, true);
        }

        for (let i = 0; i < items.length; i++) {
          const currentRowIndex = repeatingRowIndex + i;
          const row = worksheet.getRow(currentRowIndex);
          const itemData = items[i];

          templateCells.forEach(({ colNumber, value, style }) => {
            const currentCell = row.getCell(colNumber);
            currentCell.style = style;
            if (currentCell.isMerged && currentCell.master && currentCell.address !== currentCell.master.address) return;

            if (typeof value === "string") {
              let cellStr = value;
              const matches = cellStr.match(/\{\{([^}]+)\}\}/g);
              if (matches) {
                matches.forEach((m) => {
                  const field = m.replace(/[\{\}]/g, "").replace(/^(items?\.)/, "").trim();
                  let replacedVal = "";
                  if (itemData[field] !== undefined) {
                    replacedVal = itemData[field];
                  } else if (itemData[field.toLowerCase()] !== undefined) {
                    replacedVal = itemData[field.toLowerCase()];
                  } else if (field === "ITEM_DESCRIPTION" && itemData.description !== undefined) {
                    replacedVal = itemData.description;
                  } else if (field === "QTY" && itemData.quantity !== undefined) {
                    replacedVal = itemData.quantity;
                  } else if (field === "UNIT" && itemData.unit !== undefined) {
                    replacedVal = itemData.unit;
                  } else if (field === "REMARKS" && itemData.remarks !== undefined) {
                    replacedVal = itemData.remarks;
                  }
                  cellStr = cellStr.replace(m, String(replacedVal));
                });
              }
              currentCell.value = (isNaN(Number(cellStr)) || cellStr.trim() === "" || cellStr.startsWith("0") && cellStr.length > 1) ? cellStr : Number(cellStr);
            }
          });
        }
      }

      // Root substitutions
      for (let r = 1; r <= worksheet.rowCount; r++) {
        if (repeatingRowIndex !== -1 && r >= repeatingRowIndex && r < repeatingRowIndex + items.length) {
          continue;
        }
        const row = worksheet.getRow(r);
        row.eachCell({ includeEmpty: true }, (cell) => {
          if (cell.isMerged && cell.master && cell.address !== cell.master.address) return;
          const val = cell.value;
          if (typeof val === "string") {
            let cellStr = val;
            const matches = cellStr.match(/\{\{([^}]+)\}\}/g);
            if (matches) {
              matches.forEach((m) => {
                const key = m.replace(/[\{\}]/g, "").trim();
                const replacedVal = data[key] !== undefined ? data[key] : "";
                cellStr = cellStr.replace(m, String(replacedVal));
              });

              if (val.trim().match(/^\{\{[^}]+\}\}$/)) {
                const key = val.replace(/[\{\}]/g, "").trim();
                const rawVal = data[key];
                if (typeof rawVal === "number" || typeof rawVal === "boolean") {
                  cell.value = rawVal;
                  return;
                }
              }
              cell.value = (isNaN(Number(cellStr)) || cellStr.trim() === "" || cellStr.startsWith("0") && cellStr.length > 1) ? cellStr : Number(cellStr);
            }
          } else if (val && typeof val === "object" && (val as any).richText && Array.isArray((val as any).richText)) {
            const rtArray = JSON.parse(JSON.stringify((val as any).richText));
            let hasMatch = false;
            rtArray.forEach((rt: any) => {
              if (rt.text && typeof rt.text === "string") {
                const matches = rt.text.match(/\{\{([^}]+)\}\}/g);
                if (matches) {
                  hasMatch = true;
                  matches.forEach((m: string) => {
                    const key = m.replace(/[\{\}]/g, "").trim();
                    const replacedVal = data[key] !== undefined ? data[key] : "";
                    rt.text = rt.text.replace(m, String(replacedVal));
                  });
                }
              }
            });
            if (hasMatch) {
              cell.value = { richText: rtArray };
            }
          }
        });
      }
    });
  }

  const outBuffer = await workbook.xlsx.writeBuffer();
  let outBlob: Blob;

  if (templateName.endsWith(".xlsm")) {
    const originalZip = new PizZip(arrayBuffer);
    const exceljsZip = new PizZip(outBuffer);

    const originalSheets = parseSheets(originalZip);
    const exceljsSheets = parseSheets(exceljsZip);

    console.log("[Reverse-Merge] Original sheets:", originalSheets);
    console.log("[Reverse-Merge] ExcelJS sheets:", exceljsSheets);

    // Overwrite worksheets based on sheet name mapping
    exceljsSheets.forEach((ejSheet) => {
      const origSheet = originalSheets.find((os) => os.name === ejSheet.name);
      if (origSheet) {
        const file = exceljsZip.file(ejSheet.targetPath);
        if (file) {
          let sheetXml = file.asText();
          const originalSheetXml = originalZip.file(origSheet.targetPath)?.asText();
          if (originalSheetXml) {
            // Preserving drawing
            const drawingMatch = originalSheetXml.match(/<drawing\s+[^>]*?\br:id=(["'])(.*?)\1/);
            if (drawingMatch) {
              const drawingId = drawingMatch[2];
              if (!sheetXml.includes("<drawing") && !sheetXml.includes("</drawing>")) {
                sheetXml = sheetXml.replace(/<\/worksheet>\s*$/, `<drawing r:id="${drawingId}"/></worksheet>`);
              }
            }

            // Preserving legacyDrawing (for Form controls/macros)
            const legacyDrawingMatch = originalSheetXml.match(/<legacyDrawing\s+[^>]*?\br:id=(["'])(.*?)\1/);
            if (legacyDrawingMatch) {
              const legacyId = legacyDrawingMatch[2];
              if (!sheetXml.includes("<legacyDrawing") && !sheetXml.includes("</legacyDrawing>")) {
                sheetXml = sheetXml.replace(/<\/worksheet>\s*$/, `<legacyDrawing r:id="${legacyId}"/></worksheet>`);
              }
            }

            // Preserving pageSetup r:id (must come before drawing and legacyDrawing)
            const pageSetupMatch = originalSheetXml.match(/<pageSetup\s+[^>]*?\br:id=(["'])(.*?)\1/);
            if (pageSetupMatch) {
              const pageSetupId = pageSetupMatch[2];
              if (sheetXml.includes("<pageSetup")) {
                sheetXml = sheetXml.replace(/<pageSetup(?![^>]*\br:id=)/, `<pageSetup r:id="${pageSetupId}"`);
              } else {
                let inserted = false;
                for (const tag of ["<drawing", "<legacyDrawing", "</worksheet>"]) {
                  if (sheetXml.includes(tag)) {
                    sheetXml = sheetXml.replace(tag, `<pageSetup r:id="${pageSetupId}"/>${tag}`);
                    inserted = true;
                    break;
                  }
                }
                if (!inserted) {
                  sheetXml = sheetXml.replace(/<\/worksheet>\s*$/, `<pageSetup r:id="${pageSetupId}"/></worksheet>`);
                }
              }
            }
          }
          // Overwrite the original template's worksheet path instead of adding an orphan
          originalZip.file(origSheet.targetPath, sheetXml);
          console.log(`[Reverse-Merge] Successfully overwrote "${origSheet.targetPath}" with mapped sheet "${ejSheet.name}"`);

          // Also copy the worksheet relationship file to keep drawings/images linked correctly
          const parts = ejSheet.targetPath.split("/");
          const filename = parts.pop();
          const relsPath = [...parts, "_rels", filename + ".rels"].join("/");

          const origParts = origSheet.targetPath.split("/");
          const origFilename = origParts.pop();
          const origRelsPath = [...origParts, "_rels", origFilename + ".rels"].join("/");

          const ejRelsFile = exceljsZip.file(relsPath);
          if (ejRelsFile) {
            originalZip.file(origRelsPath, ejRelsFile.asText());
            console.log(`[Reverse-Merge] Successfully copied worksheet rels from "${relsPath}" to "${origRelsPath}"`);
          }
        }
      } else {
        console.warn(`[Reverse-Merge] Warning: No matching sheet in original workbook for name "${ejSheet.name}"`);
      }
    });

    // Copy all drawings and media files to originalZip so that drawing resources are intact
    Object.keys(exceljsZip.files).forEach((filePath) => {
      if (filePath.startsWith("xl/drawings/") || filePath.startsWith("xl/media/")) {
        const file = exceljsZip.file(filePath);
        if (file && !filePath.endsWith("/")) {
          originalZip.file(filePath, file.asUint8Array());
          console.log(`[Reverse-Merge] Copied resource file to original zip: ${filePath}`);
        }
      }
    });

    // Overwrite sharedStrings
    const sharedStringsXml = exceljsZip.file("xl/sharedStrings.xml")?.asText();
    if (sharedStringsXml) {
      originalZip.file("xl/sharedStrings.xml", sharedStringsXml);
    }

    // Do NOT overwrite xl/styles.xml to preserve original styles perfectly!

    outBlob = originalZip.generate({
      type: "blob",
      mimeType: "application/vnd.ms-excel.sheet.macroEnabled.12",
    });
  } else {
    outBlob = new Blob([outBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  }

  // Convert Excel workbook to HTML using custom high-fidelity parser to preserve all formatting
  let html = "";
  try {
    html = convertExcelToHtml(workbook);
  } catch (err) {
    console.error("High-fidelity Excel HTML rendering error, falling back to basic conversion:", err);
    try {
      const wb = XLSX.read(outBuffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      html = XLSX.utils.sheet_to_html(ws, { editable: false });
    } catch (fallbackErr) {
      console.error("SheetJS fallback conversion error:", fallbackErr);
      html = `<div class="p-4 text-rose-500">Failed to render Excel as HTML table.</div>`;
    }
  }

  return { blob: outBlob, html, warnings };
}

// ==========================================
// High-Fidelity Excel to HTML Conversion Helpers
// ==========================================

function parseCellAddress(addr: string): { row: number; col: number } {
  const match = addr.match(/^([A-Z]+)([0-9]+)$/);
  if (!match) return { row: 1, col: 1 };
  const colStr = match[1];
  const row = parseInt(match[2], 10);
  let col = 0;
  for (let i = 0; i < colStr.length; i++) {
    col = col * 26 + (colStr.charCodeAt(i) - 64);
  }
  return { row, col };
}

function getCellAddress(row: number, col: number): string {
  let colStr = "";
  let temp = col;
  while (temp > 0) {
    const modulo = (temp - 1) % 26;
    colStr = String.fromCharCode(65 + modulo) + colStr;
    temp = Math.floor((temp - modulo) / 26);
  }
  return `${colStr}${row}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeXml(text: string): string {
  return escapeHtml(text);
}

function mapBorderEdge(borderVal: any, edge: string, gridlinesVisible: boolean): string {
  if (borderVal && borderVal.style) {
    let width = "1px";
    let style = "solid";
    if (borderVal.style === "medium") width = "2px";
    else if (borderVal.style === "thick") width = "3px";
    else if (borderVal.style === "double") {
      width = "3px";
      style = "double";
    } else if (borderVal.style === "dotted") {
      style = "dotted";
    } else if (borderVal.style === "dashed") {
      style = "dashed";
    }
    
    let color = "#000000";
    if (borderVal.color && borderVal.color.argb) {
      const argb = borderVal.color.argb;
      color = argb.length === 8 ? `#${argb.substring(2)}` : `#${argb}`;
    }
    return `border-${edge}: ${width} ${style} ${color} !important;`;
  }
  return gridlinesVisible ? `border-${edge}: 1px solid #d1d5db !important;` : `border-${edge}: none !important;`;
}

function convertExcelToHtml(workbook: ExcelJS.Workbook): string {
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return "";

  const gridlinesVisible = worksheet.views && worksheet.views[0] ? (worksheet.views[0].showGridLines !== false) : true;

  // Find max columns and rows to render
  let maxCol = 1;
  let maxRow = worksheet.rowCount;
  
  worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    if (rowNumber > maxRow) maxRow = rowNumber;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if (colNumber > maxCol) {
        maxCol = colNumber;
      }
    });
  });

  // Parse merged cells to identify rowspan/colspan
  const merges: Record<string, { rowspan: number; colspan: number; isMaster: boolean }> = {};
  if (worksheet.model && worksheet.model.merges) {
    worksheet.model.merges.forEach((mergeRangeStr: string) => {
      const parts = mergeRangeStr.split(":");
      if (parts.length === 2) {
        const start = parseCellAddress(parts[0]);
        const end = parseCellAddress(parts[1]);
        const startCellAddr = parts[0];
        const rowspan = end.row - start.row + 1;
        const colspan = end.col - start.col + 1;
        
        merges[startCellAddr] = { rowspan, colspan, isMaster: true };
        for (let r = start.row; r <= end.row; r++) {
          for (let c = start.col; c <= end.col; c++) {
            if (r === start.row && c === start.col) continue;
            const addr = getCellAddress(r, c);
            merges[addr] = { rowspan: 0, colspan: 0, isMaster: false };
          }
        }
      }
    });
  }

  let html = `<table class="excel-table" style="border-collapse: collapse; width: auto; background-color: #ffffff; table-layout: fixed; margin: 0 auto; color: #000000; font-family: Calibri, sans-serif;">`;

  // Col group for column widths
  html += "<colgroup>";
  for (let c = 1; c <= maxCol; c++) {
    const col = worksheet.getColumn(c);
    const widthPx = col.width ? Math.round(col.width * 8.4) : 80;
    html += `<col style="width: ${widthPx}px; min-width: ${widthPx}px; max-width: ${widthPx}px;" />`;
  }
  html += "</colgroup>";

  // Rows
  for (let r = 1; r <= maxRow; r++) {
    const row = worksheet.getRow(r);
    const heightPt = row.height;
    const heightStyle = heightPt ? `height: ${Math.round(heightPt * 1.33)}px;` : "";
    const displayStyle = row.hidden ? "display: none;" : "";

    html += `<tr style="${heightStyle} ${displayStyle}">`;

    for (let c = 1; c <= maxCol; c++) {
      const cellAddress = getCellAddress(r, c);
      const mergeInfo = merges[cellAddress];
      if (mergeInfo && !mergeInfo.isMaster) {
        // Skip rendering non-master merged cells
        continue;
      }

      const cell = row.getCell(c);
      let cellStyles: string[] = [];

      // Alignment
      if (cell.alignment) {
        const align = cell.alignment;
        if (align.horizontal) {
          cellStyles.push(`text-align: ${align.horizontal};`);
        }
        if (align.vertical) {
          const vAlign = align.vertical === "middle" ? "middle" : align.vertical;
          cellStyles.push(`vertical-align: ${vAlign};`);
        }
        if (align.wrapText) {
          cellStyles.push(`white-space: normal; word-break: break-all;`);
        } else {
          cellStyles.push(`white-space: nowrap;`);
        }
      } else {
        cellStyles.push(`vertical-align: middle; white-space: nowrap;`);
      }

      // Font
      if (cell.font) {
        const font = cell.font;
        if (font.name) {
          cellStyles.push(`font-family: '${font.name}', Calibri, Arial, sans-serif;`);
        }
        if (font.size) {
          cellStyles.push(`font-size: ${font.size}pt;`);
        }
        if (font.bold) {
          cellStyles.push(`font-weight: bold;`);
        }
        if (font.italic) {
          cellStyles.push(`font-style: italic;`);
        }
        if (font.underline) {
          cellStyles.push(`text-decoration: underline;`);
        }
        if (font.color && font.color.argb) {
          const argb = font.color.argb;
          const hexColor = argb.length === 8 ? `#${argb.substring(2)}` : `#${argb}`;
          cellStyles.push(`color: ${hexColor};`);
        }
      }

      // Fill (Background)
      if (cell.fill && cell.fill.type === "pattern" && cell.fill.pattern === "solid") {
        const fgColor = cell.fill.fgColor;
        if (fgColor && fgColor.argb) {
          const argb = fgColor.argb;
          const hexColor = argb.length === 8 ? `#${argb.substring(2)}` : `#${argb}`;
          cellStyles.push(`background-color: ${hexColor} !important;`);
        }
      }

      // Borders
      const border = cell.border || {};
      cellStyles.push(mapBorderEdge(border.top, "top", gridlinesVisible));
      cellStyles.push(mapBorderEdge(border.bottom, "bottom", gridlinesVisible));
      cellStyles.push(mapBorderEdge(border.left, "left", gridlinesVisible));
      cellStyles.push(mapBorderEdge(border.right, "right", gridlinesVisible));

      const styleAttr = cellStyles.join(" ");

      // Merging attributes
      const rowspanAttr = mergeInfo && mergeInfo.rowspan > 1 ? ` rowspan="${mergeInfo.rowspan}"` : "";
      const colspanAttr = mergeInfo && mergeInfo.colspan > 1 ? ` colspan="${mergeInfo.colspan}"` : "";

      // Cell value rendering
      let cellContent = "";
      const val = cell.value;
      if (val !== null && val !== undefined) {
        if (typeof val === "object") {
          if ("richText" in val && Array.isArray((val as any).richText)) {
            (val as any).richText.forEach((rt: any) => {
              let rtStyle = "";
              if (rt.font) {
                if (rt.font.bold) rtStyle += "font-weight: bold;";
                if (rt.font.italic) rtStyle += "font-style: italic;";
                if (rt.font.size) rtStyle += `font-size: ${rt.font.size}pt;`;
                if (rt.font.color && rt.font.color.argb) {
                  const argb = rt.font.color.argb;
                  rtStyle += `color: ${argb.length === 8 ? `#${argb.substring(2)}` : `#${argb}`};`;
                }
              }
              cellContent += `<span style="${rtStyle}">${escapeHtml(rt.text || "")}</span>`;
            });
          } else if ("formula" in val) {
            const formulaVal = val as any;
            cellContent = formulaVal.result !== undefined && formulaVal.result !== null ? escapeHtml(String(formulaVal.result)) : "";
          } else if ("text" in val) {
            cellContent = escapeHtml(String((val as any).text));
          } else {
            cellContent = escapeHtml(String(val));
          }
        } else if ((val as any) instanceof Date) {
          cellContent = escapeHtml(cell.text || (val as any).toLocaleDateString());
        } else {
          cellContent = escapeHtml(String(val));
        }
      }

      html += `<td style="${styleAttr}"${rowspanAttr}${colspanAttr}>${cellContent}</td>`;
    }
    html += "</tr>";
  }

  html += "</table>";
  return html;
}

// ==========================================
// PizZip Layout-Preserving Helper Functions
// ==========================================

function replacePlaceholdersInSharedStrings(sharedStringsXml: string, data: Record<string, any>): string {
  const getValue = (key: string) => {
    const trimmedKey = key.trim();
    if (data[trimmedKey] !== undefined) return data[trimmedKey];
    const upperKey = trimmedKey.toUpperCase();
    if (data[upperKey] !== undefined) return data[upperKey];
    const snakeKey = trimmedKey.replace(/\s+/g, "_");
    if (data[snakeKey] !== undefined) return data[snakeKey];
    const upperSnakeKey = snakeKey.toUpperCase();
    if (data[upperSnakeKey] !== undefined) return data[upperSnakeKey];
    const spaceKey = trimmedKey.replace(/_/g, " ");
    if (data[spaceKey] !== undefined) return data[spaceKey];
    const upperSpaceKey = spaceKey.toUpperCase();
    if (data[upperSpaceKey] !== undefined) return data[upperSpaceKey];

    if (upperKey.includes("APROVED")) {
      const fixedKey = upperKey.replace("APROVED", "APPROVED");
      if (data[fixedKey] !== undefined) return data[fixedKey];
    }
    if (upperKey.includes("APPROVED")) {
      const fixedKey = upperKey.replace("APPROVED", "APROVED");
      if (data[fixedKey] !== undefined) return data[fixedKey];
    }
    const noNumUnderscore = upperKey.replace(/_(\d+)/g, "$1");
    if (data[noNumUnderscore] !== undefined) return data[noNumUnderscore];
    const withNumUnderscore = upperKey.replace(/([A-Z])(\d+)/g, "$1_$2");
    if (data[withNumUnderscore] !== undefined) return data[withNumUnderscore];

    return undefined;
  };

  const replacer = (match: string, key: string) => {
    const val = getValue(key);
    if (val === undefined || val === null) {
      return "";
    }
    return escapeXml(String(val));
  };

  let result = sharedStringsXml.replace(/\{\{([^{}]+)\}\}/g, replacer);
  result = result.replace(/\{([^{}]+)\}/g, replacer);
  return result;
}

function injectCellValue(sheetXml: string, cellRef: string, val: any, isString: boolean = false, isItalic: boolean = false): string {
  const selfClosingRegex = new RegExp('<c(?:\\s+[^>]*?)?\\s+r="' + cellRef + '"(?:\\s+[^>]*?)?\\/>', 'i');
  const fullCellRegex = new RegExp('<c(?:\\s+[^>]*?)?\\s+r="' + cellRef + '"(?:\\s+[^>]*?)?>[\\s\\S]*?<\\/c>', 'i');

  const selfMatch = sheetXml.match(selfClosingRegex);
  if (selfMatch) {
    const fullTag = selfMatch[0];
    const styleMatch = fullTag.match(/\bs="(\d+)"/i);
    const styleId = styleMatch ? styleMatch[1] : "2";
    let newCell = "";
    if (val === undefined || val === null || val === "") {
      newCell = `<c r="${cellRef}" s="${styleId}"/>`;
    } else if (isString) {
      if (isItalic) {
        newCell = `<c r="${cellRef}" s="${styleId}" t="inlineStr"><is><r><rPr><i/></rPr><t>${escapeXml(String(val))}</t></r></is></c>`;
      } else {
        newCell = `<c r="${cellRef}" s="${styleId}" t="inlineStr"><is><t>${escapeXml(String(val))}</t></is></c>`;
      }
    } else {
      newCell = `<c r="${cellRef}" s="${styleId}"><v>${val}</v></c>`;
    }
    return sheetXml.replace(fullTag, newCell);
  }

  const fullMatch = sheetXml.match(fullCellRegex);
  if (fullMatch) {
    const fullTag = fullMatch[0];
    const styleMatch = fullTag.match(/\bs="(\d+)"/i);
    const styleId = styleMatch ? styleMatch[1] : "2";
    let newCell = "";
    if (val === undefined || val === null || val === "") {
      newCell = `<c r="${cellRef}" s="${styleId}"/>`;
    } else if (isString) {
      if (isItalic) {
        newCell = `<c r="${cellRef}" s="${styleId}" t="inlineStr"><is><r><rPr><i/></rPr><t>${escapeXml(String(val))}</t></r></is></c>`;
      } else {
        newCell = `<c r="${cellRef}" s="${styleId}" t="inlineStr"><is><t>${escapeXml(String(val))}</t></is></c>`;
      }
    } else {
      newCell = `<c r="${cellRef}" s="${styleId}"><v>${val}</v></c>`;
    }
    return sheetXml.replace(fullTag, newCell);
  }

  return sheetXml;
}
