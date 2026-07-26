export type ToolType = 'pen' | 'highlighter' | 'eraser' | 'lasso';

export type TemplateType = 'blank' | 'lined' | 'grid' | 'cornell';

export interface Point {
  x: number;
  y: number;
  pressure?: number;
  tilt?: number;
  timestamp?: number;
}

export interface Stroke {
  id: string;
  tool: ToolType;
  color: string;
  size: number;
  points: Point[];
  skiaPathSvg?: string;
  createdAt: number;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface LassoSelectionState {
  isActive: boolean;
  lassoPoints: Point[];
  selectedStrokeIds: string[];
  selectionBoundingBox: BoundingBox | null;
  isDragging: boolean;
  dragStartPoint: Point | null;
  dragOffset: { x: number; y: number };
}

export interface CanvasState {
  activeTool: ToolType;
  activeColor: string;
  strokeWidth: number;
  currentTemplate: TemplateType;
  strokes: Stroke[];
  undoStack: Stroke[][];
  redoStack: Stroke[][];
  lassoSelection: LassoSelectionState;
}
