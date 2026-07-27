import { 
  mapPOData, 
  mapPISData, 
  mapRFSData, 
  mapCanvassData, 
  wrapRemarks 
} from "./templateMapping";

interface DocProperties {
  templatePath: string;
  paperSize: string;
  dimensions: string;
  orientation: string;
  margins: {
    top: string;
    bottom: string;
    left: string;
    right: string;
  };
  headerFooterSpacing: string;
  pageCount: number | string;
}

const TEMPLATE_PROPERTIES: Record<string, DocProperties> = {
  po: {
    templatePath: "/templates/PO_TEMPLATE.docx",
    paperSize: "A4",
    dimensions: "210mm x 297mm",
    orientation: "portrait",
    margins: { top: "5.08mm", bottom: "3.05mm", left: "5.08mm", right: "5.08mm" },
    headerFooterSpacing: "12.45mm",
    pageCount: 1,
  },
  pis: {
    templatePath: "/templates/PIS_TEMPLATE_WORD.docx",
    paperSize: "A4",
    dimensions: "210mm x 297mm",
    orientation: "portrait",
    margins: { top: "5.08mm", bottom: "4.9mm", left: "5.08mm", right: "5.08mm" },
    headerFooterSpacing: "12.45mm",
    pageCount: 2,
  },
  rfs: {
    templatePath: "/templates/RFS_TEMPLATE_WORD.docx",
    paperSize: "A4",
    dimensions: "210mm x 297mm",
    orientation: "portrait",
    margins: { top: "5.08mm", bottom: "4.9mm", left: "5.08mm", right: "5.08mm" },
    headerFooterSpacing: "12.45mm",
    pageCount: 1,
  },
  canvass: {
    templatePath: "/templates/CANVASS_TEMPLATE.docx",
    paperSize: "A4",
    dimensions: "210mm x 297mm",
    orientation: "portrait",
    margins: { top: "5.08mm", bottom: "7.62mm", left: "5.08mm", right: "5.08mm" },
    headerFooterSpacing: "12.45mm",
    pageCount: 1,
  }
};

