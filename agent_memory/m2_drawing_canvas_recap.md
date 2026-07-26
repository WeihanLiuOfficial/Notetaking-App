# Technical Recap: Milestone 2 — Hardware-Accelerated Skia Drawing Engine & Pencil Canvas

## Goal
The primary objective of Milestone 2 (M2) is to transform the Native iPadOS Notetaking App into a high-performance vector drawing engine powered by `@shopify/react-native-skia` and `react-native-gesture-handler`. The engine provides low-latency pressure and tilt sensitive drawing with Pen, Highlighter, Eraser, and Lasso selection tools, Catmull-Rom quadratic Bezier path smoothing, ray-casting point-in-polygon lasso enclosure, interactive stroke translation, paper background template rendering (Blank, Lined, Grid, Cornell), a 30-depth undo/redo history stack, floating tool palette UI, and workspace integration in `App.tsx`.

## Procedure
1. **Types Extension (`src/types/canvas.ts`)**:
   - Extended core data types with `BoundingBox`, `LassoSelectionState`, and `CanvasState` to support bounding box computations, lasso selection tracking, drag offsets, and state hooks.

2. **Mathematical & Skia Path Utilities (`src/utils/geometry.ts`, `src/utils/pressure.ts`, `src/utils/skia.ts`)**:
   - Implemented point-to-point Euclidean distance, bounding box calculation for single and multiple strokes.
   - Implemented ray-casting point-in-polygon algorithm (`isPointInPolygon`) and stroke enclosure evaluator (`isStrokeInsidePolygon` with full nullish guard checks for `stroke`, `stroke.points`, and `polygon`).
   - Implemented segment distance hit testing (`isPointNearStroke`) for vector erasing.
   - Implemented stroke translation (`transformStroke`) with cached SVG path invalidation.
   - Implemented pressure normalization (`normalizePressure`), tool-specific dynamic stroke width calculation (`calculateDynamicStrokeWidth`), and palm contact touch filtering (`filterPalmTouch`).
   - Implemented Catmull-Rom quadratic Bezier curve interpolation (`createSkiaPathFromPoints`), SVG serialization (`exportPathToSvg`), and SVG deserialization (`createPathFromSvg`) via `@shopify/react-native-skia` `Skia.Path`.

3. **Paper Background Template Renderer (`src/components/Templates/PaperTemplate.tsx`)**:
   - Created hardware-accelerated Skia background template renderer for `blank`, `lined` (ruled lines + red margin), `grid` (mesh grid), and `cornell` (header, summary section, cue column divider, and note area lines) using Skia primitives (`<Group>`, `<Rect>`, `<Line>`).

4. **Canvas State Management Hook (`src/components/Canvas/useCanvasState.ts`)**:
   - Encapsulated active tool, color, stroke width, template selection, stroke list, 30-depth undo/redo stack, and complete lasso selection lifecycle (lasso points capture, polygon enclosure evaluation, drag tracking, offset commitment, and selection clearing).

5. **Floating Tool Palette Component (`src/components/Canvas/ToolPalette.tsx`)**:
   - Built a modular iPadOS toolbar providing tool toggles (Pen, Highlighter, Eraser, Lasso), color swatches, stroke width selectors, paper template options, and undo/redo/clear buttons with active visual feedback.

6. **Hardware-Accelerated Skia Canvas (`src/components/Canvas/SkiaCanvas.tsx`)**:
   - Built multi-layer rendering surface combining PaperTemplate background, committed vector strokes with tool styling (Pen: round cap/join; Highlighter: 0.4 opacity multiply/square cap), active drawing live preview path, and lasso overlay with dashed selection box and corner drag handles.
   - Bound gesture system (`react-native-gesture-handler` `Gesture.Pan()`) to track touch start, update, and end callbacks via `react-native-reanimated` `runOnJS`.

7. **Workspace Integration & Verification (`App.tsx`)**:
   - Integrated `ToolPalette`, `SkiaCanvas`, `PaperTemplate`, and `useCanvasState` into `App.tsx`.
   - Executed full TypeScript typechecking (`tsc --noEmit`) and created unit test suite (`src/utils/__tests__/geometry.test.ts`).

