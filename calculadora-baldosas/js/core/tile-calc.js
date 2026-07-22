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

  /** Colores muestreados de producto real (fotos cliente jul 2026). */
  const NEXA_COLOR_CATALOG = [
    { name: 'Beige arena', hex: '#C6B7A2', role: 'moneda' },
    { name: 'Azul', hex: '#1E56A8', role: 'rejilla' },
    { name: 'Negro', hex: '#2A2A2A', role: 'detalle' },
    { name: 'Blanco', hex: '#F0F0F0', role: 'fondo' },
    { name: 'Violeta', hex: '#4B4376', role: 'acento' },
    { name: 'Gris', hex: '#8A8A8A', role: 'trama' },
  ];

  const DEFAULT_COLORS = NEXA_COLOR_CATALOG;

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
    } = input;

    const tilesPerBox = inputTilesPerBox ?? tilesPerBoxForPattern(pattern);
    const excludedSet = parseExcludedCells(excludedCells);
    const gridInfo = computeGrid(roomWidthM, roomLengthM, tileWidthCm, tileLengthCm);
    const { cols, rows, actualWidthM, actualLengthM, areaM2, coveredM2 } = gridInfo;
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

  function drawPlanDimensions(ctx, layout, dims) {
    const { padTop, padLeft, drawW, drawH } = layout;
    const { widthM, lengthM, roomWidthM, roomLengthM } = dims;
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--nexa-blue').trim() || '#002094';
    const fontSize = Math.max(10, Math.min(13, Math.min(drawW, drawH) * 0.04));
    const tick = 5;

    ctx.save();
    ctx.strokeStyle = accent;
    ctx.fillStyle = accent;
    ctx.lineWidth = 1.25;
    ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;

    const topY = padTop - 12;
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
    let widthLabel = `Ancho ${formatMetros(widthM)}`;
    if (roomWidthM && Math.abs(roomWidthM - widthM) > 0.04) {
      widthLabel += ` (pedido ${formatMetros(roomWidthM)})`;
    }
    ctx.fillText(widthLabel, padLeft + drawW / 2, topY - 4);

    const leftX = padLeft - 12;
    ctx.beginPath();
    ctx.moveTo(leftX, padTop);
    ctx.lineTo(leftX, padTop + drawH);
    ctx.moveTo(leftX - tick, padTop);
    ctx.lineTo(leftX + tick, padTop);
    ctx.moveTo(leftX - tick, padTop + drawH);
    ctx.lineTo(leftX + tick, padTop + drawH);
    ctx.stroke();

    let lengthLabel = `Largo ${formatMetros(lengthM)}`;
    if (roomLengthM && Math.abs(roomLengthM - lengthM) > 0.04) {
      lengthLabel += ` (pedido ${formatMetros(roomLengthM)})`;
    }

    ctx.translate(leftX - 8, padTop + drawH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(lengthLabel, 0, 0);
    ctx.restore();
  }

  function drawFloorPlan(canvas, result, options = {}) {
    if (!canvas || !result?.grid) return null;

    const { grid, colors, cols, rows, pattern, colorCount: planColorCount, actualWidthM, actualLengthM } = result;
    const layout = layoutMetrics(cols, rows, options);
    const { padTop, padLeft, padRight, padBottom, drawW, drawH, cellW, cellH } = layout;
    const { ctx } = prepareCanvas(canvas, layout);
    const showGrid = options.showGrid !== false;
    const showDimensions = options.showDimensions !== false;
    const tilePhoto = options.floorTypeImage;
    const numColors = planColorCount || colors.length;
    const usePhotoTiles = tilePhoto && isFloorType(pattern) && numColors <= 1;
    const photoAlpha = 0.82;
    const roomWidthM = options.roomWidthM ?? result.roomWidthM ?? actualWidthM;
    const roomLengthM = options.roomLengthM ?? result.roomLengthM ?? actualLengthM;

    const bg = getComputedStyle(document.documentElement).getPropertyValue('--canvas-bg').trim() || '#141414';
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

        if (isFloorType(pattern) && (!usePhotoTiles || numColors > 1)) {
          drawTileDetail(ctx, pattern, idx, x, y, cellW, cellH, colors);
        }

        if (showGrid) {
          ctx.strokeStyle = 'rgba(0,0,0,0.15)';
          ctx.lineWidth = Math.max(0.5, Math.min(cellW, cellH) * 0.02);
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
      });
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

  global.TileCalc = {
    FLOOR_TYPES,
    FLOOR_TYPE_IMAGES,
    PATTERNS,
    TILE_PRESETS,
    TILE_SIZE_CM,
    TILES_PER_BOX_BY_PATTERN,
    NEXA_COLOR_CATALOG,
    DEFAULT_COLORS,
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
    layoutMetrics,
  };
})(typeof window !== 'undefined' ? window : globalThis);
