import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, BorderStyle, AlignmentType, WidthType, ImageRun } from "docx";
import { saveAs } from "file-saver";
import smeiLogo from "../assets/images/smei_logo_1782431389924.jpg";

interface ReportItem {
  poRef: string;
  poDate: string;
  supplierName: string;
  qty: number;
  unit: string;
  particulars: string;
  unitAmount: number;
  amount: number;
  runningBalance: number;
}

export const exportReportToWord = async (items: ReportItem[], grandTotal: number, preparerName: string) => {
  let logoImage: ArrayBuffer | undefined;
  try {
    const response = await fetch(smeiLogo);
    logoImage = await response.arrayBuffer();
  } catch (err) {
    console.error("Failed to load logo for word export:", err);
  }

  const formatPHP = (val: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2
    }).format(val);
  };

  const createHeaderCell = (text: string) => {
    return new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 16 })], alignment: AlignmentType.CENTER })],
      margins: { top: 60, bottom: 60, left: 60, right: 60 },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
      }
    });
  };

  const createCell = (text: string, align: any = AlignmentType.LEFT, bold = false) => {
    return new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text, size: 16, bold })], alignment: align })],
      margins: { top: 60, bottom: 60, left: 60, right: 60 },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
      }
    });
  };

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 720, right: 720, bottom: 720, left: 720 },
          size: {
            orientation: "landscape"
          }
        }
      },
      children: [
        // Header
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            ...(logoImage ? [new ImageRun({
              data: logoImage,
              transformation: { width: 50, height: 50 },
              type: "jpg"
            })] : []),
            new TextRun({ text: "\nSouthcoast Metal Enterprise, Inc.", bold: true, size: 28, font: "Arial" })
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "Supplier Summary Ledger Report", bold: true, size: 20, font: "Arial" })]
        }),
        new Paragraph({ text: "" }),
        new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [
            new TextRun({ text: `Date Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}\n`, size: 16 }),
            new TextRun({ text: `Prepared By: ${preparerName}`, size: 16 })
          ]
        }),
        new Paragraph({ text: "" }),

        // Items Table
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                createHeaderCell("PO REF"),
                createHeaderCell("DATE"),
                createHeaderCell("SUPPLIER"),
                createHeaderCell("QTY"),
                createHeaderCell("UNIT"),
                createHeaderCell("PARTICULARS"),
                createHeaderCell("UNIT AMOUNT"),
                createHeaderCell("AMOUNT"),
                createHeaderCell("RUNNING BALANCE"),
              ],
              tableHeader: true
            }),
            ...items.map(item => new TableRow({
              children: [
                createCell(item.poRef),
                createCell(new Date(item.poDate).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "2-digit" })),
                createCell(item.supplierName),
                createCell(item.qty.toString(), AlignmentType.CENTER),
                createCell(item.unit, AlignmentType.CENTER),
                createCell(item.particulars),
                createCell(formatPHP(item.unitAmount), AlignmentType.RIGHT),
                createCell(formatPHP(item.amount), AlignmentType.RIGHT),
                createCell(formatPHP(item.runningBalance), AlignmentType.RIGHT),
              ]
            })),
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: "TOTAL AMOUNT", bold: true, size: 16 })], alignment: AlignmentType.RIGHT })],
                  columnSpan: 7,
                  margins: { top: 60, bottom: 60, left: 60, right: 60 },
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                    bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                    left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                    right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                  }
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: formatPHP(grandTotal), bold: true, size: 16 })], alignment: AlignmentType.RIGHT })],
                  columnSpan: 2,
                  margins: { top: 60, bottom: 60, left: 60, right: 60 },
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                    bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                    left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                    right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                  }
                }),
              ]
            })
          ]
        })
      ]
    }]
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `SMEI_Supplier_Summary_Report_${Date.now()}.docx`);
};
