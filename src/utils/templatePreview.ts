import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
// @ts-ignore
import ImageModule from "docxtemplater-image-module-free";
import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import { computePurposeFit, computePoFit } from "./purposeAutoFit";
import { getHazwasteSheetName } from "./hazardousWasteExport";

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
function colToNum(col: string): number {
  let num = 0;
  for (let i = 0; i < col.length; i++) {
    num = num * 26 + (col.charCodeAt(i) - 64);
  }
  return num;
}

function ensureMergeCellRange(sheetXml: string, rangeRef: string): string {
  const match = rangeRef.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
  if (!match) return sheetXml;
  const targetCol1 = match[1];
  const targetR1 = parseInt(match[2], 10);
  const targetCol2 = match[3];
  const targetR2 = parseInt(match[4], 10);

  const tC1 = colToNum(targetCol1);
  const tC2 = colToNum(targetCol2);

  if (sheetXml.includes(`ref="${rangeRef}"`)) {
    return sheetXml;
  }

  let updatedSheetXml = sheetXml.replace(/<mergeCell ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/g, (fullMatch, c1, r1Str, c2, r2Str) => {
    const r1 = parseInt(r1Str, 10);
    const r2 = parseInt(r2Str, 10);
    const colNum1 = colToNum(c1);
    const colNum2 = colToNum(c2);

    const rowOverlap = !(r2 < targetR1 || r1 > targetR2);
    const colOverlap = !(colNum2 < tC1 || colNum1 > tC2);

    if (rowOverlap && colOverlap) {
      return "";
    }
    return fullMatch;
  });

  const newTag = `<mergeCell ref="${rangeRef}"/>`;
  if (updatedSheetXml.includes("</mergeCells>")) {
    updatedSheetXml = updatedSheetXml.replace("</mergeCells>", `${newTag}</mergeCells>`);
    const countMatches = (updatedSheetXml.match(/<mergeCell /g) || []).length;
    updatedSheetXml = updatedSheetXml.replace(/<mergeCells count="(\d+)">/, `<mergeCells count="${countMatches}">`);
  } else if (updatedSheetXml.includes("</worksheet>")) {
    updatedSheetXml = updatedSheetXml.replace("</worksheet>", `<mergeCells count="1">${newTag}</mergeCells></worksheet>`);
  }

  return updatedSheetXml;
}

function replaceExactCell(
  rowXml: string,
  cellRef: string,
  replacement: string
): string {
  const escapedCellRef = cellRef.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `<c\\s+[^>]*?\\br="${escapedCellRef}"[^>]*?\\/>|<c\\s+[^>]*?\\br="${escapedCellRef}"[^>]*?>[\\s\\S]*?<\\/c>`,
    "s"
  );
  return rowXml.replace(regex, replacement);
}

function createGrandTotalStyle(
  stylesXml: string,
  baseStyleId: number
): { stylesXml: string; newStyleId: string } {
  if (!stylesXml) return { stylesXml, newStyleId: String(baseStyleId) };

  const xfsMatch = stylesXml.match(/<cellXfs count="(\d+)">([\s\S]*?)<\/cellXfs>/);
  if (!xfsMatch) return { stylesXml, newStyleId: String(baseStyleId) };

  const xfCount = parseInt(xfsMatch[1], 10);
  const xfList = xfsMatch[2].match(/<xf [^>]*\/>|<xf [^>]*>[\s\S]*?<\/xf>/g);
  if (!xfList || !xfList[baseStyleId]) return { stylesXml, newStyleId: String(baseStyleId) };

  const baseXf = xfList[baseStyleId];
  const fontIdMatch = baseXf.match(/fontId="(\d+)"/);
  const baseFontId = fontIdMatch ? parseInt(fontIdMatch[1], 10) : 0;

  const fontsMatch = stylesXml.match(/<fonts count="(\d+)">([\s\S]*?)<\/fonts>/);
  if (!fontsMatch) return { stylesXml, newStyleId: String(baseStyleId) };
  const fontCount = parseInt(fontsMatch[1], 10);
  const fontList = fontsMatch[2].match(/<font>[\s\S]*?<\/font>/g);
  if (!fontList || !fontList[baseFontId]) return { stylesXml, newStyleId: String(baseStyleId) };

  let baseFont = fontList[baseFontId];
  const szMatch = baseFont.match(/<sz val="(\d+(?:\.\d+)?)"\/>/);
  const currentSz = szMatch ? parseFloat(szMatch[1]) : 10;
  const newSz = currentSz + 1;

  let newFont = baseFont;
  if (szMatch) {
    newFont = newFont.replace(/<sz val="[^"]*"\/>/, `<sz val="${newSz}"/>`);
  } else {
    newFont = newFont.replace("<font>", `<font><sz val="${newSz}"/>`);
  }
  if (!newFont.includes("<b/>") && !newFont.includes("<b>")) {
    newFont = newFont.replace("<font>", "<font><b/>");
  }

  const newFontId = fontCount;
  let updatedStyles = stylesXml.replace(/<fonts count="(\d+)">/, `<fonts count="${fontCount + 1}">`);
  updatedStyles = updatedStyles.replace("</fonts>", `${newFont}</fonts>`);

  let newXf = baseXf.replace(`fontId="${baseFontId}"`, `fontId="${newFontId}"`);
  if (!newXf.includes("applyFont=")) {
    newXf = newXf.replace("<xf ", `<xf applyFont="1" `);
  } else {
    newXf = newXf.replace(/applyFont="0"/, `applyFont="1"`);
  }

  const newStyleId = xfCount;
  updatedStyles = updatedStyles.replace(/<cellXfs count="(\d+)">/, `<cellXfs count="${xfCount + 1}">`);
  updatedStyles = updatedStyles.replace("</cellXfs>", `${newXf}</cellXfs>`);

  return { stylesXml: updatedStyles, newStyleId: String(newStyleId) };
}

function parseBufferImageDimensions(buffer: Uint8Array | Buffer): { width: number; height: number } | null {
  if (!buffer || buffer.length < 8) return null;
  // PNG
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    const width = (buffer[16] << 24) | (buffer[17] << 16) | (buffer[18] << 8) | buffer[19];
    const height = (buffer[20] << 24) | (buffer[21] << 16) | (buffer[22] << 8) | buffer[23];
    if (width > 0 && height > 0) return { width: Math.abs(width), height: Math.abs(height) };
  }
  // JPEG
  if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
    let offset = 2;
    while (offset < buffer.length - 8) {
      if (buffer[offset] !== 0xFF) {
        offset++;
        continue;
      }
      const marker = buffer[offset + 1];
      if ((marker >= 0xC0 && marker <= 0xCF) && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
        const height = (buffer[offset + 5] << 8) | buffer[offset + 6];
        const width = (buffer[offset + 7] << 8) | buffer[offset + 8];
        if (width > 0 && height > 0) return { width, height };
      }
      const len = (buffer[offset + 2] << 8) | buffer[offset + 3];
      if (isNaN(len) || len <= 0) break;
      offset += 2 + len;
    }
  }
  return null;
}

const UNLOADING_LOADING_COL_WIDTHS_EMU: Record<number, number> = {
  3: 685738,
  4: 685738,
  5: 219103,
  6: 933450,
  7: 609880
};
const UNLOADING_LOADING_ROW_HEIGHT_EMU = 161925; // 12.75pt * 12700

function normalizeRowOffset(row: number, rowOff: number): { row: number; rowOff: number } {
  let r = row;
  let off = rowOff;
  while (off < 0 && r > 0) {
    r -= 1;
    off += UNLOADING_LOADING_ROW_HEIGHT_EMU;
  }
  while (off >= UNLOADING_LOADING_ROW_HEIGHT_EMU) {
    off -= UNLOADING_LOADING_ROW_HEIGHT_EMU;
    r += 1;
  }
  return { row: r, rowOff: Math.round(off) };
}

function normalizeColOffset(col: number, colOff: number): { col: number; colOff: number } {
  let c = col;
  let off = colOff;
  while (off < 0 && c > 0) {
    c -= 1;
    off += (UNLOADING_LOADING_COL_WIDTHS_EMU[c] || 609880);
  }
  while (off >= (UNLOADING_LOADING_COL_WIDTHS_EMU[c] || 609880)) {
    off -= (UNLOADING_LOADING_COL_WIDTHS_EMU[c] || 609880);
    c += 1;
  }
  return { col: c, colOff: Math.round(off) };
}

