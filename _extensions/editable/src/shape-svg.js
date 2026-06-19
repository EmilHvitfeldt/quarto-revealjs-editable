/**
 * Client-side port of quarto-shapes' SVG generator.
 *
 * quarto-shapes (https://github.com/emilhvitfeldt/quarto-shapes) turns a
 * `::: {.shape-* ...}` fenced div into inline SVG at render time via its Lua
 * filter. That filter has already run by the time this editor loads, so when
 * the user adds a new shape or switches a shape's type/direction we must
 * regenerate the SVG in the browser. This module mirrors the relevant parts of
 * `shapes.lua` (the static path catalog plus the parametric callout geometry)
 * so the live preview matches exactly what quarto-shapes will re-render on save.
 *
 * Keep this in sync with shapes.lua. The viewBox is always `0 0 100 100` and
 * every inner element carries `class="shape-path"` so shapes.css can style fill
 * and stroke via the `--shape-fill` / `--shape-stroke` custom properties.
 *
 * @module shape-svg
 */

/** Format a number the way shapes.lua does for catalog paths (1 decimal). */
function f1(x) {
  return x.toFixed(1);
}

/** Format a number the way shapes.lua does for callout paths (2 decimals). */
function f2(x) {
  return x.toFixed(2);
}

/** Regular n-gon, point-up, inscribed in radius r. Mirrors Lua `poly`. */
function poly(n, r = 47) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = Math.PI * ((2 * i) / n - 0.5);
    pts.push(`${f1(50 + r * Math.cos(a))},${f1(50 + r * Math.sin(a))}`);
  }
  return `<polygon points="${pts.join(" ")}" class="shape-path"/>`;
}

/** Star polygon with n points, outer radius ro and inner radius ri. */
function star(n, ro = 47, ri = 20) {
  const pts = [];
  for (let i = 0; i < 2 * n; i++) {
    const a = Math.PI * (i / n - 0.5);
    const r = i % 2 === 0 ? ro : ri;
    pts.push(`${f1(50 + r * Math.cos(a))},${f1(50 + r * Math.sin(a))}`);
  }
  return `<polygon points="${pts.join(" ")}" class="shape-path"/>`;
}

/**
 * Static catalog of shape inner-markup, keyed by the name after `shape-`.
 * Ported verbatim from shapes.lua's `shapes` table.
 * @type {Object<string, string>}
 */
