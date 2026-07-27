import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell } from "docx";
import ExcelJS from "exceljs";
import fs from "fs";
import { execSync } from "child_process";

async function createDocx(filename: string) {
    const doc = new Document({
        sections: [{
            properties: {},
            children: [
                new Paragraph({
                    children: [new TextRun({ text: "Generated Template: " + filename, bold: true, size: 32 })]
                }),
                new Paragraph({ text: "RFS: {{rfsNumber}}" }),
                new Paragraph({ text: "PO: {{poNumber}}" }),
                new Paragraph({ text: "Date: {{dateRequested}}" }),
                new Paragraph({ text: "Department: {{department}}" }),
                new Paragraph({ text: "Supplier: {{supplierName}}" }),
                new Paragraph({ text: "Address: {{supplierAddress}}" }),
                new Paragraph({ text: "Total: {{totalAmount}}" }),
                new Paragraph({ text: "Items:" }),
                new Table({
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph("{{#items}}")] }),
                                new TableCell({ children: [new Paragraph("{{description}}")] }),
                                new TableCell({ children: [new Paragraph("{{quantity}}")] }),
                                new TableCell({ children: [new Paragraph("{{unitPrice}}")] }),
                                new TableCell({ children: [new Paragraph("{{total}}")] }),
                                new TableCell({ children: [new Paragraph("{{/items}}")] }),
                            ]
                        })
                    ]
                })
            ]
        }]
    });
    const buffer = await Packer.toBuffer(doc);
    const dest = "public/templates/" + filename;
    fs.writeFileSync(dest, buffer);
    console.log("Created", filename, "size:", buffer.length);
    
    // Verify
    try {
        execSync(`unzip -t ${dest}`);
        console.log("Verified", filename, "successfully!");
    } catch (e: any) {
        console.error("Verification failed for", filename, e.message);
    }
}

async function createXlsx(filename: string) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Template");
    sheet.getCell("A1").value = "Generated Template: " + filename;
    sheet.getCell("A2").value = "{rfsNumber}";
    sheet.getCell("B2").value = "{poNumber}";
    sheet.getCell("A3").value = "{department}";
    sheet.getCell("B3").value = "{supplierName}";
    sheet.getCell("A5").value = "{items.description}";
    sheet.getCell("B5").value = "{items.quantity}";
    sheet.getCell("C5").value = "{items.total}";
    
    const dest = "public/templates/" + filename;
    await workbook.xlsx.writeFile(dest);
    
    const stats = fs.statSync(dest);
    console.log("Created", filename, "size:", stats.size);
    
    // Verify
    try {
        execSync(`unzip -t ${dest}`);
        console.log("Verified", filename, "successfully!");
    } catch (e: any) {
        console.error("Verification failed for", filename, e.message);
    }
}

async function main() {
    try {
        if (!fs.existsSync("public/templates")) {
            fs.mkdirSync("public/templates", { recursive: true });
        }
        await createDocx("PO_TEMPLATE.docx");
        await createDocx("CANVASS_TEMPLATE.docx");
        await createXlsx("PIS_TEMPLATE.xlsx");
        await createXlsx("RFS_TEMPLATE.xlsx");
        
        fs.mkdirSync("dist/templates", { recursive: true });
        fs.copyFileSync("public/templates/PO_TEMPLATE.docx", "dist/templates/PO_TEMPLATE.docx");
        fs.copyFileSync("public/templates/CANVASS_TEMPLATE.docx", "dist/templates/CANVASS_TEMPLATE.docx");
        fs.copyFileSync("public/templates/PIS_TEMPLATE.xlsx", "dist/templates/PIS_TEMPLATE.xlsx");
        fs.copyFileSync("public/templates/RFS_TEMPLATE.xlsx", "dist/templates/RFS_TEMPLATE.xlsx");
    } catch(e) {
        console.error(e);
    }
}
main();
