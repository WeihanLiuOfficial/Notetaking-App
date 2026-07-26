# Milestone 2 Architecture & Implementation Blueprint: Hardware-Accelerated Skia Drawing Engine & Pencil Canvas

## 1. Executive Summary & Scope Definition
Milestone 2 (M2) expands the Native iPadOS Notetaking App into a hardware-accelerated vector drawing canvas using `@shopify/react-native-skia` and `react-native-gesture-handler`. The core objective is to deliver low-latency, fluid, pressure-sensitive drawing powered by Apple Pencil, complete with paper background templates, tool switching (Pen, Highlighter, Eraser, Lasso), vector path smoothing, lasso stroke selection and transformation, undo/redo history management, and modular state management hooks.

This document presents a comprehensive, production-ready architectural specification and implementation blueprint for M2.

---

## 2. Codebase Architecture & Baseline Analysis

### 2.1 Dependency Stack Verification
From `package.json`:
- `@shopify/react-native-skia`: `^1.2.3` — Hardware-accelerated Skia 2D graphics engine (supports `Canvas`, `Path`, `Group`, `Rect`, `Line`, `Paint`, `Skia`).
- `react-native-gesture-handler`: `~2.16.1` — Native gesture system (`Gesture.Pan()`, `GestureDetector`, `GestureHandlerRootView`).
- `react-native-reanimated`: `~3.10.1` — UI thread high-performance animations and shared values.
- `react`: `18.2.0`, `react-native`: `0.74.5`, `expo`: `~51.0.0`.

### 2.2 Baseline Structure Analysis
- `src/types/canvas.ts`: Defines `ToolType`, `TemplateType`, `Point`, and `Stroke`.
- `src/utils/geometry.ts`: Starter distance utility (`calculateDistance`).
- `src/utils/pressure.ts`: Starter pressure normalizer (`normalizePressure`).
- `App.tsx`: Currently renders a 3-column placeholder layout wrapped in `GestureHandlerRootView`.

---

## 3. Milestone 2 Architecture & Component Blueprint

### 3.1 Extended Canvas Data Models (`src/types/canvas.ts`)
To support bounding box calculation, lasso selection, undo/redo, and tool state, `src/types/canvas.ts` must be extended with:

```typescript
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
```

---

### 3.2 Geometry, Pressure & Skia Path Utilities (`src/utils/`)

#### 3.2.1 Geometry Extensions (`src/utils/geometry.ts`)
- `calculateDistance(p1: Point, p2: Point): number`
- `calculateBoundingBox(points: Point[]): BoundingBox | null`
- `calculateStrokeBoundingBox(stroke: Stroke): BoundingBox | null`
- `calculateMultiStrokeBoundingBox(strokes: Stroke[]): BoundingBox | null`
- `isPointInPolygon(point: Point, polygon: Point[]): boolean` — Ray-Casting algorithm.
- `isStrokeInsidePolygon(stroke: Stroke, polygon: Point[]): boolean` — Evaluates if stroke points are enclosed by lasso path.
- `transformStroke(stroke: Stroke, deltaX: number, deltaY: number): Stroke` — Translates points and invalidates cached Skia SVG.
- `isPointNearStroke(point: Point, stroke: Stroke, threshold: number): boolean` — Segment distance check for stroke eraser.

#### 3.2.2 Pressure & Stylus Utilities (`src/utils/pressure.ts`)
- `normalizePressure(pressure?: number, defaultPressure?: number): number`
- `calculateDynamicStrokeWidth(baseWidth: number, pressure?: number, tilt?: number, tool?: ToolType): number`:
  - Pen: $W = baseWidth \times (0.4 + 1.2 \times pressure)$
  - Highlighter: $W = baseWidth \times (0.8 + 0.4 \times pressure)$
  - Eraser: $W = baseWidth$
- `filterPalmTouch(radius?: number, pointerType?: string): boolean`:
  - Ignores touches with contact radius $> 25\text{px}$ or non-pen touches when stylus mode is locked.

#### 3.2.3 Skia Path Conversion Helpers (`src/utils/skia.ts`)
- `createSkiaPathFromPoints(points: Point[], closed: boolean = false): SkPath`:
  - Constructs smooth Skia `SkPath` using Catmull-Rom quadratic curve interpolation ($P_{\text{mid}} = \frac{P_i + P_{i+1}}{2}$) to convert raw sampled points into smooth vector curves.
- `exportPathToSvg(path: SkPath): string`: Serializes path using `path.toSVGString()`.
- `createPathFromSvg(svg: string): SkPath | null`: Deserializes SVG string via `Skia.Path.MakeFromSVGString(svg)`.

---

### 3.3 Canvas State Hook (`src/components/Canvas/useCanvasState.ts`)

Encapsulates all canvas state operations with immutable state transitions:

```typescript
export function useCanvasState(initialTemplate: TemplateType = 'lined') {
  const [activeTool, setActiveTool] = useState<ToolType>('pen');
  const [activeColor, setActiveColor] = useState<string>('#000000');
  const [strokeWidth, setStrokeWidth] = useState<number>(4);
  const [currentTemplate, setCurrentTemplate] = useState<TemplateType>(initialTemplate);
  
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [undoStack, setUndoStack] = useState<Stroke[][]>([]);
  const [redoStack, setRedoStack] = useState<Stroke[][]>([]);
  
  const [lassoSelection, setLassoSelection] = useState<LassoSelectionState>({
    isActive: false,
    lassoPoints: [],
    selectedStrokeIds: [],
    selectionBoundingBox: null,
    isDragging: false,
    dragStartPoint: null,
    dragOffset: { x: 0, y: 0 },
  });

  // State actions: addStroke, eraseStrokes, selectWithLasso, moveLassoSelection, commitLassoMove, undo, redo, clearCanvas.
}
```