export const SHAPES = {
  // Basic geometric
  circle: '<circle cx="50" cy="50" r="47" class="shape-path"/>',
  square: '<rect x="2" y="2" width="96" height="96" class="shape-path"/>',
  rectangle: '<rect x="2" y="15" width="96" height="70" class="shape-path"/>',
  "rounded-square": '<rect x="5" y="5" width="90" height="90" rx="15" ry="15" class="shape-path"/>',
  oval: '<ellipse cx="50" cy="50" rx="48" ry="30" class="shape-path"/>',
  semicircle: '<path d="M3,50 A47,47 0 0,1 97,50 Z" class="shape-path"/>',
  pie: '<path d="M50,50 L97,50 A47,47 0 1,1 50,3 Z" class="shape-path"/>',
  wedge: '<path d="M2,98 L2,3 A95,95 0 0,1 97,98 Z" class="shape-path"/>',
  arc: '<path d="M50,5 A45,45 0 0,0 50,95 L50,70 A20,20 0 0,1 50,30 Z" class="shape-path"/>',
  "block-arc": '<path d="M50,3 A47,47 0 1,0 97,50 L78,50 A28,28 0 1,1 50,22 Z" class="shape-path"/>',
  donut: '<path fill-rule="evenodd" d="M50,3 A47,47 0 1,1 50,97 A47,47 0 1,1 50,3 M50,22 A28,28 0 1,0 50,78 A28,28 0 1,0 50,22" class="shape-path"/>',
  frame: '<path fill-rule="evenodd" d="M2,2 L98,2 L98,98 L2,98 Z M14,14 L86,14 L86,86 L14,86 Z" class="shape-path"/>',

  // Polygons
  triangle: poly(3),
  diamond: poly(4),
  pentagon: poly(5),
  hexagon: poly(6),
  heptagon: poly(7),
  octagon: poly(8),
  decagon: poly(10),
  dodecagon: poly(12),
  parallelogram: '<polygon points="20,2 98,2 80,98 2,98" class="shape-path"/>',
  trapezoid: '<polygon points="20,2 80,2 98,98 2,98" class="shape-path"/>',

  // Stars
  "star-4": star(4),
  star: star(5),
  "star-6": star(6),
  "star-8": star(8),
  "star-10": star(10),
  "star-12": star(12),
  "star-16": star(16),
  "star-24": star(24),
  "star-32": star(32),
  sun: star(8, 47, 28),
  starburst: star(12, 47, 38),

  // Nature / symbols
  heart: '<path d="M50,85 C30,70 5,60 5,40 C5,20 20,10 35,15 C42,17 48,22 50,28 C52,22 58,17 65,15 C80,10 95,20 95,40 C95,60 70,70 50,85 Z" class="shape-path"/>',
  moon: '<path d="M50,5 C20,5 5,25 5,50 C5,75 20,95 50,95 C35,80 28,66 28,50 C28,34 35,20 50,5 Z" class="shape-path"/>',
  cloud: '<path d="M28,65 C15,65 5,56 5,45 C5,35 12,27 22,26 C22,14 31,5 43,5 C52,5 59,10 63,18 C66,15 71,13 76,13 C86,13 94,21 94,31 C97,33 97,40 97,47 C97,57 89,65 79,65 Z" class="shape-path"/>',
  lightning: '<polygon points="60,2 22,52 46,52 40,98 78,48 54,48" class="shape-path"/>',
  teardrop: '<path d="M50,95 C28,78 8,62 8,44 C8,22 27,5 50,5 C73,5 92,22 92,44 C92,62 72,78 50,95 Z" class="shape-path"/>',
  wave: '<path d="M2,35 C18,15 32,15 50,35 C68,55 82,55 98,35 L98,65 C82,85 68,85 50,65 C32,45 18,45 2,65 Z" class="shape-path"/>',
  "double-wave": '<path d="M2,22 C18,8 32,8 50,22 C68,36 82,36 98,22 L98,38 C82,52 68,52 50,38 C32,24 18,24 2,38 Z M2,58 C18,44 32,44 50,58 C68,72 82,72 98,58 L98,74 C82,88 68,88 50,74 C32,60 18,60 2,74 Z" class="shape-path"/>',
  "no-symbol": '<path fill-rule="evenodd" d="M50,3 A47,47 0 1,0 50,97 A47,47 0 1,0 50,3 M14,22 L22,14 L86,78 L78,86 Z" class="shape-path"/>',
  smiley: '<path fill-rule="evenodd" d="M50,3 A47,47 0 1,0 50,97 A47,47 0 1,0 50,3 M35,30 A7,7 0 1,0 35,44 A7,7 0 1,0 35,30 M65,30 A7,7 0 1,0 65,44 A7,7 0 1,0 65,30 M28,58 Q50,84 72,58 Q66,70 50,74 Q34,70 28,58 Z" class="shape-path"/>',

  // Arrows
  arrow: '<polygon points="2,30 65,30 65,10 98,50 65,90 65,70 2,70" class="shape-path"/>',
  "arrow-double": '<polygon points="2,50 20,15 20,35 80,35 80,15 98,50 80,85 80,65 20,65 20,85" class="shape-path"/>',
  "notched-arrow": '<polygon points="2,35 60,35 60,15 98,50 60,85 60,65 2,65 15,50" class="shape-path"/>',
  "pentagon-arrow": '<polygon points="2,15 72,15 98,50 72,85 2,85" class="shape-path"/>',
  "arrow-striped": '<path fill-rule="evenodd" d="M2,30 L65,30 L65,10 L98,50 L65,90 L65,70 L2,70 Z M20,30 L26,30 L26,70 L20,70 Z M38,30 L44,30 L44,70 L38,70 Z" class="shape-path"/>',
  "arrow-bent": '<polygon points="2,15 55,15 55,2 98,35 55,68 55,55 35,55 35,95 2,95" class="shape-path"/>',
  chevron: '<polygon points="2,2 65,2 98,50 65,98 2,98 35,50" class="shape-path"/>',

  // Callouts & speech bubbles (static fallbacks; the parametric versions below
  // are used whenever a direction can be computed).
  "speech-bubble": '<path d="M5,5 L95,5 L95,68 L62,68 L50,88 L38,68 L5,68 Z" class="shape-path"/>',
  "callout-round": '<path d="M50,5 C76,5 95,24 95,50 C95,76 76,95 50,95 L30,98 L38,85 C18,79 5,66 5,50 C5,24 24,5 50,5 Z" class="shape-path"/>',
  "callout-rounded": '<path d="M12,5 Q5,5 5,12 L5,65 Q5,72 12,72 L38,72 L50,90 L62,72 L88,72 Q95,72 95,65 L95,12 Q95,5 88,5 Z" class="shape-path"/>',
  "callout-oval": '<path d="M50,5 C75,5 95,20 95,45 C95,68 77,82 55,84 L50,95 L42,84 C20,82 5,68 5,45 C5,20 25,5 50,5 Z" class="shape-path"/>',
  "callout-thought":
    '<circle cx="50" cy="38" r="32" class="shape-path"/>' +
    '<circle cx="34" cy="74" r="10" class="shape-path"/>' +
    '<circle cx="24" cy="88" r="6" class="shape-path"/>' +
    '<circle cx="16" cy="97" r="4" class="shape-path"/>',
  "callout-cloud": '<path d="M28,58 C15,58 5,50 5,40 C5,30 12,23 22,22 C22,11 31,3 43,3 C52,3 59,8 63,15 C66,12 71,10 76,10 C86,10 94,18 94,28 C97,30 97,37 97,44 C97,54 89,62 79,62 L60,62 L50,78 L42,62 Z" class="shape-path"/>',
  "callout-explosion": '<polygon points="50,2 57,18 68,5 72,20 84,10 84,27 97,22 91,38 98,50 84,50 90,65 75,63 78,80 63,74 60,92 50,80 40,92 37,74 22,80 25,63 10,65 16,50 2,50 9,38 3,22 16,27 16,10 28,20 32,5 43,18" class="shape-path"/>',

  // Flowchart
  terminator: '<rect x="5" y="20" width="90" height="60" rx="30" ry="30" class="shape-path"/>',
  cylinder: '<path d="M5,20 A45,15 0 0,1 95,20 L95,80 A45,15 0 0,1 5,80 Z" class="shape-path"/>',
  document: '<path d="M5,5 L95,5 L95,78 C82,90 70,68 57,80 C44,92 32,70 18,82 C12,87 8,88 5,86 Z" class="shape-path"/>',
  "manual-input": '<polygon points="5,30 95,5 95,95 5,95" class="shape-path"/>',
  delay: '<path d="M5,5 L60,5 A45,45 0 0,1 60,95 L5,95 Z" class="shape-path"/>',
  display: '<path d="M5,20 L70,20 L95,50 L70,80 L5,80 Z" class="shape-path"/>',
  "stored-data": '<path d="M5,5 L65,5 C88,5 95,25 95,50 C95,75 88,95 65,95 L5,95 C18,80 22,65 22,50 C22,35 18,20 5,5 Z" class="shape-path"/>',
  "summing-junction": '<path fill-rule="evenodd" d="M50,3 A47,47 0 1,0 50,97 A47,47 0 1,0 50,3 M47,10 L53,10 L53,47 L90,47 L90,53 L53,53 L53,90 L47,90 L47,53 L10,53 L10,47 L47,47 Z" class="shape-path"/>',
  "off-page": '<polygon points="2,2 98,2 98,75 50,98 2,75" class="shape-path"/>',

  // Misc block shapes
  cross: '<polygon points="35,2 65,2 65,35 98,35 98,65 65,65 65,98 35,98 35,65 2,65 2,35 35,35" class="shape-path"/>',
  shield: '<path d="M10,10 L90,10 L90,55 C90,78 72,92 50,98 C28,92 10,78 10,55 Z" class="shape-path"/>',
  "folded-corner": '<path d="M2,2 L78,2 L98,22 L98,98 L2,98 Z M78,2 L78,22 L98,22" class="shape-path"/>',
  "diagonal-stripe": '<polygon points="2,18 82,18 98,82 18,82" class="shape-path"/>',
  scroll: '<path d="M22,8 C8,8 5,16 5,24 C5,32 10,35 10,50 C10,65 5,68 5,76 C5,90 12,93 22,93 L80,93 C88,93 95,87 95,76 L95,24 C95,16 88,8 80,8 Z" class="shape-path"/>',
  "wavy-flag": '<path d="M5,22 C20,12 35,12 50,22 C65,32 80,32 95,22 L95,78 C80,88 65,88 50,78 C35,68 20,68 5,78 Z" class="shape-path"/>',

  // Ribbons & banners
  ribbon: '<polygon points="2,20 85,20 98,50 85,80 2,80 15,50" class="shape-path"/>',

  // 3D / perspective
  cube: '<path d="M50,8 L92,32 L92,72 L50,95 L8,72 L8,32 Z M50,8 L50,52 M8,32 L50,52 M92,32 L50,52" class="shape-path"/>',
  "cylinder-3d": '<path d="M5,25 A45,15 0 1,0 95,25 A45,15 0 1,0 5,25 M5,25 L5,75 A45,15 0 0,0 95,75 L95,25" class="shape-path"/>',
  cone: '<path d="M50,5 L95,88 A45,10 0 0,1 5,88 Z" class="shape-path"/>',
  pyramid: '<path d="M50,5 L95,88 L5,88 Z M50,5 L95,88 M50,5 L72,88" class="shape-path"/>',

  // Math symbols
  minus: '<rect x="10" y="44" width="80" height="12" class="shape-path"/>',
  multiply: '<path d="M15,10 L35,10 L50,30 L65,10 L85,10 L62,50 L85,90 L65,90 L50,70 L35,90 L15,90 L38,50 Z" class="shape-path"/>',
  divide: '<path d="M10,46 L90,46 L90,54 L10,54 Z M44,10 A6,6 0 1,0 56,10 A6,6 0 1,0 44,10 M44,80 A6,6 0 1,0 56,80 A6,6 0 1,0 44,80" class="shape-path"/>',
  equals: '<path d="M10,35 L90,35 L90,45 L10,45 Z M10,55 L90,55 L90,65 L10,65 Z" class="shape-path"/>',
  "not-equal": '<path d="M10,32 L90,32 L90,42 L10,42 Z M10,58 L90,58 L90,68 L10,68 Z M69,11 L45,95 L38,92 L62,8 Z" class="shape-path"/>',

  // Brackets & braces
  "bracket-left": '<path d="M60,5 L40,5 L40,95 L60,95 L60,88 L47,88 L47,12 L60,12 Z" class="shape-path"/>',
  "bracket-right": '<path d="M40,5 L60,5 L60,95 L40,95 L40,88 L53,88 L53,12 L40,12 Z" class="shape-path"/>',
  "brace-left": '<path d="M65,5 C50,5 48,14 48,24 L48,42 C48,50 42,52 38,52 C42,52 48,54 48,62 L48,78 C48,88 50,95 65,95 L65,88 C55,88 55,82 55,75 L55,60 C55,50 50,52 46,52 C50,52 55,54 55,42 L55,25 C55,18 55,12 65,12 Z" class="shape-path"/>',
  "brace-right": '<path d="M35,5 C50,5 52,12 52,25 L52,42 C52,54 57,52 61,52 C57,52 52,54 52,62 L52,75 C52,82 50,88 35,88 L35,95 C50,95 62,88 62,78 L62,62 C62,54 66,52 70,52 C66,52 62,50 62,42 L62,24 C62,14 60,5 35,5 Z" class="shape-path"/>',
  "paren-left": '<path d="M62,3 C32,22 32,78 62,97 C45,78 45,22 62,3 Z" class="shape-path"/>',
  "paren-right": '<path d="M38,3 C68,22 68,78 38,97 C55,78 55,22 38,3 Z" class="shape-path"/>',
};