## Details

### Files Modified & Created
- `src/types/canvas.ts`: Extended with `BoundingBox`, `LassoSelectionState`, `CanvasState`.
- `src/utils/geometry.ts`: Implemented distance, bounding box, ray-casting point-in-polygon, stroke enclosure with nullish safety guard, segment hit testing, and stroke translation.
- `src/utils/pressure.ts`: Implemented pressure normalization, tool-specific stroke width scaling, and palm filtering.
- `src/utils/skia.ts`: Implemented Catmull-Rom Bezier path smoothing, SVG serialization/deserialization.
- `src/utils/index.ts`: Re-exported geometry, pressure, and skia utilities.
- `src/components/Templates/PaperTemplate.tsx`: Hardware-accelerated Skia template renderer.
- `src/components/Templates/index.ts`: Re-exported `PaperTemplate`.
- `src/components/Canvas/useCanvasState.ts`: Canvas state hook with 30-depth undo/redo stack & lasso management.
- `src/components/Canvas/ToolPalette.tsx`: Floating iPadOS control toolbar component.
- `src/components/Canvas/SkiaCanvas.tsx`: Main Skia canvas with gesture handler and multi-layer rendering.
- `src/components/Canvas/index.ts`: Re-exported canvas components and state hook.
- `App.tsx`: Integrated drawing workspace.
- `src/utils/__tests__/geometry.test.ts`: Unit tests for geometry utilities.
- `src/utils/__tests__/m2_empirical_runner.js`: Empirical verification suite runner.

### Key Parameters & Configurations
- **Undo History Depth**: Max 30 actions (`MAX_UNDO_DEPTH = 30`).
- **Dynamic Stroke Width Scaling**:
  - Pen: $\text{Width} = \text{baseWidth} \times (0.4 + 1.2 \times \text{pressure})$
  - Highlighter: $\text{Width} = \text{baseWidth} \times (0.8 + 0.4 \times \text{pressure})$, opacity = 0.4.
- **Palm Touch Threshold**: Ignores touches with contact radius $> 25\text{px}$.
- **Paper Template Spacing**: Lined = 32px; Grid = 24px; Cornell cue divider $x = 200\text{px}$, summary divider $y = \text{height} - 120\text{px}$.

### Verification & Validation Tests Performed
- **TypeScript Typecheck Command**:
  `& "C:\Program Files\Adobe\Adobe Creative Cloud Experience\libs\node.exe" "E:\Program Files\PyCharm 2025.2.1.1\plugins\javascript-plugin\jsLanguageServicesImpl\external\typescript.js" --noEmit`
  **Output**: Exit Code 0 (0 type errors).
- **Unit Test Suite**:
  - Tested Euclidean distance calculation.
  - Tested bounding box calculation for point arrays.
  - Tested ray-casting point-in-polygon algorithm (`isPointInPolygon`).
  - Tested stroke enclosure evaluation (`isStrokeInsidePolygon`).
  - Tested stroke translation (`transformStroke`) and SVG cache invalidation.
  - Tested eraser hit detection (`isPointNearStroke`).
- **Empirical M2 Verification Suite**:
  Command: `& "C:\Program Files\Adobe\Adobe Creative Cloud Experience\libs\node.exe" "e:\Projects\Notetaking App\src\utils\__tests__\m2_empirical_runner.js"`
  Output: Total Tests Run: 58, Passed: 58, Failed: 0.

## Remediation & Refinement (Milestone 2)
- **Nullish Parameter Guard in `isStrokeInsidePolygon`**:
  Updated line 66 of `src/utils/geometry.ts` from:
  `if (!stroke.points || stroke.points.length === 0 || polygon.length < 3) return false;`
  To:
  `if (!stroke || !stroke.points || stroke.points.length === 0 || !polygon || polygon.length < 3) return false;`
  This change prevents potential runtime `TypeError: Cannot read properties of null/undefined` exceptions when invalid stroke or polygon objects are passed during high-speed gesture input or empty selection events.