export async function printDocument(moduleName: "po" | "pis" | "rfs" | "canvass", data: any): Promise<void> {
  const docProps = TEMPLATE_PROPERTIES[moduleName] || TEMPLATE_PROPERTIES.po;

  // Create hidden iframe for isolated, high-fidelity printing
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.left = "-9999px";
  iframe.style.top = "-9999px";
  iframe.style.width = "210mm"; // standard A4 width
  iframe.style.height = "297mm"; // standard A4 height
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  try {
    let blob: Blob;
    const isWord = true;

    const { generateDocxBlob } = await import("./templatePreview");

    if (moduleName === "po") {
      const mapped = mapPOData(data);
      console.log("[Runtime Template Load] Initiating PO Print - loading template: /templates/PO_TEMPLATE.docx");
      const result = await generateDocxBlob("PO_TEMPLATE.docx", mapped);
      blob = result.blob;
    } else if (moduleName === "pis") {
      const remarksText = data.remarks || "";
      const remarksLines = wrapRemarks(remarksText, 34);
      if (remarksLines.length > 5) {
        alert("Remarks exceed the printable area. Please shorten the Remarks.");
        iframe.remove();
        return;
      }
      const mapped = mapPISData(data);
      console.log("[Runtime Template Load] Initiating PIS Print - loading template: /templates/PIS_TEMPLATE_WORD.docx");
      const result = await generateDocxBlob("PIS_TEMPLATE_WORD.docx", mapped);
      blob = result.blob;
    } else if (moduleName === "rfs") {
      const { exportData, items } = mapRFSData(data);
      console.log("[Runtime Template Load] Initiating RFS Print - loading template: /templates/RFS_TEMPLATE_WORD.docx");
      const result = await generateDocxBlob("RFS_TEMPLATE_WORD.docx", { ...exportData, items });
      blob = result.blob;
    } else if (moduleName === "canvass") {
      const { exportData } = mapCanvassData(data);
      console.log("[Runtime Template Load] Initiating CANVASS Print - loading template: /templates/CANVASS_TEMPLATE.docx");
      const result = await generateDocxBlob("CANVASS_TEMPLATE.docx", exportData);
      blob = result.blob;
    } else {
      throw new Error("Unknown module name");
    }

    // Generate dynamic document title for browser print naming
    let printTitle = "Document";
    if (moduleName === "po") {
      const poNo = data?.poNumber || "PO";
      printTitle = `${poNo}_SMEI_PO`;
    } else if (moduleName === "pis") {
      const pisNo = data?.pisNumber || "PIS";
      printTitle = `${pisNo}_SMEI_PIS`;
    } else if (moduleName === "rfs") {
      const rfsNo = data?.rfsNumber || "RFS";
      printTitle = `${rfsNo}_SMEI_RFS`;
    } else if (moduleName === "canvass") {
      const canvassNo = data?.canvassNumber || "CANVASS";
      printTitle = `${canvassNo}_SMEI_CANVASS`;
    }

    // Initialize the iframe document
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) throw new Error("Could not access iframe document");

    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${printTitle}</title>
          <style>
            @media print {
              @page {
                size: ${docProps.paperSize} ${docProps.orientation};
                margin: 0 !important; /* Eliminate browser default margins and headers/footers */
              }
              html, body {
                width: 210mm !important;
                ${docProps.pageCount === 1 || docProps.pageCount === "1" ? "height: 297mm !important; overflow: hidden !important;" : ""}
                margin: 0 !important;
                padding: 0 !important;
                box-sizing: border-box !important;
                background-color: #ffffff !important;
                color: #000000 !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .docx-wrapper {
                padding: 0 !important;
                margin: 0 !important;
                background: transparent !important;
                box-shadow: none !important;
                width: 100% !important;
                box-sizing: border-box !important;
              }
              .docx {
                box-shadow: none !important;
                background: transparent !important;
                width: 100% !important;
                box-sizing: border-box !important;
                margin: 0 !important;
                padding: 0 !important;
              }
              .docx section {
                padding-top: ${docProps.margins.top} !important;
                padding-bottom: ${docProps.margins.bottom} !important;
                padding-left: ${docProps.margins.left} !important;
                padding-right: ${docProps.margins.right} !important;
                margin: 0 !important;
                box-sizing: border-box !important;
                width: 210mm !important;
                height: 297mm !important; /* Force each rendered section to be exactly 1 full page height */
                page-break-after: always !important;
                page-break-inside: avoid !important;
                overflow: hidden !important; /* Prevent page overflow/unintended second page */
                position: relative !important;
              }
              .docx section:last-child {
                page-break-after: avoid !important;
              }
              img {
                max-width: 100% !important;
                height: auto !important;
              }
            }
            body {
              margin: 0;
              padding: 40px;
              background-color: #ffffff;
              color: #000000;
              font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            /* Style for Word Preview */
            .docx-wrapper {
              background: transparent !important;
              padding: 0 !important;
              box-shadow: none !important;
            }
            .docx {
              box-shadow: none !important;
              margin: 0 auto !important;
              background: transparent !important;
              max-width: 100% !important;
            }
          </style>
        </head>
        <body>
          <div id="print-content"></div>
        </body>
      </html>
    `);
    iframeDoc.close();

    const printContent = iframeDoc.getElementById("print-content")!;

    if (isWord) {
      // Render DOCX inside a temporary element of main document to leverage libraries
      const tempContainer = document.createElement("div");
      const docx = await import("docx-preview");
      await docx.renderAsync(blob, tempContainer, undefined, {
        className: "docx",
        inWrapper: false
      });

      // Copy rendered DOCX content to iframe
      printContent.innerHTML = tempContainer.innerHTML;
      tempContainer.remove();

      // Copy all style and link stylesheet tags from main window to iframe to preserve Tailwind, custom fonts, and docx-preview styles
      document.querySelectorAll("style, link[rel='stylesheet']").forEach((style) => {
        iframeDoc.head.appendChild(style.cloneNode(true));
      });
    }

    // Allow brief moment for styles/layout to settle
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Trigger the native print window
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();

    // Clean up iframe after a small delay
    setTimeout(() => {
      iframe.remove();
    }, 2000);

  } catch (err) {
    console.error("Failed to print document:", err);
    alert("Unable to generate the printable document. Please try again.");
    iframe.remove();
  }
}