// ── Parametric callouts ──────────────────────────────────────────────────────
// Ported from shapes.lua: a body (ellipse or rounded rect) plus a triangular
// spike whose apex points in the requested compass direction. Changing the
// direction moves only the spike, so the body stays upright and the result is a
// single closed path with no seam.

/** Callout body specs, keyed by shape name. Mirrors Lua `CALLOUTS`. */
export const CALLOUTS = {
  "callout-round": { kind: "ellipse", rx: 34, ry: 34 },
  "callout-oval": { kind: "ellipse", rx: 36, ry: 28 },
  "callout-rounded": { kind: "rrect", x0: 16, y0: 26, x1: 84, y1: 74, r: 12 },
  "speech-bubble": { kind: "rrect", x0: 14, y0: 22, x1: 86, y1: 78, r: 6 },
};

/** Keyword aliases for `direction=` (compass degrees, 0 = up). */
export const DIRECTIONS = { up: 0, right: 90, down: 180, left: 270 };

const SPIKE_HALF = 8; // half-width of the spike base, in viewBox units
const SPIKE_LEN = 12; // how far the apex extends past the body edge

/**
 * Resolve a `direction=` value (keyword or number) to compass degrees.
 * Defaults to 180 (pointer down), matching shapes.lua.
 * @param {string|number|null|undefined} d
 * @returns {number}
 */
