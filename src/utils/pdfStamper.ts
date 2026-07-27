import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// MANUALLY ADJUSTABLE COORDINATES FOR CA NO. STAMP
// Note: PDF origin (0,0) is at the BOTTOM-LEFT of the page.
// Increasing CA_NO_X moves text RIGHT.
// Increasing CA_NO_Y moves text UPWARD.
export const CA_NO_X = 460;
export const CA_NO_Y = 980;

/**
 * Attaches user-provided CA No. to the uploaded PDF using Times New Roman Bold 14pt.
 */
export async function attachCaNoToPdf(
  file: File,
  caNo: string
): Promise<{ blob: Blob; dataUrl: string }> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);

  // Load standard Times New Roman Bold font
  const timesRomanBoldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

  const pages = pdfDoc.getPages();
  if (pages.length > 0) {
    const page = pages[0];

    page.drawText(`CA No. ${caNo}`, {
      x: CA_NO_X,
      y: CA_NO_Y,
      size: 14,
      font: timesRomanBoldFont,
      color: rgb(0, 0, 0),
    });
  }

  const modifiedPdfBytes = await pdfDoc.save();
  const blob = new Blob([modifiedPdfBytes], { type: "application/pdf" });

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  return { blob, dataUrl };
}
