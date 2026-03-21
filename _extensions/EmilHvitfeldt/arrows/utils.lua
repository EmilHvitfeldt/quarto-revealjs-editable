-- Arrow utility functions (pure, testable)
-- These functions have no Quarto/Pandoc dependencies and can be unit tested

local M = {}

--------------------------------------------------------------------------------
-- Argument Parsing (generic versions for testing)
--------------------------------------------------------------------------------

function M.get_kwarg(kwargs, key, default)
  local val = kwargs[key] and tostring(kwargs[key]) or nil
  if val and val ~= "" then
    -- Strip surrounding quotes if present
    val = val:match('^"(.*)"$') or val:match("^'(.*)'$") or val
    return val
  end
  return default
end

function M.get_kwarg_number(kwargs, key, default)
  local val = M.get_kwarg(kwargs, key, nil)
  return tonumber(val) or default
end

function M.get_kwarg_bool(kwargs, key, default)
  local val = M.get_kwarg(kwargs, key, nil)
  if val == nil then return default end
  return val == "true"
end

--------------------------------------------------------------------------------
-- Point Parsing
--------------------------------------------------------------------------------

function M.parse_point(str)
  if not str or str == "" then return nil end
  local x, y = str:match("([^,]+),([^,]+)")
  if not x or not y then return nil end
  local nx, ny = tonumber(x), tonumber(y)
  if not nx or not ny then return nil end
  return {x = nx, y = ny}
end

--------------------------------------------------------------------------------
-- Array Utilities
--------------------------------------------------------------------------------

function M.arr_min(arr)
  local m = arr[1]
  for i = 2, #arr do
    if arr[i] < m then m = arr[i] end
  end
  return m
end

function M.arr_max(arr)
  local m = arr[1]
  for i = 2, #arr do
    if arr[i] > m then m = arr[i] end
  end
  return m
end

--------------------------------------------------------------------------------
-- Bounding Box Calculation
--------------------------------------------------------------------------------

function M.calculate_bounds(from, to, control1, control2, padding)
  local all_x = {from.x, to.x}
  local all_y = {from.y, to.y}

  if control1 then
    table.insert(all_x, control1.x)
    table.insert(all_y, control1.y)
  end
  if control2 then
    table.insert(all_x, control2.x)
    table.insert(all_y, control2.y)
  end

  return {
    min_x = M.arr_min(all_x) - padding,
    max_x = M.arr_max(all_x) + padding,
    min_y = M.arr_min(all_y) - padding,
    max_y = M.arr_max(all_y) + padding
  }
end

function M.adjust_point(point, bounds)
  if not point then return nil end
  return {
    x = point.x - bounds.min_x,
    y = point.y - bounds.min_y
  }
end

--------------------------------------------------------------------------------
-- SVG Path Generation
--------------------------------------------------------------------------------

function M.build_path(adj_from, adj_to, adj_c1, adj_c2)
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

--------------------------------------------------------------------------------
-- SVG Stroke Attributes
--------------------------------------------------------------------------------

function M.build_stroke_attrs(opts)
  local attrs = {
    string.format('stroke="%s"', opts.color),
    string.format('stroke-width="%s"', opts.width),
    'fill="none"'
  }

  if opts.dash then
    if opts.dash == "true" then
      table.insert(attrs, 'stroke-dasharray="5,5"')
    else
      table.insert(attrs, string.format('stroke-dasharray="%s"', opts.dash))
    end
  end

  if opts.opacity < 1 then
    table.insert(attrs, string.format('stroke-opacity="%.2f"', opts.opacity))
  end

  return table.concat(attrs, " ")
end

return M
