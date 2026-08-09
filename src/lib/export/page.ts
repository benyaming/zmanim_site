/**
 * Print-page geometry, shared by the PDF rasterizer and the layout fitter.
 *
 * Kept in its own module (rather than in `pdf.ts`) so the pure layout math in
 * `grid.ts` can import it without dragging the browser-only download/raster
 * code into Node test runs.
 */

/** A4 landscape at 96 dpi, in CSS pixels. */
export const PAGE_WIDTH_PX = 1123;
export const PAGE_HEIGHT_PX = 794;

/**
 * Page padding on each side — the printed margin, ~4 mm. The sheet is placed
 * full-bleed on the PDF page, so this padding IS the margin: every px here is
 * width the table doesn't get, and at the old 32 (8.5 mm) a sixth of the usable
 * width went to white space. Kept at 4 mm rather than lower because printers
 * that can't do borderless clip roughly the outer 3 mm.
 *
 * The table page reads this directly (`style={{ padding }}`) instead of carrying
 * an equivalent Tailwind class, so the fitter's content box and the rendered
 * padding cannot drift apart.
 */
export const PAGE_PADDING_PX = 16;

/** Usable content box inside the page padding. */
export const CONTENT_WIDTH_PX = PAGE_WIDTH_PX - PAGE_PADDING_PX * 2;
export const CONTENT_HEIGHT_PX = PAGE_HEIGHT_PX - PAGE_PADDING_PX * 2;

/** Title band (heading line + its bottom margin). */
export const TITLE_BAND_PX = 30;
/** Footer band (compute note + attribution + top padding). */
export const FOOTER_BAND_PX = 26;