export function parseDirection(d) {
  if (d === null || d === undefined || d === "") return 180;
  if (Object.prototype.hasOwnProperty.call(DIRECTIONS, d)) return DIRECTIONS[d];
  const num = Number(d);
  return Number.isNaN(num) ? 180 : num;
}

function ellipseCallout(s, vx, vy) {
  const cx = 50;
  const cy = 50;
  const { rx, ry } = s;
  const alpha = 0.34; // half angular width of the gap (radians)
  const t0 = Math.atan2(rx * vy, ry * vx);
  const E = (t) => [cx + rx * Math.cos(t), cy + ry * Math.sin(t)];
  const [p1x, p1y] = E(t0 + alpha);
  const [p2x, p2y] = E(t0 - alpha);
  const [e0x, e0y] = E(t0);
  const ax = e0x + SPIKE_LEN * vx;
  const ay = e0y + SPIKE_LEN * vy;
  return `<path d="M${f2(p1x)},${f2(p1y)} A${rx},${ry} 0 1 1 ${f2(p2x)},${f2(p2y)} L${f2(ax)},${f2(ay)} Z" class="shape-path"/>`;
}

function rrectCallout(s, vx, vy) {
  const cx = 50;
  const cy = 50;
  const { x0, y0, x1, y1, r } = s;

  // Slab method: find the rectangle boundary the ray from center exits first.
  let best = null;
  const consider = (t, edge, px, py) => {
    if (t !== null && t > 1e-9 && (!best || t < best.t)) {
      best = { t, edge, x: px, y: py };
    }
  };
  if (vx !== 0) {
    let t = (x1 - cx) / vx;
    let y = cy + t * vy;
    if (y >= y0 && y <= y1) consider(t, "right", x1, y);
    t = (x0 - cx) / vx;
    y = cy + t * vy;
    if (y >= y0 && y <= y1) consider(t, "left", x0, y);
  }
  if (vy !== 0) {
    let t = (y1 - cy) / vy;
    let x = cx + t * vx;
    if (x >= x0 && x <= x1) consider(t, "bottom", x, y1);
    t = (y0 - cy) / vy;
    x = cx + t * vx;
    if (x >= x0 && x <= x1) consider(t, "top", x, y0);
  }

  const ex = best.x;
  const ey = best.y;
  const apexX = ex + SPIKE_LEN * vx;
  const apexY = ey + SPIKE_LEN * vy;

  const edge = (isSpike, endx, endy, ux, uy, lo, hi) => {
    if (!isSpike) return `L${f2(endx)},${f2(endy)}`;
    let along = ex * Math.abs(ux) + ey * Math.abs(uy);
    along = Math.max(lo + SPIKE_HALF, Math.min(hi - SPIKE_HALF, along));
    let bx;
    let by;
    if (ux !== 0) {
      bx = along;
      by = endy;
    } else {
      bx = endx;
      by = along;
    }
    const b1x = bx - SPIKE_HALF * ux;
    const b1y = by - SPIKE_HALF * uy;
    const b2x = bx + SPIKE_HALF * ux;
    const b2y = by + SPIKE_HALF * uy;
    return `L${f2(b1x)},${f2(b1y)} L${f2(apexX)},${f2(apexY)} L${f2(b2x)},${f2(b2y)} L${f2(endx)},${f2(endy)}`;
  };

  const arc = `A${r} ${r} 0 0 1`;
  const parts = [
    `M${f2(x0 + r)},${f2(y0)}`,
    edge(best.edge === "top", x1 - r, y0, 1, 0, x0 + r, x1 - r),
    `${arc} ${f2(x1)},${f2(y0 + r)}`,
    edge(best.edge === "right", x1, y1 - r, 0, 1, y0 + r, y1 - r),
    `${arc} ${f2(x1 - r)},${f2(y1)}`,
    edge(best.edge === "bottom", x0 + r, y1, -1, 0, x0 + r, x1 - r),
    `${arc} ${f2(x0)},${f2(y1 - r)}`,
    edge(best.edge === "left", x0, y0 + r, 0, -1, y0 + r, y1 - r),
    `${arc} ${f2(x0 + r)},${f2(y0)}`,
    "Z",
  ];
  return `<path d="${parts.join(" ")}" class="shape-path"/>`;
}

