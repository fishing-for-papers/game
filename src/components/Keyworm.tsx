import React, { useState } from 'react';
import WormBodySvg from '../assets/keyworm/worm-body.svg?react';
import WormHeadSvg from '../assets/keyworm/worm-head.svg?react';
import WormTailSvg from '../assets/keyworm/worm-tail.svg?react';
import { useKeywormStore } from '../stores/useKeywormStore';
import { calculateKeywormDimensions } from '../utils/keywormDimensions';

interface KeywormProps {
  x?: number;
  y?: number;
  size?: number;
  mode?: 'min' | 'full';
  keywords?: string[];
  editable?: boolean;
}

interface BodySegmentProps {
  bodyWidth: number;
  xPosition: number;
  totalHeight: number;
  size: number;
  keyword?: string;
  mode: 'min' | 'full';
  segmentOrder: number;
  editable: boolean;
}

const BodySegment: React.FC<BodySegmentProps> = ({
  bodyWidth,
  xPosition,
  totalHeight,
  size,
  keyword,
  mode,
  segmentOrder,
  editable
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const removeKeyword = useKeywormStore((state) => state.removeKeyword);
  const fontSize = Math.min(size * 0.15, 16);
  const buttonSize = size * 0.2;
  const bodyHeight = size * 0.6;
  const hueShiftPerSegment = 18;
  const hueShift = segmentOrder * hueShiftPerSegment;
  const labelHeight = fontSize * 1.35;
  const estimatedTextWidth = (keyword?.length ?? 0) * fontSize * 0.58;
  const labelWidth = Math.min(bodyWidth - fontSize * 0.7, estimatedTextWidth + fontSize * 0.95);
  const labelX = (bodyWidth - labelWidth) / 2;
  const labelY = bodyHeight / 2 - labelHeight / 2;

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (keyword) {
      removeKeyword(keyword);
    }
  };

  return (
    <g
      transform={`translate(${xPosition}, ${totalHeight - bodyHeight})`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Body segment SVG template */}
      <WormBodySvg
        width={bodyWidth}
        height={bodyHeight}
        preserveAspectRatio="none"
        style={{
          cursor: mode === 'full' && editable ? 'pointer' : 'default',
          overflow: 'visible',
          filter: `hue-rotate(${hueShift}deg)`
        }}
      />

      {mode === 'full' && keyword && (
        <>
          <rect
            x={labelX}
            y={labelY}
            width={labelWidth}
            height={labelHeight}
            rx={labelHeight * 0.45}
            ry={labelHeight * 0.45}
            fill="rgba(255, 255, 255, 0.52)"
            style={{ pointerEvents: 'none' }}
          />
          <text
            x={bodyWidth / 2}
            y={bodyHeight / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={fontSize}
            fill="#111"
            fontWeight="600"
            style={{ pointerEvents: 'none' }}
          >
            {keyword}
          </text>
        </>
      )}

      {/* Remove button - only show in full mode when hovered */}
      {mode === 'full' && editable && isHovered && keyword && (
        <g
          transform={`translate(${buttonSize * 0.1}, ${buttonSize * 0.1})`}
          onClick={handleRemove}
          style={{ cursor: 'pointer' }}
        >
          {/* Circle background */}
          <circle
            cx={buttonSize / 2}
            cy={buttonSize / 2}
            r={buttonSize / 2}
            fill="#ff4444"
          />
          {/* Horizontal bar (minus sign) */}
          <line
            x1={buttonSize * 0.25}
            y1={buttonSize / 2}
            x2={buttonSize * 0.75}
            y2={buttonSize / 2}
            stroke="white"
            strokeWidth={buttonSize * 0.15}
            strokeLinecap="round"
          />
        </g>
      )}
    </g>
  );
};

export const Keyworm: React.FC<KeywormProps> = ({
  x = 0,
  y = 0,
  size = 100,
  mode = 'min',
  keywords,
  editable
}) => {
  // Get the keywords from store
  const storeKeywords = useKeywormStore((state) => state.keywords);
  const activeKeywords = keywords ?? storeKeywords;
  const isEditable = editable ?? (keywords === undefined);

  // Use the number of keywords as the number of body segments
  const segments = activeKeywords.length;

  // Reverse keywords so first keyword appears near the head (rightmost)
  const reversedKeywords = [...activeKeywords].reverse();

  // Calculate all dimensions using centralized function
  const {
    totalWidth,
    totalHeight,
    headWidth,
    tailWidth,
    bodyWidths,
    segmentPositions,
    headPosition
  } = calculateKeywormDimensions(reversedKeywords, size, mode);
  
  return (
    <svg
      x={x}
      y={y}
      width={totalWidth}
      height={totalHeight}
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      style={{ overflow: 'visible' }}
    >
      {/* Tail (leftmost) */}
      <g transform={`translate(0, ${totalHeight - size * 0.85})`}>
        <WormTailSvg width={tailWidth} height={size} />
      </g>
      
      {/* Body segments */}
      {Array.from({ length: segments }).map((_, i) => (
        <BodySegment
          key={i}
          bodyWidth={bodyWidths[i]}
          xPosition={segmentPositions[i]}
          totalHeight={totalHeight}
          size={size}
          keyword={reversedKeywords[i]}
          mode={mode}
          segmentOrder={segments - 1 - i}
          editable={isEditable}
        />
      ))}
      {/* Head (rightmost) */}
      <g transform={`translate(${headPosition + size * 0.1}, ${totalHeight - size})`}>
        <WormHeadSvg width={headWidth} height={size} />
      </g>

    </svg>
  );
};