Key Logic Highlights:
1. **Undo/Redo History Stack**: Max depth = 30. Every stroke addition, stroke erasure, or lasso move commits `[...strokes]` to `undoStack` and resets `redoStack`.
2. **Lasso Selection**: Evaluates `isStrokeInsidePolygon` against all active strokes. Sets `selectedStrokeIds` and computes `selectionBoundingBox`.
3. **Immutability**: All stroke translations create new object references with re-computed SVG paths.

---

### 3.4 Hardware-Accelerated Paper Templates (`src/components/Templates/PaperTemplate.tsx`)

Renders canvas background grid/lines directly using `@shopify/react-native-skia` native graphics primitives (`<Group>`, `<Rect>`, `<Line>`) inside the canvas:

- **'blank'**: Clean white canvas background.
- **'lined'**: Horizontal grey ruled lines (`y` step = 32px) + Red margin line at $x = 60\text{px}$.
- **'grid'**: Grid mesh with horizontal & vertical lines spaced at 24px intervals.
- **'cornell'**:
  - Header line at $y = 80\text{px}$.
  - Cue column vertical divider at $x = 200\text{px}$ (from $y=80$ to $y=\text{height}-120$).
  - Summary section horizontal divider at $y = \text{height} - 120\text{px}$.
  - Main area ruled horizontal lines.

---

### 3.5 Tool Palette Component (`src/components/Canvas/ToolPalette.tsx`)

Top control toolbar providing intuitive controls:
1. **Tools**: Pen, Highlighter, Eraser, Lasso buttons with active styling.
2. **Colors**: Preset swatches (`#000000`, `#1C7ED6`, `#E03131`, `#2F9E44`, `#F59F00`, `#7048E8`, `#343A40`).
3. **Stroke Widths**: Presets (Fine: 2px, Medium: 4px, Bold: 8px, Extra Bold: 12px).
4. **Templates**: Selector dropdown/buttons for Blank, Lined, Grid, Cornell.
5. **History Controls**: Undo (disabled when stack empty), Redo, Clear Canvas.

---

### 3.6 Hardware-Accelerated Skia Canvas (`src/components/Canvas/SkiaCanvas.tsx`)

The main drawing surface binding gestures to render layers:
1. **Paper Template Layer**: Renders `<PaperTemplate template={currentTemplate} width={width} height={height} />`.
2. **Committed Vector Strokes Layer**: Iterates over `strokes`, creating/rendering `<Path>` components.
   - Pen: `style="stroke"`, `strokeCap="round"`, `strokeJoin="round"`.
   - Highlighter: `style="stroke"`, `opacity={0.4}`, `strokeCap="square"`, blend mode multiply/alpha.
3. **Active Drawing Stroke Layer**: Real-time rendering of currently drawn points while touch gesture is active.
4. **Lasso Overlay & Bounding Box Layer**:
   - Renders dashed lasso path while drawing lasso.
   - Renders dashed bounding box rectangle `<Rect>` + drag handle around `selectedStrokeIds` when active.
5. **Gesture Pipeline (`react-native-gesture-handler`)**:
   - `Gesture.Pan()` configured with `minDistance(0)`, tracking `onStart`, `onUpdate`, `onEnd`.
   - Handles Pen drawing, Eraser hit testing, Lasso selection path capture, and Selection translation dragging.

---

## 4. Technical Specifications & Algorithms

### 4.1 Lasso Selection Point-in-Polygon (Ray-Casting) Algorithm
```typescript
export function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  const { x, y } = point;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-10) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
```

### 4.2 Path Smoothing (Midpoint Quadratic Bezier Interpolation)
To achieve smooth, low-latency curves without angular sharp corners:
- For points $P_0, P_1, \dots, P_n$:
  1. Move to $P_0$.
  2. For each point $P_i$ ($i = 1 \dots n-1$), calculate midpoint $M_i = \frac{P_i + P_{i+1}}{2}$.
  3. Append quadratic Bezier segment `quadTo(P_i.x, P_i.y, M_i.x, M_i.y)`.
  4. Final lineTo $P_n$.

---

## 5. Application Integration Plan (`App.tsx`)

Integrate `useCanvasState`, `ToolPalette`, and `SkiaCanvas` into `App.tsx`:
- Replace existing `canvasPlaceholder` view with `ToolPalette` atop `SkiaCanvas`.
- Ensure flex layout properly dimensions canvas bounds to container layout dimensions.

---

## 6. Verification & Test Suite Strategy

### 6.1 Unit Tests (`src/utils/__tests__/`, `src/components/__tests__/`)
- **`geometry.test.ts`**: Test distance calculation, bounding box bounds, point-in-polygon ray-casting, stroke point translation.
- **`pressure.test.ts`**: Test pressure normalization, dynamic width calculation across tools, palm contact filtering.
- **`skia.test.ts`**: Test Skia path creation, SVG conversion serialization and deserialization.
- **`useCanvasState.test.ts`**: Test tool switching, stroke creation, stroke deletion, undo/redo stack limits, lasso selection.

### 6.2 Verification Command Suite
1. `npm run typecheck` (`tsc --noEmit`) — Zero type errors.
2. `npm test` — Jest suite validation.
