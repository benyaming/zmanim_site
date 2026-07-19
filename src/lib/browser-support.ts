/**
 * Outdated-browser notice, inlined into the document by the locale layout the
 * same way as `themeInitScript` (see src/lib/theme.ts for why it is a plain
 * string interpolated via innerHTML rather than a React <script>).
 *
 * The stylesheet is Tailwind v4 output: everything sits in native `@layer`
 * blocks and leans on `oklch()`, `color-mix()`, and `@property`. Its baseline
 * is Safari 16.4 / Chrome 111 / Firefox 128; anything older than Safari 15.4
 * doesn't parse `@layer` at all and drops the ENTIRE stylesheet, rendering the
 * page as bare unstyled HTML. This probe mirrors that exact baseline
 * (`CSSPropertyRule` ⇔ `@property` support) and, when short, prepends a
 * dismissible banner. The banner is styled inline only — on the browsers it
 * targets none of our CSS applies — and is inserted before hydration; React 19
 * ignores unexpected pre-existing nodes in <body> when hydrating.
 */
export function browserSupportScript(message: string, dismissLabel: string): string {
  return `(function(){try{if(window.CSS&&CSS.supports&&CSS.supports('color','oklch(0 0 0)')&&CSS.supports('color','color-mix(in oklab, red, red)')&&typeof CSSPropertyRule!=='undefined')return;var b=document.createElement('div');b.setAttribute('role','alert');b.setAttribute('style','position:fixed;top:0;left:0;right:0;z-index:9999;padding:10px 16px;background:#fde68a;color:#78350f;font:14px/1.5 -apple-system,system-ui,sans-serif;text-align:center;border-bottom:1px solid #d97706');b.appendChild(document.createTextNode(${JSON.stringify(message)}));var x=document.createElement('button');x.setAttribute('aria-label',${JSON.stringify(dismissLabel)});x.setAttribute('style','margin-inline-start:12px;border:0;padding:0;background:none;color:inherit;font:inherit;cursor:pointer');x.appendChild(document.createTextNode('\\u2715'));x.onclick=function(){if(b.parentNode)b.parentNode.removeChild(b)};b.appendChild(x);document.body.insertBefore(b,document.body.firstChild);}catch(e){}})();`;
}
