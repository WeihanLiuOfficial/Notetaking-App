import { Skia, SkPath } from '@shopify/react-native-skia';
import { Point } from '../types/canvas';

export function createSkiaPathFromPoints(points: Point[], closed: boolean = false): SkPath {
  const path = Skia.Path.Make();
  if (!points || points.length === 0) {
    return path;
  }

  if (points.length === 1) {
    path.moveTo(points[0].x, points[0].y);
    path.lineTo(points[0].x + 0.1, points[0].y + 0.1);
    if (closed) path.close();
    return path;
  }

  if (points.length === 2) {
    path.moveTo(points[0].x, points[0].y);
    path.lineTo(points[1].x, points[1].y);
    if (closed) path.close();
    return path;
  }

  path.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length - 1; i++) {
    const midX = (points[i].x + points[i + 1].x) / 2;
    const midY = (points[i].y + points[i + 1].y) / 2;
    path.quadTo(points[i].x, points[i].y, midX, midY);
  }

  path.lineTo(points[points.length - 1].x, points[points.length - 1].y);

  if (closed) {
    path.close();
  }

  return path;
}

export function exportPathToSvg(path: SkPath): string {
  return path.toSVGString();
}

export function createPathFromSvg(svg: string): SkPath | null {
  if (!svg) return null;
  return Skia.Path.MakeFromSVGString(svg);
}