function computeFitAnchor(
  frame: { fromCol: number; fromColOff: number; fromRow: number; fromRowOff: number; toCol: number; toColOff: number; toRow: number; toRowOff: number; cx: number; cy: number },
  imgW: number,
  imgH: number
) {
  const frameW = frame.cx;
  const frameH = frame.cy;
  const scale = Math.min(frameW / imgW, frameH / imgH);
  const renderW = Math.round(imgW * scale);
  const renderH = Math.round(imgH * scale);
  const padX = Math.round((frameW - renderW) / 2);
  const padY = Math.round((frameH - renderH) / 2);

  const rawFromCol = normalizeColOffset(frame.fromCol, frame.fromColOff + padX);
  const rawFromRow = normalizeRowOffset(frame.fromRow, frame.fromRowOff + padY);
  const rawToCol = normalizeColOffset(frame.toCol, frame.toColOff - padX);
  const rawToRow = normalizeRowOffset(frame.toRow, frame.toRowOff - padY);

  return {
    fromCol: rawFromCol.col,
    fromColOff: rawFromCol.colOff,
    fromRow: rawFromRow.row,
    fromRowOff: rawFromRow.rowOff,
    toCol: rawToCol.col,
    toColOff: rawToCol.colOff,
    toRow: rawToRow.row,
    toRowOff: rawToRow.rowOff,
  };
}

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
      let sheet1Xml = originalZip.file("xl/worksheets/sheet1.xml")?.asText() || "";

      // Extract payments list from data
      let paymentEntries: Array<{ poNumber: string; purposeText: string; gross?: number; ewt?: number; total?: number }> = data.PIS_PAYMENT_ENTRIES || [];

      if (!paymentEntries || paymentEntries.length === 0) {
        paymentEntries = [];
        let i = 1;
        while (true) {
          const purp = data[`PURPOSE${i}`] || data[`PURPOSE_${i}`] || data[`PAYMENT_PURPOSE_${i}`] || "";
          const po = data[`PO_NO${i}`] || data[`PO_NO_${i}`] || data[`COMPLETED_PO_${i}`] || "";
          if (!purp && !po && i > 3) break;
          if (purp || po || i <= 3) {
            paymentEntries.push({ poNumber: po, purposeText: purp });
          }
          i++;
        }
      }

      const activePurposes = paymentEntries.filter(p => (p.purposeText || "").trim() !== "" || (p.poNumber || "").trim() !== "");
      const totalPurposes = activePurposes.length;

      // Ensure data object has PURPOSE1..3 and PO_NO1..3 mapped for placeholder substitution
      data.PURPOSE1 = (activePurposes[0]?.purposeText || "").toUpperCase();
      data.PURPOSE2 = (activePurposes[1]?.purposeText || "").toUpperCase();
      data.PURPOSE3 = (activePurposes[2]?.purposeText || "").toUpperCase();
      data.PO_NO1 = (activePurposes[0]?.poNumber || "").slice(0, 40);
      data.PO_NO2 = (activePurposes[1]?.poNumber || "").slice(0, 40);
      data.PO_NO3 = (activePurposes[2]?.poNumber || "").slice(0, 40);

      // Extract prototype PURPOSE and PO_NO <si> blocks before placeholder replacement
      const purposeSiPrototypeMatch = sharedStringsXml.match(/<si\b[^>]*>(?:(?!<\/si>).)*?PURPOSE(?:(?!<\/si>).)*?<\/si>/is);
      const purposeSiPrototype = purposeSiPrototypeMatch ? purposeSiPrototypeMatch[0] : "";

      const poNoSiPrototypeMatch = sharedStringsXml.match(/<si\b[^>]*>(?:(?!<\/si>).)*?PO_NO(?:(?!<\/si>).)*?<\/si>/is);
      const poNoSiPrototype = poNoSiPrototypeMatch ? poNoSiPrototypeMatch[0] : "";

      // Replace placeholders in sharedStrings.xml
      sharedStringsXml = replacePlaceholdersInSharedStrings(sharedStringsXml, data);

      // Check if calculation section values exist (Scenario A vs Scenario B)
      const hasCalculationValues = !!(
        (data.GROSS && String(data.GROSS).trim() !== "") ||
        (data.TOTAL && String(data.TOTAL).trim() !== "") ||
        (data.GROSS_1 && String(data.GROSS_1).trim() !== "") ||
        (data.TOTAL_1 && String(data.TOTAL_1).trim() !== "") ||
        data.HAS_TOTAL
      );

      if (!hasCalculationValues) {
        // Scenario A: Hide GROSS, EWT (1%), and TOTAL labels and empty value cells
        sheet1Xml = injectCellValue(sheet1Xml, "K14", "", true); // GROSS Label
        sheet1Xml = injectCellValue(sheet1Xml, "N14", "", true); // EWT Label
        sheet1Xml = injectCellValue(sheet1Xml, "U14", "", true); // TOTAL Label
        sheet1Xml = injectCellValue(sheet1Xml, "K15", "", true); // GROSS 1
        sheet1Xml = injectCellValue(sheet1Xml, "N15", "", true); // EWT 1
        sheet1Xml = injectCellValue(sheet1Xml, "U15", "", true); // TOTAL 1
        sheet1Xml = injectCellValue(sheet1Xml, "K16", "", true);
        sheet1Xml = injectCellValue(sheet1Xml, "N16", "", true);
        sheet1Xml = injectCellValue(sheet1Xml, "U16", "", true);
        sheet1Xml = injectCellValue(sheet1Xml, "K17", "", true);
        sheet1Xml = injectCellValue(sheet1Xml, "N17", "", true);
        sheet1Xml = injectCellValue(sheet1Xml, "U17", "", true);
      } else {
        if (data.EWT_PERCENTAGE && data.EWT_PERCENTAGE !== "1%") {
          sheet1Xml = injectCellValue(sheet1Xml, "N14", `EWT (${data.EWT_PERCENTAGE})`, true);
        }

        const formatVal = (num: number) =>
          num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        // Scenario D: Inject values for 2nd and 3rd entries if present
        const g2 = data.GROSS_2 || (activePurposes[1]?.gross ? formatVal(activePurposes[1].gross) : "");
        const e2 = data.EWT_2 || (activePurposes[1] && (activePurposes[1].gross || 0) * (activePurposes[1].ewt || 0) > 0 ? formatVal((activePurposes[1].gross || 0) * (activePurposes[1].ewt || 0) / 100) : "");
        const t2 = data.TOTAL_2 || (activePurposes[1]?.total ? formatVal(activePurposes[1].total) : "");
        if (g2) sheet1Xml = injectCellValue(sheet1Xml, "K16", g2, true);
        if (e2) sheet1Xml = injectCellValue(sheet1Xml, "N16", e2, true);
        if (t2) {
          sheet1Xml = injectCellValue(sheet1Xml, "T16", t2, true);
          sheet1Xml = injectCellValue(sheet1Xml, "U16", t2, true);
        }

        const g3 = data.GROSS_3 || (activePurposes[2]?.gross ? formatVal(activePurposes[2].gross) : "");
        const e3 = data.EWT_3 || (activePurposes[2] && (activePurposes[2].gross || 0) * (activePurposes[2].ewt || 0) > 0 ? formatVal((activePurposes[2].gross || 0) * (activePurposes[2].ewt || 0) / 100) : "");
        const t3 = data.TOTAL_3 || (activePurposes[2]?.total ? formatVal(activePurposes[2].total) : "");
        if (g3) sheet1Xml = injectCellValue(sheet1Xml, "K17", g3, true);
        if (e3) sheet1Xml = injectCellValue(sheet1Xml, "N17", e3, true);
        if (t3) {
          sheet1Xml = injectCellValue(sheet1Xml, "T17", t3, true);
          sheet1Xml = injectCellValue(sheet1Xml, "U17", t3, true);
        }
      }

      // Ensure consistent merged-cell structure for Gross Amount, PO Number, Purpose, EWT, and Total across all entries
      const standardMergeRanges = [
        "A15:B15", "C15:J15", "K15:M15", "N15:Q15", "T15:U15",
        "A16:B16", "C16:J16", "K16:M16", "N16:Q16", "T16:U16",
        "A17:B17", "C17:J17", "K17:M17", "N17:Q17", "T17:U17",
      ];
      for (const rng of standardMergeRanges) {
        sheet1Xml = ensureMergeCellRange(sheet1Xml, rng);
      }

      // Extract style IDs from First Entry (Row 15) as the formatting source of truth
      const getStyleId = (xml: string, cellRef: string): string => {
        const match = xml.match(new RegExp(`<c\\s+[^>]*?\\br="${cellRef}"[^>]*?\\bs="(\\d+)"`, 'i'))
          || xml.match(new RegExp(`<c\\s+[^>]*?\\bs="(\\d+)"[^>]*?\\br="${cellRef}"`, 'i'));
        return match ? match[1] : "";
      };

      const formatVal = (num: number) =>
        num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      // Ensure cells in rows 15, 16, 17 use style 7 (blue font style in PIS template) instead of style 57 (red/black)
      sheet1Xml = sheet1Xml.replace(/<c r="C15" s="57"/g, '<c r="C15" s="7"');
      sheet1Xml = sheet1Xml.replace(/<c r="C16" s="57"/g, '<c r="C16" s="7"');
      sheet1Xml = sheet1Xml.replace(/<c r="C17" s="57"/g, '<c r="C17" s="7"');
      sheet1Xml = sheet1Xml.replace(/<c r="A15" s="57"/g, '<c r="A15" s="7"');
      sheet1Xml = sheet1Xml.replace(/<c r="A16" s="57"/g, '<c r="A16" s="7"');
      sheet1Xml = sheet1Xml.replace(/<c r="A17" s="57"/g, '<c r="A17" s="7"');

      const stylePO = getStyleId(sheet1Xml, "A15") || "7";
      const stylePurpose = getStyleId(sheet1Xml, "C15") || "7";
      const styleGross = getStyleId(sheet1Xml, "K15") || "41";
      const styleEwt = getStyleId(sheet1Xml, "N15") || "70";
      const styleTotal = getStyleId(sheet1Xml, "T15") || "69";

      let stylesXml = originalZip.file("xl/styles.xml")?.asText() || "";
      let styleGrandTotal = styleTotal;
      if (stylesXml && styleTotal) {
        const res = createGrandTotalStyle(stylesXml, parseInt(styleTotal, 10));
        stylesXml = res.stylesXml;
        styleGrandTotal = res.newStyleId;
        originalZip.file("xl/styles.xml", stylesXml);
      }

      // Perform dynamic purpose expansion if totalPurposes > 3
      if (totalPurposes > 3 && sheet1Xml) {
        const extraRows = totalPurposes - 3;

        const addSharedString = (text: string, isPurpose: boolean = false): number => {
          const matches = sharedStringsXml.match(/<si>/g);
          const currIdx = matches ? matches.length : 0;
          const strText = (text || "").toUpperCase();
          const escapedText = escapeXml(strText);

          const prototype = isPurpose ? purposeSiPrototype : poNoSiPrototype;
          let newSi = `<si><t>${escapedText}</t></si>`;

          if (prototype) {
            let inner = prototype.replace(/<si\b[^>]*>([\s\S]*?)<\/si>/i, "$1");
            inner = inner.replace(/\{\{[^{}]+\}\}|\{[^{}]+\}|PURPOSE\d*|PO_NO\d*/gi, escapedText);

            let targetFontSize: number | null = null;
            if (isPurpose) {
              const fit = computePurposeFit(strText);
              targetFontSize = fit.fontSize;
            } else {
              const fit = computePoFit(strText);
              targetFontSize = fit.fontSize;
            }

            if (targetFontSize !== null) {
              if (/<rPr\b[^>]*>/i.test(inner)) {
                inner = inner.replace(/<rPr\b([^>]*)>([\s\S]*?)<\/rPr>/gi, (rPrMatch, rPrAttrs, rPrContent) => {
                  if (/<sz\b[^>]*\/>/i.test(rPrContent)) {
                    const newContent = rPrContent.replace(/<sz\s+val=["']\d+["']\s*\/?>/gi, `<sz val="${targetFontSize}"/>`);
                    return `<rPr${rPrAttrs}>${newContent}</rPr>`;
                  } else {
                    return `<rPr${rPrAttrs}><sz val="${targetFontSize}"/>${rPrContent}</rPr>`;
                  }
                });
              } else if (targetFontSize < 11) {
                if (/<t\b[^>]*>([\s\S]*?)<\/t>/i.test(inner)) {
                  inner = inner.replace(/<t\b([^>]*)>([\s\S]*?)<\/t>/gi, (tMatch, tAttrs, tContent) => {
                    return `<r><rPr><rFont val="Tahoma"/><sz val="${targetFontSize}"/><color rgb="FF0000FF"/></rPr><t${tAttrs}>${tContent}</t></r>`;
                  });
                } else {
                  inner = `<r><rPr><rFont val="Tahoma"/><sz val="${targetFontSize}"/><color rgb="FF0000FF"/></rPr><t>${inner}</t></r>`;
                }
              }
            }
            newSi = `<si>${inner}</si>`;
          } else {
            let targetFontSize: number | null = null;
            if (isPurpose) {
              const fit = computePurposeFit(strText);
              targetFontSize = fit.fontSize;
            } else {
              const fit = computePoFit(strText);
              targetFontSize = fit.fontSize;
            }

            if (targetFontSize !== null && targetFontSize < 11) {
              newSi = `<si><r><rPr><rFont val="Tahoma"/><sz val="${targetFontSize}"/><color rgb="FF0000FF"/></rPr><t>${escapedText}</t></r></si>`;
            }
          }

          sharedStringsXml = sharedStringsXml.replace("</sst>", `${newSi}</sst>`);

          const countMatch = sharedStringsXml.match(/count="(\d+)"/);
          const uniqueMatch = sharedStringsXml.match(/uniqueCount="(\d+)"/);
          if (countMatch) {
            const count = parseInt(countMatch[1], 10);
            sharedStringsXml = sharedStringsXml.replace(`count="${count}"`, `count="${count + 1}"`);
          }
          if (uniqueMatch) {
            const ucount = parseInt(uniqueMatch[1], 10);
            sharedStringsXml = sharedStringsXml.replace(`uniqueCount="${ucount}"`, `uniqueCount="${ucount + 1}"`);
          }
          return currIdx;
        };

        // Shift merged cells starting at or after row 18 down by extraRows
        sheet1Xml = sheet1Xml.replace(/<mergeCell ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/g, (m, col1, r1Str, col2, r2Str) => {
          let r1 = parseInt(r1Str, 10);
          let r2 = parseInt(r2Str, 10);
          if (r1 >= 18) r1 += extraRows;
          if (r2 >= 18) r2 += extraRows;
          return `<mergeCell ref="${col1}${r1}:${col2}${r2}"/>`;
        });

        // Extract Row 17 XML as prototype
        const row17Match = sheet1Xml.match(/<row r="17"[^>]*>.*?<\/row>/s);
        const row17Xml = row17Match ? row17Match[0] : "";

        // Extract all rows from sheet1Xml
        const rowRegex = /<row r="(\d+)"[^>]*>.*?<\/row>/gs;
        const allRows: Array<{ full: string; r: number }> = [];
        let rm;
        while ((rm = rowRegex.exec(sheet1Xml)) !== null) {
          allRows.push({ full: rm[0], r: parseInt(rm[1], 10) });
        }

        // Shift rows >= 18 descending
        allRows.sort((a, b) => b.r - a.r);
        for (const rowObj of allRows) {
          if (rowObj.r >= 18) {
            const oldR = rowObj.r;
            const newR = oldR + extraRows;
            let newRowXml = rowObj.full;
            newRowXml = newRowXml.replace(new RegExp(`r="${oldR}"`, "g"), `r="${newR}"`);
            newRowXml = newRowXml.replace(new RegExp(`r="([A-Z]+)${oldR}"`, "g"), `r="$1${newR}"`);
            sheet1Xml = sheet1Xml.replace(rowObj.full, newRowXml);
          }
        }

        // Create new rows for index 4..totalPurposes
        let newRowsXml = "";
        for (let k = 3; k < totalPurposes; k++) {
          const item = activePurposes[k];
          const newR = 18 + (k - 3);

          const poIdx = addSharedString(item.poNumber || "");
          const purpIdx = addSharedString(item.purposeText || "", true);

          const grossVal = (data[`GROSS_${k+1}`] !== undefined && data[`GROSS_${k+1}`] !== "")
            ? data[`GROSS_${k+1}`]
            : (item && item.gross && item.gross > 0 ? formatVal(item.gross) : "");

          const absEwt = item ? ((item.gross || 0) * (item.ewt || 0) / 100) : 0;
          const ewtVal = (data[`EWT_${k+1}`] !== undefined && data[`EWT_${k+1}`] !== "")
            ? data[`EWT_${k+1}`]
            : (absEwt > 0 ? formatVal(absEwt) : "");

          const totalVal = (data[`TOTAL_${k+1}`] !== undefined && data[`TOTAL_${k+1}`] !== "")
            ? data[`TOTAL_${k+1}`]
            : (item && item.total && item.total > 0 ? formatVal(item.total) : "");

          let rowXml = row17Xml;
          rowXml = rowXml.replace(/r="17"/g, `r="${newR}"`);
          rowXml = rowXml.replace(/r="([A-Z]+)17"/g, `r="$1${newR}"`);

          // Set cell A${newR} (PO_NO) with stylePO from Row 15 (First Entry)
          rowXml = replaceExactCell(
            rowXml,
            `A${newR}`,
            `<c r="A${newR}" s="${stylePO}" t="s"><v>${poIdx}</v></c>`
          );
          rowXml = replaceExactCell(
            rowXml,
            `B${newR}`,
            `<c r="B${newR}" s="${stylePO}"/>`
          );

          // Set cell C${newR} (PURPOSE) with stylePurpose from Row 15 (First Entry)
          rowXml = replaceExactCell(
            rowXml,
            `C${newR}`,
            `<c r="C${newR}" s="${stylePurpose}" t="s"><v>${purpIdx}</v></c>`
          );
          for (const col of ["D", "E", "F", "G", "H", "I", "J"]) {
            rowXml = replaceExactCell(
              rowXml,
              `${col}${newR}`,
              `<c r="${col}${newR}" s="${stylePurpose}"/>`
            );
          }

          // Set cell K${newR} (GROSS) with styleGross from Row 15 (First Entry)
          const grossCell = grossVal
            ? `<c r="K${newR}" s="${styleGross}" t="inlineStr"><is><t>${escapeXml(grossVal)}</t></is></c>`
            : `<c r="K${newR}" s="${styleGross}"/>`;
          rowXml = replaceExactCell(
            rowXml,
            `K${newR}`,
            grossCell
          );
          for (const col of ["L", "M"]) {
            rowXml = replaceExactCell(
              rowXml,
              `${col}${newR}`,
              `<c r="${col}${newR}" s="${styleGross}"/>`
            );
          }

          // Set cell N${newR} (EWT) with styleEwt from Row 15 (First Entry)
          const ewtCell = ewtVal
            ? `<c r="N${newR}" s="${styleEwt}" t="inlineStr"><is><t>${escapeXml(ewtVal)}</t></is></c>`
            : `<c r="N${newR}" s="${styleEwt}"/>`;
          rowXml = replaceExactCell(
            rowXml,
            `N${newR}`,
            ewtCell
          );
          for (const col of ["O", "P", "Q"]) {
            rowXml = replaceExactCell(
              rowXml,
              `${col}${newR}`,
              `<c r="${col}${newR}" s="${styleEwt}"/>`
            );
          }

          // Set cell T${newR} (TOTAL) with styleTotal from Row 15 (First Entry)
          const totalCell = totalVal
            ? `<c r="T${newR}" s="${styleTotal}" t="inlineStr"><is><t>${escapeXml(totalVal)}</t></is></c>`
            : `<c r="T${newR}" s="${styleTotal}"/>`;
          rowXml = replaceExactCell(
            rowXml,
            `T${newR}`,
            totalCell
          );
          rowXml = replaceExactCell(
            rowXml,
            `U${newR}`,
            `<c r="U${newR}" s="${styleTotal}"/>`
          );

          newRowsXml += rowXml;

          // Ensure merge cell ranges for dynamic extra row
          sheet1Xml = ensureMergeCellRange(sheet1Xml, `A${newR}:B${newR}`);
          sheet1Xml = ensureMergeCellRange(sheet1Xml, `C${newR}:J${newR}`);
          sheet1Xml = ensureMergeCellRange(sheet1Xml, `K${newR}:M${newR}`);
          sheet1Xml = ensureMergeCellRange(sheet1Xml, `N${newR}:Q${newR}`);
          sheet1Xml = ensureMergeCellRange(sheet1Xml, `T${newR}:U${newR}`);
        }

        // Insert new rows immediately after Row 17
        sheet1Xml = sheet1Xml.replace(/<row r="17"[^>]*>.*?<\/row>/s, (m) => m + newRowsXml);

        // Update sheet dimensions
        sheet1Xml = sheet1Xml.replace(/<dimension ref="([A-Z]+\d+):([A-Z]+)(\d+)"\/>/, (m, p1, col2, lastRStr) => {
          const lastR = parseInt(lastRStr, 10) + extraRows;
          return `<dimension ref="${p1}:${col2}${lastR}"/>`;
        });
      }

      // Automatically insert Grand Total row directly beneath the last payment entry
      let grandTotalNum = 0;
      for (let k = 0; k < totalPurposes; k++) {
        const item = activePurposes[k];
        let entryTot = 0;
        if (item && typeof item.total === "number" && item.total > 0) {
          entryTot = item.total;
        } else if (item && typeof item.gross === "number" && item.gross > 0) {
          const absEwt = (item.gross * (item.ewt || 0)) / 100;
          entryTot = item.gross - absEwt;
        } else {
          const totalStr = data[`TOTAL_${k+1}`] || (k === 0 ? data.TOTAL : "");
          if (totalStr) {
            const parsed = parseFloat(String(totalStr).replace(/,/g, ""));
            if (!isNaN(parsed)) entryTot = parsed;
          }
        }
        grandTotalNum += entryTot;
      }
      if (grandTotalNum === 0 && data.TOTAL) {
        const parsedTotal = parseFloat(String(data.TOTAL).replace(/,/g, ""));
        if (!isNaN(parsedTotal)) grandTotalNum = parsedTotal;
      }

      if (hasCalculationValues && totalPurposes > 0 && grandTotalNum > 0) {
        const formattedGrandTotal = formatVal(grandTotalNum);
        const gtRow = 15 + totalPurposes;

        const gtRowMatch = sheet1Xml.match(new RegExp(`<row r="${gtRow}"[^>]*>.*?<\\/row>`, "s"));
        const tCell = `<c r="T${gtRow}" s="${styleGrandTotal}" t="inlineStr"><is><t>${escapeXml(formattedGrandTotal)}</t></is></c>`;
        const uCell = `<c r="U${gtRow}" s="${styleGrandTotal}"/>`;

        if (gtRowMatch) {
          let rowXml = gtRowMatch[0];
          // Ensure row height is expanded so Grand Total value is fully visible without clipping
          rowXml = rowXml
            .replace(/\bht="[^"]*"\s*/g, "")
            .replace(/\bcustomHeight="[^"]*"\s*/g, "")
            .replace(`<row r="${gtRow}"`, `<row r="${gtRow}" ht="22" customHeight="1"`);

          if (rowXml.includes(`r="T${gtRow}"`)) {
            rowXml = replaceExactCell(rowXml, `T${gtRow}`, tCell);
          } else {
            rowXml = rowXml.replace("</row>", `${tCell}</row>`);
          }
          if (rowXml.includes(`r="U${gtRow}"`)) {
            rowXml = replaceExactCell(rowXml, `U${gtRow}`, uCell);
          } else {
            rowXml = rowXml.replace("</row>", `${uCell}</row>`);
          }
          sheet1Xml = sheet1Xml.replace(gtRowMatch[0], rowXml);
        } else {
          const prevRow = gtRow - 1;
          const prevRowMatch = sheet1Xml.match(new RegExp(`<row r="${prevRow}"[^>]*>.*?<\\/row>`, "s"));
          if (prevRowMatch) {
            const newRowXml = `<row r="${gtRow}" ht="22" customHeight="1">${tCell}${uCell}</row>`;
            sheet1Xml = sheet1Xml.replace(prevRowMatch[0], prevRowMatch[0] + newRowXml);
          }
        }

        sheet1Xml = ensureMergeCellRange(sheet1Xml, `T${gtRow}:U${gtRow}`);
      }

      if (sheet1Xml) {
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

      // Ensure [Content_Types].xml has PNG and JPEG image content types
      let contentTypesXml = originalZip.file("[Content_Types].xml")?.asText() || "";
      if (contentTypesXml && !contentTypesXml.includes('Extension="png"')) {
        contentTypesXml = contentTypesXml.replace(
          '</Types>',
          '  <Default Extension="png" ContentType="image/png"/>\n  <Default Extension="jpeg" ContentType="image/jpeg"/>\n  <Default Extension="jpg" ContentType="image/jpeg"/>\n</Types>'
        );
        originalZip.file("[Content_Types].xml", contentTypesXml);
      }

      // 3. Inject relationships to xl/drawings/_rels/drawing1.xml.rels
      let drawingRelsXml = originalZip.file("xl/drawings/_rels/drawing1.xml.rels")?.asText() || "";
      if (drawingRelsXml && !drawingRelsXml.includes("rIdImg1")) {
        const rel1 = `<Relationship Id="rIdImg1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image2.png"/>`;
        const rel2 = `<Relationship Id="rIdImg2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image3.png"/>`;
        drawingRelsXml = drawingRelsXml.replace("</Relationships>", `${rel1}${rel2}</Relationships>`);
        originalZip.file("xl/drawings/_rels/drawing1.xml.rels", drawingRelsXml);
      }

      // 4. Set picture anchors matching exact updated frame boundaries to completely fill the frame:
      // Rectangle 1 (Loading photo frame): D29 to H41 (col 3 row 28 to col 7 row 40)
      const lAnchor = {
        fromCol: 3, fromColOff: 39329,
        fromRow: 28, fromRowOff: 35007,
        toCol: 7, toColOff: 607219,
        toRow: 40, toRowOff: 154780,
      };

      // Rectangle 4 (Unloading photo frame): D58 to H71 (col 3 row 57 to col 7 row 70)
      const uAnchor = {
        fromCol: 3, fromColOff: 41132,
        fromRow: 57, fromRowOff: 17859,
        toCol: 7, toColOff: 609022,
        toRow: 70, toRowOff: 6663,
      };

      // Inject picture elements to xl/drawings/drawing1.xml
      let drawingXml = originalZip.file("xl/drawings/drawing1.xml")?.asText() || "";
      if (drawingXml && !drawingXml.includes("LoadingPhoto")) {
        if (!drawingXml.includes("xmlns:r=")) {
          drawingXml = drawingXml.replace(
            '<xdr:wsDr ',
            '<xdr:wsDr xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
          );
        }

        const loadingPicAnchor = `
          <xdr:twoCellAnchor editAs="oneCell">
            <xdr:from>
              <xdr:col>${lAnchor.fromCol}</xdr:col>
              <xdr:colOff>${lAnchor.fromColOff}</xdr:colOff>
              <xdr:row>${lAnchor.fromRow}</xdr:row>
              <xdr:rowOff>${lAnchor.fromRowOff}</xdr:rowOff>
            </xdr:from>
            <xdr:to>
              <xdr:col>${lAnchor.toCol}</xdr:col>
              <xdr:colOff>${lAnchor.toColOff}</xdr:colOff>
              <xdr:row>${lAnchor.toRow}</xdr:row>
              <xdr:rowOff>${lAnchor.toRowOff}</xdr:rowOff>
            </xdr:to>
            <xdr:pic>
              <xdr:nvPicPr>
                <xdr:cNvPr id="1001" name="LoadingPhoto"/>
                <xdr:cNvPicPr>
                  <a:picLocks noChangeAspect="0"/>
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
              <xdr:col>${uAnchor.fromCol}</xdr:col>
              <xdr:colOff>${uAnchor.fromColOff}</xdr:colOff>
              <xdr:row>${uAnchor.fromRow}</xdr:row>
              <xdr:rowOff>${uAnchor.fromRowOff}</xdr:rowOff>
            </xdr:from>
            <xdr:to>
              <xdr:col>${uAnchor.toCol}</xdr:col>
              <xdr:colOff>${uAnchor.toColOff}</xdr:colOff>
              <xdr:row>${uAnchor.toRow}</xdr:row>
              <xdr:rowOff>${uAnchor.toRowOff}</xdr:rowOff>
            </xdr:to>
            <xdr:pic>
              <xdr:nvPicPr>
                <xdr:cNvPr id="1002" name="UnloadingPhoto"/>
                <xdr:cNvPicPr>
                  <a:picLocks noChangeAspect="0"/>
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
      let baseSheetXml = originalZip.file("xl/worksheets/sheet13.xml")?.asText() || originalZip.file("xl/worksheets/sheet1.xml")?.asText() || "";
      let baseSheetRels = originalZip.file("xl/worksheets/_rels/sheet13.xml.rels")?.asText() || originalZip.file("xl/worksheets/_rels/sheet1.xml.rels")?.asText() || "";

      // Helper to ensure numeric values are written as true Excel numbers (not text)
      const cleanNumeric = (val: any): any => {
        if (val === undefined || val === null || val === "" || isNaN(Number(val))) {
          return "";
        }
        return Number(val);
      };

      const hazwasteGroupsToProcess = (data._hazwasteGroups && Array.isArray(data._hazwasteGroups) && data._hazwasteGroups.length > 0)
        ? data._hazwasteGroups
        : [
            {
              sheetName: data.SHEET_NAME || getHazwasteSheetName(data.CLIENT || "COMPANY", data.DATE),
              client: data.CLIENT || "",
              manifestNo: data.MANIFEST || "",
              date: data.DATE || "",
              quantityKg: data.QUANTITY || 0,
              mrrNo: data.MRR_NO || "",
              recycle: data.RECYCLE || "N/A",
              preparedBy: data.PREPARED_BY || "",
              preparedPosition: data.PREPARED_POSITION || "",
              checkedApprovedBy: data.CHECKED_APPROVED_BY || "",
              checkedApprovedPosition: data.CHECKED_APPROVED_POSITION || "",
              items: (items && items.length > 0) ? items : (data.items || []),
              totalQty: data.TOTAL_QTY,
              totalHaz: data.TOTAL_HAZ_WASTE,
              totalTsd: data.TOTAL_LOCAL_TSD,
              totalNonHaz: data.TOTAL_NON_HAZ
            }
          ];

      let workbookXml = originalZip.file("xl/workbook.xml")?.asText() || "";
      let workbookRelsXml = originalZip.file("xl/_rels/workbook.xml.rels")?.asText() || "";
      let contentTypesXml = originalZip.file("[Content_Types].xml")?.asText() || "";

      let sheetsXmlStr = "<sheets>";
      let definedNamesStr = "<definedNames>";

      hazwasteGroupsToProcess.forEach((group: any, i: number) => {
        const sheetIndex = i + 1;
        const sheetFileName = `xl/worksheets/sheet${sheetIndex}.xml`;
        const sheetRelsFileName = `xl/worksheets/_rels/sheet${sheetIndex}.xml.rels`;
        const rId = i === 0 ? "rId1" : `rId${20 + i}`;

        let sheetXml = baseSheetXml;
        const groupItems = group.items || [];

        // Compute items totals if not precomputed
        let sumQty = 0;
        let sumHaz = 0;
        let sumTsd = 0;
        let sumNonHaz = 0;
        groupItems.forEach((it: any) => {
          if (it.qty !== undefined && it.qty !== null && !isNaN(Number(it.qty))) sumQty += Number(it.qty);
          if (it.haz_waste !== undefined && it.haz_waste !== null && !isNaN(Number(it.haz_waste))) sumHaz += Number(it.haz_waste);
          if (it.local_tsd !== undefined && it.local_tsd !== null && !isNaN(Number(it.local_tsd))) sumTsd += Number(it.local_tsd);
          if (it.non_haz !== undefined && it.non_haz !== null && !isNaN(Number(it.non_haz))) sumNonHaz += Number(it.non_haz);
        });

        const gTotalQty = group.totalQty !== undefined ? group.totalQty : sumQty;
        const gTotalHaz = group.totalHaz !== undefined ? group.totalHaz : sumHaz;
        const gTotalTsd = group.totalTsd !== undefined ? group.totalTsd : sumTsd;
        const gTotalNonHaz = group.totalNonHaz !== undefined ? group.totalNonHaz : sumNonHaz;

        // Header injections
        sheetXml = injectCellValue(sheetXml, "C2", group.client || "", true);
        sheetXml = injectCellValue(sheetXml, "G2", group.date || "", true);
        sheetXml = injectCellValue(sheetXml, "C3", group.manifestNo || "", true);
        sheetXml = injectCellValue(sheetXml, "G3", group.recycle || "N/A", true);
        sheetXml = injectCellValue(sheetXml, "C4", group.quantityKg !== undefined ? cleanNumeric(group.quantityKg) : "", false);
        sheetXml = injectCellValue(sheetXml, "G4", group.mrrNo || "", true);

        sheetXml = injectCellValue(sheetXml, "A23", group.preparedBy || "", true);
        sheetXml = injectCellValue(sheetXml, "A24", group.preparedPosition ? ` ${group.preparedPosition}` : "", true);
        sheetXml = injectCellValue(sheetXml, "D23", group.checkedApprovedBy || "", true);
        sheetXml = injectCellValue(sheetXml, "D24", group.checkedApprovedPosition || "", true);

        // Extract reference styles from Row 7 (the first entry in the table)
        const refStyles: { [col: string]: string } = {};
        ["A", "B", "C", "D", "E", "F", "G", "H"].forEach((col) => {
          const m = baseSheetXml.match(new RegExp(`<c\\s+[^>]*?\\br="${col}7"[^>]*?\\bs="(\\d+)"`, "i"));
          if (m) {
            refStyles[col] = m[1];
          }
        });

        // Inject Items 1 to 11 in rows 7 to 17
        for (let j = 0; j < 11; j++) {
          const rowNum = 7 + j;
          const item = groupItems[j];

          const itemClass = item ? (item.classification || "104") : "";
          const desc = item ? (item.description || "") : "";
          const qty = item ? cleanNumeric(item.qty) : "";
          const pct = item ? (item.percentage !== undefined ? cleanNumeric(item.percentage) / 100 : "") : "";
          const hw = item ? cleanNumeric(item.haz_waste) : "";
          const lt = item ? cleanNumeric(item.local_tsd) : "";
          const nh = item ? cleanNumeric(item.non_haz) : "";
          const rem = item ? (item.remarks || "") : "";

          sheetXml = injectCellValue(sheetXml, `A${rowNum}`, itemClass, true, false, refStyles["A"]);
          sheetXml = injectCellValue(sheetXml, `B${rowNum}`, desc, true, false, refStyles["B"]);
          sheetXml = injectCellValue(sheetXml, `C${rowNum}`, qty, false, false, refStyles["C"]);
          sheetXml = injectCellValue(sheetXml, `D${rowNum}`, pct, false, false, refStyles["D"]);
          sheetXml = injectCellValue(sheetXml, `E${rowNum}`, hw, false, false, refStyles["E"]);
          sheetXml = injectCellValue(sheetXml, `F${rowNum}`, lt, false, false, refStyles["F"]);
          sheetXml = injectCellValue(sheetXml, `G${rowNum}`, nh, false, false, refStyles["G"]);
          sheetXml = injectCellValue(sheetXml, `H${rowNum}`, rem, true, false, refStyles["H"]);
        }

        // Inject Totals into row 18
        sheetXml = injectCellValue(sheetXml, "C18", cleanNumeric(gTotalQty), false);
        sheetXml = injectCellValue(sheetXml, "E18", cleanNumeric(gTotalHaz), false);
        sheetXml = injectCellValue(sheetXml, "F18", cleanNumeric(gTotalTsd), false);
        sheetXml = injectCellValue(sheetXml, "G18", cleanNumeric(gTotalNonHaz), false);

        originalZip.file(sheetFileName, sheetXml);
        if (baseSheetRels) {
          originalZip.file(sheetRelsFileName, baseSheetRels);
        }

        const cleanSheetName = escapeXml(group.sheetName || `Sheet${sheetIndex}`);
        sheetsXmlStr += `<sheet name="${cleanSheetName}" sheetId="${sheetIndex}" r:id="${rId}"/>`;
        definedNamesStr += `<definedName name="_xlnm.Print_Area" localSheetId="${i}">${cleanSheetName.includes(' ') ? `'${cleanSheetName}'` : cleanSheetName}!$A$1:$H$52</definedName>`;

        if (!workbookRelsXml.includes(`Id="${rId}"`)) {
          workbookRelsXml = workbookRelsXml.replace(
            '</Relationships>',
            `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${sheetIndex}.xml"/></Relationships>`
          );
        } else {
          workbookRelsXml = workbookRelsXml.replace(
            new RegExp(`<Relationship\\s+[^>]*?Id="${rId}"[^>]*?/>`),
            `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${sheetIndex}.xml"/>`
          );
        }

        if (!contentTypesXml.includes(`PartName="/${sheetFileName}"`)) {
          contentTypesXml = contentTypesXml.replace(
            '</Types>',
            `<Override PartName="/${sheetFileName}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`
          );
        }
      });

      // Remove unused template worksheets (original template had up to sheet13)
      for (let s = hazwasteGroupsToProcess.length + 1; s <= 20; s++) {
        originalZip.remove(`xl/worksheets/sheet${s}.xml`);
        originalZip.remove(`xl/worksheets/_rels/sheet${s}.xml.rels`);
      }

      sheetsXmlStr += "</sheets>";
      definedNamesStr += "</definedNames>";

      workbookXml = workbookXml.replace(/<sheets>[\s\S]*?<\/sheets>/, sheetsXmlStr);
      workbookXml = workbookXml.replace(/activeTab="\d+"/, 'activeTab="0"').replace(/firstSheet="\d+"/, 'firstSheet="0"');
      if (workbookXml.includes("<definedNames>")) {
        workbookXml = workbookXml.replace(/<definedNames>[\s\S]*?<\/definedNames>/, definedNamesStr);
      } else {
        workbookXml = workbookXml.replace("</workbook>", `${definedNamesStr}</workbook>`);
      }

      // Remove calculation chain to prevent corrupt formula chain repair warning in Excel
      originalZip.remove("xl/calcChain.xml");
      workbookRelsXml = workbookRelsXml.replace(/<Relationship[^>]+Type="[^"]+calcChain"[^>]*\/>/g, "");

      originalZip.file("xl/workbook.xml", workbookXml);
      originalZip.file("xl/_rels/workbook.xml.rels", workbookRelsXml);
      originalZip.file("[Content_Types].xml", contentTypesXml);
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

      let sheet1Xml = originalZip.file("xl/worksheets/sheet1.xml")?.asText() || "";
      if (sheet1Xml) {
        // Clean cached placeholder values inside sheet1.xml formula cells
        sheet1Xml = sheet1Xml.replace(/<v>\{\{[^}]+\}\}<\/v>/g, "<v/>");

        // Helper to get description for item index
        const getDescForIdx = (idx: number): string => {
          if (data[`DESCRIPTION${idx}`] !== undefined && data[`DESCRIPTION${idx}`] !== null) return String(data[`DESCRIPTION${idx}`] || "");
          if (data[`DESCRIPTION_${idx}`] !== undefined && data[`DESCRIPTION_${idx}`] !== null) return String(data[`DESCRIPTION_${idx}`] || "");
          if (items && items[idx - 1] && items[idx - 1].description !== undefined) return String(items[idx - 1].description || "");
          return "";
        };

        // Helper to count wrapped lines based on capacity and explicit newlines
        const countWrappedLines = (text: string, capacity = 50): number => {
          if (!text || !text.trim()) return 1;
          const rawLines = text.split(/\r?\n/);
          let totalLines = 0;
          for (const rawLine of rawLines) {
            if (!rawLine.trim()) {
              totalLines += 1;
              continue;
            }
            const words = rawLine.split(/\s+/);
            let currentLineLen = 0;
            let lineCount = 1;
            for (const word of words) {
              if (word.length === 0) continue;
              if (currentLineLen === 0) {
                if (word.length > capacity) {
                  lineCount += Math.floor((word.length - 1) / capacity);
                  currentLineLen = word.length % capacity;
                } else {
                  currentLineLen = word.length;
                }
              } else {
                if (currentLineLen + 1 + word.length <= capacity) {
                  currentLineLen += 1 + word.length;
                } else {
                  lineCount += 1;
                  if (word.length > capacity) {
                    lineCount += Math.floor((word.length - 1) / capacity);
                    currentLineLen = word.length % capacity;
                  } else {
                    currentLineLen = word.length;
                  }
                }
              }
            }
            totalLines += lineCount;
          }
          return totalLines;
        };

        // Helper to calculate required row height based on description text length and wrapping
        const calcRowHeight = (descText: string): number => {
          if (!descText || !descText.trim()) return 14.25;
          if (descText === "*****NOTHING FOLLOWS*****") return 14.25;
          const totalLines = countWrappedLines(descText, 50);
          return Math.max(14.25, totalLines * 14.25);
        };

        // Standard 8 item rows in template are rows 26 through 33
        for (let idx = 1; idx <= 8; idx++) {
          const r = 25 + idx; // row 26 to 33
          const desc = getDescForIdx(idx);
          const ht = calcRowHeight(desc);

          // Update height on row r while preserving existing row attributes
          const rowTagRegex = new RegExp(`<row r="${r}"([^>]*)>`, "g");
          sheet1Xml = sheet1Xml.replace(rowTagRegex, (m, p1) => {
            const cleanP1 = p1.replace(/\s*ht="[^"]*"/g, "").replace(/\s*customHeight="[^"]*"/g, "");
            return `<row r="${r}"${cleanP1} ht="${ht}" customHeight="1">`;
          });
        }

        // Ensure row 33 C33 uses style 201 (matching C26..C32) instead of style 206
        sheet1Xml = sheet1Xml.replace(/<c r="C33" s="206"/g, '<c r="C33" s="201"');

        // Check for extra items beyond 8 items
        const rawItemsCount = items ? items.length : 0;
        let activeItemsCount = Math.max(8, rawItemsCount);
        let checkIdx = 9;
        while (getDescForIdx(checkIdx) !== "" || checkIdx <= rawItemsCount) {
          activeItemsCount = Math.max(activeItemsCount, checkIdx);
          checkIdx++;
        }

        if (activeItemsCount > 8) {
          const extraRows = activeItemsCount - 8;

          const addSharedString = (text: string, isDesc: boolean = false): number => {
            const matches = sharedStringsXml.match(/<si>/g);
            const currIdx = matches ? matches.length : 0;
            const escapedText = escapeXml(text || "");
            let newSi = "";
            if (isDesc) {
              const totalLines = countWrappedLines(text, 50);
              const fontSize = totalLines >= 5 ? 9 : 10;
              newSi = `<si><r><rPr><sz val="${fontSize}"/><rFont val="Verdana"/><color rgb="FF000000"/></rPr><t>${escapedText}</t></r></si>`;
            } else {
              newSi = `<si><t>${escapedText}</t></si>`;
            }
            sharedStringsXml = sharedStringsXml.replace("</sst>", `${newSi}</sst>`);
            const countMatch = sharedStringsXml.match(/count="(\d+)"/);
            const uniqueMatch = sharedStringsXml.match(/uniqueCount="(\d+)"/);
            if (countMatch) {
              const count = parseInt(countMatch[1], 10);
              sharedStringsXml = sharedStringsXml.replace(`count="${count}"`, `count="${count + 1}"`);
            }
            if (uniqueMatch) {
              const ucount = parseInt(uniqueMatch[1], 10);
              sharedStringsXml = sharedStringsXml.replace(`uniqueCount="${ucount}"`, `uniqueCount="${ucount + 1}"`);
            }
            return currIdx;
          };

          // Shift merged cells starting at or after row 34 down by extraRows
          sheet1Xml = sheet1Xml.replace(/<mergeCell ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/g, (m, col1, r1Str, col2, r2Str) => {
            let r1 = parseInt(r1Str, 10);
            let r2 = parseInt(r2Str, 10);
            if (r1 >= 34) r1 += extraRows;
            if (r2 >= 34) r2 += extraRows;
            return `<mergeCell ref="${col1}${r1}:${col2}${r2}"/>`;
          });

          // Shift row tags and cells >= 34 down
          const existingRowMatches: Array<{ r: number; full: string }> = [];
          const rowTagRegex = /<row r="(\d+)"[^>]*>[\s\S]*?<\/row>/g;
          let rm: RegExpExecArray | null;
          while ((rm = rowTagRegex.exec(sheet1Xml)) !== null) {
            const rNum = parseInt(rm[1], 10);
            existingRowMatches.push({ r: rNum, full: rm[0] });
          }

          existingRowMatches.sort((a, b) => b.r - a.r);
          for (const rowObj of existingRowMatches) {
            if (rowObj.r >= 34) {
              const oldR = rowObj.r;
              const newR = oldR + extraRows;
              let newRowXml = rowObj.full;
              newRowXml = newRowXml.replace(new RegExp(`r="${oldR}"`, "g"), `r="${newR}"`);
              newRowXml = newRowXml.replace(new RegExp(`r="([A-Z]+)${oldR}"`, "g"), `r="$1${newR}"`);
              sheet1Xml = sheet1Xml.replace(rowObj.full, newRowXml);
            }
          }

          // Extract template for extra item row from Row 32
          const row32Match = sheet1Xml.match(/<row r="32"[^>]*>[\s\S]*?<\/row>/);
          const row32Xml = row32Match ? row32Match[0] : "";

          let newRowsXml = "";
          for (let k = 8; k < activeItemsCount; k++) {
            const idx = k + 1; // 9, 10, ...
            const newR = 25 + idx; // 34, 35, ...
            const itemObj = items ? items[k] : null;

            const qtyVal = data[`QUANTITY${idx}`] !== undefined ? String(data[`QUANTITY${idx}`]) : (itemObj ? String(itemObj.quantity || "") : "");
            const unitVal = data[`UNIT${idx}`] !== undefined ? String(data[`UNIT${idx}`]) : (itemObj ? String(itemObj.unit || "") : "");
            const descVal = getDescForIdx(idx);
            const priceVal = data[`UNIT_PRICE${idx}`] !== undefined ? String(data[`UNIT_PRICE${idx}`]) : (itemObj ? String(itemObj.unitPrice || "") : "");
            const amountVal = data[`AMOUNT${idx}`] !== undefined ? String(data[`AMOUNT${idx}`]) : (itemObj ? String(itemObj.amount || "") : "");

            const ht = calcRowHeight(descVal);

            const qtyIdx = qtyVal ? addSharedString(qtyVal) : -1;
            const unitIdx = unitVal ? addSharedString(unitVal) : -1;
            const descIdx = descVal ? addSharedString(descVal, true) : -1;
            const priceIdx = priceVal ? addSharedString(priceVal) : -1;
            const amountIdx = amountVal ? addSharedString(amountVal) : -1;

            let rowXml = row32Xml || `<row r="${newR}" spans="1:18" ht="${ht}" customHeight="1" x14ac:dyDescent="0.2"/>`;
            rowXml = rowXml.replace(/r="32"/g, `r="${newR}"`);
            rowXml = rowXml.replace(/r="([A-Z]+)32"/g, `r="$1${newR}"`);
            rowXml = rowXml.replace(/ht="[^"]*"/, `ht="${ht}"`);

            // Replace cell contents
            rowXml = replaceExactCell(rowXml, `A${newR}`, qtyIdx >= 0 ? `<c r="A${newR}" s="101" t="s"><v>${qtyIdx}</v></c>` : `<c r="A${newR}" s="101"/>`);
            rowXml = replaceExactCell(rowXml, `B${newR}`, unitIdx >= 0 ? `<c r="B${newR}" s="102" t="s"><v>${unitIdx}</v></c>` : `<c r="B${newR}" s="102"/>`);
            rowXml = replaceExactCell(rowXml, `C${newR}`, descIdx >= 0 ? `<c r="C${newR}" s="201" t="s"><v>${descIdx}</v></c>` : `<c r="C${newR}" s="201"/>`);
            rowXml = replaceExactCell(rowXml, `D${newR}`, `<c r="D${newR}" s="202"/>`);
            rowXml = replaceExactCell(rowXml, `E${newR}`, `<c r="E${newR}" s="203"/>`);
            rowXml = replaceExactCell(rowXml, `F${newR}`, priceIdx >= 0 ? `<c r="F${newR}" s="107" t="s"><v>${priceIdx}</v></c>` : `<c r="F${newR}" s="107"/>`);
            rowXml = replaceExactCell(rowXml, `G${newR}`, amountIdx >= 0 ? `<c r="G${newR}" s="114" t="s"><v>${amountIdx}</v></c>` : `<c r="G${newR}" s="114"/>`);

            newRowsXml += rowXml;

            // Ensure merge cells for C:E and G:H on new row
            sheet1Xml = ensureMergeCellRange(sheet1Xml, `C${newR}:E${newR}`);
            sheet1Xml = ensureMergeCellRange(sheet1Xml, `G${newR}:H${newR}`);
          }

          // Insert new rows immediately after row 33
          const row33Match = sheet1Xml.match(/<row r="33"[^>]*>[\s\S]*?<\/row>/);
          if (row33Match) {
            sheet1Xml = sheet1Xml.replace(row33Match[0], `${row33Match[0]}${newRowsXml}`);
          }
        }

        originalZip.file("xl/worksheets/sheet1.xml", sheet1Xml);
      }

      // Remove calculation chain to prevent corrupt formula chain repair warning in Excel
      originalZip.remove("xl/calcChain.xml");
      let workbookRelsXml = originalZip.file("xl/_rels/workbook.xml.rels")?.asText() || "";
      if (workbookRelsXml) {
        workbookRelsXml = workbookRelsXml.replace(/<Relationship[^>]+Type="[^"]+calcChain"[^>]*\/>/g, "");
        originalZip.file("xl/_rels/workbook.xml.rels", workbookRelsXml);
      }
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
          `<xf numFmtId="43" fontId="9" fillId="2" borderId="1" xfId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>`,
          `<xf numFmtId="43" fontId="9" fillId="2" borderId="1" xfId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center" wrapText="1"/></xf>`
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

      let baseSheetXml = originalZip.file("xl/worksheets/sheet1.xml")?.asText() || "";
      let baseSheetRels = originalZip.file("xl/worksheets/_rels/sheet1.xml.rels")?.asText() || "";

      // Strip tableParts from baseSheetXml to prevent duplicate table object conflicts across worksheets
      baseSheetXml = baseSheetXml.replace(/<tableParts[^>]*>[\s\S]*?<\/tableParts>/g, "");

      const weeklyGroupsToProcess = (data._weeklyGroups && Array.isArray(data._weeklyGroups) && data._weeklyGroups.length > 0)
        ? data._weeklyGroups
        : [
            {
              sheetName: data.SHEET_NAME || "JAN 1ST",
              haulingDate: data.DATE_COMPLETED || data.HAULING_DATE || "",
              signatoryName: data.SIGNED_BY || data.SIGNATORY_NAME || "",
              signatoryPosition: data.POSITION || data.SIGNATORY_POSITION || "",
              totalQty: data.TOTAL_QTY || data.TOTAL_QUANTITY || "",
              records: (items && items.length > 0) ? items : (data._records || []),
            }
          ];

      let workbookXml = originalZip.file("xl/workbook.xml")?.asText() || "";
      let workbookRelsXml = originalZip.file("xl/_rels/workbook.xml.rels")?.asText() || "";
      let contentTypesXml = originalZip.file("[Content_Types].xml")?.asText() || "";

      let sheetsXmlStr = "<sheets>";
      let definedNamesStr = "<definedNames>";

      weeklyGroupsToProcess.forEach((group: any, i: number) => {
        const sheetIndex = i + 1;
        const sheetFileName = `xl/worksheets/sheet${sheetIndex}.xml`;
        const sheetRelsFileName = `xl/worksheets/_rels/sheet${sheetIndex}.xml.rels`;
        const rId = i === 0 ? "rId1" : `rId${10 + i}`;

        let sheetXml = baseSheetXml;
        const records = group.records || [];
        const totalRecords = records.length;
        const maxRow = 27 + Math.max(6, totalRecords);
        const overflow = totalRecords > 21 ? totalRecords - 21 : 0;

        if (overflow > 0) {
          // Shift rows 49+ down by overflow
          sheetXml = sheetXml.replace(/<row r="(\d+)"([^>]*)>/g, (match, rNumStr, rest) => {
            const rNum = parseInt(rNumStr);
            return rNum >= 49 ? `<row r="${rNum + overflow}"${rest}>` : match;
          });
          // Shift cell references in rows 49+
          sheetXml = sheetXml.replace(/<c r="([A-Z]+)(\d+)"/g, (match, col, rNumStr) => {
            const rNum = parseInt(rNumStr);
            return rNum >= 49 ? `<c r="${col}${rNum + overflow}"` : match;
          });
          // Shift mergeCells in rows 49+
          sheetXml = sheetXml.replace(/<mergeCell ref="([^"]+)"\/>/g, (match, ref) => {
            const newRef = ref.replace(/([A-Z]+)(\d+)/g, (cellMatch, col, rNumStr) => {
              const rNum = parseInt(rNumStr);
              return rNum >= 49 ? `${col}${rNum + overflow}` : cellMatch;
            });
            return `<mergeCell ref="${newRef}"/>`;
          });
        }

        // Calculate sumKg
        let sumKg = 0;
        records.forEach((rec: any) => {
          if (rec && rec.quantity !== undefined && rec.quantity !== null && rec.quantity !== "" && !isNaN(Number(rec.quantity))) {
            sumKg += Number(rec.quantity) * 1000;
          }
        });
        const formattedTotalQty = group.totalQty || (Number.isInteger(sumKg)
          ? sumKg.toLocaleString("en-US")
          : sumKg.toLocaleString("en-US", { maximumFractionDigits: 3 }));

        const haulingDateStr = group.haulingDate || data.DATE_COMPLETED || data.HAULING_DATE || "";
        const sigNameStr = group.signatoryName || data.SIGNED_BY || data.SIGNATORY_NAME || "";
        const sigPosStr = group.signatoryPosition || data.POSITION || data.SIGNATORY_POSITION || "";

        // Replace header placeholders (C9: hauling date)
        sheetXml = sheetXml.replace(
          /<c r="C9"[^>]*t="s"[^>]*><v>142<\/v><\/c>/,
          `<c r="C9" s="48" t="inlineStr"><is><t>${escapeXml(haulingDateStr)}</t></is></c>`
        );

        // Replace footer placeholders
        const rowTotal = 51 + overflow;
        const rowSigned = 59 + overflow;
        const rowPos = 60 + overflow;

        const totalRegex = new RegExp(`<c r="G${rowTotal}"[^>]*t="s"[^>]*><v>181<\\/v><\\/c>`);
        sheetXml = sheetXml.replace(
          totalRegex,
          `<c r="G${rowTotal}" s="29" t="inlineStr"><is><t>${escapeXml(formattedTotalQty)}</t></is></c>`
        );

        const signedRegex = new RegExp(`<c r="C${rowSigned}"[^>]*t="s"[^>]*><v>179<\\/v><\\/c>`);
        sheetXml = sheetXml.replace(
          signedRegex,
          `<c r="C${rowSigned}" s="9" t="inlineStr"><is><t>${escapeXml(sigNameStr)}</t></is></c>`
        );

        const posRegex = new RegExp(`<c r="C${rowPos}"[^>]*t="s"[^>]*><v>180<\\/v><\\/c>`);
        sheetXml = sheetXml.replace(
          posRegex,
          `<c r="C${rowPos}" s="7" t="inlineStr"><is><t>${escapeXml(sigPosStr)}</t></is></c>`
        );

        // Insert or replace record rows 28..maxRow
        for (let r = 28; r <= maxRow; r++) {
          const idx = r - 28;
          const rec = records[idx];

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

          const rowRegex = new RegExp(`<row r="${r}"[^>]*>[\\s\\S]*?<\\/row>`);
          const rowMatch = sheetXml.match(rowRegex);

          if (rowMatch) {
            sheetXml = sheetXml.replace(rowRegex, newRowXml);
          } else {
            const prevRowRegex = new RegExp(`<row r="${r - 1}"[^>]*>[\\s\\S]*?<\\/row>`);
            const prevMatch = sheetXml.match(prevRowRegex);
            if (prevMatch) {
              sheetXml = sheetXml.replace(prevRowRegex, `${prevMatch[0]}\n${newRowXml}`);
            }
          }
        }

        originalZip.file(sheetFileName, sheetXml);
        if (baseSheetRels) {
          originalZip.file(sheetRelsFileName, baseSheetRels);
        }

        const cleanSheetName = escapeXml(group.sheetName || `Sheet${sheetIndex}`);
        sheetsXmlStr += `<sheet name="${cleanSheetName}" sheetId="${sheetIndex}" r:id="${rId}"/>`;
        definedNamesStr += `<definedName name="_xlnm.Print_Area" localSheetId="${i}">${cleanSheetName.includes(' ') ? `'${cleanSheetName}'` : cleanSheetName}!$B$1:$J$${60 + overflow}</definedName>`;

        if (i > 0) {
          workbookRelsXml = workbookRelsXml.replace(
            '</Relationships>',
            `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${sheetIndex}.xml"/></Relationships>`
          );
          contentTypesXml = contentTypesXml.replace(
            '</Types>',
            `<Override PartName="/${sheetFileName}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`
          );
        }
      });

      sheetsXmlStr += "</sheets>";
      definedNamesStr += "</definedNames>";

      workbookXml = workbookXml.replace(/<sheets>[\s\S]*?<\/sheets>/, sheetsXmlStr);
      if (workbookXml.includes("<definedNames>")) {
        workbookXml = workbookXml.replace(/<definedNames>[\s\S]*?<\/definedNames>/, definedNamesStr);
      } else {
        workbookXml = workbookXml.replace("</workbook>", `${definedNamesStr}</workbook>`);
      }

      originalZip.file("xl/workbook.xml", workbookXml);
      originalZip.file("xl/_rels/workbook.xml.rels", workbookRelsXml);
      originalZip.file("[Content_Types].xml", contentTypesXml);

    } else {
      // RFS_TEMPLATE.xlsm
      // We substitute Item 1 in shared strings
      const item1 = items[0] || {};
      const rfsData: Record<string, any> = {
        ...data,
        QTY: item1.quantity !== undefined ? item1.quantity : "",
        UNIT: item1.unit || "",
        ITEM_DESCRIPTION: item1.description || item1.item || "",
        REMARKS: item1.remarks || "",
        // Override indicator placeholders so no text ('x') is written to sharedStrings
        complete: "",
        on_time: "",
        late: "",
        incomplete: "",
        emergency: "",
        urgent: "",
        regular: "",
        irregular: ""
      };
      sharedStringsXml = replacePlaceholdersInSharedStrings(sharedStringsXml, rfsData);
      
      // Inject Item 2 to 12 in sheet1.xml
      let sheet1Xml = originalZip.file("xl/worksheets/sheet1.xml")?.asText() || "";
      if (rfsData.DUE_DATE) {
        sheet1Xml = injectCellValue(sheet1Xml, "AW8", rfsData.DUE_DATE, true);
      }
      for (let i = 1; i < 12; i++) {
        const rowNum = 13 + i;
        const item = items[i];
        const qty = item ? (item.quantity ?? "") : "";
        const unit = item ? (item.unit ?? "") : "";
        const desc = item ? (item.description || item.item || "") : "";
        const rem = item ? (item.remarks ?? "") : "";

        sheet1Xml = injectCellValue(sheet1Xml, `I${rowNum}`, qty, false); // Qty
        sheet1Xml = injectCellValue(sheet1Xml, `K${rowNum}`, unit, true); // Unit
        sheet1Xml = injectCellValue(sheet1Xml, `M${rowNum}`, desc, true, desc === "*****NOTHING FOLLOWS*****"); // Desc
        sheet1Xml = injectCellValue(sheet1Xml, `BB${rowNum}`, rem, true); // Remarks
      }

      // Handle RFS selection indicator black fill styling
      let stylesXml = originalZip.file("xl/styles.xml")?.asText() || "";
      if (stylesXml && sheet1Xml) {
        // 1. Ensure solid black fill pattern exists in stylesXml
        let fillsCountMatch = stylesXml.match(/<fills count="(\d+)">([\s\S]*?)<\/fills>/);
        let blackFillIndex = -1;
        if (fillsCountMatch) {
          let fillsCount = parseInt(fillsCountMatch[1], 10);
          const fillsContent = fillsCountMatch[2];
          blackFillIndex = fillsCount;
          fillsCount += 1;
          const blackFillXml = '<fill><patternFill patternType="solid"><fgColor rgb="FF000000"/><bgColor indexed="64"/></patternFill></fill>';
          stylesXml = stylesXml.replace(
            /<fills count="\d+">[\s\S]*?<\/fills>/,
            `<fills count="${fillsCount}">${fillsContent}${blackFillXml}</fills>`
          );
        }

        // 2. Parse cellXfs to enable style cloning with black fill
        let cellXfsMatch = stylesXml.match(/<cellXfs count="(\d+)">([\s\S]*?)<\/cellXfs>/);
        if (cellXfsMatch && blackFillIndex >= 0) {
          let xfsCount = parseInt(cellXfsMatch[1], 10);
          let xfsContent = cellXfsMatch[2];

          // Parse individual <xf .../> tags from xfsContent
          const xfsList: string[] = [];
          const xfRegex = /<xf\b[^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g;
          let xfMatch;
          while ((xfMatch = xfRegex.exec(xfsContent)) !== null) {
            xfsList.push(xfMatch[0]);
          }

          const blackStyleCache: Record<number, number> = {};
          const getBlackStyleId = (origStyleId: number): number => {
            if (blackStyleCache[origStyleId] !== undefined) return blackStyleCache[origStyleId];
            const origXf = xfsList[origStyleId];
            if (!origXf) return origStyleId;

            let newXf = origXf;
            if (/fillId="\d+"/.test(newXf)) {
              newXf = newXf.replace(/fillId="\d+"/, `fillId="${blackFillIndex}"`);
            } else {
              newXf = newXf.replace('<xf ', `<xf fillId="${blackFillIndex}" `);
            }
            if (/applyFill="\d+"/.test(newXf)) {
              newXf = newXf.replace(/applyFill="\d+"/, 'applyFill="1"');
            } else {
              newXf = newXf.replace('<xf ', '<xf applyFill="1" ');
            }

            const newStyleId = xfsCount;
            xfsCount += 1;
            xfsList.push(newXf);
            xfsContent += newXf;
            blackStyleCache[origStyleId] = newStyleId;
            return newStyleId;
          };

          // Determine selected status and mode
          const statusVal = String(data.STATUS || data.status || "").trim().toLowerCase();
          const modeVal = String(data.MODE || data.modeOfRequest || data.mode || "").trim().toLowerCase();

          const indicators: { key: string; cellRefFallback: string; isSelected: boolean }[] = [
            {
              key: "complete",
              cellRefFallback: "L26",
              isSelected: data.complete === "x" || data.complete === true || statusVal === "complete"
            },
            {
              key: "on_time",
              cellRefFallback: "T26",
              isSelected: data.on_time === "x" || data.on_time === true || statusVal === "on time" || statusVal === "on_time" || statusVal === "ontime"
            },
            {
              key: "late",
              cellRefFallback: "AD26",
              isSelected: data.late === "x" || data.late === true || statusVal === "late"
            },
            {
              key: "incomplete",
              cellRefFallback: "L28",
              isSelected: data.incomplete === "x" || data.incomplete === true || statusVal === "incomplete"
            },
            {
              key: "emergency",
              cellRefFallback: "AP32",
              isSelected: data.emergency === "x" || data.emergency === true || modeVal === "emergency"
            },
            {
              key: "urgent",
              cellRefFallback: "AP34",
              isSelected: data.urgent === "x" || data.urgent === true || modeVal === "urgent"
            },
            {
              key: "regular",
              cellRefFallback: "AP36",
              isSelected: data.regular === "x" || data.regular === true || modeVal === "regular"
            },
            {
              key: "irregular",
              cellRefFallback: "AP38",
              isSelected: data.irregular === "x" || data.irregular === true || modeVal === "irregular"
            }
          ];

          indicators.forEach((ind) => {
            const cellRef = ind.cellRefFallback;
            const cellRegex = new RegExp(`<c\\s+[^>]*?\\br="${cellRef}"[^>]*?(?:\\/>|>([\\s\\S]*?)<\\/c>)`);
            const match = sheet1Xml.match(cellRegex);
            if (match) {
              const fullTag = match[0];
              const styleMatch = fullTag.match(/s="(\d+)"/);
              const origStyleId = styleMatch ? parseInt(styleMatch[1], 10) : 0;

              const styleToApply = ind.isSelected ? getBlackStyleId(origStyleId) : origStyleId;
              const replacement = `<c r="${cellRef}" s="${styleToApply}"/>`;
              sheet1Xml = sheet1Xml.replace(fullTag, replacement);
            }
          });

          // Write updated cellXfs back into stylesXml
          stylesXml = stylesXml.replace(
            /<cellXfs count="\d+">[\s\S]*?<\/cellXfs>/,
            `<cellXfs count="${xfsCount}">${xfsContent}</cellXfs>`
          );
          originalZip.file("xl/styles.xml", stylesXml);
        }
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

// Helper to count wrapped lines based on capacity and explicit newlines
export function countWrappedLines(text: string, capacity = 50): number {
  if (!text || !text.trim()) return 1;
  const rawLines = text.split(/\r?\n/);
  let totalLines = 0;
  for (const rawLine of rawLines) {
    if (!rawLine.trim()) {
      totalLines += 1;
      continue;
    }
    const words = rawLine.split(/\s+/);
    let currentLineLen = 0;
    let lineCount = 1;
    for (const word of words) {
      if (word.length === 0) continue;
      if (currentLineLen === 0) {
        if (word.length > capacity) {
          lineCount += Math.floor((word.length - 1) / capacity);
          currentLineLen = word.length % capacity;
        } else {
          currentLineLen = word.length;
        }
      } else {
        if (currentLineLen + 1 + word.length <= capacity) {
          currentLineLen += 1 + word.length;
        } else {
          lineCount += 1;
          if (word.length > capacity) {
            lineCount += Math.floor((word.length - 1) / capacity);
            currentLineLen = word.length % capacity;
          } else {
            currentLineLen = word.length;
          }
        }
      }
    }
    totalLines += lineCount;
  }
  return totalLines;
}

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

  // Process each <si>...</si> block independently to preserve existing template styling (<rPr>, <color>, etc.)
  return sharedStringsXml.replace(/<si\b[^>]*>([\s\S]*?)<\/si>/gi, (match, innerXml) => {
    const placeholderRegex = /\{\{([^{}]+)\}\}|\{([^{}]+)\}/g;
    const matches = Array.from(innerXml.matchAll(placeholderRegex));

    if (matches.length === 0) {
      return match; // No placeholders, leave unchanged
    }

    let updatedInner = innerXml;
    let isPurpose = false;
    let targetFontSize: number | null = null;
    let isNothingFollows = false;

    for (const m of matches) {
      const placeholderText = m[0];
      const rawKey = m[1] || m[2];
      const upperKey = rawKey.trim().toUpperCase();
      const rawVal = getValue(rawKey);
      let strVal = rawVal !== undefined && rawVal !== null ? String(rawVal) : "";

      if (upperKey.includes("PURPOSE")) {
        isPurpose = true;
        strVal = strVal.toUpperCase();
        const fit = computePurposeFit(strVal);
        targetFontSize = fit.fontSize;
      } else if (upperKey.includes("PO_NO")) {
        strVal = strVal.slice(0, 40);
        const fit = computePoFit(strVal);
        targetFontSize = fit.fontSize;
      } else if (upperKey.includes("DESCRIPTION")) {
        if (strVal === "*****NOTHING FOLLOWS*****") {
          isNothingFollows = true;
          targetFontSize = 10;
        } else {
          const totalLines = countWrappedLines(strVal, 50);
          targetFontSize = totalLines >= 5 ? 9 : 10;
        }
      }

      if (strVal === "*****NOTHING FOLLOWS*****") {
        isNothingFollows = true;
      }

      const escapedVal = escapeXml(strVal);
      updatedInner = updatedInner.replace(placeholderText, escapedVal);
    }

    // Apply targetFontSize styling (Case A: existing <rPr>; Case B: plain <t> transformed to rich text when targetFontSize < 11)
    if (targetFontSize !== null) {
      if (/<rPr\b[^>]*>/i.test(updatedInner)) {
        // Case A: Update or insert <sz val="..."/> inside existing <rPr> blocks without touching <color>, <rFont>, etc.
        updatedInner = updatedInner.replace(/<rPr\b([^>]*)>([\s\S]*?)<\/rPr>/gi, (rPrMatch, rPrAttrs, rPrContent) => {
          if (/<sz\b[^>]*\/>/i.test(rPrContent)) {
            const newContent = rPrContent.replace(/<sz\s+val=["']\d+["']\s*\/?>/gi, `<sz val="${targetFontSize}"/>`);
            return `<rPr${rPrAttrs}>${newContent}</rPr>`;
          } else {
            return `<rPr${rPrAttrs}><sz val="${targetFontSize}"/>${rPrContent}</rPr>`;
          }
        });
      } else if (targetFontSize < 11) {
        // Case B: Plain <t> without <rPr>, wrap in rich text run with font properties
        if (/<t\b[^>]*>([\s\S]*?)<\/t>/i.test(updatedInner)) {
          updatedInner = updatedInner.replace(/<t\b([^>]*)>([\s\S]*?)<\/t>/gi, (tMatch, tAttrs, tContent) => {
            return `<r><rPr><rFont val="Tahoma"/><sz val="${targetFontSize}"/><color rgb="FF0000FF"/></rPr><t${tAttrs}>${tContent}</t></r>`;
          });
        } else {
          updatedInner = `<r><rPr><rFont val="Tahoma"/><sz val="${targetFontSize}"/><color rgb="FF0000FF"/></rPr><t>${updatedInner}</t></r>`;
        }
      }
    }

    if (isNothingFollows && !/<i\b/i.test(updatedInner)) {
      if (/<rPr\b[^>]*>/i.test(updatedInner)) {
        updatedInner = updatedInner.replace(/<rPr\b([^>]*)>/gi, `<rPr$1><i/>`);
      } else {
        updatedInner = `<r><rPr><i/></rPr>${updatedInner}</r>`;
      }
    }

    return `<si>${updatedInner}</si>`;
  });
}

function injectCellValue(sheetXml: string, cellRef: string, val: any, isString: boolean = false, isItalic: boolean = false, overrideStyleId?: string): string {
  const cellRegex = new RegExp('<c\\s+[^>]*?\\br="' + cellRef + '"[^>]*?\\bs="(\\d+)"[^>]*?(?:\\/>|>([\\s\\S]*?)<\\/c>)', 'i');
  const match = sheetXml.match(cellRegex);
  if (!match) {
    return sheetXml;
  }
  const styleId = overrideStyleId || match[1];
  let newCell = "";
  if (val === undefined || val === null || val === "") {
    newCell = `<c r="${cellRef}" s="${styleId}"/>`;
  } else if (isString) {
    if (isItalic || val === "*****NOTHING FOLLOWS*****") {
      newCell = `<c r="${cellRef}" s="${styleId}" t="inlineStr"><is><r><rPr><i/></rPr><t>${escapeXml(val)}</t></r></is></c>`;
    } else {
      newCell = `<c r="${cellRef}" s="${styleId}" t="inlineStr"><is><t>${escapeXml(val)}</t></is></c>`;
    }
  } else {
    newCell = `<c r="${cellRef}" s="${styleId}"><v>${val}</v></c>`;
  }
  return sheetXml.replace(match[0], newCell);
}
