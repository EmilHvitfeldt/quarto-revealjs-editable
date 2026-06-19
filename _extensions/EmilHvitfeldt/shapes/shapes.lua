-- shapes.lua

-- Generate regular polygon SVG element
local function poly(n, r)
  r = r or 47
  local pts = {}
  for i = 0, n - 1 do
    local a = math.pi * (2 * i / n - 0.5)
    pts[#pts + 1] = string.format("%.1f,%.1f", 50 + r * math.cos(a), 50 + r * math.sin(a))
  end
  return '<polygon points="' .. table.concat(pts, " ") .. '" class="shape-path"/>'
end

-- Generate star polygon SVG element
local function star(n, ro, ri)
  ro = ro or 47
  ri = ri or 20
  local pts = {}
  for i = 0, 2 * n - 1 do
    local a = math.pi * (i / n - 0.5)
    local r = (i % 2 == 0) and ro or ri
    pts[#pts + 1] = string.format("%.1f,%.1f", 50 + r * math.cos(a), 50 + r * math.sin(a))
  end
  return '<polygon points="' .. table.concat(pts, " ") .. '" class="shape-path"/>'
end

local shapes = {

  -- ── Basic geometric ──────────────────────────────────────────────────────────
  circle        = '<circle cx="50" cy="50" r="47" class="shape-path"/>',
  square        = '<rect x="2" y="2" width="96" height="96" class="shape-path"/>',
  rectangle     = '<rect x="2" y="15" width="96" height="70" class="shape-path"/>',
  ["rounded-square"] = '<rect x="5" y="5" width="90" height="90" rx="15" ry="15" class="shape-path"/>',
  oval          = '<ellipse cx="50" cy="50" rx="48" ry="30" class="shape-path"/>',
  semicircle    = '<path d="M3,50 A47,47 0 0,1 97,50 Z" class="shape-path"/>',
  pie           = '<path d="M50,50 L97,50 A47,47 0 1,1 50,3 Z" class="shape-path"/>',
  wedge         = '<path d="M2,98 L2,3 A95,95 0 0,1 97,98 Z" class="shape-path"/>',
  arc           = '<path d="M50,5 A45,45 0 0,0 50,95 L50,70 A20,20 0 0,1 50,30 Z" class="shape-path"/>',
  ["block-arc"] = '<path d="M50,3 A47,47 0 1,0 97,50 L78,50 A28,28 0 1,1 50,22 Z" class="shape-path"/>',
  donut         = '<path fill-rule="evenodd" d="M50,3 A47,47 0 1,1 50,97 A47,47 0 1,1 50,3 M50,22 A28,28 0 1,0 50,78 A28,28 0 1,0 50,22" class="shape-path"/>',
  frame         = '<path fill-rule="evenodd" d="M2,2 L98,2 L98,98 L2,98 Z M14,14 L86,14 L86,86 L14,86 Z" class="shape-path"/>',

  -- ── Polygons ─────────────────────────────────────────────────────────────────
  triangle      = poly(3),
  diamond       = poly(4),
  pentagon      = poly(5),
  hexagon       = poly(6),
  heptagon      = poly(7),
  octagon       = poly(8),
  decagon       = poly(10),
  dodecagon     = poly(12),
  parallelogram = '<polygon points="20,2 98,2 80,98 2,98" class="shape-path"/>',
  trapezoid     = '<polygon points="20,2 80,2 98,98 2,98" class="shape-path"/>',

  -- ── Stars ────────────────────────────────────────────────────────────────────
  ["star-4"]    = star(4),
  star          = star(5),
  ["star-6"]    = star(6),
  ["star-8"]    = star(8),
  ["star-10"]   = star(10),
  ["star-12"]   = star(12),
  ["star-16"]   = star(16),
  ["star-24"]   = star(24),
  ["star-32"]   = star(32),
  sun           = star(8, 47, 28),
  starburst     = star(12, 47, 38),

  -- ── Nature / symbols ─────────────────────────────────────────────────────────
  heart         = '<path d="M50,85 C30,70 5,60 5,40 C5,20 20,10 35,15 C42,17 48,22 50,28 C52,22 58,17 65,15 C80,10 95,20 95,40 C95,60 70,70 50,85 Z" class="shape-path"/>',
  moon          = '<path d="M50,5 C20,5 5,25 5,50 C5,75 20,95 50,95 C35,80 28,66 28,50 C28,34 35,20 50,5 Z" class="shape-path"/>',
  cloud         = '<path d="M28,65 C15,65 5,56 5,45 C5,35 12,27 22,26 C22,14 31,5 43,5 C52,5 59,10 63,18 C66,15 71,13 76,13 C86,13 94,21 94,31 C97,33 97,40 97,47 C97,57 89,65 79,65 Z" class="shape-path"/>',
  lightning     = '<polygon points="60,2 22,52 46,52 40,98 78,48 54,48" class="shape-path"/>',
  teardrop      = '<path d="M50,95 C28,78 8,62 8,44 C8,22 27,5 50,5 C73,5 92,22 92,44 C92,62 72,78 50,95 Z" class="shape-path"/>',
  wave          = '<path d="M2,35 C18,15 32,15 50,35 C68,55 82,55 98,35 L98,65 C82,85 68,85 50,65 C32,45 18,45 2,65 Z" class="shape-path"/>',
  ["double-wave"] = '<path d="M2,22 C18,8 32,8 50,22 C68,36 82,36 98,22 L98,38 C82,52 68,52 50,38 C32,24 18,24 2,38 Z M2,58 C18,44 32,44 50,58 C68,72 82,72 98,58 L98,74 C82,88 68,88 50,74 C32,60 18,60 2,74 Z" class="shape-path"/>',
  ["no-symbol"] = '<path fill-rule="evenodd" d="M50,3 A47,47 0 1,0 50,97 A47,47 0 1,0 50,3 M14,22 L22,14 L86,78 L78,86 Z" class="shape-path"/>',
  smiley        = '<path fill-rule="evenodd" d="M50,3 A47,47 0 1,0 50,97 A47,47 0 1,0 50,3 M35,30 A7,7 0 1,0 35,44 A7,7 0 1,0 35,30 M65,30 A7,7 0 1,0 65,44 A7,7 0 1,0 65,30 M28,58 Q50,84 72,58 Q66,70 50,74 Q34,70 28,58 Z" class="shape-path"/>',

  -- ── Arrows ───────────────────────────────────────────────────────────────────
  arrow              = '<polygon points="2,30 65,30 65,10 98,50 65,90 65,70 2,70" class="shape-path"/>',
  ["arrow-double"]   = '<polygon points="2,50 20,15 20,35 80,35 80,15 98,50 80,85 80,65 20,65 20,85" class="shape-path"/>',
  ["notched-arrow"]  = '<polygon points="2,35 60,35 60,15 98,50 60,85 60,65 2,65 15,50" class="shape-path"/>',
  ["pentagon-arrow"] = '<polygon points="2,15 72,15 98,50 72,85 2,85" class="shape-path"/>',
  ["arrow-striped"]  = '<path fill-rule="evenodd" d="M2,30 L65,30 L65,10 L98,50 L65,90 L65,70 L2,70 Z M20,30 L26,30 L26,70 L20,70 Z M38,30 L44,30 L44,70 L38,70 Z" class="shape-path"/>',
  ["arrow-bent"]     = '<polygon points="2,15 55,15 55,2 98,35 55,68 55,55 35,55 35,95 2,95" class="shape-path"/>',
  chevron            = '<polygon points="2,2 65,2 98,50 65,98 2,98 35,50" class="shape-path"/>',

  -- ── Callouts & speech bubbles ─────────────────────────────────────────────────
  ["speech-bubble"]    = '<path d="M5,5 L95,5 L95,68 L62,68 L50,88 L38,68 L5,68 Z" class="shape-path"/>',
  ["callout-round"]    = '<path d="M50,5 C76,5 95,24 95,50 C95,76 76,95 50,95 L30,98 L38,85 C18,79 5,66 5,50 C5,24 24,5 50,5 Z" class="shape-path"/>',
  ["callout-rounded"]  = '<path d="M12,5 Q5,5 5,12 L5,65 Q5,72 12,72 L38,72 L50,90 L62,72 L88,72 Q95,72 95,65 L95,12 Q95,5 88,5 Z" class="shape-path"/>',
  ["callout-oval"]     = '<path d="M50,5 C75,5 95,20 95,45 C95,68 77,82 55,84 L50,95 L42,84 C20,82 5,68 5,45 C5,20 25,5 50,5 Z" class="shape-path"/>',
  ["callout-thought"]  = '<circle cx="50" cy="38" r="32" class="shape-path"/>'
                      .. '<circle cx="34" cy="74" r="10" class="shape-path"/>'
                      .. '<circle cx="24" cy="88" r="6" class="shape-path"/>'
                      .. '<circle cx="16" cy="97" r="4" class="shape-path"/>',
  ["callout-cloud"]    = '<path d="M28,58 C15,58 5,50 5,40 C5,30 12,23 22,22 C22,11 31,3 43,3 C52,3 59,8 63,15 C66,12 71,10 76,10 C86,10 94,18 94,28 C97,30 97,37 97,44 C97,54 89,62 79,62 L60,62 L50,78 L42,62 Z" class="shape-path"/>',
  ["callout-explosion"]= '<polygon points="50,2 57,18 68,5 72,20 84,10 84,27 97,22 91,38 98,50 84,50 90,65 75,63 78,80 63,74 60,92 50,80 40,92 37,74 22,80 25,63 10,65 16,50 2,50 9,38 3,22 16,27 16,10 28,20 32,5 43,18" class="shape-path"/>',

  -- ── Flowchart ─────────────────────────────────────────────────────────────────
  terminator    = '<rect x="5" y="20" width="90" height="60" rx="30" ry="30" class="shape-path"/>',
  cylinder      = '<path d="M5,20 A45,15 0 0,1 95,20 L95,80 A45,15 0 0,1 5,80 Z" class="shape-path"/>',
  document      = '<path d="M5,5 L95,5 L95,78 C82,90 70,68 57,80 C44,92 32,70 18,82 C12,87 8,88 5,86 Z" class="shape-path"/>',
  ["manual-input"]     = '<polygon points="5,30 95,5 95,95 5,95" class="shape-path"/>',
  delay                = '<path d="M5,5 L60,5 A45,45 0 0,1 60,95 L5,95 Z" class="shape-path"/>',
  display              = '<path d="M5,20 L70,20 L95,50 L70,80 L5,80 Z" class="shape-path"/>',
  ["stored-data"]      = '<path d="M5,5 L65,5 C88,5 95,25 95,50 C95,75 88,95 65,95 L5,95 C18,80 22,65 22,50 C22,35 18,20 5,5 Z" class="shape-path"/>',
  ["summing-junction"] = '<path fill-rule="evenodd" d="M50,3 A47,47 0 1,0 50,97 A47,47 0 1,0 50,3 M47,10 L53,10 L53,47 L90,47 L90,53 L53,53 L53,90 L47,90 L47,53 L10,53 L10,47 L47,47 Z" class="shape-path"/>',
  ["off-page"]         = '<polygon points="2,2 98,2 98,75 50,98 2,75" class="shape-path"/>',

  -- ── Misc block shapes ─────────────────────────────────────────────────────────
  cross                = '<polygon points="35,2 65,2 65,35 98,35 98,65 65,65 65,98 35,98 35,65 2,65 2,35 35,35" class="shape-path"/>',
  shield               = '<path d="M10,10 L90,10 L90,55 C90,78 72,92 50,98 C28,92 10,78 10,55 Z" class="shape-path"/>',
  ["folded-corner"]    = '<path d="M2,2 L78,2 L98,22 L98,98 L2,98 Z M78,2 L78,22 L98,22" class="shape-path"/>',
  ["diagonal-stripe"]  = '<polygon points="2,18 82,18 98,82 18,82" class="shape-path"/>',
  scroll               = '<path d="M22,8 C8,8 5,16 5,24 C5,32 10,35 10,50 C10,65 5,68 5,76 C5,90 12,93 22,93 L80,93 C88,93 95,87 95,76 L95,24 C95,16 88,8 80,8 Z" class="shape-path"/>',
  ["wavy-flag"]        = '<path d="M5,22 C20,12 35,12 50,22 C65,32 80,32 95,22 L95,78 C80,88 65,88 50,78 C35,68 20,68 5,78 Z" class="shape-path"/>',

  -- ── Ribbons & banners ─────────────────────────────────────────────────────────
  ribbon               = '<polygon points="2,20 85,20 98,50 85,80 2,80 15,50" class="shape-path"/>',

  -- ── 3D / Perspective ─────────────────────────────────────────────────────────
  cube                 = '<path d="M50,8 L92,32 L92,72 L50,95 L8,72 L8,32 Z M50,8 L50,52 M8,32 L50,52 M92,32 L50,52" class="shape-path"/>',
  ["cylinder-3d"]      = '<path d="M5,25 A45,15 0 1,0 95,25 A45,15 0 1,0 5,25 M5,25 L5,75 A45,15 0 0,0 95,75 L95,25" class="shape-path"/>',
  cone                 = '<path d="M50,5 L95,88 A45,10 0 0,1 5,88 Z" class="shape-path"/>',
  pyramid              = '<path d="M50,5 L95,88 L5,88 Z M50,5 L95,88 M50,5 L72,88" class="shape-path"/>',

  -- ── Math symbols ─────────────────────────────────────────────────────────────
  minus                = '<rect x="10" y="44" width="80" height="12" class="shape-path"/>',
  multiply             = '<path d="M15,10 L35,10 L50,30 L65,10 L85,10 L62,50 L85,90 L65,90 L50,70 L35,90 L15,90 L38,50 Z" class="shape-path"/>',
  divide               = '<path d="M10,46 L90,46 L90,54 L10,54 Z M44,10 A6,6 0 1,0 56,10 A6,6 0 1,0 44,10 M44,80 A6,6 0 1,0 56,80 A6,6 0 1,0 44,80" class="shape-path"/>',
  equals               = '<path d="M10,35 L90,35 L90,45 L10,45 Z M10,55 L90,55 L90,65 L10,65 Z" class="shape-path"/>',
  ["not-equal"]        = '<path d="M10,32 L90,32 L90,42 L10,42 Z M10,58 L90,58 L90,68 L10,68 Z M69,11 L45,95 L38,92 L62,8 Z" class="shape-path"/>',

  -- ── Brackets & braces ─────────────────────────────────────────────────────────
  ["bracket-left"]     = '<path d="M60,5 L40,5 L40,95 L60,95 L60,88 L47,88 L47,12 L60,12 Z" class="shape-path"/>',
  ["bracket-right"]    = '<path d="M40,5 L60,5 L60,95 L40,95 L40,88 L53,88 L53,12 L40,12 Z" class="shape-path"/>',
  ["brace-left"]       = '<path d="M65,5 C50,5 48,14 48,24 L48,42 C48,50 42,52 38,52 C42,52 48,54 48,62 L48,78 C48,88 50,95 65,95 L65,88 C55,88 55,82 55,75 L55,60 C55,50 50,52 46,52 C50,52 55,54 55,42 L55,25 C55,18 55,12 65,12 Z" class="shape-path"/>',
  ["brace-right"]      = '<path d="M35,5 C50,5 52,12 52,25 L52,42 C52,54 57,52 61,52 C57,52 52,54 52,62 L52,75 C52,82 50,88 35,88 L35,95 C50,95 62,88 62,78 L62,62 C62,54 66,52 70,52 C66,52 62,50 62,42 L62,24 C62,14 60,5 35,5 Z" class="shape-path"/>',
  ["paren-left"]       = '<path d="M62,3 C32,22 32,78 62,97 C45,78 45,22 62,3 Z" class="shape-path"/>',
  ["paren-right"]      = '<path d="M38,3 C68,22 68,78 38,97 C55,78 55,22 38,3 Z" class="shape-path"/>',
}

local function get_shape_name(classes)
  for _, cls in ipairs(classes) do
    local name = cls:match("^shape%-(.+)$")
    if name and shapes[name] then return name end
  end
end

-- ── Parametric callouts ─────────────────────────────────────────────────────
-- Callouts are built at render time from a body (ellipse or rounded rect) and a
-- pointer (triangular spike) that can face any direction. The spike's base sits
-- on the body's perimeter and its apex points outward, so changing direction
-- moves only the spike: the body stays upright. The result is a single closed
-- path that strokes cleanly (no seam between body and pointer).
--
-- direction= is a compass angle in degrees (0 = up, 90 = right, 180 = down,
-- 270 = left). The keywords up/right/down/left are aliases for those numbers.

-- Bodies are kept small enough that the spike apex stays inside the 0–100
-- viewBox in every direction (body edge + SPIKE_LEN <= ~98), so nothing is
-- clipped in HTML, RevealJS, or the Typst image bounds.
local CALLOUTS = {
  ["callout-round"]   = { kind = "ellipse", rx = 34, ry = 34 },
  ["callout-oval"]    = { kind = "ellipse", rx = 36, ry = 28 },
  ["callout-rounded"] = { kind = "rrect", x0 = 16, y0 = 26, x1 = 84, y1 = 74, r = 12 },
  ["speech-bubble"]   = { kind = "rrect", x0 = 14, y0 = 22, x1 = 86, y1 = 78, r = 6 },
}

local DIRECTIONS = { up = 0, right = 90, down = 180, left = 270 }

local function parse_direction(el)
  local d = el.attributes.direction
  if not d then return 180 end          -- default: pointer down
  return DIRECTIONS[d] or tonumber(d) or 180
end

local SPIKE_HALF = 8     -- half-width of the spike base, in viewBox units
local SPIKE_LEN  = 12    -- how far the apex extends past the body edge

local function n(x) return string.format("%.2f", x) end

local function ellipse_callout(s, vx, vy)
  local cx, cy = 50, 50
  local rx, ry = s.rx, s.ry
  local alpha = 0.34                     -- half angular width of the gap (radians)
  -- Ellipse parameter t0 whose point lies in the (vx, vy) direction.
  local t0 = math.atan(rx * vy, ry * vx)
  local function E(t) return cx + rx * math.cos(t), cy + ry * math.sin(t) end
  local p1x, p1y = E(t0 + alpha)
  local p2x, p2y = E(t0 - alpha)
  -- Apex sits SPIKE_LEN beyond the body edge in the pointer direction, so the
  -- spike is the same length whichever way it faces.
  local e0x, e0y = E(t0)
  local ax, ay = e0x + SPIKE_LEN * vx, e0y + SPIKE_LEN * vy
  -- Major arc (large-arc=1, sweep=1) from p1 the long way to p2, avoiding the
  -- gap at t0, then a line out to the apex and back to close the spike.
  return string.format(
    '<path d="M%s,%s A%s,%s 0 1 1 %s,%s L%s,%s Z" class="shape-path"/>',
    n(p1x), n(p1y), rx, ry, n(p2x), n(p2y), n(ax), n(ay))
end

local function rrect_callout(s, vx, vy)
  local cx, cy = 50, 50
  local x0, y0, x1, y1, r = s.x0, s.y0, s.x1, s.y1, s.r

  -- Find where the ray from the center exits the rectangle (slab method): the
  -- boundary hit with the smallest positive parameter t.
  local best
  local function consider(t, edge, px, py)
    if t and t > 1e-9 and (not best or t < best.t) then
      best = { t = t, edge = edge, x = px, y = py }
    end
  end
  if vx ~= 0 then
    local t = (x1 - cx) / vx; local y = cy + t * vy
    if y >= y0 and y <= y1 then consider(t, "right", x1, y) end
    t = (x0 - cx) / vx; y = cy + t * vy
    if y >= y0 and y <= y1 then consider(t, "left", x0, y) end
  end
  if vy ~= 0 then
    local t = (y1 - cy) / vy; local x = cx + t * vx
    if x >= x0 and x <= x1 then consider(t, "bottom", x, y1) end
    t = (y0 - cy) / vy; x = cx + t * vx
    if x >= x0 and x <= x1 then consider(t, "top", x, y0) end
  end

  local ex, ey = best.x, best.y
  local apex_x, apex_y = ex + SPIKE_LEN * vx, ey + SPIKE_LEN * vy

  -- Emit one straight edge as a line to its endpoint, splicing in the spike
  -- (base1 → apex → base2) when this is the exit edge. `ux, uy` is the unit
  -- travel direction along the edge; base points are clamped to the straight
  -- portion so they never land in a corner arc.
  local function edge(is_spike, endx, endy, ux, uy, lo, hi)
    if not is_spike then return string.format("L%s,%s", n(endx), n(endy)) end
    -- Base centre slides along the edge; its fixed coordinate is the edge line
    -- (endy for horizontal edges, endx for vertical), not the body centre.
    local along = ex * math.abs(ux) + ey * math.abs(uy)
    along = math.max(lo + SPIKE_HALF, math.min(hi - SPIKE_HALF, along))
    local bx, by
    if ux ~= 0 then bx, by = along, endy else bx, by = endx, along end
    local b1x, b1y = bx - SPIKE_HALF * ux, by - SPIKE_HALF * uy
    local b2x, b2y = bx + SPIKE_HALF * ux, by + SPIKE_HALF * uy
    return string.format("L%s,%s L%s,%s L%s,%s L%s,%s",
      n(b1x), n(b1y), n(apex_x), n(apex_y), n(b2x), n(b2y), n(endx), n(endy))
  end

  local arc = string.format("A%s %s 0 0 1", r, r)
  local parts = {
    string.format("M%s,%s", n(x0 + r), n(y0)),
    edge(best.edge == "top",    x1 - r, y0,  1,  0, x0 + r, x1 - r),
    string.format("%s %s,%s", arc, n(x1), n(y0 + r)),
    edge(best.edge == "right",  x1, y1 - r,  0,  1, y0 + r, y1 - r),
    string.format("%s %s,%s", arc, n(x1 - r), n(y1)),
    edge(best.edge == "bottom", x0 + r, y1, -1,  0, x0 + r, x1 - r),
    string.format("%s %s,%s", arc, n(x0), n(y1 - r)),
    edge(best.edge == "left",   x0, y0 + r,  0, -1, y0 + r, y1 - r),
    string.format("%s %s,%s", arc, n(x0 + r), n(y0)),
    "Z",
  }
  return string.format('<path d="%s" class="shape-path"/>', table.concat(parts, " "))
end

local function callout_svg(spec, deg)
  local rad = math.rad(deg)
  local vx, vy = math.sin(rad), -math.cos(rad)
  if spec.kind == "ellipse" then return ellipse_callout(spec, vx, vy) end
  return rrect_callout(spec, vx, vy)
end

-- Returns the SVG inner markup for a shape, computing parametric callouts from
-- their direction= attribute and falling back to the static catalog otherwise.
local function get_shape_markup(el, shape)
  local spec = CALLOUTS[shape]
  if spec then return callout_svg(spec, parse_direction(el)) end
  return shapes[shape]
end

local function render_html(el, shape)
  quarto.doc.add_html_dependency({
    name = "shapes",
    version = "0.1.0",
    stylesheets = { "shapes.css" }
  })

  local class_str = table.concat(el.classes, " ")

  -- fill= and stroke= attributes become inline CSS custom properties that
  -- shapes.css reads on .shape-path. Any valid CSS color is accepted.
  local styles = {}
  if el.attributes.fill then
    table.insert(styles, "--shape-fill:" .. el.attributes.fill)
  end
  if el.attributes.stroke then
    table.insert(styles, "--shape-stroke:" .. el.attributes.stroke)
  end
  -- size= accepts any CSS length (e.g. "3cm", "200px") and overrides the
  -- .shape-{sm,md,lg,full} size classes.
  if el.attributes.size then
    table.insert(styles, "--shape-size:" .. el.attributes.size)
  end
  -- RevealJS's .absolute reads top/left/right/bottom (and width/height) as
  -- inline px offsets. Quarto normally injects these, but because we replace
  -- the Div with raw HTML we have to forward them ourselves. A bare number is
  -- treated as px; any other value (e.g. "50%") is passed through verbatim.
  for _, prop in ipairs({ "top", "left", "right", "bottom", "width", "height" }) do
    local val = el.attributes[prop]
    if val then
      if val:match("^%-?%d+%.?%d*$") then val = val .. "px" end
      table.insert(styles, prop .. ":" .. val)
    end
  end
  local style_attr = ""
  if #styles > 0 then
    style_attr = string.format(' style="%s"', table.concat(styles, ";"))
  end

  local open = pandoc.RawBlock("html", string.format(
    '<div class="shape-wrapper %s"%s>'
    .. '<svg class="shape-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">%s</svg>'
    .. '<div class="shape-content">',
    class_str,
    style_attr,
    get_shape_markup(el, shape)
  ))
  local close = pandoc.RawBlock("html", "</div></div>")

  local blocks = pandoc.Blocks({ open })
  blocks:extend(el.content)
  blocks:insert(close)
  return blocks
end

-- Typst output: shapes.css does not apply, so modifiers are parsed here
-- and baked directly into a standalone SVG embedded as a Typst image.
-- Fill and stroke colors come from the fill= / stroke= attributes (any CSS
-- color string) and size from the size= attribute (any length); stroke width
-- and rotation still come from classes.
local SIZES = { sm = "3cm", md = "5cm", lg = "8cm", full = "100%" }
local STROKE_W = { sm = 1, md = 3, lg = 6, xl = 10 }

local function parse_typst_modifiers(el)
  local m = {
    fill = el.attributes.fill or "#111111",
    stroke = el.attributes.stroke or "none",
    width = 3, size = "5cm", rotate = 0, center = false,
  }
  for _, cls in ipairs(el.classes) do
    local size = cls:match("^shape%-(sm)$") or cls:match("^shape%-(md)$")
      or cls:match("^shape%-(lg)$") or cls:match("^shape%-(full)$")
    if size and SIZES[size] then m.size = SIZES[size] end

    local sw = cls:match("^shape%-stroke%-(%a+)$")
    if sw and STROKE_W[sw] then m.width = STROKE_W[sw] end

    local rot = cls:match("^shape%-rotate%-(%d+)$")
    if rot then m.rotate = tonumber(rot) end

    if cls == "shape-center" then m.center = true end
  end
  -- size= accepts any Typst length (e.g. "3cm") and overrides the size class.
  if el.attributes.size then m.size = el.attributes.size end
  return m
end

local function render_typst(el, shape)
  local m = parse_typst_modifiers(el)

  local elem = get_shape_markup(el, shape):gsub('"', "'")
  elem = elem:gsub("class='shape%-path'", string.format(
    "fill='%s' stroke='%s' stroke-width='%s'", m.fill, m.stroke, m.width))
  local svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>"
    .. elem .. "</svg>"

  local image = string.format(
    'image(bytes("%s"), format: "svg", width: %s, height: %s)', svg, m.size, m.size)
  local align = m.center and "center" or "left"

  if #el.content == 0 then
    return pandoc.RawBlock("typst", string.format(
      "#align(%s)[#rotate(%ddeg, %s)]", align, m.rotate, image))
  end

  -- Wrap el.content as Typst blocks so Quarto processes shortcodes/crossrefs.
  local open = pandoc.RawBlock("typst", string.format(
    "#align(%s)[#rotate(%ddeg, box(width: %s, height: %s)[\n"
    .. "  #place(center + horizon, %s)\n"
    .. "  #place(center + horizon)[",
    align, m.rotate, m.size, m.size, image))
  local close = pandoc.RawBlock("typst", "]])]")

  local blocks = pandoc.Blocks({ open })
  blocks:extend(el.content)
  blocks:insert(close)
  return blocks
end

function Div(el)
  local shape = get_shape_name(el.classes)
  if not shape then return end
  if quarto.doc.is_format("typst") then
    return render_typst(el, shape)
  end
  if quarto.doc.is_format("html:js") then
    return render_html(el, shape)
  end
  return el.content
end
