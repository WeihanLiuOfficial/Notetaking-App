import React from 'react';
import { Group, Rect, Line, vec } from '@shopify/react-native-skia';
import { TemplateType } from '../../types/canvas';

export interface PaperTemplateProps {
  template: TemplateType;
  width: number;
  height: number;
}

export const PaperTemplate: React.FC<PaperTemplateProps> = ({ template, width, height }) => {
  const canvasWidth = Math.max(width, 100);
  const canvasHeight = Math.max(height, 100);

  if (template === 'blank') {
    return (
      <Rect x={0} y={0} width={canvasWidth} height={canvasHeight} color="#FFFFFF" />
    );
  }

  if (template === 'lined') {
    const lineSpacing = 32;
    const horizontalLines: number[] = [];
    for (let y = 60; y < canvasHeight - 20; y += lineSpacing) {
      horizontalLines.push(y);
    }

    return (
      <Group>
        <Rect x={0} y={0} width={canvasWidth} height={canvasHeight} color="#FFFFFF" />
        {horizontalLines.map((y, idx) => (
          <Line
            key={`lined-h-${idx}`}
            p1={vec(0, y)}
            p2={vec(canvasWidth, y)}
            color="#E9ECEF"
            strokeWidth={1}
          />
        ))}
        {/* Red left margin line */}
        <Line
          p1={vec(60, 0)}
          p2={vec(60, canvasHeight)}
          color="#FF8787"
          strokeWidth={1.5}
        />
      </Group>
    );
  }

  if (template === 'grid') {
    const gridSpacing = 24;
    const verticalLines: number[] = [];
    for (let x = gridSpacing; x < canvasWidth; x += gridSpacing) {
      verticalLines.push(x);
    }

    const horizontalLines: number[] = [];
    for (let y = gridSpacing; y < canvasHeight; y += gridSpacing) {
      horizontalLines.push(y);
    }

    return (
      <Group>
        <Rect x={0} y={0} width={canvasWidth} height={canvasHeight} color="#FFFFFF" />
        {verticalLines.map((x, idx) => (
          <Line
            key={`grid-v-${idx}`}
            p1={vec(x, 0)}
            p2={vec(x, canvasHeight)}
            color="#E9ECEF"
            strokeWidth={1}
          />
        ))}
        {horizontalLines.map((y, idx) => (
          <Line
            key={`grid-h-${idx}`}
            p1={vec(0, y)}
            p2={vec(canvasWidth, y)}
            color="#E9ECEF"
            strokeWidth={1}
          />
        ))}
      </Group>
    );
  }

  if (template === 'cornell') {
    const headerY = 80;
    const summaryY = Math.max(headerY + 200, canvasHeight - 120);
    const cueColumnX = 200;

    const lineSpacing = 32;
    const bodyLines: number[] = [];
    for (let y = headerY + lineSpacing; y < summaryY - 10; y += lineSpacing) {
      bodyLines.push(y);
    }

    return (
      <Group>
        <Rect x={0} y={0} width={canvasWidth} height={canvasHeight} color="#FFFFFF" />
        {/* Main section body horizontal lines */}
        {bodyLines.map((y, idx) => (
          <Line
            key={`cornell-h-${idx}`}
            p1={vec(0, y)}
            p2={vec(canvasWidth, y)}
            color="#E9ECEF"
            strokeWidth={1}
          />
        ))}
        {/* Header divider line */}
        <Line
          p1={vec(0, headerY)}
          p2={vec(canvasWidth, headerY)}
          color="#495057"
          strokeWidth={2}
        />
        {/* Summary divider line */}
        <Line
          p1={vec(0, summaryY)}
          p2={vec(canvasWidth, summaryY)}
          color="#495057"
          strokeWidth={2}
        />
        {/* Cue column vertical line */}
        <Line
          p1={vec(cueColumnX, headerY)}
          p2={vec(cueColumnX, summaryY)}
          color="#495057"
          strokeWidth={2}
        />
      </Group>
    );
  }

  return <Rect x={0} y={0} width={canvasWidth} height={canvasHeight} color="#FFFFFF" />;
};
