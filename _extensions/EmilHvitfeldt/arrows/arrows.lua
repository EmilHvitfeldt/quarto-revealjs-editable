-- Arrow shortcode: draws curved SVG arrows with Bezier curves
-- Usage: {{< arrow from="x1,y1" to="x2,y2" control1="cx1,cy1" control2="cx2,cy2" >}}

--------------------------------------------------------------------------------
-- Utility Functions
--------------------------------------------------------------------------------

local function get_kwarg(kwargs, key, default)
  local val = kwargs[key] and pandoc.utils.stringify(kwargs[key]) or nil
  if val and val ~= "" then
    -- Strip surrounding quotes if present
    val = val:match('^"(.*)"$') or val:match("^'(.*)'$") or val
    return val
  end
  return default
end

local function get_kwarg_number(kwargs, key, default)
  local val = get_kwarg(kwargs, key, nil)
  return tonumber(val) or default
end

local function get_kwarg_bool(kwargs, key, default)
  local val = get_kwarg(kwargs, key, nil)
  if val == nil then return default end
  return val == "true"
end

local function parse_point(str)
  if not str or str == "" then return nil end
  local x, y = str:match("([^,]+),([^,]+)")
  if not x or not y then return nil end
  local nx, ny = tonumber(x), tonumber(y)
  if not nx or not ny then return nil end
  return {x = nx, y = ny}
end

local function parse_waypoints(str)
  if not str or str == "" then return nil end
  local points = {}
  for point_str in str:gmatch("[^;]+") do
    local point = parse_point(point_str:match("^%s*(.-)%s*$"))  -- trim whitespace
    if point then
      table.insert(points, point)
    end
  end
  if #points == 0 then return nil end
  return points
end

local function generate_id(prefix)
  return (prefix or "arrow") .. "-" .. tostring(math.random(100000, 999999))
end

local function arr_min(arr)
  local m = arr[1]
  for i = 2, #arr do
    if arr[i] < m then m = arr[i] end
  end
  return m
end

local function arr_max(arr)
  local m = arr[1]
  for i = 2, #arr do
    if arr[i] > m then m = arr[i] end
  end
  return m
end

--------------------------------------------------------------------------------
-- Option Parsing
--------------------------------------------------------------------------------

local function parse_options(kwargs)
  local opts = {}

  -- Points
  opts.from = parse_point(get_kwarg(kwargs, "from", ""))
  opts.to = parse_point(get_kwarg(kwargs, "to", ""))
  opts.control1 = parse_point(get_kwarg(kwargs, "control1", ""))
  opts.control2 = parse_point(get_kwarg(kwargs, "control2", ""))

  -- Multiple waypoints for complex paths
  opts.waypoints = parse_waypoints(get_kwarg(kwargs, "waypoints", ""))
  opts.smooth = get_kwarg_bool(kwargs, "smooth", true)  -- smooth curves through waypoints

  -- Curve shortcuts (alternative to manual control points)
  opts.curve = get_kwarg_number(kwargs, "curve", nil)  -- 0-1 curviness
  opts.bend = get_kwarg(kwargs, "bend", nil)  -- "left", "right", or angle in degrees

  -- Styling
  opts.color = get_kwarg(kwargs, "color", "black")
  opts.width = get_kwarg_number(kwargs, "width", 2)
  opts.size = get_kwarg_number(kwargs, "size", 10)
  opts.head_size = get_kwarg_number(kwargs, "head-size", nil)  -- Independent head sizing

  -- Line style
  opts.dash = get_kwarg(kwargs, "dash", nil)
  opts.line = get_kwarg(kwargs, "line", "single")  -- single, dot, double, triple
  opts.opacity = get_kwarg_number(kwargs, "opacity", 1)

  -- Arrowhead options
  opts.head = get_kwarg(kwargs, "head", "arrow")
  opts.head_start = get_kwarg_bool(kwargs, "head-start", false)
  opts.head_end = get_kwarg_bool(kwargs, "head-end", true)
  opts.head_fill = get_kwarg_bool(kwargs, "head-fill", true)

  -- Positioning
  opts.position = get_kwarg(kwargs, "position", nil)

  -- RevealJS fragment options
  opts.fragment = get_kwarg(kwargs, "fragment", nil)  -- true or "draw" for draw animation
  opts.fragment_index = get_kwarg_number(kwargs, "fragment-index", nil)
  opts.fragment_duration = get_kwarg_number(kwargs, "fragment-duration", 0.5)  -- animation duration in seconds

  -- Label options
  opts.label = get_kwarg(kwargs, "label", nil)
  opts.label_position = get_kwarg(kwargs, "label-position", "middle")  -- start, middle, end
  opts.label_offset = get_kwarg_number(kwargs, "label-offset", 10)

  -- Accessibility
  opts.aria_label = get_kwarg(kwargs, "aria-label", nil)
  opts.alt = get_kwarg(kwargs, "alt", nil)  -- fallback for aria-label
  opts.title = get_kwarg(kwargs, "title", nil)  -- tooltip/accessible name
  opts.css_class = get_kwarg(kwargs, "class", nil)

  return opts
end

--------------------------------------------------------------------------------
-- Auto Control Point Calculation
--------------------------------------------------------------------------------

