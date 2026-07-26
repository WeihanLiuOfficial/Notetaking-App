import { ToolType } from '../types/canvas';

export function normalizePressure(pressure?: number, defaultPressure: number = 0.5): number {
  if (pressure === undefined || pressure === null || isNaN(pressure)) {
    return defaultPressure;
  }
  return Math.max(0, Math.min(1, pressure));
}

export function calculateDynamicStrokeWidth(
  baseWidth: number,
  pressure?: number,
  tilt?: number,
  tool: ToolType = 'pen'
): number {
  const normPressure = normalizePressure(pressure);

  switch (tool) {
    case 'pen':
      return baseWidth * (0.4 + 1.2 * normPressure);
    case 'highlighter':
      return baseWidth * (0.8 + 0.4 * normPressure);
    case 'eraser':
      return baseWidth;
    case 'lasso':
      return 1;
    default:
      return baseWidth;
  }
}

export function filterPalmTouch(radius?: number, pointerType?: string): boolean {
  if (radius !== undefined && radius > 25) {
    return false; // Contact area too large, likely palm
  }
  return true;
}
