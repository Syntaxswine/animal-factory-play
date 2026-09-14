// One world coordinate system for drawing, picking, and construction previews.
export const ISO_RISE = 0.5;
export function project(x, y, scale = 1) {
  return {x: (x - y) * scale, y: (x + y) * scale * ISO_RISE};
}
export function unproject(x, y, scale = 1) {
  return {x: (x / scale + y / (scale * ISO_RISE)) / 2,
    y: (y / (scale * ISO_RISE) - x / scale) / 2};
}
export function footprint(x, y, size = 1, scale = 1) {
  return [project(x, y, scale), project(x + size, y, scale),
    project(x + size, y + size, scale), project(x, y + size, scale)];
}
