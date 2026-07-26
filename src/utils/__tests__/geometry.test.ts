import {
  calculateDistance,
  calculateBoundingBox,
  isPointInPolygon,
  isStrokeInsidePolygon,
  transformStroke,
  isPointNearStroke,
} from '../geometry';
import { Stroke, Point } from '../../types/canvas';

describe('Geometry Utils', () => {

  test('calculateDistance should compute Euclidean distance between two points', () => {
    const p1: Point = { x: 0, y: 0 };
    const p2: Point = { x: 3, y: 4 };
    expect(calculateDistance(p1, p2)).toBe(5);
  });

  test('calculateBoundingBox should return correct min/max bounds', () => {
    const points: Point[] = [
      { x: 10, y: 20 },
      { x: 50, y: 5 },
      { x: 30, y: 100 },
    ];
    const bbox = calculateBoundingBox(points);
    expect(bbox).toEqual({
      minX: 10,
      minY: 5,
      maxX: 50,
      maxY: 100,
      width: 40,
      height: 95,
    });
  });

  test('isPointInPolygon should accurately evaluate point inside polygon via ray casting', () => {
    const polygon: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];

    expect(isPointInPolygon({ x: 50, y: 50 }, polygon)).toBe(true);
    expect(isPointInPolygon({ x: 150, y: 50 }, polygon)).toBe(false);
  });

  test('isStrokeInsidePolygon should return true if majority of stroke points are enclosed', () => {
    const polygon: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];

    const stroke: Stroke = {
      id: 's1',
      tool: 'pen',
      color: '#000',
      size: 4,
      points: [
        { x: 10, y: 10 },
        { x: 20, y: 20 },
        { x: 30, y: 30 },
      ],
      createdAt: Date.now(),
    };

    expect(isStrokeInsidePolygon(stroke, polygon)).toBe(true);
  });

  test('transformStroke should offset stroke points and invalidate cached SVG path', () => {
    const stroke: Stroke = {
      id: 's1',
      tool: 'pen',
      color: '#000',
      size: 4,
      points: [{ x: 10, y: 10 }],
      skiaPathSvg: 'M 10 10',
      createdAt: Date.now(),
    };

    const transformed = transformStroke(stroke, 15, 25);
    expect(transformed.points[0]).toEqual({ x: 25, y: 35 });
    expect(transformed.skiaPathSvg).toBeUndefined();
  });

  test('isPointNearStroke should detect close eraser contact', () => {
    const stroke: Stroke = {
      id: 's1',
      tool: 'pen',
      color: '#000',
      size: 4,
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      createdAt: Date.now(),
    };

    expect(isPointNearStroke({ x: 50, y: 2 }, stroke, 5)).toBe(true);
    expect(isPointNearStroke({ x: 50, y: 50 }, stroke, 5)).toBe(false);
  });
});