local function calculate_auto_control(opts)
  -- Skip if control points are already specified or no curve parameter
  if opts.control1 or not opts.curve then
    return
  end

  local from = opts.from
  local to = opts.to
  if not from or not to then return end

  -- Calculate midpoint
  local mid_x = (from.x + to.x) / 2
  local mid_y = (from.y + to.y) / 2

  -- Calculate line length and angle
  local dx = to.x - from.x
  local dy = to.y - from.y
  local length = math.sqrt(dx * dx + dy * dy)
  local line_angle = math.atan(dy, dx)

  -- Determine bend direction
  local bend_angle
  if opts.bend == "left" then
    bend_angle = line_angle - math.pi / 2  -- perpendicular left
  elseif opts.bend == "right" then
    bend_angle = line_angle + math.pi / 2  -- perpendicular right
  elseif opts.bend then
    -- Numeric angle in degrees
    local degrees = tonumber(opts.bend)
    if degrees then
      bend_angle = math.rad(degrees)
    else
      bend_angle = line_angle - math.pi / 2  -- default to left
    end
  else
    bend_angle = line_angle - math.pi / 2  -- default to left (above for horizontal)
  end

  -- Calculate offset distance based on curve parameter and line length
  local curve_amount = math.max(0, math.min(1, opts.curve))  -- clamp 0-1
  local offset = curve_amount * length * 0.5

  -- Calculate control point
  opts.control1 = {
    x = mid_x + offset * math.cos(bend_angle),
    y = mid_y + offset * math.sin(bend_angle)
  }
end

--------------------------------------------------------------------------------
-- Bounding Box Calculation
--------------------------------------------------------------------------------

local function calculate_bounds(opts)
  local head_size = opts.head_size or opts.size
  local padding = head_size + 10
  local all_x = {opts.from.x, opts.to.x}
  local all_y = {opts.from.y, opts.to.y}

  if opts.control1 then
    table.insert(all_x, opts.control1.x)
    table.insert(all_y, opts.control1.y)
  end
  if opts.control2 then
    table.insert(all_x, opts.control2.x)
    table.insert(all_y, opts.control2.y)
  end

  -- Include waypoints in bounds calculation
  if opts.waypoints then
    for _, wp in ipairs(opts.waypoints) do
      table.insert(all_x, wp.x)
      table.insert(all_y, wp.y)
    end
  end

  return {
    min_x = arr_min(all_x) - padding,
    max_x = arr_max(all_x) + padding,
    min_y = arr_min(all_y) - padding,
    max_y = arr_max(all_y) + padding
  }
end

local function adjust_point(point, bounds)
  if not point then return nil end
  return {
    x = point.x - bounds.min_x,
    y = point.y - bounds.min_y
  }
end

--------------------------------------------------------------------------------
-- SVG Path Generation
--------------------------------------------------------------------------------

local function build_path(adj_from, adj_to, adj_c1, adj_c2)
  if adj_c1 and adj_c2 then
    -- Cubic Bezier
    return string.format("M %.1f,%.1f C %.1f,%.1f %.1f,%.1f %.1f,%.1f",
      adj_from.x, adj_from.y,
      adj_c1.x, adj_c1.y,
      adj_c2.x, adj_c2.y,
      adj_to.x, adj_to.y)
  elseif adj_c1 then
    -- Quadratic Bezier
    return string.format("M %.1f,%.1f Q %.1f,%.1f %.1f,%.1f",
      adj_from.x, adj_from.y,
      adj_c1.x, adj_c1.y,
      adj_to.x, adj_to.y)
  else
    -- Straight line
    return string.format("M %.1f,%.1f L %.1f,%.1f",
      adj_from.x, adj_from.y,
      adj_to.x, adj_to.y)
  end
end

