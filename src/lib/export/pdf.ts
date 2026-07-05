/**
 * Shared PDF pipeline: every export page is a fixed-size DOM node (A4
 * landscape at 96 dpi), rasterized in the browser with html-to-image and
 * placed full-bleed on a jsPDF page. Rendering through the live DOM keeps
 * Hebrew/RTL text, the app fonts and the oklch theme tokens pixel-identical
 * to the screen — no PDF font embedding or bidi handling needed.
 */

/** A4 landscape at 96 dpi, in CSS pixels. */
export const PAGE_WIDTH_PX = 1123;
export const PAGE_HEIGHT_PX = 794;

/** Rasterize the given page elements (each PAGE_WIDTH×PAGE_HEIGHT) into an A4-landscape PDF download. */
export async function pagesToPdf(pages: HTMLElement[], filename: string): Promise<void> {
  const [{ toPng }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);
  // Web fonts must be loaded before rasterizing, or the snapshot falls back.
  await document.fonts.ready;

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  for (let i = 0; i < pages.length; i++) {
    const dataUrl = await toPng(pages[i], {
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      width: PAGE_WIDTH_PX,
      height: PAGE_HEIGHT_PX,
    });
    if (i > 0) pdf.addPage();
    pdf.addImage(dataUrl, 'PNG', 0, 0, 297, 210, undefined, 'FAST');
  }
  pdf.save(filename);
}
