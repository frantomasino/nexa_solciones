/**
 * Cálculo de grilla de baldosas y dibujo en canvas.
 */
(function (global) {
  'use strict';

  const PATTERNS = {
    solid: 'Sólido',
    'border-center': 'Marco + centro',
    checkerboard: 'Damero',
    'stripes-h': 'Rayas horizontales',
    'stripes-v': 'Rayas verticales',
    'center-aisle': 'Carril central',
    custom: 'Personalizado (%)',
  };

  const DEFAULT_COLORS = [
    { name: 'Gris', hex: '#6b7280' },
    { name: 'Negro', hex: '#1f2937' },
    { name: 'Rojo', hex: '#dc2626' },
  ];

  function metersToCm(m) {
    return m * 100;
  }

  function computeGrid(roomWidthM, roomLengthM, tileWidthCm, tileLengthCm) {
    const cols = Math.max(1, Math.ceil(metersToCm(roomWidthM) / tileWidthCm));
    const rows = Math.max(1, Math.ceil(metersToCm(roomLengthM) / tileLengthCm));
    const actualWidthM = (cols * tileWidthCm) / 100;
    const actualLengthM = (rows * tileLengthCm) / 100;
    return { cols, rows, actualWidthM, actualLengthM, areaM2: roomWidthM * roomLengthM };
  }

  function getColorIndex(pattern, col, row, cols, rows, options) {
    const { aisleWidth = 2, stripeWidth = 1 } = options;

    switch (pattern) {
      case 'solid':
        return 0;

      case 'border-center':
        if (col === 0 || col === cols - 1 || row === 0 || row === rows - 1) return 0;
        return 1;

      case 'checkerboard':
        return (col + row) % 2;

      case 'stripes-h':
        return Math.floor(row / stripeWidth) % 2;

      case 'stripes-v':
        return Math.floor(col / stripeWidth) % 2;

      case 'center-aisle': {
        const start = Math.floor((cols - aisleWidth) / 2);
        const end = start + aisleWidth;
        return col >= start && col < end ? 1 : 0;
      }

      case 'custom':
        return 0;

      default:
        return 0;
    }
  }

  function buildGrid(cols, rows, pattern, options) {
    const grid = [];
    for (let row = 0; row < rows; row++) {
      const line = [];
      for (let col = 0; col < cols; col++) {
        line.push(getColorIndex(pattern, col, row, cols, rows, options));
      }
      grid.push(line);
    }
    return grid;
  }

  function countByColor(grid, colorCount) {
    const counts = Array(colorCount).fill(0);
    for (const row of grid) {
      for (const idx of row) {
        if (idx < colorCount) counts[idx]++;
      }
    }
    return counts;
  }

  function applySpare(counts, sparePercent) {
    const factor = 1 + sparePercent / 100;
    return counts.map((c) => Math.ceil(c * factor));
  }

  function computeBoxes(tileCounts, tilesPerBox) {
    const perBox = Math.max(1, tilesPerBox);
    return tileCounts.map((c) => Math.ceil(c / perBox));
  }

  function distributeCustom(totalTiles, percents) {
    const p = percents.slice(0, 3);
    const sum = p.reduce((a, b) => a + b, 0) || 100;
    const counts = p.map((pct) => Math.floor((totalTiles * pct) / sum));
    let assigned = counts.reduce((a, b) => a + b, 0);
    let i = 0;
    while (assigned < totalTiles) {
      counts[i % counts.length]++;
      assigned++;
      i++;
    }
    return counts;
  }

  function colorsForPattern(pattern) {
    switch (pattern) {
      case 'solid':
        return 1;
      case 'custom':
        return 3;
      default:
        return 2;
    }
  }

  function calculate(input) {
    const {
      roomWidthM = 0,
      roomLengthM = 0,
      tileWidthCm = 50,
      tileLengthCm = 50,
      tilesPerBox = 20,
      sparePercent = 10,
      pattern = 'solid',
      colors = DEFAULT_COLORS,
      aisleWidth = 2,
      stripeWidth = 1,
      customPercents = [50, 30, 20],
    } = input;

    const gridInfo = computeGrid(roomWidthM, roomLengthM, tileWidthCm, tileLengthCm);
    const { cols, rows, actualWidthM, actualLengthM, areaM2 } = gridInfo;
    const totalTiles = cols * rows;
    const numColors = colorsForPattern(pattern);

    const activeColors = colors.slice(0, numColors).map((c, i) => ({
      name: c.name || `Color ${i + 1}`,
      hex: c.hex || DEFAULT_COLORS[i]?.hex || '#888',
    }));

    let baseCounts;
    let grid;

    if (pattern === 'custom') {
      baseCounts = distributeCustom(totalTiles, customPercents);
      grid = buildGrid(cols, rows, 'solid', { aisleWidth, stripeWidth });
    } else {
      grid = buildGrid(cols, rows, pattern, { aisleWidth, stripeWidth });
      baseCounts = countByColor(grid, numColors);
    }

    const withSpare = applySpare(baseCounts, sparePercent);
    const boxes = computeBoxes(withSpare, tilesPerBox);

    const breakdown = activeColors.map((color, i) => ({
      ...color,
      tiles: baseCounts[i] || 0,
      tilesWithSpare: withSpare[i] || 0,
      boxes: boxes[i] || 0,
      percent: totalTiles ? Math.round(((baseCounts[i] || 0) / totalTiles) * 100) : 0,
    }));

    return {
      cols,
      rows,
      totalTiles,
      totalTilesWithSpare: withSpare.reduce((a, b) => a + b, 0),
      totalBoxes: boxes.reduce((a, b) => a + b, 0),
      areaM2,
      actualWidthM,
      actualLengthM,
      grid,
      colors: activeColors,
      breakdown,
      tilesPerBox,
      sparePercent,
      pattern,
    };
  }

  function drawFloorPlan(canvas, result, options = {}) {
    if (!canvas || !result?.grid) return null;

    const { grid, colors, cols, rows } = result;
    const padding = options.padding ?? 24;
    const maxSize = options.maxSize ?? 480;
    const showGrid = options.showGrid !== false;

    const aspect = cols / rows;
    let drawW, drawH;
    if (aspect >= 1) {
      drawW = maxSize;
      drawH = maxSize / aspect;
    } else {
      drawH = maxSize;
      drawW = maxSize * aspect;
    }

    const cellW = drawW / cols;
    const cellH = drawH / rows;
    canvas.width = drawW + padding * 2;
    canvas.height = drawH + padding * 2;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--canvas-bg').trim() || '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const idx = grid[row][col];
        const color = colors[idx]?.hex || '#888';
        const x = padding + col * cellW;
        const y = padding + row * cellH;

        ctx.fillStyle = color;
        ctx.fillRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1);

        if (showGrid) {
          ctx.strokeStyle = 'rgba(0,0,0,0.15)';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1);
        }
      }
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(padding, padding, drawW, drawH);

    return canvas.toDataURL('image/png');
  }

  global.TileCalc = {
    PATTERNS,
    DEFAULT_COLORS,
    calculate,
    drawFloorPlan,
    computeGrid,
  };
})(typeof window !== 'undefined' ? window : globalThis);
