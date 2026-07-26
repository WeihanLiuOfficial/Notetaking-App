import React, { useState, useCallback } from 'react';
import { StyleSheet, View, LayoutChangeEvent } from 'react-native';
import { Canvas, Group, Path, Rect } from '@shopify/react-native-skia';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { Point, Stroke, ToolType, TemplateType } from '../../types/canvas';
import { PaperTemplate } from '../Templates/PaperTemplate';
import { CanvasStateHookResult } from './useCanvasState';
import {
  createSkiaPathFromPoints,
  exportPathToSvg,
  createPathFromSvg,
} from '../../utils/skia';
import {
  calculateDynamicStrokeWidth,
  filterPalmTouch,
} from '../../utils/pressure';

export interface SkiaCanvasProps {
  canvasStateHook: CanvasStateHookResult;
  style?: object;
}

export const SkiaCanvas: React.FC<SkiaCanvasProps> = ({ canvasStateHook, style }) => {
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [activePoints, setActivePoints] = useState<Point[]>([]);

  const {
    activeTool,
    activeColor,
    strokeWidth,
    currentTemplate,
    strokes,
    lassoSelection,
    addStroke,
    eraseStrokesAtPoint,
    commitLassoSelection,
    startLassoDrag,
    updateLassoDrag,
    commitLassoDrag,
    clearLassoSelection,
  } = canvasStateHook;

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setDimensions({ width, height });
    }
  };

  const isPointInBbox = (pt: Point, bbox: { minX: number; minY: number; maxX: number; maxY: number }) => {
    return (
      pt.x >= bbox.minX - 10 &&
      pt.x <= bbox.maxX + 10 &&
      pt.y >= bbox.minY - 10 &&
      pt.y <= bbox.maxY + 10
    );
  };

  const onGestureStartJS = useCallback(
    (x: number, y: number, pressure?: number, radius?: number) => {
      if (!filterPalmTouch(radius)) return;

      const pt: Point = { x, y, pressure, timestamp: Date.now() };

      if (activeTool === 'pen' || activeTool === 'highlighter') {
        setActivePoints([pt]);
      } else if (activeTool === 'eraser') {
        eraseStrokesAtPoint(pt, strokeWidth * 2);
      } else if (activeTool === 'lasso') {
        if (
          lassoSelection.isActive &&
          lassoSelection.selectionBoundingBox &&
          isPointInBbox(pt, lassoSelection.selectionBoundingBox)
        ) {
          startLassoDrag(pt);
        } else {
          clearLassoSelection();
          setActivePoints([pt]);
        }
      }
    },
    [
      activeTool,
      strokeWidth,
      eraseStrokesAtPoint,
      lassoSelection,
      startLassoDrag,
      clearLassoSelection,
    ]
  );

  const onGestureUpdateJS = useCallback(
    (x: number, y: number, pressure?: number, radius?: number) => {
      if (!filterPalmTouch(radius)) return;

      const pt: Point = { x, y, pressure, timestamp: Date.now() };

      if (activeTool === 'pen' || activeTool === 'highlighter') {
        setActivePoints((prev) => [...prev, pt]);
      } else if (activeTool === 'eraser') {
        eraseStrokesAtPoint(pt, strokeWidth * 2);
      } else if (activeTool === 'lasso') {
        if (lassoSelection.isDragging) {
          updateLassoDrag(pt);
        } else {
          setActivePoints((prev) => [...prev, pt]);
        }
      }
    },
    [activeTool, strokeWidth, eraseStrokesAtPoint, lassoSelection.isDragging, updateLassoDrag]
  );

  const onGestureEndJS = useCallback(() => {
    if (activeTool === 'pen' || activeTool === 'highlighter') {
      setActivePoints((currentPts) => {
        if (currentPts.length > 0) {
          const avgPressure =
            currentPts.reduce((acc, p) => acc + (p.pressure ?? 0.5), 0) / currentPts.length;

          const calculatedWidth = calculateDynamicStrokeWidth(
            strokeWidth,
            avgPressure,
            undefined,
            activeTool
          );

          const skPath = createSkiaPathFromPoints(currentPts);
          const svgStr = exportPathToSvg(skPath);

          const newStroke: Stroke = {
            id: `stroke_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            tool: activeTool,
            color: activeColor,
            size: calculatedWidth,
            points: currentPts,
            skiaPathSvg: svgStr,
            createdAt: Date.now(),
          };

          addStroke(newStroke);
        }
        return [];
      });
    } else if (activeTool === 'lasso') {
      if (lassoSelection.isDragging) {
        commitLassoDrag();
      } else {
        setActivePoints((currentPts) => {
          if (currentPts.length >= 3) {
            commitLassoSelection(currentPts);
          }
          return [];
        });
      }
    }
  }, [
    activeTool,
    activeColor,
    strokeWidth,
    addStroke,
    lassoSelection.isDragging,
    commitLassoDrag,
    commitLassoSelection,
  ]);

  const gesture = React.useMemo(() => {
    return Gesture.Pan()
      .minDistance(0)
      .runOnJS(true)
      .onStart((e) => {
        const stylusPress = (e as any).stylusData?.pressure ?? (e as any).pressure;
        onGestureStartJS(e.x, e.y, stylusPress, (e as any).radius);
      })
      .onUpdate((e) => {
        const stylusPress = (e as any).stylusData?.pressure ?? (e as any).pressure;
        onGestureUpdateJS(e.x, e.y, stylusPress, (e as any).radius);
      })
      .onEnd(() => {
        onGestureEndJS();
      });
  }, [onGestureStartJS, onGestureUpdateJS, onGestureEndJS]);

  // Render helpers
  const renderCommittedStroke = (stroke: Stroke) => {
    const isSelected = lassoSelection.selectedStrokeIds.includes(stroke.id);
    const offsetX = isSelected && lassoSelection.isDragging ? lassoSelection.dragOffset.x : 0;
    const offsetY = isSelected && lassoSelection.isDragging ? lassoSelection.dragOffset.y : 0;

    let path = stroke.skiaPathSvg ? createPathFromSvg(stroke.skiaPathSvg) : null;
    if (!path) {
      path = createSkiaPathFromPoints(stroke.points);
    }

    const strokeCapVal: 'round' | 'square' = stroke.tool === 'highlighter' ? 'square' : 'round';
    const strokeStyle = {
      style: 'stroke' as const,
      strokeCap: strokeCapVal,
      strokeJoin: 'round' as const,
      color: stroke.color,
      strokeWidth: stroke.tool === 'highlighter' ? stroke.size * 2.5 : stroke.size,
      opacity: stroke.tool === 'highlighter' ? 0.4 : 1.0,
    };

    if (offsetX !== 0 || offsetY !== 0) {
      return (
        <Group key={stroke.id} transform={[{ translateX: offsetX }, { translateY: offsetY }]}>
          <Path path={path} {...strokeStyle} />
        </Group>
      );
    }

    return <Path key={stroke.id} path={path} {...strokeStyle} />;
  };

  const activePath = activePoints.length > 0 ? createSkiaPathFromPoints(activePoints) : null;
  const lassoPath =
    activeTool === 'lasso' && activePoints.length >= 2
      ? createSkiaPathFromPoints(activePoints, true)
      : null;

  const bbox = lassoSelection.selectionBoundingBox;
  const bboxX = bbox ? bbox.minX + (lassoSelection.isDragging ? lassoSelection.dragOffset.x : 0) - 6 : 0;
  const bboxY = bbox ? bbox.minY + (lassoSelection.isDragging ? lassoSelection.dragOffset.y : 0) - 6 : 0;
  const bboxWidth = bbox ? bbox.width + 12 : 0;
  const bboxHeight = bbox ? bbox.height + 12 : 0;

  return (
    <View style={[styles.canvasContainer, style]} onLayout={handleLayout}>
      <GestureDetector gesture={gesture}>
        <Canvas style={styles.skiaCanvas}>
          {/* Layer 1: Paper Template */}
          <PaperTemplate
            template={currentTemplate}
            width={dimensions.width}
            height={dimensions.height}
          />

          {/* Layer 2: Committed Vector Strokes */}
          <Group>{strokes.map(renderCommittedStroke)}</Group>

          {/* Layer 3: Active Drawing Stroke Live Preview */}
          {activePath && (activeTool === 'pen' || activeTool === 'highlighter') && (
            <Path
              path={activePath}
              style="stroke"
              strokeCap={activeTool === 'highlighter' ? 'square' : 'round'}
              strokeJoin="round"
              color={activeColor}
              strokeWidth={
                activeTool === 'highlighter' ? strokeWidth * 2.5 : strokeWidth
              }
              opacity={activeTool === 'highlighter' ? 0.4 : 1.0}
            />
          )}

          {/* Layer 4: Lasso Selection Drawing & Bounding Box Overlay */}
          {lassoPath && activeTool === 'lasso' && (
            <Path
              path={lassoPath}
              style="stroke"
              strokeWidth={1.5}
              color="#1C7ED6"
            />
          )}

          {lassoSelection.isActive && bbox && (
            <Group>
              <Rect
                x={bboxX}
                y={bboxY}
                width={bboxWidth}
                height={bboxHeight}
                style="stroke"
                strokeWidth={1.5}
                color="#1C7ED6"
              />
              {/* Corner Handles */}
              <Rect x={bboxX - 4} y={bboxY - 4} width={8} height={8} color="#1C7ED6" />
              <Rect x={bboxX + bboxWidth - 4} y={bboxY - 4} width={8} height={8} color="#1C7ED6" />
              <Rect x={bboxX - 4} y={bboxY + bboxHeight - 4} width={8} height={8} color="#1C7ED6" />
              <Rect x={bboxX + bboxWidth - 4} y={bboxY + bboxHeight - 4} width={8} height={8} color="#1C7ED6" />
            </Group>
          )}
        </Canvas>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  canvasContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  skiaCanvas: {
    flex: 1,
  },
});
