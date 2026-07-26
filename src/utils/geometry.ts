import { Point, Stroke, BoundingBox } from '../types/canvas';

export function calculateDistance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function calculateBoundingBox(points: Point[]): BoundingBox | null {
  if (!points || points.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const pt of points) {
    if (pt.x < minX) minX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y > maxY) maxY = pt.y;
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function calculateStrokeBoundingBox(stroke: Stroke): BoundingBox | null {
  return calculateBoundingBox(stroke.points);
}

export function calculateMultiStrokeBoundingBox(strokes: Stroke[]): BoundingBox | null {
  const allPoints: Point[] = [];
  for (const stroke of strokes) {
    allPoints.push(...stroke.points);
  }
  return calculateBoundingBox(allPoints);
}

export function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  if (!polygon || polygon.length < 3) return false;
  let inside = false;
  const { x, y } = point;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-10) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

export function isStrokeInsidePolygon(stroke: Stroke, polygon: Point[]): boolean {
  if (!stroke || !stroke.points || stroke.points.length === 0 || !polygon || polygon.length < 3) return false;

  let pointsInside = 0;
  for (const pt of stroke.points) {
    if (isPointInPolygon(pt, polygon)) {
      pointsInside++;
    }
  }

  // Stroke is considered inside if at least 50% of its points are inside polygon
  return pointsInside / stroke.points.length >= 0.5;
}

export function transformStroke(stroke: Stroke, deltaX: number, deltaY: number): Stroke {
  const newPoints = stroke.points.map((p) => ({
    ...p,
    x: p.x + deltaX,
    y: p.y + deltaY,
  }));

  return {
    ...stroke,
    points: newPoints,
    skiaPathSvg: undefined, // invalidate cached SVG path
  };
}

export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  if (l2 === 0) return calculateDistance(p, a);
  let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = a.x + t * (b.x - a.x);
  const projY = a.y + t * (b.y - a.y);
  return calculateDistance(p, { x: projX, y: projY });
}

export function isPointNearStroke(point: Point, stroke: Stroke, threshold: number = 10): boolean {
  if (!stroke.points || stroke.points.length === 0) return false;

  const effectiveThreshold = threshold + stroke.size / 2;

  if (stroke.points.length === 1) {
    return calculateDistance(point, stroke.points[0]) <= effectiveThreshold;
  }

  for (let i = 0; i < stroke.points.length - 1; i++) {
    const dist = distanceToSegment(point, stroke.points[i], stroke.points[i + 1]);
    if (dist <= effectiveThreshold) {
      return true;
    }
  }

  return false;
}
