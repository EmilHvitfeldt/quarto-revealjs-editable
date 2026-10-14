/** Affine transforms in the outer diagram's coordinate system. */
export const identityMatrix = () => [1, 0, 0, 1, 0, 0];

export function multiplyMatrices(a, b) {
  return [
    a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1],
    a[0]*b[2]+a[2]*b[3], a[1]*b[2]+a[3]*b[3],
    a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5],
  ];
}

export function inverseMatrix(m) {
  const d=m[0]*m[3]-m[1]*m[2];
  if(!Number.isFinite(d)||Math.abs(d)<1e-12)throw new Error('Cannot edit a singular diagram transform');
  return [m[3]/d,-m[1]/d,-m[2]/d,m[0]/d,(m[2]*m[5]-m[3]*m[4])/d,(m[1]*m[4]-m[0]*m[5])/d];
}

export function svgStateMatrix(state) {
  return multiplyMatrices([1, 0, 0, 1, state.x || 0, state.y || 0], state.matrix || identityMatrix());
}

export function combinedSVGMatrix(parts, member, stateFor = part => part.state) {
  return parts.filter(part => part.members.includes(member)).reduce(
    (matrix, part) => multiplyMatrices(matrix, svgStateMatrix(stateFor(part))), identityMatrix());
}

/** Resize from a handle, keeping its opposite edge/corner fixed. */
export function resizeSVGState(state, box, handle, dx, dy, { keepAspect = false, minSize = 1, prefixMatrix = identityMatrix() } = {}) {
  const west = handle.includes('w'), east = handle.includes('e');
  const north = handle.includes('n'), south = handle.includes('s');
  let sx = box.width > 0 && (west || east) ? Math.max(minSize, box.width + (west ? -dx : dx)) / box.width : 1;
  let sy = box.height > 0 && (north || south) ? Math.max(minSize, box.height + (north ? -dy : dy)) / box.height : 1;
  if (keepAspect && (west || east) && (north || south) && box.width > 0 && box.height > 0) {
    sx = sy = Math.abs(sx - 1) >= Math.abs(sy - 1) ? sx : sy;
  }
  const ax = west ? box.x + box.width : box.x;
  const ay = north ? box.y + box.height : box.y;
  const resize = [sx, 0, 0, sy, ax*(1-sx), ay*(1-sy)];
  const localResize=multiplyMatrices(inverseMatrix(prefixMatrix),multiplyMatrices(resize,prefixMatrix));
  return { ...state, x: 0, y: 0, matrix: multiplyMatrices(localResize, svgStateMatrix(state)) };
}
