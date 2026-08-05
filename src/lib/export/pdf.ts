/**
 * Shared PDF pipeline: every export page is a fixed-size DOM node (A4
 * landscape at 96 dpi), rasterized in the browser with html-to-image and
 * placed full-bleed on a jsPDF page. Rendering through the live DOM keeps
 * Hebrew/RTL text, the app fonts and the oklch theme tokens pixel-identical
 * to the screen — no PDF font embedding or bidi handling needed.
 */

import { downloadBlob } from './download';
import { PAGE_HEIGHT_PX, PAGE_WIDTH_PX } from './page';

/**
 * Temporarily detach every stylesheet whose rules this document may not read.
 *
 * To embed web fonts, html-to-image walks `document.styleSheets` and reads
 * `cssRules` on each. A CROSS-ORIGIN sheet throws a SecurityError there; the
 * library catches it, but then tries to `fetch()` the sheet instead, which also
 * fails — so a single stylesheet injected by a browser extension floods the
 * console with a SecurityError and a "Failed to fetch" for EVERY page rasterized,
 * and on a banded export that is every sheet in the document times every page.
 *
 * Removing the owner node takes the sheet out of `document.styleSheets` for the
 * duration. It is safe by construction: a sheet whose rules cannot be read cannot
 * be inlined into the snapshot anyway, so nothing that would have been captured
 * is lost. Same-origin sheets — ours, including the fonts — are untouched.
 *
 * Returns a function restoring each node to its original position.
 */
function detachUnreadableStyleSheets(): () => void {
  const detached: { node: Node; parent: Node; next: Node | null }[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      // Throws for a cross-origin sheet. Reading `length` is enough to provoke it.
      void sheet.cssRules.length;
      continue;
    } catch {
      const node = sheet.ownerNode;
      if (!node?.parentNode) continue;
      detached.push({ node, parent: node.parentNode, next: node.nextSibling });
      node.parentNode.removeChild(node);
    }
  }
  return () => {
    // Reverse order, so re-inserting before a sibling that was itself detached
    // still lands in the right place.
    for (const { node, parent, next } of detached.reverse()) {
      try {
        parent.insertBefore(node, next);
      } catch {
        // The parent may be gone if the page navigated mid-export; nothing to do.
      }
    }
  };
}

/** Rasterize the given page elements (each PAGE_WIDTH×PAGE_HEIGHT) into an A4-landscape PDF download. */
export async function pagesToPdf(pages: HTMLElement[], filename: string): Promise<void> {
  const [{ toPng, getFontEmbedCSS }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);
  // Web fonts must be loaded before rasterizing, or the snapshot falls back.
  await document.fonts.ready;

  const restoreStyleSheets = detachUnreadableStyleSheets();
  try {
    // Collected ONCE and handed to every page. html-to-image would otherwise
    // re-walk the stylesheets and re-fetch every font file per page, which a
    // banded export multiplies by the number of sheets. Undefined on failure
    // means "work it out yourself", i.e. the previous behaviour.
    let fontEmbedCSS: string | undefined;
    try {
      fontEmbedCSS = await getFontEmbedCSS(pages[0]);
    } catch {
      fontEmbedCSS = undefined;
    }

    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    for (let i = 0; i < pages.length; i++) {
      const dataUrl = await toPng(pages[i], {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        width: PAGE_WIDTH_PX,
        height: PAGE_HEIGHT_PX,
        fontEmbedCSS,
      });
      if (i > 0) pdf.addPage();
      pdf.addImage(dataUrl, 'PNG', 0, 0, 297, 210, undefined, 'FAST');
    }
    // Through downloadBlob (not pdf.save) so the Telegram Mini App delivery
    // path applies to PDFs too.
    await downloadBlob(pdf.output('blob'), filename);
  } finally {
    restoreStyleSheets();
  }
}
