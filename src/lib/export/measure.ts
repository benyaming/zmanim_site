/**
 * Text measurement for the print layout.
 *
 * The fitter used to size columns by COUNTING CHARACTERS, at a flat 0.58em
 * apiece. That is wrong by more than 2× within a single column: in the export's
 * sans stack a Cyrillic "Ш" is about 0.78em and a ":" about 0.26em, yet both
 * counted as one character. The visible symptom was a column reserving width for
 * a string it does not hold — the date column sized for the longest month name
 * in the language rather than the short ones in the chosen range — while headers
 * needed a 1.25× fudge factor to stop wrapping mid-word.
 *
 * Measuring the real glyphs removes both the waste and the fudge. Every demand
 * is measured at REFERENCE_FONT_PX and scaled linearly, which is exact: text
 * advance is proportional to font size.
 *
 * The measurer is injected rather than imported so `grid.ts` stays pure and
 * Node-testable — a canvas exists in the browser, where the PDF is actually
 * rasterized, and not in vitest.
 */

/** Font size every demand is measured at, then scaled from. */
export const REFERENCE_FONT_PX = 10;

export interface TextMeasurer {
  /** Rendered advance width of `text` in px at `fontPx`. */
  width(text: string, fontPx: number, bold?: boolean): number;
}

// --- character estimate (fallback) -----------------------------------------
//
// Kept for Node — unit tests fit layouts without a DOM — and as the browser's
// own fallback if a canvas context can't be had. Deliberately the OLD
// behaviour, so a test run measures something stable rather than something
// platform-dependent.

/** Digit/letter advance as a fraction of the font size, for the export sans stack. */
const CHAR_ASPECT = 0.58;
/**
 * Proportional prose measures wider than the tabular digits CHAR_ASPECT is
 * calibrated on, so the estimate widens anything with a space or a letter in it.
 */
const PROSE_WIDEN = 1.25;

const PROSE = /[^\d\s.:–-]/;

export const estimateMeasurer: TextMeasurer = {
  width(text, fontPx) {
    const widen = PROSE.test(text) ? PROSE_WIDEN : 1;
    return text.length * CHAR_ASPECT * widen * fontPx;
  },
};

// --- canvas measurer (browser) ---------------------------------------------

/**
 * Measure against a real font via a 2D canvas. The family is read from a probe
 * element carrying the same class the sheet uses, so this tracks the app's font
 * stack instead of restating it.
 *
 * Caveat worth knowing: the body's time cells render with `tabular-nums`, which
 * canvas cannot switch on. Tabular digits are marginally wider than
 * proportional ones in most faces, so time columns measure a hair narrow — well
 * inside the FIT_SAFETY margin the fitter already applies.
 */
export function createCanvasMeasurer(): TextMeasurer {
  let ctx: CanvasRenderingContext2D | null = null;
  let family = '';
  try {
    const canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d');
    const probe = document.createElement('span');
    probe.className = 'font-sans';
    probe.style.cssText = 'position:absolute;left:-99999px;visibility:hidden';
    document.body.appendChild(probe);
    family = getComputedStyle(probe).fontFamily;
    probe.remove();
  } catch {
    ctx = null;
  }
  if (!ctx || !family) return estimateMeasurer;

  const context = ctx;
  const cache = new Map<string, number>();
  return {
    width(text, fontPx, bold = false) {
      if (!text) return 0;
      const key = `${bold ? 1 : 0}|${fontPx}|${text}`;
      const hit = cache.get(key);
      if (hit !== undefined) return hit;
      context.font = `${bold ? 600 : 400} ${fontPx}px ${family}`;
      const width = context.measureText(text).width;
      cache.set(key, width);
      return width;
    },
  };
}

/**
 * The measurer to fit with: a canvas in the browser, the character estimate
 * anywhere else. Memoized — building one probes the DOM for the font family.
 */
let shared: TextMeasurer | null = null;
export function defaultMeasurer(): TextMeasurer {
  if (shared) return shared;
  shared = canvasAvailable() ? createCanvasMeasurer() : estimateMeasurer;
  return shared;
}

/**
 * jsdom is excluded explicitly rather than by try/catch: its `getContext` does
 * not throw, it returns null AND prints a "Not implemented" notice through the
 * virtual console, which would litter every test run that fits a layout.
 */
function canvasAvailable(): boolean {
  if (typeof document === 'undefined') return false;
  return !(typeof navigator !== 'undefined' && navigator.userAgent.includes('jsdom'));
}
