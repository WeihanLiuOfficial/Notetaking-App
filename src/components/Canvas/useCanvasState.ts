import { useState, useCallback } from 'react';
import {
  ToolType,
  TemplateType,
  Stroke,
  Point,
  BoundingBox,
  LassoSelectionState,
  CanvasState,
} from '../../types/canvas';
import {
  calculateMultiStrokeBoundingBox,
  isStrokeInsidePolygon,
  transformStroke,
  isPointNearStroke,
} from '../../utils/geometry';

const MAX_UNDO_DEPTH = 30;

const initialLassoState: LassoSelectionState = {
  isActive: false,
  lassoPoints: [],
  selectedStrokeIds: [],
  selectionBoundingBox: null,
  isDragging: false,
  dragStartPoint: null,
  dragOffset: { x: 0, y: 0 },
};

export function useCanvasState(initialTemplate: TemplateType = 'lined') {
  const [activeTool, setActiveToolState] = useState<ToolType>('pen');
  const [activeColor, setActiveColor] = useState<string>('#000000');
  const [strokeWidth, setStrokeWidth] = useState<number>(4);
  const [currentTemplate, setCurrentTemplate] = useState<TemplateType>(initialTemplate);

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [undoStack, setUndoStack] = useState<Stroke[][]>([]);
  const [redoStack, setRedoStack] = useState<Stroke[][]>([]);

  const [lassoSelection, setLassoSelection] = useState<LassoSelectionState>(initialLassoState);

  const clearLassoSelection = useCallback(() => {
    setLassoSelection(initialLassoState);
  }, []);

  const setActiveTool = useCallback(
    (tool: ToolType) => {
      setActiveToolState(tool);
      if (tool !== 'lasso') {
        clearLassoSelection();
      }
    },
    [clearLassoSelection]
  );

  const pushToUndoStack = useCallback((currentStrokes: Stroke[]) => {
    setUndoStack((prev) => {
      const nextStack = [...prev, currentStrokes];
      if (nextStack.length > MAX_UNDO_DEPTH) {
        return nextStack.slice(nextStack.length - MAX_UNDO_DEPTH);
      }
      return nextStack;
    });
    setRedoStack([]);
  }, []);

  const addStroke = useCallback(
    (stroke: Stroke) => {
      setStrokes((prevStrokes) => {
        pushToUndoStack(prevStrokes);
        return [...prevStrokes, stroke];
      });
    },
    [pushToUndoStack]
  );

  const eraseStrokesAtPoint = useCallback(
    (point: Point, threshold: number = 10): boolean => {
      let erasedAny = false;
      setStrokes((prevStrokes) => {
        const remaining = prevStrokes.filter((stroke) => {
          const hit = isPointNearStroke(point, stroke, threshold);
          if (hit) erasedAny = true;
          return !hit;
        });

        if (erasedAny) {
          pushToUndoStack(prevStrokes);
        }
        return remaining;
      });

      if (erasedAny) {
        clearLassoSelection();
      }
      return erasedAny;
    },
    [pushToUndoStack, clearLassoSelection]
  );

  const setLassoPoints = useCallback((points: Point[]) => {
    setLassoSelection((prev) => ({
      ...prev,
      lassoPoints: points,
    }));
  }, []);

  const commitLassoSelection = useCallback(
    (points: Point[]) => {
      if (points.length < 3) {
        clearLassoSelection();
        return;
      }

      const selectedStrokes = strokes.filter((stroke) =>
        isStrokeInsidePolygon(stroke, points)
      );

      const selectedIds = selectedStrokes.map((s) => s.id);
      const bbox = calculateMultiStrokeBoundingBox(selectedStrokes);

      setLassoSelection({
        isActive: selectedIds.length > 0,
        lassoPoints: points,
        selectedStrokeIds: selectedIds,
        selectionBoundingBox: bbox,
        isDragging: false,
        dragStartPoint: null,
        dragOffset: { x: 0, y: 0 },
      });
    },
    [strokes, clearLassoSelection]
  );

  const startLassoDrag = useCallback((startPoint: Point) => {
    setLassoSelection((prev) => ({
      ...prev,
      isDragging: true,
      dragStartPoint: startPoint,
      dragOffset: { x: 0, y: 0 },
    }));
  }, []);

  const updateLassoDrag = useCallback((currentPoint: Point) => {
    setLassoSelection((prev) => {
      if (!prev.isDragging || !prev.dragStartPoint) return prev;
      const deltaX = currentPoint.x - prev.dragStartPoint.x;
      const deltaY = currentPoint.y - prev.dragStartPoint.y;
      return {
        ...prev,
        dragOffset: { x: deltaX, y: deltaY },
      };
    });
  }, []);

  const commitLassoDrag = useCallback(() => {
    setLassoSelection((prev) => {
      if (!prev.isDragging || (prev.dragOffset.x === 0 && prev.dragOffset.y === 0)) {
        return {
          ...prev,
          isDragging: false,
          dragStartPoint: null,
          dragOffset: { x: 0, y: 0 },
        };
      }

      const { selectedStrokeIds, dragOffset } = prev;
      setStrokes((currentStrokes) => {
        pushToUndoStack(currentStrokes);
        return currentStrokes.map((stroke) => {
          if (selectedStrokeIds.includes(stroke.id)) {
            return transformStroke(stroke, dragOffset.x, dragOffset.y);
          }
          return stroke;
        });
      });

      // Update bounding box for new positions
      const updatedSelectedStrokes = strokes
        .map((stroke) => {
          if (selectedStrokeIds.includes(stroke.id)) {
            return transformStroke(stroke, dragOffset.x, dragOffset.y);
          }
          return stroke;
        })
        .filter((s) => selectedStrokeIds.includes(s.id));

      const newBbox = calculateMultiStrokeBoundingBox(updatedSelectedStrokes);

      return {
        ...prev,
        selectionBoundingBox: newBbox,
        isDragging: false,
        dragStartPoint: null,
        dragOffset: { x: 0, y: 0 },
      };
    });
  }, [strokes, pushToUndoStack]);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;

    const previousStrokes = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, undoStack.length - 1);

    setRedoStack((prev) => [...prev, strokes]);
    setUndoStack(newUndoStack);
    setStrokes(previousStrokes);
    clearLassoSelection();
  }, [undoStack, strokes, clearLassoSelection]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;

    const nextStrokes = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, redoStack.length - 1);

    setUndoStack((prev) => {
      const nextStack = [...prev, strokes];
      if (nextStack.length > MAX_UNDO_DEPTH) {
        return nextStack.slice(nextStack.length - MAX_UNDO_DEPTH);
      }
      return nextStack;
    });
    setRedoStack(newRedoStack);
    setStrokes(nextStrokes);
    clearLassoSelection();
  }, [redoStack, strokes, clearLassoSelection]);

  const clearCanvas = useCallback(() => {
    if (strokes.length === 0) return;
    pushToUndoStack(strokes);
    setStrokes([]);
    clearLassoSelection();
  }, [strokes, pushToUndoStack, clearLassoSelection]);

  const loadStrokes = useCallback((newStrokes: Stroke[]) => {
    setStrokes(newStrokes);
    setUndoStack([]);
    setRedoStack([]);
    clearLassoSelection();
  }, [clearLassoSelection]);

  const resetCanvasState = useCallback((template: TemplateType = 'lined') => {
    setStrokes([]);
    setUndoStack([]);
    setRedoStack([]);
    setCurrentTemplate(template);
    clearLassoSelection();
  }, [clearLassoSelection]);

  const canvasState: CanvasState = {
    activeTool,
    activeColor,
    strokeWidth,
    currentTemplate,
    strokes,
    undoStack,
    redoStack,
    lassoSelection,
  };

  return {
    canvasState,
    activeTool,
    activeColor,
    strokeWidth,
    currentTemplate,
    strokes,
    undoStack,
    redoStack,
    lassoSelection,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    setActiveTool,
    setActiveColor,
    setStrokeWidth,
    setCurrentTemplate,
    addStroke,
    eraseStrokesAtPoint,
    setLassoPoints,
    commitLassoSelection,
    startLassoDrag,
    updateLassoDrag,
    commitLassoDrag,
    clearLassoSelection,
    undo,
    redo,
    clearCanvas,
    loadStrokes,
    resetCanvasState,
  };
}

export type CanvasStateHookResult = ReturnType<typeof useCanvasState>;