function calloutSvg(spec, deg) {
  const rad = (deg * Math.PI) / 180;
  const vx = Math.sin(rad);
  const vy = -Math.cos(rad);
  if (spec.kind === "ellipse") return ellipseCallout(spec, vx, vy);
  return rrectCallout(spec, vx, vy);
}

/**
 * Whether a shape name is a parametric callout that honours `direction=`.
 * @param {string} shapeName
 * @returns {boolean}
 */
export function isCallout(shapeName) {
  return Object.prototype.hasOwnProperty.call(CALLOUTS, shapeName);
}

/**
 * Whether a shape name is known to the catalog (static or parametric).
 * @param {string} shapeName
 * @returns {boolean}
 */
export function isKnownShape(shapeName) {
  return isCallout(shapeName) || Object.prototype.hasOwnProperty.call(SHAPES, shapeName);
}

/**
 * Inner SVG markup for a shape, computing parametric callouts from a direction
 * and falling back to the static catalog. Mirrors Lua `get_shape_markup`.
 * @param {string} shapeName - Name after the `shape-` prefix (e.g. "hexagon").
 * @param {string|number} [direction] - Callout direction (keyword or degrees).
 * @returns {string}
 */
export function shapeMarkup(shapeName, direction) {
  if (isCallout(shapeName)) {
    return calloutSvg(CALLOUTS[shapeName], parseDirection(direction));
  }
  return SHAPES[shapeName] || "";
}

