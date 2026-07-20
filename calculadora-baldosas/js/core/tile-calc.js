/**
 * Cálculo de grilla de baldosas y dibujo en canvas.
 * Tipos de piso: rejilla, trama, moneda (+ patrones de distribución).
 */
(function (global) {
  'use strict';

  const FLOOR_TYPES = {
    rejilla: 'Rejilla',
    trama: 'Trama',
    moneda: 'Moneda',
  };

  const PATTERNS = {
    rejilla: 'Rejilla',
    trama: 'Trama',
    moneda: 'Moneda',
    solid: 'Sólido',
    'border-center': 'Marco + centro',
    checkerboard: 'Damero',
    'stripes-h': 'Rayas horizontales',
    'stripes-v': 'Rayas verticales',
    'center-aisle': 'Carril central',
    'transverse-aisle': 'Carril transversal',
    custom: 'Personalizado',
  };

  const TILE_PRESETS = {
    '40': { w: 40, l: 40 },
    '50': { w: 50, l: 50 },
    '60': { w: 60, l: 60 },
  };

  const DEFAULT_COLORS = [
    { name: 'Gris', hex: '#7a7a7a', role: 'fondo' },
    { name: 'Negro', hex: '#1a1a1a', role: 'detalle' },
    { name: 'Rojo', hex: '#c41e1e', role: 'acento' },
  ];

  function metersToCm(m) {
    return m * 100;
  }

  function computeGrid(roomWidthM, roomLengthM, tileWidthCm, tileLengthCm) {
    const cols = Math.max(1, Math.ceil(metersToCm(roomWidthM) / tileWidthCm));
    const rows = Math.max(1, Math.ceil(metersToCm(roomLengthM) / tileLengthCm));
    const actualWidthM = (cols * tileWidthCm) / 100;
    const actualLengthM = (rows * tileLengthCm) / 100;
    const areaM2 = roomWidthM * roomLengthM;
    const coveredM2 = actualWidthM * actualLengthM;
    return { cols, rows, actualWidthM, actualLengthM, areaM2, coveredM2 };
  }

  function dimensionsFromArea(areaM2, aspectRatio = 1) {
    const w = Math.sqrt(areaM2 * aspectRatio);
    const l = areaM2 / w;
    return { roomWidthM: w, roomLengthM: l };
  }

  /** Rejilla: módulo 3×3 — gris fondo, negro líneas, rojo en cruces */
  function colorRejilla(col, row) {
    const onH = row % 3 === 1;
    const onV = col % 3 === 1;
    if (onH && onV) return 2;
    if (onH || onV) return 1;
    return 0;
  }

  /** Trama: tejido 2×2 alternado — gris / negro / rojo */
  function colorTrama(col, row) {
    const bx = Math.floor(col / 2);
    const by = Math.floor(row / 2);
    if ((bx + by) % 2 === 0) return 0;
    return (col + row) % 2 === 0 ? 1 : 2;
  }

  /** Moneda: puntos escalonados sobre fondo gris */
  function colorMoneda(col, row) {
    const period = 4;
    const offset = row % 2 === 0 ? 1 : 3;
    const nearDotCol = (col - offset + period * 100) % period === 0;
    const nearDotRow = row % 2 === 0 ? row % period === 0 : row % period === 2;
    if (nearDotCol && nearDotRow) return (Math.floor(col / period) + Math.floor(row / period)) % 2 === 0 ? 1 : 2;
    if (nearDotCol || (row % period === 1 && col % 2 === row % 2)) return 0;
    return 0;
  }

  function getColorIndex(pattern, col, row, cols, rows, options) {
    const { aisleWidth = 2, stripeWidth = 1 } = options;

    switch (pattern) {
      case 'rejilla':
        return colorRejilla(col, row);
      case 'trama':
        return colorTrama(col, row);
      case 'moneda':
        return colorMoneda(col, row);
      case 'solid':
        return 0;
      case 'border-center':
        if (col === 0 || col === cols - 1 || row === 0 || row === rows - 1) return 1;
        return 0;
      case 'checkerboard':
        return (col + row) % 2 === 0 ? 0 : 1;
      case 'stripes-h':
        return Math.floor(row / stripeWidth) % 2 === 0 ? 0 : 1;
      case 'stripes-v':
        return Math.floor(col / stripeWidth) % 2 === 0 ? 0 : 1;
      case 'center-aisle': {
        const start = Math.floor((cols - aisleWidth) / 2);
        return col >= start && col < start + aisleWidth ? 1 : 0;
      }
      case 'transverse-aisle': {
        const start = Math.floor((rows - aisleWidth) / 2);
        return row >= start && row < start + aisleWidth ? 1 : 0;
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
    if (['rejilla', 'trama', 'moneda', 'custom'].includes(pattern)) return 3;
    if (pattern === 'solid') return 1;
    return 2;
  }

  function isFloorType(pattern) {
    return pattern in FLOOR_TYPES;
  }

  function calculate(input) {
    const {
      roomWidthM = 0,
      roomLengthM = 0,
      tileWidthCm = 50,
      tileLengthCm = 50,
      tilesPerBox = 4,
      sparePercent = 10,
      pattern = 'rejilla',
      colors = DEFAULT_COLORS,
      aisleWidth = 2,
      stripeWidth = 1,
      customPercents = [50, 30, 20],
    } = input;

    const gridInfo = computeGrid(roomWidthM, roomLengthM, tileWidthCm, tileLengthCm);
    const { cols, rows, actualWidthM, actualLengthM, areaM2, coveredM2 } = gridInfo;
    const totalTiles = cols * rows;
    const numColors = colorsForPattern(pattern);

    const activeColors = colors.slice(0, numColors).map((c, i) => ({
      name: c.name || DEFAULT_COLORS[i]?.name || `Color ${i + 1}`,
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
      percent: totalTiles ? Math.round(((baseCounts[i] || 0) / totalTiles) * 1000) / 10 : 0,
    }));

    return {
      cols,
      rows,
      totalTiles,
      totalTilesWithSpare: withSpare.reduce((a, b) => a + b, 0),
      totalBoxes: boxes.reduce((a, b) => a + b, 0),
      areaM2,
      coveredM2,
      actualWidthM,
      actualLengthM,
      grid,
      colors: activeColors,
      breakdown,
      tilesPerBox,
      sparePercent,
      pattern,
      floorType: isFloorType(pattern) ? pattern : null,
    };
  }

  function drawTileDetail(ctx, pattern, idx, x, y, w, h, colors) {
    const pad = Math.max(1, Math.min(w, h) * 0.08);
    const cx = x + w / 2;
    const cy = y + h / 2;

    if (pattern === 'moneda' && idx > 0) {
      const r = Math.min(w, h) * 0.32;
      ctx.fillStyle = colors[idx]?.hex || '#888';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
      return;
    }

    if (pattern === 'rejilla' && idx === 1) {
      ctx.fillStyle = colors[idx]?.hex || '#888';
      const thick = Math.max(1, Math.min(w, h) * 0.18);
      if (w > h) ctx.fillRect(x + pad, y + h / 2 - thick / 2, w - pad * 2, thick);
      else ctx.fillRect(x + w / 2 - thick / 2, y + pad, thick, h - pad * 2);
    }

    if (pattern === 'trama' && idx > 0) {
      ctx.strokeStyle = colors[idx]?.hex || '#888';
      ctx.lineWidth = Math.max(0.5, Math.min(w, h) * 0.1);
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const off = pad + i * ((w - pad * 2) / 2);
        ctx.moveTo(x + off, y + pad);
        ctx.lineTo(x + off, y + h - pad);
      }
      ctx.stroke();
    }
  }

  function drawFloorPlan(canvas, result, options = {}) {
    if (!canvas || !result?.grid) return null;

    const { grid, colors, cols, rows, pattern } = result;
    const padding = options.padding ?? 20;
    const maxSize = options.maxSize ?? 520;
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
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--canvas-bg').trim() || '#141414';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const idx = grid[row][col];
        const color = colors[idx]?.hex || '#888';
        const x = padding + col * cellW;
        const y = padding + row * cellH;

        ctx.fillStyle = color;
        ctx.fillRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1);

        if (isFloorType(pattern)) {
          drawTileDetail(ctx, pattern, idx, x, y, cellW, cellH, colors);
        }

        if (showGrid) {
          ctx.strokeStyle = 'rgba(0,0,0,0.2)';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1);
        }
      }
    }

    ctx.strokeStyle = 'rgba(255, 200, 0, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(padding, padding, drawW, drawH);

    return canvas;
  }

  function drawLogoOnPlan(ctx, options, cols, rows, padding, cellW, cellH) {
    const logo = options.logo;
    if (!logo?.enabled || !logo.image) return;

    const lc = logo.col ?? Math.floor((cols - 1) / 2);
    const lr = logo.row ?? Math.floor((rows - 1) / 2);
    const x = padding + lc * cellW;
    const y = padding + lr * cellH;

    ctx.fillStyle = logo.tileBg || '#ffffff';
    ctx.fillRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1);

    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1);

    const inset = Math.min(cellW, cellH) * 0.12;
    ctx.drawImage(logo.image, x + inset, y + inset, cellW - inset * 2, cellH - inset * 2);
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  async function drawFloorPlanAsync(canvas, result, options = {}) {
    if (!canvas || !result?.grid) return null;

    const temp = drawFloorPlan(canvas, result, options);
    if (!temp) return null;

    const { cols, rows, pattern } = result;
    const padding = options.padding ?? 20;
    const maxSize = options.maxSize ?? 520;
    const aspect = cols / rows;
    let drawW, drawH;
    if (aspect >= 1) { drawW = maxSize; drawH = maxSize / aspect; }
    else { drawH = maxSize; drawW = maxSize * aspect; }
    const cellW = drawW / cols;
    const cellH = drawH / rows;

    const ctx = canvas.getContext('2d');

    if (options.logo?.enabled && options.logo.src) {
      try {
        const img = options.logo.image || await loadImage(options.logo.src);
        drawLogoOnPlan(ctx, { ...options, logo: { ...options.logo, image: img } }, cols, rows, padding, cellW, cellH);
      } catch {
        /* logo no cargó */
      }
    }

    return canvas.toDataURL('image/png');
  }

  function drawFloorPlanSync(canvas, result, options = {}) {
    drawFloorPlan(canvas, result, options);
    if (options.logo?.enabled && options.logo.image) {
      const { cols, rows } = result;
      const padding = options.padding ?? 20;
      const maxSize = options.maxSize ?? 520;
      const aspect = cols / rows;
      let drawW, drawH;
      if (aspect >= 1) { drawW = maxSize; drawH = maxSize / aspect; }
      else { drawH = maxSize; drawW = maxSize * aspect; }
      const cellW = drawW / cols;
      const cellH = drawH / rows;
      drawLogoOnPlan(canvas.getContext('2d'), options, cols, rows, padding, cellW, cellH);
    }
    return canvas.toDataURL('image/png');
  }

  function getPatternPreview(pattern, size = 48) {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    const cells = 6;
    const cell = size / cells;
    const colors = DEFAULT_COLORS;

    for (let row = 0; row < cells; row++) {
      for (let col = 0; col < cells; col++) {
        const idx = getColorIndex(pattern, col, row, cells, cells, { aisleWidth: 2, stripeWidth: 1 });
        ctx.fillStyle = colors[idx]?.hex || '#888';
        ctx.fillRect(col * cell, row * cell, cell, cell);
        if (isFloorType(pattern)) {
          drawTileDetail(ctx, pattern, idx, col * cell, row * cell, cell, cell, colors);
        }
      }
    }
    return c.toDataURL();
  }

  global.TileCalc = {
    FLOOR_TYPES,
    PATTERNS,
    TILE_PRESETS,
    DEFAULT_COLORS,
    calculate,
    drawFloorPlan,
    drawFloorPlanAsync,
    drawFloorPlanSync,
    loadImage,
    computeGrid,
    dimensionsFromArea,
    getPatternPreview,
    isFloorType,
  };
})(typeof window !== 'undefined' ? window : globalThis);
