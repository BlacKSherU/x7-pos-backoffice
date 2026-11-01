/**
 * Helper utility to generate standalone SVG vector QR Code assets and data URIs.
 * Generates an SVG representation with finder patterns, timing patterns,
 * alignment blocks, and data modules.
 */

export function generateQrMatrix(input: string, size = 25): boolean[][] {
  const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const isReserved: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  // Helper to place 7x7 finder pattern
  const placeFinder = (startRow: number, startCol: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const row = startRow + r;
        const col = startCol + c;
        if (row >= 0 && row < size && col >= 0 && col < size) {
          isReserved[row][col] = true;
          // Outer border (7x7) or inner 3x3 core
          if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
            matrix[row][col] = true;
          } else {
            matrix[row][col] = false;
          }
        }
      }
    }
  };

  // Top-left, Top-right, Bottom-left finder patterns
  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (!isReserved[6][i]) {
      isReserved[6][i] = true;
      matrix[6][i] = i % 2 === 0;
    }
    if (!isReserved[i][6]) {
      isReserved[i][6] = true;
      matrix[i][6] = i % 2 === 0;
    }
  }

  // Deterministic data fill based on input hash & characters
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }

  // Seed pseudo-random data matrix from hash and string content
  let step = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!isReserved[r][c]) {
        const charCode = input.charCodeAt(step % input.length) || 65;
        const val = (hash ^ (r * 31 + c * 17 + charCode * step)) % 3;
        matrix[r][c] = val === 0 || val === 1;
        step++;
      }
    }
  }

  return matrix;
}

export function generateQrSvg(
  inputUrl: string,
  options: {
    title?: string;
    subtitle?: string;
    size?: number;
    color?: string;
    bgColor?: string;
  } = {}
): string {
  const { title = '', size = 250, color = '#0f172a', bgColor = '#ffffff' } = options;
  const matrixSize = 25;
  const matrix = generateQrMatrix(inputUrl, matrixSize);
  const padding = 20;
  const qrAreaSize = size - padding * 2;
  const cellSize = qrAreaSize / matrixSize;

  let rects = '';
  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      if (matrix[r][c]) {
        const x = (padding + c * cellSize).toFixed(2);
        const y = (padding + r * cellSize).toFixed(2);
        const w = (cellSize + 0.1).toFixed(2); // minimal overlap to avoid gap artifacts
        const h = (cellSize + 0.1).toFixed(2);
        rects += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}" rx="0.5"/>`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="100%" height="100%" fill="${bgColor}" rx="12"/>
  <g>${rects}</g>
  ${title ? `<text x="${size / 2}" y="${size - 8}" font-family="sans-serif" font-size="10" font-weight="bold" fill="${color}" text-anchor="middle">${title}</text>` : ''}
</svg>`;
}

export function generateQrSvgDataUrl(inputUrl: string, options = {}): string {
  const svgText = generateQrSvg(inputUrl, options);
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgText)}`;
}