-- Build path through multiple waypoints
-- Uses Catmull-Rom spline conversion to cubic Bezier for smooth curves
local function build_waypoint_path(points, smooth)
  if #points < 2 then return "" end

  local path_parts = {}
  table.insert(path_parts, string.format("M %.1f,%.1f", points[1].x, points[1].y))

  if not smooth or #points == 2 then
    -- Straight line segments
    for i = 2, #points do
      table.insert(path_parts, string.format("L %.1f,%.1f", points[i].x, points[i].y))
    end
  else
    -- Catmull-Rom to Bezier conversion for smooth curves
    -- Add phantom points at start and end for proper curve at endpoints
    local extended = {}
    -- Reflect first point
    table.insert(extended, {
      x = 2 * points[1].x - points[2].x,
      y = 2 * points[1].y - points[2].y
    })
    for _, p in ipairs(points) do
      table.insert(extended, p)
    end
    -- Reflect last point
    table.insert(extended, {
      x = 2 * points[#points].x - points[#points - 1].x,
      y = 2 * points[#points].y - points[#points - 1].y
    })

    -- Convert each segment to cubic Bezier
    -- Catmull-Rom uses points p0, p1, p2, p3 to define curve from p1 to p2
    for i = 1, #extended - 3 do
      local p0, p1, p2, p3 = extended[i], extended[i + 1], extended[i + 2], extended[i + 3]

      -- Catmull-Rom to Bezier control points (tension = 0.5)
      local t = 0.5
      local c1 = {
        x = p1.x + (p2.x - p0.x) / 6 * t * 3,
        y = p1.y + (p2.y - p0.y) / 6 * t * 3
      }
      local c2 = {
        x = p2.x - (p3.x - p1.x) / 6 * t * 3,
        y = p2.y - (p3.y - p1.y) / 6 * t * 3
      }

      table.insert(path_parts, string.format("C %.1f,%.1f %.1f,%.1f %.1f,%.1f",
        c1.x, c1.y, c2.x, c2.y, p2.x, p2.y))
    end
  end

  return table.concat(path_parts, " ")
end

--------------------------------------------------------------------------------
-- Label Position Calculation
--------------------------------------------------------------------------------

-- Linear interpolation
local function lerp(a, b, t)
  return a + (b - a) * t
end

-- Calculate point on quadratic Bezier at t (0-1)
local function quadratic_bezier_point(p0, p1, p2, t)
  local u = 1 - t
  return {
    x = u*u*p0.x + 2*u*t*p1.x + t*t*p2.x,
    y = u*u*p0.y + 2*u*t*p1.y + t*t*p2.y
  }
end

-- Calculate point on cubic Bezier at t (0-1)
local function cubic_bezier_point(p0, p1, p2, p3, t)
  local u = 1 - t
  return {
    x = u*u*u*p0.x + 3*u*u*t*p1.x + 3*u*t*t*p2.x + t*t*t*p3.x,
    y = u*u*u*p0.y + 3*u*u*t*p1.y + 3*u*t*t*p2.y + t*t*t*p3.y
  }
end

-- Calculate tangent angle at point on path
local function calculate_tangent_angle(adj_from, adj_to, adj_c1, adj_c2, t)
  local dx, dy
  local epsilon = 0.001
  local t1 = math.max(0, t - epsilon)
  local t2 = math.min(1, t + epsilon)

  if adj_c1 and adj_c2 then
    local p1 = cubic_bezier_point(adj_from, adj_c1, adj_c2, adj_to, t1)
    local p2 = cubic_bezier_point(adj_from, adj_c1, adj_c2, adj_to, t2)
    dx = p2.x - p1.x
    dy = p2.y - p1.y
  elseif adj_c1 then
    local p1 = quadratic_bezier_point(adj_from, adj_c1, adj_to, t1)
    local p2 = quadratic_bezier_point(adj_from, adj_c1, adj_to, t2)
    dx = p2.x - p1.x
    dy = p2.y - p1.y
  else
    dx = adj_to.x - adj_from.x
    dy = adj_to.y - adj_from.y
  end

  return math.atan(dy, dx)
end

-- Get label position and perpendicular offset
local function get_label_position(adj_from, adj_to, adj_c1, adj_c2, position, offset)
  local t
  if position == "start" then
    t = 0.15
  elseif position == "end" then
    t = 0.85
  else
    t = 0.5  -- middle (default)
  end

  local point
  if adj_c1 and adj_c2 then
    point = cubic_bezier_point(adj_from, adj_c1, adj_c2, adj_to, t)
  elseif adj_c1 then
    point = quadratic_bezier_point(adj_from, adj_c1, adj_to, t)
  else
    point = {
      x = lerp(adj_from.x, adj_to.x, t),
      y = lerp(adj_from.y, adj_to.y, t)
    }
  end

  -- Calculate perpendicular offset (above the line)
  local angle = calculate_tangent_angle(adj_from, adj_to, adj_c1, adj_c2, t)
  local perp_angle = angle - math.pi / 2  -- perpendicular (above)

  return {
    x = point.x + offset * math.cos(perp_angle),
    y = point.y + offset * math.sin(perp_angle),
    angle = math.deg(angle)
  }
end

--------------------------------------------------------------------------------
-- SVG Marker (Arrowhead) Generation
--------------------------------------------------------------------------------

-- Arrowhead style definitions
-- Each returns: {path = "...", refX = n, refY = n, width = n, height = n, is_stroke = bool}
local MARKER_STYLES = {
  arrow = function(size)
    -- Default filled triangle pointing right
    return {
      path = string.format("M 0 0 L %s %s L 0 %s z", size, size/2, size),
      refX = 0,  -- Base of arrowhead, so stroke ends here
      refY = size/2,
      width = size,
      height = size,
      is_stroke = false
    }
  end,

  stealth = function(size)
    -- Pointed, angular military-style arrow
    local w = size * 1.2
    local h = size
    return {
      path = string.format("M 0 0 L %s %s L 0 %s L %s %s z", w, h/2, h, w*0.3, h/2),
      refX = w*0.3,  -- Inner notch point, so stroke ends inside
      refY = h/2,
      width = w,
      height = h,
      is_stroke = false
    }
  end,

  diamond = function(size)
    -- Diamond/rhombus shape
    local w = size
    local h = size
    return {
      path = string.format("M 0 %s L %s 0 L %s %s L %s %s z", h/2, w/2, w, h/2, w/2, h),
      refX = w/2,  -- Center of diamond, so stroke ends at middle
      refY = h/2,
      width = w,
      height = h,
      is_stroke = false
    }
  end,

  circle = function(size)
    -- Round endpoint (circle)
    local r = size / 2
    return {
      path = string.format("M %s %s m -%s 0 a %s %s 0 1 0 %s 0 a %s %s 0 1 0 -%s 0",
        r, r, r, r, r, r*2, r, r, r*2),
      refX = r,  -- Center of circle, so stroke ends at middle
      refY = r,
      width = size,
      height = size,
      is_stroke = false
    }
  end,


  square = function(size)
    -- Square endpoint
    return {
      path = string.format("M 0 0 L %s 0 L %s %s L 0 %s z", size, size, size, size),
      refX = size/2,  -- Center of square, so stroke ends at middle
      refY = size/2,
      width = size,
      height = size,
      is_stroke = false
    }
  end,

  bar = function(size)
    -- Flat perpendicular line (stop)
    local w = size / 3
    local h = size
    return {
      path = string.format("M 0 0 L %s 0 L %s %s L 0 %s z", w, w, h, h),
      refX = w/2,  -- Center of bar, so stroke ends at middle
      refY = h/2,
      width = w,
      height = h,
      is_stroke = false
    }
  end,

  barbed = function(size)
    -- Hook-like, fishing arrow style (open, no fill)
    local w = size
    local h = size
    return {
      path = string.format("M 0 0 L %s %s L 0 %s", w, h/2, h),
      refX = w,  -- Tip of barbed arrow (stroke-based, so it connects at tip)
      refY = h/2,
      width = w,
      height = h,
      is_stroke = true
    }
  end,
}

local function build_marker(id, opts, anim_class)
  local size = opts.head_size or opts.size  -- Use head-size if provided, otherwise size
  local color = opts.color
  local style = opts.head
  local fill = opts.head_fill

  -- Handle aliases
  if style == "dot" then style = "circle" end
  if style == "stop" then style = "bar" end

  -- Get style generator, default to arrow
  local style_fn = MARKER_STYLES[style] or MARKER_STYLES.arrow
  local marker = style_fn(size)

  -- Determine fill and stroke based on style and head-fill option
  local path_attrs
  if marker.is_stroke or not fill then
    -- Stroke-based marker (outline)
    path_attrs = string.format('fill="none" stroke="%s" stroke-width="1.5"', color)
  else
    -- Fill-based marker (solid)
    path_attrs = string.format('fill="%s"', color)
  end

  -- Add animation class if specified
  local class_attr = ""
  if anim_class then
    class_attr = string.format(' class="%s-marker"', anim_class)
  end

  return string.format(
    '<marker id="%s" markerWidth="%s" markerHeight="%s" refX="%s" refY="%s" orient="auto-start-reverse" markerUnits="strokeWidth">' ..
    '<path%s d="%s" %s/>' ..
    '</marker>',
    id, marker.width, marker.height, marker.refX, marker.refY, class_attr,
    marker.path, path_attrs)
end

--------------------------------------------------------------------------------
-- SVG Stroke Attributes
--------------------------------------------------------------------------------

local function build_stroke_attrs(opts, override_width, override_color)
  local width = override_width or opts.width
  local color = override_color or opts.color

  local attrs = {
    string.format('stroke="%s"', color),
    string.format('stroke-width="%s"', width),
    'fill="none"'
  }

  -- Dash pattern
  if opts.dash then
    if opts.dash == "true" then
      table.insert(attrs, 'stroke-dasharray="5,5"')
    else
      table.insert(attrs, string.format('stroke-dasharray="%s"', opts.dash))
    end
  end

  -- Dot pattern (small dots)
  if opts.line == "dot" and not opts.dash then
    local dot_size = math.max(1, width * 0.5)
    local gap_size = width * 2
    table.insert(attrs, string.format('stroke-dasharray="%.1f,%.1f"', dot_size, gap_size))
    table.insert(attrs, 'stroke-linecap="round"')
  end

  -- Opacity
  if opts.opacity < 1 then
    table.insert(attrs, string.format('stroke-opacity="%.2f"', opts.opacity))
  end

  return table.concat(attrs, " ")
end

--------------------------------------------------------------------------------
-- SVG Assembly
--------------------------------------------------------------------------------

local function build_svg(opts, bounds, path_d, marker_id, adj_from, adj_to, adj_c1, adj_c2)
  local svg_width = bounds.max_x - bounds.min_x
  local svg_height = bounds.max_y - bounds.min_y

  -- Generate unique ID for animation (used for path and marker classes)
  local anim_id = nil
  if opts.fragment then
    anim_id = generate_id("arrow-anim")
    opts._anim_id = anim_id  -- Store for render_html
  end

  -- Build marker(s) - skip if head="none"
  local markers = {}
  local has_markers = (opts.head_end or opts.head_start) and opts.head ~= "none"
  if has_markers then
    table.insert(markers, build_marker(marker_id, opts, anim_id))
  end

  -- Build defs section
  local defs = ""
  if #markers > 0 then
    defs = "<defs>" .. table.concat(markers, "") .. "</defs>"
  end

  -- Build marker references
  local marker_attrs = {}
  if has_markers then
    if opts.head_end then
      table.insert(marker_attrs, string.format('marker-end="url(#%s)"', marker_id))
    end
    if opts.head_start then
      table.insert(marker_attrs, string.format('marker-start="url(#%s)"', marker_id))
    end
  end

  -- Build path elements based on line style
  local paths = {}
  local stroke_attrs = build_stroke_attrs(opts)

  if opts.line == "double" then
    -- Double line: thick outer stroke + thin white gap in middle
    local outer_width = opts.width * 3
    local gap_width = opts.width
    local outer_attrs = build_stroke_attrs(opts, outer_width, opts.color)
    local gap_attrs = build_stroke_attrs(opts, gap_width, "white")
    -- Outer stroke (no markers)
    table.insert(paths, string.format('<path d="%s" %s/>', path_d, outer_attrs))
    -- Gap stroke (no markers)
    table.insert(paths, string.format('<path d="%s" %s/>', path_d, gap_attrs))
  elseif opts.line == "triple" then
    -- Triple line: thick outer + two gaps
    local outer_width = opts.width * 5
    local gap_width = opts.width
    local outer_attrs = build_stroke_attrs(opts, outer_width, opts.color)
    local gap_attrs = build_stroke_attrs(opts, gap_width, "white")
    -- Outer stroke
    table.insert(paths, string.format('<path d="%s" %s/>', path_d, outer_attrs))
    -- Two gap strokes at different positions (simulated with single wider gap)
    local inner_gap_width = opts.width * 3
    local inner_gap_attrs = build_stroke_attrs(opts, inner_gap_width, "white")
    table.insert(paths, string.format('<path d="%s" %s/>', path_d, inner_gap_attrs))
    -- Center line
    local center_attrs = build_stroke_attrs(opts, gap_width, opts.color)
    table.insert(paths, string.format('<path d="%s" %s/>', path_d, center_attrs))
  end

  -- Accessibility attributes
  local a11y_attrs = {}
  local a11y_content = ""
  local accessible_name = opts.aria_label or opts.alt
  if accessible_name then
    table.insert(a11y_attrs, string.format('aria-label="%s"', accessible_name))
    table.insert(a11y_attrs, 'role="img"')
  end
  if opts.title then
    a11y_content = string.format('<title>%s</title>', opts.title)
    if not accessible_name then
      table.insert(a11y_attrs, 'role="img"')
    end
  end

  -- CSS class
  local class_attr = ""
  if opts.css_class then
    class_attr = string.format(' class="%s"', opts.css_class)
  end

  -- Build path content with optional animation class
  local path_content
  local path_anim_class = ""
  if anim_id then
    path_anim_class = string.format(' class="%s-path"', anim_id)
  end

  if #paths > 0 then
    -- Multiple paths for double/triple lines
    -- Add markers and animation class only to the final (topmost) path
    local final_path = paths[#paths]
    paths[#paths] = final_path:gsub('<path ', '<path' .. path_anim_class .. ' ')
    paths[#paths] = paths[#paths]:gsub('/>$', ' ' .. table.concat(marker_attrs, " ") .. '/>')
    path_content = table.concat(paths, "")
  else
    -- Single path (default, dot, etc.)
    path_content = string.format('<path%s d="%s" %s %s/>',
      path_anim_class, path_d, stroke_attrs, table.concat(marker_attrs, " "))
  end

  -- Build label element
  local label_content = ""
  if opts.label and opts.label ~= "" then
    local label_pos = get_label_position(adj_from, adj_to, adj_c1, adj_c2, opts.label_position, opts.label_offset)
    -- Normalize angle to keep text readable (not upside down)
    local angle = label_pos.angle
    if angle > 90 or angle < -90 then
      angle = angle + 180
    end
    label_content = string.format(
      '<text x="%.1f" y="%.1f" text-anchor="middle" dominant-baseline="middle" fill="%s" font-size="12" font-family="sans-serif" transform="rotate(%.1f %.1f %.1f)">%s</text>',
      label_pos.x, label_pos.y, opts.color, angle, label_pos.x, label_pos.y, opts.label)
  end

  return string.format(
    '<svg width="%.1f" height="%.1f" viewBox="0 0 %.1f %.1f" xmlns="http://www.w3.org/2000/svg" style="overflow: visible;"%s%s>%s%s%s%s</svg>',
    svg_width, svg_height, svg_width, svg_height,
    class_attr,
    #a11y_attrs > 0 and (" " .. table.concat(a11y_attrs, " ")) or "",
    a11y_content,
    defs,
    path_content,
    label_content)
end

--------------------------------------------------------------------------------
-- HTML Output
--------------------------------------------------------------------------------

local function render_html(svg, opts, bounds)
  local output
  local is_positioned = opts.position == "fixed" or opts.position == "absolute"

  -- Build fragment wrapper and animation styles if specified (for RevealJS)
  local fragment_wrap_start = ""
  local fragment_wrap_end = ""
  local anim_style = ""

  if opts.fragment then
    local fragment_class = "fragment custom"
    local index_attr = ""
    if opts.fragment_index then
      index_attr = string.format(' data-fragment-index="%d"', opts.fragment_index)
    end
    fragment_wrap_start = string.format('<span class="%s"%s>', fragment_class, index_attr)
    fragment_wrap_end = '</span>'

    -- CSS for draw animation - path starts hidden, animates when .visible is added
    -- Marker also starts hidden and fades in at the end
    local duration = opts.fragment_duration or 0.5
    local anim_id = opts._anim_id or "arrow-anim"
    anim_style = string.format([[
<style>
.%s-path {
  stroke-dasharray: 2000;
  stroke-dashoffset: 2000;
}
.%s-marker {
  opacity: 0;
}
.fragment.visible .%s-path {
  animation: %s-draw %.2fs ease forwards;
}
.fragment.visible .%s-marker {
  animation: %s-marker-appear 0.1s ease forwards;
  animation-delay: 0.05s;
}
@keyframes %s-draw {
  to { stroke-dashoffset: 0; }
}
@keyframes %s-marker-appear {
  to { opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .%s-path {
    stroke-dasharray: none;
    stroke-dashoffset: 0;
  }
  .%s-marker {
    opacity: 1;
  }
  .fragment.visible .%s-path,
  .fragment.visible .%s-marker {
    animation: none;
  }
}
</style>]], anim_id, anim_id, anim_id, anim_id, duration, anim_id, anim_id, anim_id, anim_id, anim_id, anim_id, anim_id, anim_id)
  end

  if is_positioned then
    output = string.format(
      '%s%s<div style="position: %s; left: %.1fpx; top: %.1fpx; pointer-events: none; z-index: 9999;">%s</div>%s',
      anim_style, fragment_wrap_start, opts.position, bounds.min_x, bounds.min_y, svg, fragment_wrap_end)
    return pandoc.RawBlock("html", output)
  else
    output = string.format('%s%s%s%s', anim_style, fragment_wrap_start, svg, fragment_wrap_end)
    return pandoc.RawInline("html", output)
  end
end

--------------------------------------------------------------------------------
-- LaTeX/TikZ Output for PDF
--------------------------------------------------------------------------------

local function render_latex(opts, adj_from, adj_to, adj_c1, adj_c2, adj_waypoints)
  -- Convert color names to LaTeX-compatible format
  local color = opts.color
  -- Common color names work in both, but we could add a mapping if needed

  -- Build arrow style options
  local arrow_opts = {}

  -- Line width (TikZ uses line width in pt)
  table.insert(arrow_opts, string.format("line width=%.1fpt", opts.width))

  -- Color
  if color ~= "black" then
    table.insert(arrow_opts, string.format("draw=%s", color))
  end

  -- Dash pattern
  if opts.dash then
    if opts.dash == "true" then
      table.insert(arrow_opts, "dashed")
    else
      table.insert(arrow_opts, string.format("dash pattern=on %s off %s",
        opts.dash:match("([^,]+)") or "5pt",
        opts.dash:match(",([^,]+)") or "5pt"))
    end
  end

  -- Line style
  if opts.line == "dot" then
    table.insert(arrow_opts, "dotted")
  elseif opts.line == "double" then
    table.insert(arrow_opts, "double")
  elseif opts.line == "triple" then
    -- TikZ doesn't have native triple, use double with extra distance
    table.insert(arrow_opts, "double")
    table.insert(arrow_opts, "double distance=2pt")
  end

  -- Opacity
  if opts.opacity and opts.opacity < 1 then
    table.insert(arrow_opts, string.format("opacity=%.2f", opts.opacity))
  end

  -- Arrowhead style using arrows.meta library
  local arrow_tip = "Triangle"  -- Default filled triangle (matches SVG arrow style)
  local arrow_tip_open = false  -- for unfilled arrowheads
  if opts.head == "arrow" then
    arrow_tip = "Triangle"
  elseif opts.head == "stealth" then
    arrow_tip = "Stealth"
  elseif opts.head == "diamond" then
    arrow_tip = "Diamond"
  elseif opts.head == "circle" or opts.head == "dot" then
    arrow_tip = "Circle"
  elseif opts.head == "square" then
    arrow_tip = "Square"
  elseif opts.head == "bar" then
    arrow_tip = "Bar[]"  -- Simple bar without size parameters
  elseif opts.head == "barbed" then
    arrow_tip = "Stealth"  -- Stealth with open is closest to barbed
    arrow_tip_open = true
  elseif opts.head == "none" then
    arrow_tip = ""
  end

  -- Handle head-fill option (open/unfilled arrowheads)
  if not opts.head_fill then
    arrow_tip_open = true
  end

  -- Arrow head size (convert pixels to mm, roughly)
  local head_size = opts.head_size or opts.size or 10
  local head_size_mm = head_size * 0.3  -- rough conversion

  -- Build arrow specification (TikZ arrows.meta syntax)
  local arrow_spec = ""
  if arrow_tip ~= "" then
    local tip_with_size
    -- Check if arrow_tip already has brackets (like "Bar[]")
    if arrow_tip:match("%[") then
      tip_with_size = "{" .. arrow_tip .. "}"
    else
      local tip_opts = string.format("length=%.1fmm", head_size_mm)
      if arrow_tip_open then
        tip_opts = tip_opts .. ", open"
      end
      tip_with_size = string.format("{%s[%s]}", arrow_tip, tip_opts)
    end
    local start_tip = opts.head_start and (tip_with_size .. "-") or "-"
    local end_tip = opts.head_end and tip_with_size or ""
    arrow_spec = start_tip .. end_tip
    if arrow_spec ~= "-" then
      table.insert(arrow_opts, arrow_spec)
    end
  end

  -- Scale factor: convert pixels to cm (72 pixels per inch, 2.54 cm per inch)
  -- Using a scale that makes typical arrows (200-300px) about 4-6cm wide
  local scale = 0.02

  -- Build the path
  local path_cmd
  if adj_waypoints and #adj_waypoints > 0 then
    -- Path through waypoints
    local points = {adj_from}
    for _, wp in ipairs(adj_waypoints) do
      table.insert(points, wp)
    end
    table.insert(points, adj_to)

    if opts.smooth then
      -- Smooth curve through points
      local coords = {}
      for _, p in ipairs(points) do
        table.insert(coords, string.format("(%.2f,%.2f)", p.x * scale, -p.y * scale))
      end
      path_cmd = "plot [smooth, tension=0.5] coordinates {" .. table.concat(coords, " ") .. "}"
    else
      -- Straight line segments
      local segments = {}
      for i, p in ipairs(points) do
        if i == 1 then
          table.insert(segments, string.format("(%.2f,%.2f)", p.x * scale, -p.y * scale))
        else
          table.insert(segments, string.format("-- (%.2f,%.2f)", p.x * scale, -p.y * scale))
        end
      end
      path_cmd = table.concat(segments, " ")
    end
  elseif adj_c1 and adj_c2 then
    -- Cubic Bezier
    path_cmd = string.format("(%.2f,%.2f) .. controls (%.2f,%.2f) and (%.2f,%.2f) .. (%.2f,%.2f)",
      adj_from.x * scale, -adj_from.y * scale,
      adj_c1.x * scale, -adj_c1.y * scale,
      adj_c2.x * scale, -adj_c2.y * scale,
      adj_to.x * scale, -adj_to.y * scale)
  elseif adj_c1 then
    -- Quadratic Bezier (approximate with cubic - same control point twice)
    path_cmd = string.format("(%.2f,%.2f) .. controls (%.2f,%.2f) and (%.2f,%.2f) .. (%.2f,%.2f)",
      adj_from.x * scale, -adj_from.y * scale,
      adj_c1.x * scale, -adj_c1.y * scale,
      adj_c1.x * scale, -adj_c1.y * scale,
      adj_to.x * scale, -adj_to.y * scale)
  else
    -- Straight line
    path_cmd = string.format("(%.2f,%.2f) -- (%.2f,%.2f)",
      adj_from.x * scale, -adj_from.y * scale,
      adj_to.x * scale, -adj_to.y * scale)
  end

  -- Build TikZ code
  local tikz = string.format(
    "\\begin{tikzpicture}\\draw[%s] %s;\\end{tikzpicture}",
    table.concat(arrow_opts, ", "),
    path_cmd)

  return pandoc.RawInline("latex", tikz)
end

--------------------------------------------------------------------------------
-- Typst Output using CeTZ
--------------------------------------------------------------------------------

local function render_typst(opts, adj_from, adj_to, adj_c1, adj_c2, adj_waypoints)
  -- Scale factor: convert pixels to pt (similar to PDF)
  local scale = 0.75  -- pixels to pt roughly

  -- Build stroke style
  local stroke_parts = {}

  -- Line width
  table.insert(stroke_parts, string.format("%.1fpt", opts.width))

  -- Color
  if opts.color ~= "black" then
    -- Try to use Typst color names or rgb
    local color = opts.color
    -- Common CSS colors that work in Typst
    local typst_colors = {
      red = "red", blue = "blue", green = "green", yellow = "yellow",
      orange = "orange", purple = "purple", black = "black", white = "white",
      gray = "gray", grey = "gray", cyan = "aqua", magenta = "fuchsia",
      pink = "rgb(255, 192, 203)", brown = "rgb(165, 42, 42)",
      crimson = "rgb(220, 20, 60)", teal = "rgb(0, 128, 128)",
      steelblue = "rgb(70, 130, 180)", navy = "rgb(0, 0, 128)"
    }
    color = typst_colors[opts.color:lower()] or opts.color
    table.insert(stroke_parts, color)
  end

  local stroke = table.concat(stroke_parts, " + ")

  -- Build mark (arrowhead) specification
  local mark_end = ""
  local mark_start = ""

  local arrow_mark = "\">\""  -- default arrow
  if opts.head == "stealth" then
    arrow_mark = "\"stealth\""
  elseif opts.head == "diamond" then
    arrow_mark = "\"diamond\""
  elseif opts.head == "circle" or opts.head == "dot" then
    arrow_mark = "\"o\""
  elseif opts.head == "square" then
    arrow_mark = "\"square\""
  elseif opts.head == "bar" then
    arrow_mark = "\"|\""
  elseif opts.head == "none" then
    arrow_mark = ""
  end

  if arrow_mark ~= "" then
    if opts.head_end then
      mark_end = string.format("end: %s", arrow_mark)
    end
    if opts.head_start then
      mark_start = string.format("start: %s", arrow_mark)
    end
  end

  local mark_spec = ""
  if mark_start ~= "" or mark_end ~= "" then
    local mark_parts = {}
    if mark_start ~= "" then table.insert(mark_parts, mark_start) end
    if mark_end ~= "" then table.insert(mark_parts, mark_end) end
    mark_spec = string.format(", mark: (%s)", table.concat(mark_parts, ", "))
  end

  -- Build the path/line command
  local draw_cmd

  if adj_waypoints and #adj_waypoints > 0 then
    -- Path through waypoints using catmull or line
    local points = {adj_from}
    for _, wp in ipairs(adj_waypoints) do
      table.insert(points, wp)
    end
    table.insert(points, adj_to)

    local coords = {}
    for _, p in ipairs(points) do
      table.insert(coords, string.format("(%.1fpt, %.1fpt)", p.x * scale, -p.y * scale))
    end

    if opts.smooth then
      draw_cmd = string.format("catmull(%s, tension: 0.5)", table.concat(coords, ", "))
    else
      draw_cmd = string.format("line(%s)", table.concat(coords, ", "))
    end
  elseif adj_c1 and adj_c2 then
    -- Cubic Bezier
    draw_cmd = string.format("bezier((%.1fpt, %.1fpt), (%.1fpt, %.1fpt), (%.1fpt, %.1fpt), (%.1fpt, %.1fpt))",
      adj_from.x * scale, -adj_from.y * scale,
      adj_to.x * scale, -adj_to.y * scale,
      adj_c1.x * scale, -adj_c1.y * scale,
      adj_c2.x * scale, -adj_c2.y * scale)
  elseif adj_c1 then
    -- Quadratic Bezier (use cubic with same control point)
    draw_cmd = string.format("bezier((%.1fpt, %.1fpt), (%.1fpt, %.1fpt), (%.1fpt, %.1fpt), (%.1fpt, %.1fpt))",
      adj_from.x * scale, -adj_from.y * scale,
      adj_to.x * scale, -adj_to.y * scale,
      adj_c1.x * scale, -adj_c1.y * scale,
      adj_c1.x * scale, -adj_c1.y * scale)
  else
    -- Straight line
    draw_cmd = string.format("line((%.1fpt, %.1fpt), (%.1fpt, %.1fpt))",
      adj_from.x * scale, -adj_from.y * scale,
      adj_to.x * scale, -adj_to.y * scale)
  end

  -- Build dash pattern
  local dash_spec = ""
  if opts.dash then
    if opts.dash == "true" then
      dash_spec = ', stroke: (dash: "dashed")'
    else
      dash_spec = string.format(', stroke: (dash: (%s))', opts.dash)
    end
  elseif opts.line == "dot" then
    dash_spec = ', stroke: (dash: "dotted")'
  end

  -- Complete CeTZ code
  local typst = string.format([[#{{
import "@preview/cetz:0.3.2"
cetz.canvas({{
  import cetz.draw: *
  set-style(stroke: %s%s)
  %s
}})
}}]], stroke, mark_spec, draw_cmd)

  return pandoc.RawInline("typst", typst)
end

--------------------------------------------------------------------------------
-- Main Shortcode Function
--------------------------------------------------------------------------------

function arrow(args, kwargs, meta, raw_args, context)
  -- Parse all options
  local opts = parse_options(kwargs)

  -- Validate required arguments
  if not opts.from or not opts.to then
    quarto.log.error("Arrow shortcode requires 'from' and 'to' coordinates")
    return pandoc.Str("[arrow: missing coordinates]")
  end

  -- Auto-calculate control points if curve/bend specified (only if no waypoints)
  if not opts.waypoints then
    calculate_auto_control(opts)
  end

  -- Calculate bounding box
  local bounds = calculate_bounds(opts)

  -- Adjust coordinates relative to viewBox
  local adj_from = adjust_point(opts.from, bounds)
  local adj_to = adjust_point(opts.to, bounds)
  local adj_c1 = adjust_point(opts.control1, bounds)
  local adj_c2 = adjust_point(opts.control2, bounds)

  -- Adjust waypoints
  local adj_waypoints = nil
  if opts.waypoints then
    adj_waypoints = {}
    for _, wp in ipairs(opts.waypoints) do
      table.insert(adj_waypoints, adjust_point(wp, bounds))
    end
  end

  -- Build SVG path
  local path_d
  if adj_waypoints and #adj_waypoints > 0 then
    -- Build path through waypoints
    local all_points = {adj_from}
    for _, wp in ipairs(adj_waypoints) do
      table.insert(all_points, wp)
    end
    table.insert(all_points, adj_to)
    path_d = build_waypoint_path(all_points, opts.smooth)
  else
    path_d = build_path(adj_from, adj_to, adj_c1, adj_c2)
  end

  -- Generate unique marker ID
  local marker_id = generate_id("arrow")

  -- Build complete SVG
  local svg = build_svg(opts, bounds, path_d, marker_id, adj_from, adj_to, adj_c1, adj_c2)

  -- Return format-appropriate output
  if quarto.doc.isFormat("html:js") then
    return render_html(svg, opts, bounds)
  elseif quarto.doc.isFormat("typst") then
    return render_typst(opts, adj_from, adj_to, adj_c1, adj_c2, adj_waypoints)
  elseif quarto.doc.isFormat("pdf") or quarto.doc.isFormat("latex") then
    return render_latex(opts, adj_from, adj_to, adj_c1, adj_c2, adj_waypoints)
  else
    return pandoc.Str("->")
  end
end
