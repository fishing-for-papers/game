export interface KeywormDimensions {
  totalWidth: number;
  totalHeight: number;
  headWidth: number;
  tailWidth: number;
  overlap: number;
  minBodyWidth: number;
  charWidth: number;
  bodyWidths: number[];
  segmentPositions: number[];
  headPosition: number;
}

export function calculateKeywormDimensions(
  keywords: string[],
  size: number,
  mode: 'min' | 'full' = 'min'
): KeywormDimensions {
  const segments = keywords.length;
  const headWidth = size * 1.15;
  const tailWidth = size * 0.75;
  const overlap = size * 0.17;
  const minBodyWidth = size * 0.8;
  const charWidth = size * 0.07; // Increased for better text fitting
  const minPadding = size * 0.22;
  const maxPadding = size * 0.46;

  // Calculate width for each body segment based on keyword length
  const bodyWidths = keywords.map((keyword) => {
    if (mode === 'full' && keyword) {
      const textWidth = keyword.length * charWidth;
      const proportionalPadding = textWidth * 0.35;
      const boundedPadding = Math.max(minPadding, Math.min(maxPadding, proportionalPadding));

      return Math.max(minBodyWidth, textWidth + boundedPadding);
    }
    return minBodyWidth;
  });

  // Calculate positions for each segment
  let currentX = tailWidth - overlap;
  const segmentPositions = bodyWidths.map((width) => {
    const xPos = currentX;
    currentX += width - overlap;
    return xPos;
  });

  // Calculate head position (at the end of the last body segment)
  const headPosition = segments > 0
    ? segmentPositions[segments - 1] + bodyWidths[segments - 1] - overlap * 2
    : tailWidth - overlap * 2;

  const totalWidth = headPosition + headWidth;

  return {
    totalWidth,
    totalHeight: size,
    headWidth,
    tailWidth,
    overlap,
    minBodyWidth,
    charWidth,
    bodyWidths,
    segmentPositions,
    headPosition
  };
}
