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

  const FLOOR_TYPE_IMAGES = {
    rejilla: 'images/piso-rejilla.jpg',
    trama: 'images/piso-trama.jpg',
    moneda: 'images/piso-moneda.jpg',
  };

  const FLOOR_TYPE_INFO = {
    rejilla: {
      summary: 'Rejilla abierta con drenaje · 8 baldosas por caja',
      refs: [
        { src: 'images/reference/IMG_8142_b669.jpg', caption: 'Negro, grises y blanco' },
        { src: 'images/reference/IMG_8141_3d33.jpg', caption: 'Naranja, verde, rojo y azul' },
        { src: 'images/reference/IMG_8145_6306.jpg', caption: 'Verde lima' },
      ],
    },
    trama: {
      summary: 'Superficie lisa granulada · 25 baldosas por caja · logo opcional',
      refs: [],
    },
    moneda: {
      summary: 'Puntos tipo moneda · color yute · 25 baldosas por caja',
      refs: [],
    },
  };

  const TILE_SIZE_CM = 40;

  const TILES_PER_BOX_BY_PATTERN = {
    rejilla: 8,
    trama: 25,
    moneda: 25,
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
    '40': { w: TILE_SIZE_CM, l: TILE_SIZE_CM },
  };

  /** Colores por tipo de piso (fotos cliente jul 2026). */
  const NEXA_COLORS_BY_FLOOR_TYPE = {
    moneda: [
      { name: 'Yute', hex: '#C9B89A' },
    ],
    rejilla: [
      { name: 'Azul claro', hex: '#5B9BD5' },
      { name: 'Celeste', hex: '#7EC8E3' },
      { name: 'Verde oscuro', hex: '#2D5A3D' },
      { name: 'Azul oscuro', hex: '#1E3A7A' },
      { name: 'Rojo', hex: '#D32F2F' },
      { name: 'Naranja', hex: '#E85D2B' },
      { name: 'Amarillo', hex: '#F5C518' },
      { name: 'Negro', hex: '#252525' },
      { name: 'Gris oscuro', hex: '#5C5F63' },
      { name: 'Blanco', hex: '#F0F0F0' },
      { name: 'Gris claro', hex: '#B8BCC2' },
    ],
    trama: [
      { name: 'Negro', hex: '#252525' },
      { name: 'Gris oscuro', hex: '#5C5F63' },
      { name: 'Gris claro', hex: '#B8BCC2' },
      { name: 'Blanco', hex: '#F0F0F0' },
    ],
  };

  const NEXA_COLOR_CATALOG = Object.values(NEXA_COLORS_BY_FLOOR_TYPE).flat();

  const DEFAULT_COLORS = NEXA_COLORS_BY_FLOOR_TYPE.rejilla;

  function getColorsForFloorType(floorType) {
    return NEXA_COLORS_BY_FLOOR_TYPE[floorType] || DEFAULT_COLORS;
  }

  function pointInPolygon(x, y, polygon) {
    if (!polygon || polygon.length < 3) return true;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].xM;
      const yi = polygon[i].yM;
      const xj = polygon[j].xM;
      const yj = polygon[j].yM;
      const denom = yj - yi;
      if (denom === 0) continue;
      const intersect = ((yi > y) !== (yj > y))
        && (x < ((xj - xi) * (y - yi)) / denom + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function polygonExclusions(cols, rows, actualWidthM, actualLengthM, polygon) {
    const excluded = new Set();
    if (!polygon || polygon.length < 3 || !cols || !rows) return excluded;
    const cellWidthM = actualWidthM / cols;
    const cellHeightM = actualLengthM / rows;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const xM = (col + 0.5) * cellWidthM;
        const yM = (row + 0.5) * cellHeightM;
        if (!pointInPolygon(xM, yM, polygon)) excluded.add(`${col},${row}`);
      }
    }
    return excluded;
  }

  function mergeExclusions(manualExcluded, polygonExcluded, columnExcluded) {
    const set = parseExcludedCells(manualExcluded);
    if (polygonExcluded?.size) {
      for (const key of polygonExcluded) set.add(key);
    }
    if (columnExcluded?.size) {
      for (const key of columnExcluded) set.add(key);
    }
    return set;
  }

  function normalizeColumnRect(col0, row0, col1, row1) {
    return {
      col0: Math.min(col0, col1),
      row0: Math.min(row0, row1),
      col1: Math.max(col0, col1),
      row1: Math.max(row0, row1),
    };
  }

  function parseColumnRects(data) {
    if (!Array.isArray(data)) return [];
    return data
      .map((item, i) => {
        if (!item) return null;
        const col0 = parseInt(item.col0, 10);
        const row0 = parseInt(item.row0, 10);
        const col1 = parseInt(item.col1, 10);
        const row1 = parseInt(item.row1, 10);
        if ([col0, row0, col1, row1].some((n) => Number.isNaN(n))) return null;
        const rect = normalizeColumnRect(col0, row0, col1, row1);
        return { id: item.id || `col-${i}`, ...rect };
      })
      .filter(Boolean);
  }

  function exclusionsFromColumns(columnRects, cols, rows) {
    const excluded = new Set();
    if (!columnRects?.length || !cols || !rows) return excluded;
    for (const rect of columnRects) {
      const c0 = Math.max(0, rect.col0);
      const r0 = Math.max(0, rect.row0);
      const c1 = Math.min(cols - 1, rect.col1);
      const r1 = Math.min(rows - 1, rect.row1);
      for (let row = r0; row <= r1; row++) {
        for (let col = c0; col <= c1; col++) {
          excluded.add(`${col},${row}`);
        }
      }
    }
    return excluded;
  }

  function columnCellKeys(columnRects, cols, rows) {
    return exclusionsFromColumns(columnRects, cols, rows);
  }

  function columnRectSize(rect) {
    return {
      cols: rect.col1 - rect.col0 + 1,
      rows: rect.row1 - rect.row0 + 1,
      tiles: (rect.col1 - rect.col0 + 1) * (rect.row1 - rect.row0 + 1),
    };
  }

  function metersFromCanvasPoint(canvas, clientX, clientY, cols, rows, actualWidthM, actualLengthM) {
    if (!canvas || !cols || !rows) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const logicalW = parseFloat(canvas.dataset.logicalWidth) || rect.width;
    const logicalH = parseFloat(canvas.dataset.logicalHeight) || rect.height;
    const px = ((clientX - rect.left) / rect.width) * logicalW;
    const py = ((clientY - rect.top) / rect.height) * logicalH;
    const layout = layoutMetrics(cols, rows);
    const { padLeft, padTop, drawW, drawH } = layout;
    const xM = ((px - padLeft) / drawW) * actualWidthM;
    const yM = ((py - padTop) / drawH) * actualLengthM;
    if (xM < 0 || yM < 0 || xM > actualWidthM || yM > actualLengthM) return null;
    return { xM, yM };
  }

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

  function remapForColorCount(idx, colorCount) {
    if (colorCount >= 3) return idx;
    if (colorCount === 1) return 0;
    return idx === 0 ? 0 : 1;
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
    const colorCount = options.colorCount ?? 3;
    const grid = [];
    for (let row = 0; row < rows; row++) {
      const line = [];
      for (let col = 0; col < cols; col++) {
        const raw = getColorIndex(pattern, col, row, cols, rows, options);
        line.push(remapForColorCount(raw, colorCount));
      }
      grid.push(line);
    }
    return grid;
  }

  function tilesPerBoxForPattern(pattern) {
    if (pattern && TILES_PER_BOX_BY_PATTERN[pattern]) return TILES_PER_BOX_BY_PATTERN[pattern];
    return 25;
  }

  function parseExcludedCells(excluded) {
    if (!excluded) return new Set();
    const set = new Set();
    for (const item of excluded) {
      if (typeof item === 'string' && item.includes(',')) {
        set.add(item);
      } else if (Array.isArray(item) && item.length === 2) {
        set.add(`${item[0]},${item[1]}`);
      }
    }
    return set;
  }

  function applyExclusions(grid, cols, rows, excludedSet) {
    if (!excludedSet?.size) return grid;
    return grid.map((row, r) => row.map((cell, c) => (
      excludedSet.has(`${c},${r}`) ? -1 : cell
    )));
  }

  function parseCustomPaint(data) {
    const map = {};
    if (!data) return map;
    if (Array.isArray(data)) {
      for (const item of data) {
        if (item && Number.isInteger(item.col) && Number.isInteger(item.row)) {
          map[`${item.col},${item.row}`] = item.colorIndex ?? 0;
        }
      }
      return map;
    }
    if (typeof data === 'object') {
      for (const [key, val] of Object.entries(data)) {
        if (key.includes(',')) {
          const idx = parseInt(val, 10);
          if (!Number.isNaN(idx)) map[key] = idx;
        }
      }
    }
    return map;
  }

  function applyCustomPaint(grid, customPaint) {
    if (!customPaint || !Object.keys(customPaint).length) return grid;
    return grid.map((row, r) => row.map((cell, c) => {
      if (cell < 0) return cell;
      const key = `${c},${r}`;
      return key in customPaint ? customPaint[key] : cell;
    }));
  }

  function hasCustomPaint(customPaint) {
    return customPaint && Object.keys(customPaint).length > 0;
  }

  function countActiveTiles(grid) {
    let n = 0;
    for (const row of grid) {
      for (const idx of row) {
        if (idx >= 0) n++;
      }
    }
    return n;
  }

  function countByColor(grid, colorCount) {
    const counts = Array(colorCount).fill(0);
    for (const row of grid) {
      for (const idx of row) {
        if (idx >= 0 && idx < colorCount) counts[idx]++;
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

  function colorsForPattern(pattern, colorCount) {
    if (colorCount) return Math.min(3, Math.max(1, colorCount));
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
      tileWidthCm = TILE_SIZE_CM,
      tileLengthCm = TILE_SIZE_CM,
      tilesPerBox: inputTilesPerBox,
      sparePercent = 10,
      pattern = 'rejilla',
      colorCount: inputColorCount,
      colors = DEFAULT_COLORS,
      aisleWidth = 2,
      stripeWidth = 1,
      customPercents = [50, 30, 20],
      excludedCells = [],
      roomPolygon = null,
      customPaint: inputCustomPaint = null,
      columnRects: inputColumnRects = null,
    } = input;

    const tilesPerBox = inputTilesPerBox ?? tilesPerBoxForPattern(pattern);
    const gridInfo = computeGrid(roomWidthM, roomLengthM, tileWidthCm, tileLengthCm);
    const { cols, rows, actualWidthM, actualLengthM, areaM2, coveredM2 } = gridInfo;
    const polygonExcluded = polygonExclusions(cols, rows, actualWidthM, actualLengthM, roomPolygon);
    const columnRects = parseColumnRects(inputColumnRects);
    const columnExcluded = exclusionsFromColumns(columnRects, cols, rows);
    const excludedSet = mergeExclusions(excludedCells, polygonExcluded, columnExcluded);
    const customPaint = parseCustomPaint(inputCustomPaint);
    const numColors = colorsForPattern(pattern, inputColorCount);
    const gridOptions = { aisleWidth, stripeWidth, colorCount: numColors };

    const activeColors = colors.slice(0, numColors).map((c, i) => ({
      name: c.name || DEFAULT_COLORS[i]?.name || `Color ${i + 1}`,
      hex: c.hex || DEFAULT_COLORS[i]?.hex || '#888',
    }));

    let baseCounts;
    let grid;

    if (pattern === 'custom') {
      grid = buildGrid(cols, rows, 'solid', gridOptions);
      grid = applyExclusions(grid, cols, rows, excludedSet);
      const activeTotal = countActiveTiles(grid);
      baseCounts = distributeCustom(activeTotal, customPercents);
    } else {
      grid = buildGrid(cols, rows, pattern, gridOptions);
      grid = applyCustomPaint(grid, customPaint);
      grid = applyExclusions(grid, cols, rows, excludedSet);
      baseCounts = countByColor(grid, numColors);
    }

    const totalTiles = countActiveTiles(grid);
    const excludedCount = cols * rows - totalTiles;

    const withSpare = applySpare(baseCounts, sparePercent);
    const spareCounts = baseCounts.map((c, i) => (withSpare[i] || 0) - c);
    const boxes = computeBoxes(withSpare, tilesPerBox);

    const breakdown = activeColors.map((color, i) => ({
      ...color,
      tiles: baseCounts[i] || 0,
      spareTiles: spareCounts[i] || 0,
      tilesWithSpare: withSpare[i] || 0,
      boxes: boxes[i] || 0,
      percent: totalTiles ? Math.round(((baseCounts[i] || 0) / totalTiles) * 1000) / 10 : 0,
    }));

    return {
      cols,
      rows,
      totalTiles,
      totalSpareTiles: spareCounts.reduce((a, b) => a + b, 0),
      totalTilesWithSpare: withSpare.reduce((a, b) => a + b, 0),
      totalBoxes: boxes.reduce((a, b) => a + b, 0),
      areaM2,
      coveredM2,
      actualWidthM,
      actualLengthM,
      roomWidthM,
      roomLengthM,
      grid,
      colors: activeColors,
      breakdown,
      tilesPerBox,
      sparePercent,
      pattern,
      colorCount: numColors,
      floorType: isFloorType(pattern) ? pattern : null,
      excludedCells: [...excludedSet],
      excludedCount,
      roomPolygon: roomPolygon?.length >= 3 ? roomPolygon.map((p) => ({ ...p })) : null,
      polygonExcludedCount: polygonExcluded.size,
      customPaint: hasCustomPaint(customPaint) ? { ...customPaint } : null,
      isCustomPainted: hasCustomPaint(customPaint),
      columnRects: columnRects.map((r) => ({ ...r })),
      columnCellCount: columnExcluded.size,
    };
  }

  function cellFromPoint(canvas, clientX, clientY, cols, rows) {
    if (!canvas || !cols || !rows) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const logicalW = parseFloat(canvas.dataset.logicalWidth) || rect.width;
    const logicalH = parseFloat(canvas.dataset.logicalHeight) || rect.height;
    const px = ((clientX - rect.left) / rect.width) * logicalW;
    const py = ((clientY - rect.top) / rect.height) * logicalH;
    const { padLeft, padTop, cellW, cellH } = layoutMetrics(cols, rows);
    const col = Math.floor((px - padLeft) / cellW);
    const row = Math.floor((py - padTop) / cellH);
    if (col < 0 || row < 0 || col >= cols || row >= rows) return null;
    return { col, row };
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

    if (pattern === 'trama') {
      const lineColor = idx === 0 ? (colors[1]?.hex || '#444') : (colors[0]?.hex || '#aaa');
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = Math.max(0.5, Math.min(w, h) * 0.12);
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const off = pad + i * ((w - pad * 2) / 2);
        ctx.moveTo(x + off, y + pad);
        ctx.lineTo(x + off, y + h - pad);
      }
      ctx.stroke();
    }
  }

  function formatMetros(m) {
    return `${Number(m || 0).toFixed(2).replace('.', ',')} m`;
  }

  function layoutMetrics(cols, rows, options = {}) {
    const padTop = options.padTop ?? 36;
    const padLeft = options.padLeft ?? 44;
    const padRight = options.padRight ?? 20;
    const padBottom = options.padBottom ?? 20;
    const minCellPx = options.minCellPx ?? 40;
    const maxDim = options.maxSize ?? 2048;
    let drawW = cols * minCellPx;
    let drawH = rows * minCellPx;
    const limit = maxDim - padLeft - padRight;
    if (drawW > limit || drawH > limit) {
      const s = limit / Math.max(drawW, drawH);
      drawW *= s;
      drawH *= s;
    }
    const pixelRatio = options.pixelRatio ?? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    const supersample = options.supersample ?? 2;
    const ratio = pixelRatio * supersample;
    return {
      padTop,
      padLeft,
      padRight,
      padBottom,
      drawW,
      drawH,
      cellW: drawW / cols,
      cellH: drawH / rows,
      ratio,
    };
  }

  function prepareCanvas(canvas, layout) {
    const { padTop, padLeft, padRight, padBottom, drawW, drawH, ratio } = layout;
    const logicalW = drawW + padLeft + padRight;
    const logicalH = drawH + padTop + padBottom;
    canvas.width = Math.round(logicalW * ratio);
    canvas.height = Math.round(logicalH * ratio);
    canvas.style.width = `${logicalW}px`;
    canvas.style.height = `${logicalH}px`;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.imageSmoothingEnabled = true;
    if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = 'high';
    return { ctx, logicalW, logicalH };
  }

  function drawPlanDimensions(ctx, layout, dims, style = 'default') {
    const { padTop, padLeft, drawW, drawH } = layout;
    const { widthM, lengthM, roomWidthM, roomLengthM } = dims;
    const accent = style === 'assembly' ? '#111' : (getComputedStyle(document.documentElement).getPropertyValue('--nexa-blue').trim() || '#002094');
    const fontSize = style === 'assembly'
      ? Math.max(14, Math.min(22, Math.min(drawW, drawH) * 0.06))
      : Math.max(10, Math.min(13, Math.min(drawW, drawH) * 0.04));
    const tick = style === 'assembly' ? 8 : 5;

    ctx.save();
    ctx.strokeStyle = accent;
    ctx.fillStyle = accent;
    ctx.lineWidth = style === 'assembly' ? 2 : 1.25;
    ctx.font = `700 ${fontSize}px Inter, system-ui, sans-serif`;

    const topY = padTop - (style === 'assembly' ? 18 : 12);
    ctx.beginPath();
    ctx.moveTo(padLeft, topY);
    ctx.lineTo(padLeft + drawW, topY);
    ctx.moveTo(padLeft, topY - tick);
    ctx.lineTo(padLeft, topY + tick);
    ctx.moveTo(padLeft + drawW, topY - tick);
    ctx.lineTo(padLeft + drawW, topY + tick);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const widthLabel = style === 'assembly'
      ? formatMetros(widthM).replace(' m', '')
      : `Ancho ${formatMetros(widthM)}${roomWidthM && Math.abs(roomWidthM - widthM) > 0.04 ? ` (pedido ${formatMetros(roomWidthM)})` : ''}`;
    ctx.fillText(widthLabel, padLeft + drawW / 2, topY - 6);

    const leftX = padLeft - (style === 'assembly' ? 16 : 12);
    ctx.beginPath();
    ctx.moveTo(leftX, padTop);
    ctx.lineTo(leftX, padTop + drawH);
    ctx.moveTo(leftX - tick, padTop);
    ctx.lineTo(leftX + tick, padTop);
    ctx.moveTo(leftX - tick, padTop + drawH);
    ctx.lineTo(leftX + tick, padTop + drawH);
    ctx.stroke();

    const lengthLabel = style === 'assembly'
      ? formatMetros(lengthM).replace(' m', '')
      : `Largo ${formatMetros(lengthM)}${roomLengthM && Math.abs(roomLengthM - lengthM) > 0.04 ? ` (pedido ${formatMetros(roomLengthM)})` : ''}`;

    ctx.translate(leftX - 10, padTop + drawH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(lengthLabel, 0, 0);
    ctx.restore();
  }

  function drawRoomPolygonOverlay(ctx, layout, polygon, actualWidthM, actualLengthM, closed) {
    if (!polygon?.length) return;
    const { padLeft, padTop, drawW, drawH } = layout;
    const toX = (xM) => padLeft + (xM / actualWidthM) * drawW;
    const toY = (yM) => padTop + (yM / actualLengthM) * drawH;

    ctx.save();
    ctx.strokeStyle = '#22d3ee';
    ctx.fillStyle = 'rgba(34, 211, 238, 0.08)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash(closed ? [] : [8, 6]);
    ctx.beginPath();
    ctx.moveTo(toX(polygon[0].xM), toY(polygon[0].yM));
    for (let i = 1; i < polygon.length; i++) {
      ctx.lineTo(toX(polygon[i].xM), toY(polygon[i].yM));
    }
    if (closed && polygon.length >= 3) {
      ctx.closePath();
      ctx.fill();
    }
    ctx.stroke();

    for (const p of polygon) {
      ctx.beginPath();
      ctx.arc(toX(p.xM), toY(p.yM), 5, 0, Math.PI * 2);
      ctx.fillStyle = '#22d3ee';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawColumnBlock(ctx, x, y, w, h, label) {
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = Math.max(0.5, Math.min(w, h) * 0.03);
    const step = Math.max(4, Math.min(w, h) * 0.22);
    for (let py = y + step; py < y + h; py += step) {
      ctx.beginPath();
      ctx.moveTo(x + 2, py);
      ctx.lineTo(x + w - 2, py);
      ctx.stroke();
    }
    for (let px = x + step; px < x + w; px += step) {
      ctx.beginPath();
      ctx.moveTo(px, y + 2);
      ctx.lineTo(px, y + h - 2);
      ctx.stroke();
    }
    if (label && w > 18 && h > 14) {
      ctx.fillStyle = '#666';
      ctx.font = `600 ${Math.max(7, Math.min(10, Math.min(w, h) * 0.28))}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x + w / 2, y + h / 2);
    }
  }

  function drawColumnsOverlay(ctx, layout, columnRects, columnPreview, cols, rows) {
    const { padLeft, padTop, cellW, cellH } = layout;
    const drawRect = (rect, alpha, label) => {
      const c0 = Math.max(0, rect.col0);
      const r0 = Math.max(0, rect.row0);
      const c1 = Math.min(cols - 1, rect.col1);
      const r1 = Math.min(rows - 1, rect.row1);
      const x = padLeft + c0 * cellW;
      const y = padTop + r0 * cellH;
      const w = (c1 - c0 + 1) * cellW;
      const h = (r1 - r0 + 1) * cellH;
      ctx.save();
      ctx.globalAlpha = alpha;
      drawColumnBlock(ctx, x, y, w, h, label);
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      ctx.restore();
    };
    (columnRects || []).forEach((rect, i) => drawRect(rect, 0.95, `COL ${i + 1}`));
    if (columnPreview) drawRect(columnPreview, 0.55, 'Nueva');
  }

  function drawFloorPlan(canvas, result, options = {}) {
    if (!canvas || !result?.grid) return null;

    const { grid, colors, cols, rows, pattern, colorCount: planColorCount, actualWidthM, actualLengthM } = result;
    const layout = layoutMetrics(cols, rows, options);
    const { padTop, padLeft, padRight, padBottom, drawW, drawH, cellW, cellH } = layout;
    const { ctx } = prepareCanvas(canvas, layout);
    const showGrid = options.showGrid !== false;
    const showDimensions = options.showDimensions !== false;
    const assemblyMode = options.assemblyMode === true;
    const tilePhoto = options.floorTypeImage;
    const numColors = planColorCount || colors.length;
    const usePhotoTiles = !assemblyMode && tilePhoto && isFloorType(pattern) && numColors <= 1;
    const photoAlpha = 0.82;
    const roomWidthM = options.roomWidthM ?? result.roomWidthM ?? actualWidthM;
    const roomLengthM = options.roomLengthM ?? result.roomLengthM ?? actualLengthM;
    const columnKeys = options.columnCellKeys || columnCellKeys(options.columnRects, cols, rows);

    const bg = assemblyMode ? '#ffffff' : (getComputedStyle(document.documentElement).getPropertyValue('--canvas-bg').trim() || '#141414');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, drawW + padLeft + padRight, drawH + padTop + padBottom);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const idx = grid[row][col];
        const x = padLeft + col * cellW;
        const y = padTop + row * cellH;
        const cw = cellW - 1;
        const ch = cellH - 1;

        if (idx < 0) {
          const isColumn = columnKeys.has(`${col},${row}`);
          if (isColumn) {
            drawColumnBlock(ctx, x + 0.5, y + 0.5, cw, ch, '');
          } else {
            ctx.fillStyle = 'rgba(200, 60, 60, 0.18)';
            ctx.fillRect(x + 0.5, y + 0.5, cw, ch);
            ctx.strokeStyle = 'rgba(200, 60, 60, 0.55)';
            ctx.lineWidth = Math.max(1, Math.min(cellW, cellH) * 0.06);
            ctx.beginPath();
            ctx.moveTo(x + 4, y + 4);
            ctx.lineTo(x + cw - 2, y + ch - 2);
            ctx.moveTo(x + cw - 2, y + 4);
            ctx.lineTo(x + 4, y + ch - 2);
            ctx.stroke();
          }
          if (showGrid) {
            ctx.strokeStyle = 'rgba(0,0,0,0.12)';
            ctx.lineWidth = Math.max(0.5, Math.min(cellW, cellH) * 0.02);
            ctx.strokeRect(x + 0.5, y + 0.5, cw, ch);
          }
          continue;
        }

        ctx.fillStyle = colors[idx]?.hex || '#888';
        ctx.fillRect(x + 0.5, y + 0.5, cw, ch);

        if (usePhotoTiles) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(x + 0.5, y + 0.5, cw, ch);
          ctx.clip();
          ctx.globalAlpha = photoAlpha;
          drawImageCover(ctx, tilePhoto, x, y, cellW, cellH);
          ctx.restore();
        }

        if (!assemblyMode && isFloorType(pattern) && (!usePhotoTiles || numColors > 1)) {
          drawTileDetail(ctx, pattern, idx, x, y, cellW, cellH, colors);
        }

        if (showGrid) {
          ctx.strokeStyle = assemblyMode ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.15)';
          ctx.lineWidth = assemblyMode
            ? Math.max(1, Math.min(cellW, cellH) * 0.04)
            : Math.max(0.5, Math.min(cellW, cellH) * 0.02);
          ctx.strokeRect(x + 0.5, y + 0.5, cw, ch);
        }
      }
    }

    const accent = getComputedStyle(document.documentElement).getPropertyValue('--nexa-blue').trim() || '#002094';
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 2;
    ctx.strokeRect(padLeft, padTop, drawW, drawH);
    ctx.globalAlpha = 1;

    if (showDimensions && actualWidthM && actualLengthM) {
      drawPlanDimensions(ctx, layout, {
        widthM: actualWidthM,
        lengthM: actualLengthM,
        roomWidthM,
        roomLengthM,
      }, assemblyMode ? 'assembly' : 'default');
    }

    const roomPolygon = options.roomPolygon;
    if (roomPolygon?.length) {
      drawRoomPolygonOverlay(
        ctx,
        layout,
        roomPolygon,
        actualWidthM,
        actualLengthM,
        options.roomPolygonClosed !== false
      );
    }

    if (options.columnRects?.length || options.columnPreview) {
      drawColumnsOverlay(ctx, layout, options.columnRects, options.columnPreview, cols, rows);
    }

    canvas.dataset.logicalWidth = String(drawW + padLeft + padRight);
    canvas.dataset.logicalHeight = String(drawH + padTop + padBottom);
    return canvas;
  }

  function drawImageCover(ctx, img, x, y, w, h) {
    const scale = Math.max(w / img.width, h / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    const dx = x + (w - dw) / 2;
    const dy = y + (h - dh) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.clip();
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
  }

  function drawLogoOnPlan(ctx, options, cols, rows, gridX, gridY, cellW, cellH) {
    const logo = options.logo;
    if (!logo?.enabled || !logo.image) return;

    const span = Math.min(logo.span || 1, cols, rows);
    const lc = logo.col ?? Math.floor((cols - span) / 2);
    const lr = logo.row ?? Math.floor((rows - span) / 2);
    const x = gridX + lc * cellW;
    const y = gridY + lr * cellH;
    const w = cellW * span;
    const h = cellH * span;

    ctx.fillStyle = logo.tileBg || '#ffffff';
    ctx.fillRect(x + 0.5, y + 0.5, w - 1, h - 1);

    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

    const margin = Math.min(w, h) * 0.04;
    drawImageCover(ctx, logo.image, x + margin, y + margin, w - margin * 2, h - margin * 2);
  }

  const floorTypeImageCache = {};

  function loadFloorTypeImage(pattern) {
    if (!isFloorType(pattern)) return Promise.resolve(null);
    const src = FLOOR_TYPE_IMAGES[pattern];
    if (!src) return Promise.resolve(null);
    if (floorTypeImageCache[pattern]) return Promise.resolve(floorTypeImageCache[pattern]);
    return loadImage(src)
      .then((img) => {
        floorTypeImageCache[pattern] = img;
        return img;
      })
      .catch(() => null);
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

    const pattern = result.pattern;
    let floorTypeImage = options.floorTypeImage;
    if (!floorTypeImage && isFloorType(pattern)) {
      floorTypeImage = await loadFloorTypeImage(pattern);
    }

    const drawOpts = { ...options, floorTypeImage };
    drawFloorPlan(canvas, result, drawOpts);
    if (!canvas) return null;

    const { cols, rows } = result;
    const layout = layoutMetrics(cols, rows, options);
    const { padTop, padLeft, cellW, cellH, ratio } = layout;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    if (options.logo?.enabled && options.logo.src) {
      try {
        const img = options.logo.image || await loadImage(options.logo.src);
        drawLogoOnPlan(ctx, { ...options, logo: { ...options.logo, image: img } }, cols, rows, padLeft, padTop, cellW, cellH);
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
      const { padTop, padLeft, cellW, cellH, ratio } = layoutMetrics(cols, rows, options);
      const ctx = canvas.getContext('2d');
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      drawLogoOnPlan(ctx, options, cols, rows, padLeft, padTop, cellW, cellH);
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

  function renderAssemblyPlanImage(result, options = {}) {
    const canvas = document.createElement('canvas');
    drawFloorPlan(canvas, result, {
      ...options,
      assemblyMode: true,
      minCellPx: options.minCellPx ?? 36,
      maxSize: options.maxSize ?? 2800,
      showGrid: true,
      showDimensions: true,
      supersample: 2,
    });
    return canvas.toDataURL('image/png');
  }

  global.TileCalc = {
    FLOOR_TYPES,
    FLOOR_TYPE_IMAGES,
    FLOOR_TYPE_INFO,
    PATTERNS,
    TILE_PRESETS,
    TILE_SIZE_CM,
    TILES_PER_BOX_BY_PATTERN,
    NEXA_COLOR_CATALOG,
    NEXA_COLORS_BY_FLOOR_TYPE,
    DEFAULT_COLORS,
    getColorsForFloorType,
    pointInPolygon,
    polygonExclusions,
    parseColumnRects,
    exclusionsFromColumns,
    columnCellKeys,
    columnRectSize,
    normalizeColumnRect,
    parseCustomPaint,
    applyCustomPaint,
    hasCustomPaint,
    renderAssemblyPlanImage,
    calculate,
    drawFloorPlan,
    drawFloorPlanAsync,
    drawFloorPlanSync,
    loadImage,
    loadFloorTypeImage,
    computeGrid,
    dimensionsFromArea,
    getPatternPreview,
    isFloorType,
    tilesPerBoxForPattern,
    cellFromPoint,
    metersFromCanvasPoint,
    layoutMetrics,
  };
})(typeof window !== 'undefined' ? window : globalThis);