/**
 * Full `<svg class="shape-svg">…</svg>` string for a shape, matching the markup
 * quarto-shapes' Lua filter emits in HTML/RevealJS output.
 * @param {string} shapeName
 * @param {Object} [opts]
 * @param {string|number} [opts.direction] - Callout direction.
 * @returns {string}
 */
export function renderShapeSvg(shapeName, opts = {}) {
  return (
    '<svg class="shape-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
    shapeMarkup(shapeName, opts.direction) +
    "</svg>"
  );
}

/**
 * Ordered list of shape types for the picker UI, grouped for display.
 * `direction: true` marks callout/bubble types that support `direction=`.
 * @type {Array<{group: string, items: Array<{name: string, label: string, direction?: boolean}>}>}
 */
export const SHAPE_GROUPS = [
  {
    group: "Basic",
    items: [
      { name: "circle", label: "Circle" },
      { name: "square", label: "Square" },
      { name: "rectangle", label: "Rectangle" },
      { name: "rounded-square", label: "Rounded square" },
      { name: "oval", label: "Oval" },
      { name: "semicircle", label: "Semicircle" },
      { name: "pie", label: "Pie" },
      { name: "wedge", label: "Wedge" },
      { name: "arc", label: "Arc" },
      { name: "block-arc", label: "Block arc" },
      { name: "donut", label: "Donut" },
      { name: "frame", label: "Frame" },
    ],
  },
  {
    group: "Polygons",
    items: [
      { name: "triangle", label: "Triangle" },
      { name: "diamond", label: "Diamond" },
      { name: "pentagon", label: "Pentagon" },
      { name: "hexagon", label: "Hexagon" },
      { name: "heptagon", label: "Heptagon" },
      { name: "octagon", label: "Octagon" },
      { name: "decagon", label: "Decagon" },
      { name: "dodecagon", label: "Dodecagon" },
      { name: "parallelogram", label: "Parallelogram" },
      { name: "trapezoid", label: "Trapezoid" },
    ],
  },
  {
    group: "Stars",
    items: [
      { name: "star-4", label: "4-point star" },
      { name: "star", label: "Star" },
      { name: "star-6", label: "6-point star" },
      { name: "star-8", label: "8-point star" },
      { name: "star-10", label: "10-point star" },
      { name: "star-12", label: "12-point star" },
      { name: "star-16", label: "16-point star" },
      { name: "star-24", label: "24-point star" },
      { name: "star-32", label: "32-point star" },
      { name: "sun", label: "Sun" },
      { name: "starburst", label: "Starburst" },
    ],
  },
  {
    group: "Nature & symbols",
    items: [
      { name: "heart", label: "Heart" },
      { name: "moon", label: "Moon" },
      { name: "cloud", label: "Cloud" },
      { name: "lightning", label: "Lightning" },
      { name: "teardrop", label: "Teardrop" },
      { name: "wave", label: "Wave" },
      { name: "double-wave", label: "Double wave" },
      { name: "no-symbol", label: "No symbol" },
      { name: "smiley", label: "Smiley" },
    ],
  },
  {
    group: "Arrows",
    items: [
      { name: "arrow", label: "Arrow" },
      { name: "arrow-double", label: "Double arrow" },
      { name: "notched-arrow", label: "Notched arrow" },
      { name: "pentagon-arrow", label: "Pentagon arrow" },
      { name: "arrow-striped", label: "Striped arrow" },
      { name: "arrow-bent", label: "Bent arrow" },
      { name: "chevron", label: "Chevron" },
    ],
  },
  {
    group: "Callouts",
    items: [
      { name: "speech-bubble", label: "Speech bubble", direction: true },
      { name: "callout-round", label: "Round callout", direction: true },
      { name: "callout-oval", label: "Oval callout", direction: true },
      { name: "callout-rounded", label: "Rounded callout", direction: true },
      { name: "callout-thought", label: "Thought" },
      { name: "callout-cloud", label: "Cloud callout" },
      { name: "callout-explosion", label: "Explosion" },
    ],
  },
  {
    group: "Flowchart",
    items: [
      { name: "terminator", label: "Terminator" },
      { name: "cylinder", label: "Cylinder" },
      { name: "document", label: "Document" },
      { name: "manual-input", label: "Manual input" },
      { name: "delay", label: "Delay" },
      { name: "display", label: "Display" },
      { name: "stored-data", label: "Stored data" },
      { name: "summing-junction", label: "Summing junction" },
      { name: "off-page", label: "Off-page" },
    ],
  },
  {
    group: "Blocks & banners",
    items: [
      { name: "cross", label: "Cross" },
      { name: "shield", label: "Shield" },
      { name: "folded-corner", label: "Folded corner" },
      { name: "diagonal-stripe", label: "Diagonal stripe" },
      { name: "scroll", label: "Scroll" },
      { name: "wavy-flag", label: "Wavy flag" },
      { name: "ribbon", label: "Ribbon" },
    ],
  },
  {
    group: "3D",
    items: [
      { name: "cube", label: "Cube" },
      { name: "cylinder-3d", label: "Cylinder (3D)" },
      { name: "cone", label: "Cone" },
      { name: "pyramid", label: "Pyramid" },
    ],
  },
  {
    group: "Math",
    items: [
      { name: "minus", label: "Minus" },
      { name: "multiply", label: "Multiply" },
      { name: "divide", label: "Divide" },
      { name: "equals", label: "Equals" },
      { name: "not-equal", label: "Not equal" },
    ],
  },
  {
    group: "Brackets",
    items: [
      { name: "bracket-left", label: "Left bracket" },
      { name: "bracket-right", label: "Right bracket" },
      { name: "brace-left", label: "Left brace" },
      { name: "brace-right", label: "Right brace" },
      { name: "paren-left", label: "Left paren" },
      { name: "paren-right", label: "Right paren" },
    ],
  },
];

/** Flat list of every picker entry. */
export const SHAPE_TYPES = SHAPE_GROUPS.flatMap((g) => g.items);
