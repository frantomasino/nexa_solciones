/**
 * Orquestación: vistas, formularios, eventos y cálculo en vivo.
 */
(function () {
  'use strict';

  const DEBOUNCE_MS = 300;

  let currentId = null;
  let measureSession = null;
  let debounceTimer = null;
  let lastResult = null;
  let selectedPattern = null;
  let colorCount = null;
  let logoImageData = null;
  let logoImageEl = null;
  let deferredInstallPrompt = null;
  let planViewerControls = null;
  let excludedCells = new Set();
  let obstacleMode = false;
  let shapeMode = false;
  let roomPolygon = [];
  let shapeClosed = false;
  let roomShapeType = 'rect';
  let activeColorSlot = 1;
  let planNeedsFitView = true;
  let paintMode = false;
  let activePaintIndex = 0;
  let customPaint = {};
  let isPaintingDrag = false;
  let columnRects = [];
  let columnMode = false;
  let columnDragStart = null;
  let columnPreview = null;
  let isColumnDragging = false;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  function debounce(fn) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fn, DEBOUNCE_MS);
  }

  function defaultFormState() {
    return {
      cliente: '',
      referencia: '',
      link: '',
      notas: '',
      roomWidthM: 0,
      roomLengthM: 0,
      areaM2: 0,
      tileWidthCm: TileCalc.TILE_SIZE_CM,
      tileLengthCm: TileCalc.TILE_SIZE_CM,
      tilesPerBox: TileCalc.tilesPerBoxForPattern(null),
      sparePercent: 10,
      pattern: null,
      colorCount: null,
      colors: TileCalc.DEFAULT_COLORS.map((c) => ({ ...c })),
      measureMethod: 'manual',
      logoEnabled: false,
      logoImage: null,
      logoTileBg: '#ffffff',
      logoSpan: 1,
      photoThumb: null,
    };
  }

  function clearMeasureFields() {
    ['#roomWidth', '#roomLength', '#areaInput', '#photoRoomWidth', '#photoRoomLength'].forEach((id) => {
      const el = $(id);
      if (el) el.value = '';
    });
    if ($('#areaFromDims')) $('#areaFromDims').textContent = '—';
    if ($('#photoAreaFromDims')) $('#photoAreaFromDims').textContent = '—';
  }

  function resetEditorForNew() {
    lastResult = null;
    logoImageData = null;
    logoImageEl = null;
    selectedPattern = null;
    colorCount = null;
    if ($('#logoFile')) $('#logoFile').value = '';
    if ($('#photoFile')) $('#photoFile').value = '';
    excludedCells = new Set();
    obstacleMode = false;
    shapeMode = false;
    roomPolygon = [];
    shapeClosed = false;
    roomShapeType = 'rect';
    planNeedsFitView = true;
    paintMode = false;
    customPaint = {};
    activePaintIndex = 0;
    columnRects = [];
    columnMode = false;
    columnDragStart = null;
    columnPreview = null;
    isColumnDragging = false;
    clearMeasureFields();
    measureSession?.clearImage();
    setPhotoFileName('Ninguna foto');
    updateLogoPanel();
    updateTilesPerBoxUI();
    updatePatternSelection();
    setColorCount(null);
    updateCanvasPlaceholder();
    renderResults(null);
    updateShapeStatus();
    setShapeTypeUI('rect');
  }

  function readForm() {
    return {
      cliente: $('#cliente').value.trim(),
      referencia: $('#referencia').value.trim(),
      link: $('#link').value.trim(),
      notas: $('#notas').value.trim(),
      roomWidthM: parseFloat($('#roomWidth').value) || 0,
      roomLengthM: parseFloat($('#roomLength').value) || 0,
      areaM2: parseFloat($('#areaInput')?.value) || 0,
      tileWidthCm: TileCalc.TILE_SIZE_CM,
      tileLengthCm: TileCalc.TILE_SIZE_CM,
      tilesPerBox: selectedPattern ? TileCalc.tilesPerBoxForPattern(selectedPattern) : parseInt($('#tilesPerBox').value, 10) || 25,
      excludedCells: [...excludedCells],
      columnRects: columnRects.map((r) => ({ ...r })),
      roomPolygon: shapeClosed && roomPolygon.length >= 3 ? roomPolygon.map((p) => ({ ...p })) : null,
      roomShapeType: shapeClosed ? roomShapeType : 'rect',
      customPaint: TileCalc.hasCustomPaint(customPaint) ? { ...customPaint } : null,
      sparePercent: parseFloat($('#sparePercent').value) || 0,
      pattern: selectedPattern,
      colorCount,
      colors: [
        { name: $('#color1Name').value, hex: $('#color1Hex').value },
        { name: $('#color2Name').value, hex: $('#color2Hex').value },
        { name: $('#color3Name').value, hex: $('#color3Hex').value },
      ],
      measureMethod: document.querySelector('.measure-tab.active')?.dataset.tab || 'manual',
      logoEnabled: $('#logoEnabled')?.checked || false,
      logoImage: logoImageData,
      logoTileBg: $('#logoTileBg')?.value || '#ffffff',
      logoSpan: parseInt($('#logoSpan')?.value, 10) || 1,
      photoThumb: $('#photoThumbData').value || null,
    };
  }

  function updateAreaFromDims() {
    const w = parseFloat($('#roomWidth').value) || 0;
    const l = parseFloat($('#roomLength').value) || 0;
    if (!w || !l) {
      $('#areaFromDims').textContent = '—';
      syncDimsToPhotoPanel();
      return;
    }
    const area = w * l;
    $('#areaFromDims').textContent = `${area.toFixed(2)} m²`;
    if ($('#areaInput')) $('#areaInput').value = area.toFixed(2);
    syncDimsToPhotoPanel();
  }

  function syncDimsToPhotoPanel() {
    const w = $('#roomWidth')?.value ?? '';
    const l = $('#roomLength')?.value ?? '';
    if ($('#photoRoomWidth')) $('#photoRoomWidth').value = w;
    if ($('#photoRoomLength')) $('#photoRoomLength').value = l;
    const pw = parseFloat(w) || 0;
    const pl = parseFloat(l) || 0;
    if ($('#photoAreaFromDims')) {
      $('#photoAreaFromDims').textContent = pw && pl ? `${(pw * pl).toFixed(2)} m²` : '—';
    }
  }

  function applyPhotoManualDims() {
    const w = parseFloat($('#photoRoomWidth')?.value) || 0;
    const l = parseFloat($('#photoRoomLength')?.value) || 0;
    measureSession?.resetContour();
    if ($('#photoAreaFromDims')) {
      $('#photoAreaFromDims').textContent = w && l ? `${(w * l).toFixed(2)} m²` : '—';
    }
    if (!w || !l) return;
    $('#roomWidth').value = w.toFixed(2);
    $('#roomLength').value = l.toFixed(2);
    updateAreaFromDims();
    debounce(recalculate);
  }

  function syncPhotoManualToMain() {
    const pw = parseFloat($('#photoRoomWidth')?.value) || 0;
    const pl = parseFloat($('#photoRoomLength')?.value) || 0;
    if (!pw || !pl) return;
    $('#roomWidth').value = pw.toFixed(2);
    $('#roomLength').value = pl.toFixed(2);
    updateAreaFromDims();
  }

  function applyPhotoMeasureDims(result) {
    if (!result?.ready) return;
    $('#roomWidth').value = result.widthM.toFixed(2);
    $('#roomLength').value = result.lengthM.toFixed(2);
    if ($('#areaInput')) $('#areaInput').value = result.areaM2.toFixed(2);
    const poly = TileCalc.contourPointsToPolygon(result.contourPoints, result.scale);
    if (poly?.length >= 3) {
      roomPolygon = poly;
      shapeClosed = true;
      roomShapeType = 'draw';
      setShapeTypeUI('draw');
    }
    updateAreaFromDims();
    updateShapeStatus();
    debounce(recalculate);
  }

  function setShapeTypeUI(type) {
    roomShapeType = type || 'rect';
    $$('.shape-type-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.shape === roomShapeType);
    });
    $('#shapeOptionsL')?.classList.toggle('hidden', roomShapeType !== 'l');
    $('#shapeOptionsCircle')?.classList.toggle('hidden', roomShapeType !== 'circle');
    $('#shapeOptionsDraw')?.classList.toggle('hidden', roomShapeType !== 'draw');
  }

  function applyRectangleShape() {
    roomPolygon = [];
    shapeClosed = false;
    roomShapeType = 'rect';
    setShapeTypeUI('rect');
    setPlanInteractionMode('none');
    updateShapeStatus();
    debounce(recalculate);
  }

  function applyCircleShape() {
    const w = parseFloat($('#roomWidth').value) || 0;
    const l = parseFloat($('#roomLength').value) || 0;
    if (w <= 0 || l <= 0) {
      alert('Primero ingresá ancho y largo del rectángulo que envuelve el círculo.');
      $('#roomWidth').focus();
      return;
    }
    const diameter = parseFloat($('#circleDiameter')?.value) || 0;
    roomPolygon = TileCalc.createCirclePolygon(w, l, diameter);
    shapeClosed = true;
    roomShapeType = 'circle';
    shapeMode = false;
    setShapeTypeUI('circle');
    setPlanInteractionMode('none');
    updateShapeStatus();
    debounce(recalculate);
    setTimeout(() => $('#planViewer')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 200);
  }

  function applyAreaInput() {
    const area = parseFloat($('#areaInput').value);
    if (!area || area <= 0) return;
    const w = parseFloat($('#roomWidth').value) || 0;
    const l = parseFloat($('#roomLength').value) || 0;
    if (w > 0 && l > 0) return;
    $('#areaFromDims').textContent = `${area.toFixed(2)} m² (ingresá ancho y largo)`;
  }

  function updateTilesPerBoxUI() {
    const perBox = selectedPattern ? TileCalc.tilesPerBoxForPattern(selectedPattern) : null;
    const display = $('#tilesPerBoxDisplay');
    const hidden = $('#tilesPerBox');
    if (!display || !hidden) return;
    if (!perBox) {
      display.textContent = '—';
      return;
    }
    display.textContent = `${perBox} u.`;
    hidden.value = String(perBox);
  }

  function updateLogoPanel() {
    const isTrama = selectedPattern === 'trama';
    $('#logoPanel')?.classList.toggle('hidden', !isTrama);
    if (!isTrama && $('#logoEnabled')?.checked) {
      $('#logoEnabled').checked = false;
      setLogoPreview(null);
    }
    updateLogoUI();
  }

  function excludedKey(col, row) {
    return `${col},${row}`;
  }

  function toggleExcludedCell(col, row) {
    const key = excludedKey(col, row);
    if (excludedCells.has(key)) excludedCells.delete(key);
    else excludedCells.add(key);
    updateObstacleUI();
    debounce(recalculate);
  }

  function clearExcludedCells() {
    excludedCells.clear();
    updateObstacleUI();
    debounce(recalculate);
  }

  function createLShapePolygon(widthM, lengthM, cutWidthM, cutLengthM) {
    const cutW = Math.min(widthM - 0.1, Math.max(0.1, cutWidthM));
    const cutL = Math.min(lengthM - 0.1, Math.max(0.1, cutLengthM));
    return [
      { xM: 0, yM: 0 },
      { xM: cutW, yM: 0 },
      { xM: cutW, yM: cutL },
      { xM: widthM, yM: cutL },
      { xM: widthM, yM: lengthM },
      { xM: 0, yM: lengthM },
    ];
  }

  function updateShapeStatus() {
    const el = $('#shapeStatus');
    if (!el) return;
    const showClear = shapeClosed && roomPolygon.length >= 3;
    $('#btnShapeClear')?.classList.toggle('hidden', !showClear);
    $('#btnShapeClose')?.classList.toggle('hidden', !shapeMode || roomPolygon.length < 3 || shapeClosed);
    $('#btnShapeUndo')?.classList.toggle('hidden', !shapeMode || roomPolygon.length === 0);
    $('#btnShapeDraw')?.classList.toggle('active', shapeMode);
    $('#planShapeClose')?.classList.toggle('hidden', !shapeMode || roomPolygon.length < 3 || shapeClosed);
    $('#planShapeUndo')?.classList.toggle('hidden', !shapeMode || roomPolygon.length === 0);
    $('#planShapeClear')?.classList.toggle('hidden', !showClear);

    if (!shapeClosed || !roomPolygon.length) {
      el.textContent = 'Rectángulo completo — todo el plano lleva baldosas.';
      el.classList.remove('active');
      return;
    }
    el.classList.add('active');
    const outside = lastResult?.polygonExcludedCount ?? 0;
    const shapeLabel = roomShapeType === 'circle' ? 'Círculo'
      : roomShapeType === 'l' ? 'Forma en L'
      : roomShapeType === 'draw' ? 'Contorno dibujado'
      : 'Forma personalizada';
    if (shapeMode) {
      el.textContent = `Dibujando contorno: ${roomPolygon.length} punto(s) en el plano · mínimo 3 · luego «Cerrar forma».`;
    } else {
      el.textContent = `${shapeLabel} activo · ${outside} baldosas fuera del piso (gris en el plano).`;
    }
  }

  function applyLShapePreset() {
    const w = parseFloat($('#roomWidth').value) || 0;
    const l = parseFloat($('#roomLength').value) || 0;
    if (w <= 0 || l <= 0) {
      alert('Primero ingresá ancho y largo del ambiente (el rectángulo que envuelve la L).');
      $('#roomWidth').focus();
      return;
    }
    const cutW = parseFloat($('#lShapeCutWidth')?.value) || w * 0.6;
    const cutL = parseFloat($('#lShapeCutLength')?.value) || l * 0.5;
    roomPolygon = createLShapePolygon(w, l, cutW, cutL);
    shapeClosed = true;
    roomShapeType = 'l';
    shapeMode = false;
    setShapeTypeUI('l');
    planNeedsFitView = true;
    setPlanInteractionMode('none');
    updateShapeStatus();
    debounce(recalculate);
    if (!selectedPattern || !colorCount) {
      alert('Forma en L aplicada. Elegí tipo de piso y colores para ver el plano.');
    } else {
      setTimeout(() => $('#planViewer')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 200);
    }
  }

  function startShapeDrawing() {
    if (!lastResult) {
      alert('Primero cargá medidas, tipo de piso y colores para ver el plano.');
      return;
    }
    setPlanInteractionMode('shape');
    roomShapeType = 'draw';
    setShapeTypeUI('draw');
    updateShapeStatus();
    $('#planViewer')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function updateColumnUI() {
    const n = columnRects.length;
    const tiles = lastResult?.columnCellCount ?? columnRects.reduce((sum, r) => sum + TileCalc.columnRectSize(r).tiles, 0);
    $('#planColumnToggle')?.classList.toggle('active', columnMode);
    $('#planColumnClear')?.classList.toggle('hidden', n === 0);
    const list = $('#columnList');
    if (list) {
      if (!n) {
        list.innerHTML = '';
        list.classList.add('hidden');
      } else {
        list.classList.remove('hidden');
        list.innerHTML = columnRects.map((rect, i) => {
          const size = TileCalc.columnRectSize(rect);
          return `
            <div class="column-list-item">
              <span>Columna ${i + 1}: ${size.cols}×${size.rows} (${size.tiles} bald.)</span>
              <button type="button" class="btn btn-sm btn-ghost column-remove-btn" data-col-idx="${i}" title="Quitar columna">✕</button>
            </div>`;
        }).join('');
      }
    }
    const summary = $('#columnSummary');
    if (summary) {
      summary.textContent = n
        ? `${n} columna(s) · ${tiles} baldosa(s) sin piso`
        : 'Arrastrá en el plano para marcar el rectángulo de cada columna o pilar.';
    }
    updateObstacleUI();
  }

  function updateObstacleUI() {
    const n = excludedCells.size;
    const colN = columnRects.length;
    const polyN = shapeClosed && roomPolygon.length >= 3 ? (lastResult?.polygonExcludedCount ?? 0) : 0;
    $('#planObstacleClear')?.classList.toggle('hidden', n === 0);
    $('#planObstacleToggle')?.classList.toggle('active', obstacleMode);
    $('#planShapeToggle')?.classList.toggle('active', shapeMode);
    $('#planShapeClose')?.classList.toggle('hidden', !shapeMode || roomPolygon.length < 3 || shapeClosed);
    $('#planShapeUndo')?.classList.toggle('hidden', !shapeMode || roomPolygon.length === 0);
    $('#planShapeClear')?.classList.toggle('hidden', roomPolygon.length === 0 && !shapeClosed);
    const hint = $('#planViewerHint');
    if (hint && lastResult) {
      if (shapeMode) {
        hint.textContent = shapeClosed
          ? `Forma cerrada: ${roomPolygon.length} vértices · ${polyN} baldosas fuera del contorno. Tocá Forma para editar.`
          : `Modo forma: tocá el plano para marcar vértices (${roomPolygon.length} puntos). Mínimo 3, luego «Cerrar forma».`;
      } else if (columnMode) {
        hint.textContent = `Modo columnas: arrastrá en el plano para dibujar cada pilar o columna (${colN} marcada(s)). Las baldosas alrededor siguen el diseño.`;
      } else if (obstacleMode) {
        hint.textContent = `Modo obstáculos: tocá baldosas sueltas para marcar zonas sin piso (${n} marcadas).`;
      } else if (paintMode) {
        hint.textContent = `Modo pintar: elegí un color abajo y tocá baldosas en el plano. Se van sumando en tiempo real.`;
      } else if (shapeClosed || colN > 0) {
        const parts = [];
        if (shapeClosed) parts.push(`forma irregular (${roomPolygon.length} vértices)`);
        if (colN > 0) parts.push(`${colN} columna(s)`);
        hint.textContent = `Plano con ${parts.join(' y ')}. Usá las herramientas de arriba para ajustar.`;
      } else {
        hint.textContent = 'Arrastrá para mover · Zoom +/− · <strong>Columnas</strong> para pilares · <strong>Pintar</strong> para el diseño';
      }
    }
  }

  function setPlanInteractionMode(mode) {
    obstacleMode = mode === 'obstacle';
    shapeMode = mode === 'shape';
    paintMode = mode === 'paint';
    columnMode = mode === 'column';
    columnDragStart = null;
    columnPreview = null;
    isColumnDragging = false;
    $('#planStage')?.classList.toggle('obstacle-mode', obstacleMode);
    $('#planStage')?.classList.toggle('shape-mode', shapeMode);
    $('#planStage')?.classList.toggle('paint-mode', paintMode);
    $('#planStage')?.classList.toggle('column-mode', columnMode);
    $('#btnShapeDraw')?.classList.toggle('active', shapeMode);
    $('#planPaintToggle')?.classList.toggle('active', paintMode);
    $('#paintToolbar')?.classList.toggle('hidden', !paintMode);
    $('#columnToolbar')?.classList.toggle('hidden', !columnMode);
    updateShapeStatus();
    updatePaintUI();
    updateColumnUI();
    if (lastResult) redrawPlan();
  }

  function clearColumnRects() {
    columnRects = [];
    columnDragStart = null;
    columnPreview = null;
    isColumnDragging = false;
    updateColumnUI();
    debounce(recalculate);
  }

  function removeColumnRect(index) {
    if (index < 0 || index >= columnRects.length) return;
    columnRects.splice(index, 1);
    updateColumnUI();
    debounce(recalculate);
  }

  function startColumnMode() {
    if (!lastResult) {
      alert('Primero cargá medidas, tipo de piso y colores para ver el plano.');
      return;
    }
    setPlanInteractionMode('column');
    $('#planViewer')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function updateColumnPreview(endCol, endRow) {
    if (!columnDragStart) return;
    columnPreview = TileCalc.normalizeColumnRect(
      columnDragStart.col,
      columnDragStart.row,
      endCol,
      endRow
    );
    redrawPlan();
  }

  function finishColumnDrag(endCol, endRow) {
    if (!columnDragStart) return;
    const rect = TileCalc.normalizeColumnRect(
      columnDragStart.col,
      columnDragStart.row,
      endCol,
      endRow
    );
    columnRects.push({ id: `col-${Date.now()}`, ...rect });
    columnDragStart = null;
    columnPreview = null;
    isColumnDragging = false;
    updateColumnUI();
    debounce(recalculate);
  }

  async function redrawPlan() {
    if (!lastResult) return;
    const canvas = $('#floorCanvas');
    await TileCalc.drawFloorPlanAsync(canvas, lastResult, getDrawOptions(readForm()));
  }

  function paintCell(col, row, colorIndex) {
    const key = `${col},${row}`;
    if (lastResult?.grid?.[row]?.[col] < 0) return;
    customPaint[key] = colorIndex;
    updatePaintUI();
    debounce(recalculate);
  }

  function clearCustomPaint() {
    customPaint = {};
    updatePaintUI();
    debounce(recalculate);
  }

  function buildPaintBrushes() {
    const wrap = $('#paintBrushes');
    if (!wrap) return;
    const n = colorCount || 1;
    const colors = [
      { name: $('#color1Name')?.value, hex: $('#color1Hex')?.value },
      { name: $('#color2Name')?.value, hex: $('#color2Hex')?.value },
      { name: $('#color3Name')?.value, hex: $('#color3Hex')?.value },
    ];
    wrap.innerHTML = Array.from({ length: n }, (_, i) => `
      <button type="button" class="paint-brush-btn${i === activePaintIndex ? ' active' : ''}" data-paint-idx="${i}" title="${escapeHtml(colors[i]?.name || `Color ${i + 1}`)}">
        <span class="paint-brush-swatch" style="background:${colors[i]?.hex || '#888'}"></span>
        <span class="paint-brush-label">${escapeHtml(colors[i]?.name || `Color ${i + 1}`)}</span>
        <span class="paint-brush-count" id="paintCount${i}">0</span>
      </button>
    `).join('');
  }

  function updatePaintCounts() {
    const n = colorCount || 1;
    const counts = TileCalc.countByCustomPaint(customPaint, n);
    for (let i = 0; i < 3; i++) {
      const el = $(`#paintCount${i}`);
      if (!el) continue;
      el.textContent = i < n ? String(counts[i] ?? 0) : '—';
    }
  }

  function updatePaintUI() {
    const n = colorCount || 1;
    if (paintMode || TileCalc.hasCustomPaint(customPaint)) buildPaintBrushes();
    updatePaintCounts();
    const tally = $('#paintLiveTally');
    if (tally) {
      const counts = TileCalc.countByCustomPaint(customPaint, n);
      const painted = counts.reduce((a, b) => a + b, 0);
      if (painted > 0) {
        const colors = [
          { name: $('#color1Name')?.value },
          { name: $('#color2Name')?.value },
          { name: $('#color3Name')?.value },
        ];
        tally.textContent = counts
          .slice(0, n)
          .map((c, i) => `${colors[i]?.name || `Color ${i + 1}`}: ${c}`)
          .join(' · ');
      } else {
        tally.textContent = 'Elegí un color y tocá las baldosas en el plano.';
      }
    }
    $('#planPaintClear')?.classList.toggle('hidden', !TileCalc.hasCustomPaint(customPaint));
  }

  function startPaintMode() {
    if (!lastResult) {
      alert('Primero cargá medidas, tipo de piso y colores para ver el plano.');
      return;
    }
    if (!colorCount) {
      alert('Elegí cuántos colores vas a usar (1, 2 o 3).');
      return;
    }
    setPlanInteractionMode('paint');
    redrawPlan();
    $('#planViewer')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function clearRoomShape() {
    applyRectangleShape();
  }

  function closeRoomShape() {
    if (roomPolygon.length < 3) return;
    shapeClosed = true;
    roomShapeType = 'draw';
    shapeMode = false;
    $('#planStage')?.classList.remove('shape-mode');
    $('#planShapeToggle')?.classList.remove('active');
    $('#btnShapeDraw')?.classList.remove('active');
    updateShapeStatus();
    updateObstacleUI();
    debounce(recalculate);
  }

  function undoShapePoint() {
    if (!roomPolygon.length) return;
    const wasClosed = shapeClosed;
    roomPolygon.pop();
    shapeClosed = false;
    updateShapeStatus();
    updateColumnUI();
    if (wasClosed) debounce(recalculate);
    else redrawPlan();
  }

  function addShapePoint(clientX, clientY) {
    if (!lastResult) return;
    const pt = TileCalc.metersFromCanvasPoint(
      $('#floorCanvas'),
      clientX,
      clientY,
      lastResult.cols,
      lastResult.rows,
      lastResult.actualWidthM,
      lastResult.actualLengthM
    );
    if (!pt) return;
    roomPolygon.push(pt);
    shapeClosed = false;
    roomShapeType = 'draw';
    updateShapeStatus();
    updateColumnUI();
    redrawPlan();
  }

  function parseExcludedFromData(data) {
    const set = new Set();
    for (const item of data || []) {
      if (typeof item === 'string' && item.includes(',')) set.add(item);
      else if (Array.isArray(item) && item.length === 2) set.add(`${item[0]},${item[1]}`);
    }
    return set;
  }

  function resolvePattern(data) {
    if (data?.pattern && TileCalc.FLOOR_TYPES[data.pattern]) return data.pattern;
    return null;
  }

  function resolveColorCount(data) {
    const n = data?.colorCount;
    if (Number.isInteger(n) && n >= 1 && n <= 3) return n;
    const fromBreakdown = data?.breakdown?.filter((r) => (r.tiles ?? 0) > 0).length;
    if (fromBreakdown >= 1 && fromBreakdown <= 3) return fromBreakdown;
    return null;
  }

  function updateCanvasPlaceholder() {
    const empty = $('#canvasEmpty');
    if (!empty) return;
    if (!selectedPattern && !colorCount) {
      empty.textContent = 'Elegí el tipo de piso y la cantidad de colores para ver el plano.';
    } else if (!selectedPattern) {
      empty.textContent = 'Elegí el tipo de piso: Rejilla, Trama o Moneda.';
    } else {
      empty.textContent = 'Elegí cuántos colores: 1, 2 o 3.';
    }
    empty.classList.remove('hidden');
    $('#planViewer')?.classList.add('hidden');
  }

  function fillForm(data) {
    $('#cliente').value = data.cliente || '';
    $('#referencia').value = data.referencia || '';
    $('#link').value = data.link || '';
    $('#notas').value = data.notas || '';
    $('#roomWidth').value = data.roomWidthM > 0 ? data.roomWidthM.toFixed(2) : '';
    $('#roomLength').value = data.roomLengthM > 0 ? data.roomLengthM.toFixed(2) : '';
    if ($('#areaInput')) {
      const area = data.areaM2 > 0 ? data.areaM2 : (data.roomWidthM > 0 && data.roomLengthM > 0 ? data.roomWidthM * data.roomLengthM : 0);
      $('#areaInput').value = area > 0 ? area.toFixed(2) : '';
    }
    updateAreaFromDims();
    syncDimsToPhotoPanel();

    const tw = TileCalc.TILE_SIZE_CM;
    $('#tileWidth').value = String(tw);
    $('#tileLength').value = String(tw);

    $('#tilesPerBox').value = data.tilesPerBox ?? TileCalc.tilesPerBoxForPattern(data.pattern);
    updateTilesPerBoxUI();
    $('#sparePercent').value = data.sparePercent ?? 10;

    excludedCells = parseExcludedFromData(data.excludedCells);
    columnRects = TileCalc.parseColumnRects(data.columnRects);
    customPaint = TileCalc.parseCustomPaint(data.customPaint);
    activePaintIndex = 0;
    roomPolygon = Array.isArray(data.roomPolygon) ? data.roomPolygon.map((p) => ({ xM: p.xM, yM: p.yM })) : [];
    shapeClosed = roomPolygon.length >= 3;
    roomShapeType = data.roomShapeType || (shapeClosed ? 'draw' : 'rect');
    setShapeTypeUI(roomShapeType);
    setPlanInteractionMode('none');
    updateShapeStatus();

    selectedPattern = resolvePattern(data);
    setColorCount(resolveColorCount(data));
    updatePatternSelection();

    const colors = data.colors || TileCalc.getColorsForFloorType(selectedPattern || data.pattern);
    $('#color1Name').value = colors[0]?.name || TileCalc.getColorsForFloorType(data.pattern)[0]?.name || '';
    $('#color1Hex').value = colors[0]?.hex || TileCalc.getColorsForFloorType(data.pattern)[0]?.hex || '#888888';
    $('#color2Name').value = colors[1]?.name || TileCalc.getColorsForFloorType(data.pattern)[1]?.name || '';
    $('#color2Hex').value = colors[1]?.hex || TileCalc.getColorsForFloorType(data.pattern)[1]?.hex || '#888888';
    $('#color3Name').value = colors[2]?.name || TileCalc.getColorsForFloorType(data.pattern)[2]?.name || '';
    $('#color3Hex').value = colors[2]?.hex || TileCalc.getColorsForFloorType(data.pattern)[2]?.hex || '#888888';
    applyFloorTypeColors(false);

    $('#photoThumbData').value = data.photoThumb || '';
    setMeasureTab(data.measureMethod || 'manual');

    const logoOn = !!data.logoEnabled;
    $('#logoEnabled').checked = logoOn;
    $('#logoTileBg').value = data.logoTileBg || '#ffffff';
    $('#logoSpan').value = String(data.logoSpan || 1);
    logoImageData = data.logoImage || null;
    if (logoOn && logoImageData) setLogoPreview(logoImageData);
    else setLogoPreview(null);
    updateLogoUI();

    updatePatternUI();
    if (!data.id && !data.roomWidthM && !data.roomLengthM) {
      updateCanvasPlaceholder();
      renderResults(null);
    } else {
      recalculate();
    }
  }

  function updateLogoUI() {
    const on = $('#logoEnabled')?.checked && selectedPattern === 'trama';
    $('#logoOptions')?.classList.toggle('hidden', !on);
  }

  function setLogoPreview(src) {
    const img = $('#logoPreview');
    const empty = $('#logoPreviewEmpty');
    const fileName = $('#logoFileName');
    if (!src) {
      img.classList.add('hidden');
      empty?.classList.remove('hidden');
      if (fileName) fileName.textContent = 'Ningún archivo';
      logoImageEl = null;
      return;
    }
    img.src = src;
    img.classList.remove('hidden');
    empty?.classList.add('hidden');
    if (fileName) fileName.textContent = 'Logo cargado ✓';
    TileCalc.loadImage(src).then((el) => { logoImageEl = el; debounce(recalculate); }).catch(() => {});
  }

  function getDrawOptions(form) {
    const opts = {};
    if (form?.logoEnabled && selectedPattern === 'trama' && logoImageData) {
      opts.logo = {
        enabled: true,
        src: logoImageData,
        image: logoImageEl,
        tileBg: form.logoTileBg || '#ffffff',
        span: form.logoSpan || 1,
      };
    }
    if (roomPolygon.length) {
      opts.roomPolygon = roomPolygon;
      opts.roomPolygonClosed = shapeClosed;
    }
    if (columnRects.length || columnPreview) {
      opts.columnRects = columnRects;
      if (columnPreview) opts.columnPreview = columnPreview;
    }
    if (lastResult?.polygonExcludedKeys?.length) {
      opts.polygonCellKeys = new Set(lastResult.polygonExcludedKeys);
    }
    if (paintMode || columnMode) {
      opts.paintNeutralMode = true;
      opts.customPaint = customPaint;
    } else if (TileCalc.hasCustomPaint(customPaint)) {
      opts.customPaint = customPaint;
    }
    return opts;
  }

  function applyFloorTypeColors(resetSlots = true) {
    if (!selectedPattern) {
      buildColorPalette([]);
      return;
    }
    const catalog = TileCalc.getColorsForFloorType(selectedPattern);
    buildColorPalette(catalog);
    if (!resetSlots || !colorCount) return;
    catalog.slice(0, colorCount).forEach((color, i) => {
      const hexEl = $(`#color${i + 1}Hex`);
      const nameEl = $(`#color${i + 1}Name`);
      if (hexEl) hexEl.value = color.hex;
      if (nameEl) nameEl.value = color.name;
    });
  }

  function setActiveColorSlot(slot) {
    activeColorSlot = Math.min(3, Math.max(1, slot));
    $$('.color-chip').forEach((chip) => {
      chip.classList.toggle('color-chip-active', parseInt(chip.dataset.slot, 10) === activeColorSlot);
    });
    highlightPaletteSelection($(`#color${activeColorSlot}Hex`)?.value);
  }

  function applyCatalogColor(color) {
    const hexEl = $(`#color${activeColorSlot}Hex`);
    const nameEl = $(`#color${activeColorSlot}Name`);
    if (!hexEl || !nameEl) return;
    hexEl.value = color.hex;
    nameEl.value = color.name;
    highlightPaletteSelection(color.hex);
    debounce(recalculate);
  }

  function highlightPaletteSelection(hex) {
    $$('.color-palette-btn').forEach((btn) => {
      btn.classList.toggle('is-selected', btn.dataset.hex?.toLowerCase() === hex?.toLowerCase());
    });
  }

  function buildColorPalette(catalog) {
    const palette = $('#colorPalette');
    if (!palette) return;
    const colors = catalog?.length ? catalog : (selectedPattern ? TileCalc.getColorsForFloorType(selectedPattern) : []);
    const typeLabel = selectedPattern ? TileCalc.FLOOR_TYPES[selectedPattern] : 'piso';
    const hint = $('.color-catalog-hint');
    if (hint) {
      hint.textContent = selectedPattern
        ? `Colores disponibles para ${typeLabel} (fotos del cliente). Tocá una muestra para asignarla al color activo.`
        : 'Elegí primero el tipo de piso para ver los colores disponibles.';
    }
    if (!colors.length) {
      palette.innerHTML = '';
      return;
    }
    palette.innerHTML = colors.map((color) => `
      <button type="button" class="color-palette-btn" data-hex="${color.hex}" data-name="${escapeHtml(color.name)}" title="${escapeHtml(color.name)}">
        <span class="color-palette-swatch" style="background:${color.hex}"></span>
        <span>${escapeHtml(color.name)}</span>
      </button>
    `).join('');

    palette.querySelectorAll('.color-palette-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        applyCatalogColor({ hex: btn.dataset.hex, name: btn.dataset.name });
      });
    });
  }

  function setColorCount(count) {
    if (count == null || count === '') {
      colorCount = null;
      $$('.color-count-btn').forEach((b) => b.classList.remove('active'));
      updateColorUI();
      return;
    }
    colorCount = Math.min(3, Math.max(1, parseInt(count, 10) || 1));
    $$('.color-count-btn').forEach((b) => b.classList.toggle('active', parseInt(b.dataset.count, 10) === colorCount));
    updateColorUI();
  }

  function updateColorUI() {
    const hint = $('#colorSelectHint');
    const row = $('.colors-row');
    const palette = $('#colorPalette');
    if (!colorCount) {
      hint?.classList.remove('hidden');
      row?.classList.add('hidden');
      palette?.classList.add('hidden');
      return;
    }
    if (!selectedPattern) {
      hint.textContent = 'Elegí primero el tipo de piso para ver los colores.';
      hint?.classList.remove('hidden');
      row?.classList.add('hidden');
      palette?.classList.add('hidden');
      return;
    }
    hint?.classList.add('hidden');
    row?.classList.remove('hidden');
    palette?.classList.remove('hidden');
    $('#color2Group').classList.toggle('hidden', colorCount < 2);
    $('#color3Group').classList.toggle('hidden', colorCount < 3);
    if (activeColorSlot > colorCount) setActiveColorSlot(colorCount);
    else setActiveColorSlot(activeColorSlot);
    updatePaintUI();
  }

  function setMeasureTab(tab) {
    $$('.measure-tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
    $$('.measure-panel').forEach((p) => p.classList.toggle('hidden', p.dataset.panel !== tab));
    if (tab === 'manual') {
      syncPhotoManualToMain();
    } else if (tab === 'photo') {
      syncDimsToPhotoPanel();
      requestAnimationFrame(() => {
        measureSession?.redraw();
        updateMeasureUI();
      });
    }
  }

  function updatePatternUI() {
    updateColorUI();
  }

  function updatePatternSelection() {
    $$('.floor-type-btn').forEach((btn) => {
      btn.classList.toggle('active', !!selectedPattern && btn.dataset.pattern === selectedPattern);
    });
    $('#floorTypeHint')?.classList.toggle('hidden', !!selectedPattern);
    updateTilesPerBoxUI();
    updateLogoPanel();
    updatePatternUI();
  }

  async function recalculate() {
    const form = readForm();
    if (form.roomWidthM <= 0 || form.roomLengthM <= 0) {
      planNeedsFitView = true;
      renderResults(null);
      updateShapeStatus();
      return;
    }
    if (!selectedPattern || !colorCount) {
      updateCanvasPlaceholder();
      renderResults(null);
      updateShapeStatus();
      return;
    }

    lastResult = TileCalc.calculate(form);
    const canvas = $('#floorCanvas');
    const empty = $('#canvasEmpty');
    const viewer = $('#planViewer');
    await TileCalc.drawFloorPlanAsync(canvas, lastResult, getDrawOptions(form));
    empty.classList.add('hidden');
    viewer.classList.remove('hidden');
    if (planNeedsFitView) {
      requestAnimationFrame(() => {
        planViewerControls?.fitView();
        planNeedsFitView = false;
      });
    }

    $('#photoThumbData').value = canvas.toDataURL('image/png');
    renderResults(lastResult, form);
    updateShapeStatus();
    updatePaintUI();
    updateColumnUI();
  }

  function renderResults(result, form) {
    const tbody = $('#resultsBody');
    const empty = $('#resultsEmpty');

    if (!result) {
      tbody.innerHTML = '';
      empty.classList.remove('hidden');
      $('#statNetas').textContent = '—';
      $('#statRepuesto').textContent = '—';
      $('#statComprar').textContent = '—';
      $('#statAreaPedida').textContent = '—';
      $('#statCubierto').textContent = '—';
      $('#statGrilla').textContent = '—';
      $('#gridHint').textContent = '';
      $('#subtotalNetas').textContent = '—';
      $('#subtotalRepuesto').textContent = '—';
      $('#subtotalComprar').textContent = '—';
      $('#subtotalCajas').textContent = '—';
      $('#totalNetasLabel').textContent = '—';
      $('#totalRepuestoLabel').textContent = '—';
      $('#totalSparePct').textContent = '—';
      $('#totalFinalLabel').textContent = '—';
      $('#totalBoxes').textContent = '—';
      $('#canvasEmpty').classList.remove('hidden');
      $('#planViewer').classList.add('hidden');
      return;
    }

    empty.classList.add('hidden');
    const sparePct = form?.sparePercent ?? result.sparePercent ?? 10;
    tbody.innerHTML = result.breakdown
      .map(
        (row) => `
      <tr>
        <td><span class="color-swatch" style="background:${row.hex}"></span>${escapeHtml(row.name)}</td>
        <td>${row.tiles}</td>
        <td class="col-spare">+${row.spareTiles ?? (row.tilesWithSpare - row.tiles)}</td>
        <td><strong>${row.tilesWithSpare}</strong></td>
        <td>${row.percent}%</td>
        <td>${row.boxes}</td>
      </tr>`
      )
      .join('');

    $('#statNetas').textContent = result.totalTiles;
    $('#statRepuesto').textContent = `+${result.totalSpareTiles ?? 0} (${sparePct}%)`;
    $('#statComprar').textContent = result.totalTilesWithSpare;
    $('#statAreaPedida').textContent = `${result.areaM2.toFixed(1)} m²`;
    $('#statCubierto').textContent = `${result.coveredM2.toFixed(1)} m²`;
    $('#statGrilla').textContent = `${result.cols} × ${result.rows} baldosas`;
    const extraM2 = result.coveredM2 - result.areaM2;
    $('#gridHint').textContent = extraM2 > 0.05
      ? `El plano usa baldosas enteras: ${result.cols} de ancho × ${result.rows} de largo (${result.actualWidthM.toFixed(2)} m × ${result.actualLengthM.toFixed(2)} m). Por eso cubre ${result.coveredM2.toFixed(1)} m² en vez de ${result.areaM2.toFixed(1)} m².`
      : `Plano: ${result.cols} baldosas de ancho × ${result.rows} de largo.`;
    if (result.columnCellCount > 0) {
      $('#gridHint').textContent += ` · ${result.columnRects?.length || columnRects.length} columna(s) (${result.columnCellCount} bald. sin piso).`;
    }
    if (result.excludedCount > 0) {
      $('#gridHint').textContent += ` · ${result.excludedCount} baldosa(s) fuera del contorno u obstáculo.`;
    }
    if (result.isCustomPainted) {
      $('#gridHint').textContent += ' · Diseño pintado a mano en el plano.';
    }
    updateColumnUI();
    $('#subtotalNetas').textContent = result.totalTiles;
    $('#subtotalRepuesto').textContent = `+${result.totalSpareTiles ?? 0}`;
    $('#subtotalComprar').textContent = result.totalTilesWithSpare;
    $('#subtotalCajas').textContent = result.totalBoxes;
    $('#totalNetasLabel').textContent = result.totalTiles;
    $('#totalRepuestoLabel').textContent = result.totalSpareTiles ?? 0;
    $('#totalSparePct').textContent = sparePct;
    $('#totalFinalLabel').textContent = result.totalTilesWithSpare;
    $('#totalBoxes').textContent = result.totalBoxes;
  }

  function createThumb(canvas, maxW = 96, maxH = 64) {
    if (!canvas?.width) return null;
    const c = document.createElement('canvas');
    const scale = Math.min(maxW / canvas.width, maxH / canvas.height, 1);
    c.width = Math.max(1, Math.round(canvas.width * scale));
    c.height = Math.max(1, Math.round(canvas.height * scale));
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#141414';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(canvas, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.9);
  }

  function formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-AR', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function getSearchQuery() {
    return ($('#searchPresupuestos')?.value || '').trim().toLowerCase();
  }

  function filterItems(items) {
    const q = getSearchQuery();
    if (!q) return items;
    return items.filter((p) => {
      const hay = [
        p.cliente, p.referencia, p.link, p.notas,
        p.createdBy, p.updatedBy,
        TileCalc.PATTERNS[p.pattern] || p.pattern,
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }
  function showView(view) {
    $('#viewDashboard').classList.toggle('hidden', view !== 'dashboard');
    $('#viewEditor').classList.toggle('hidden', view !== 'editor');
    document.body.dataset.view = view;
    if (view === 'dashboard') renderDashboard();
  }

  function renderDashboard() {
    const items = Storage.getAll();
    const filtered = filterItems(items);
    const tbody = $('#dashboardTableBody');
    const tableWrap = $('#dashboardTableWrap');
    const empty = $('#dashboardEmpty');

    let totalM2 = 0;
    let totalBaldosas = 0;
    let totalLinks = 0;

    items.forEach((p) => {
      totalM2 += (p.roomWidthM || 0) * (p.roomLengthM || 0);
      totalBaldosas += p.totalTilesWithSpare || 0;
      if (p.link) totalLinks++;
    });

    $('#statPresupuestos').textContent = items.length;
    $('#statM2').textContent = totalM2.toFixed(0);
    $('#statBaldosas').textContent = totalBaldosas;
    $('#statLinks').textContent = totalLinks;
    $('#listCount').textContent = items.length;
    $('#listExportHint')?.classList.toggle('hidden', !items.length);

    if (!items.length) {
      tbody.innerHTML = '';
      tableWrap.classList.add('hidden');
      empty.classList.remove('hidden');
      return;
    }

    empty.classList.add('hidden');
    tableWrap.classList.remove('hidden');

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="9" class="table-empty">No hay resultados para "${escapeHtml(getSearchQuery())}"</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered
      .map((p) => {
        const date = formatDate(p.updatedAt || p.createdAt);
        const area = ((p.roomWidthM || 0) * (p.roomLengthM || 0)).toFixed(1);
        const thumb = p.canvasThumb || p.photoThumb;
        const tiles = p.totalTilesWithSpare ?? '—';
        const boxes = p.totalBoxes ?? '—';
        const patron = TileCalc.PATTERNS[p.pattern] || p.pattern || '—';
        const cliente = escapeHtml(p.cliente || 'Sin cliente');
        const ref = p.referencia ? `<span class="row-ref">${escapeHtml(p.referencia)}</span>` : '';
        const linkIcon = p.link
          ? `<a href="${escapeHtml(p.link)}" class="row-link" target="_blank" rel="noopener" title="Abrir link" onclick="event.stopPropagation()">↗</a>`
          : '';

        const usuario = escapeHtml(p.createdBy || p.updatedBy || '—');

        return `
        <tr class="budget-row" data-id="${p.id}" tabindex="0">
          <td class="col-thumb">
            <div class="row-thumb">
              ${thumb ? `<img src="${thumb}" alt="Plano" loading="lazy">` : '<span class="thumb-fallback">▦</span>'}
            </div>
          </td>
          <td class="col-client">
            <span class="row-client">${cliente}</span>
            ${ref}
            ${linkIcon}
          </td>
          <td class="col-user"><span class="user-tag">${usuario}</span></td>
          <td class="col-date">${date}</td>
          <td class="col-area"><strong>${area}</strong> m²</td>
          <td class="col-pattern"><span class="pattern-tag">${escapeHtml(patron)}</span></td>
          <td class="col-tiles">${tiles}</td>
          <td class="col-boxes">${boxes}</td>
          <td class="col-actions">
            <div class="row-actions">
              <button type="button" class="btn-icon-action has-tip" data-action="excel" data-id="${p.id}" data-tip="Exportar a Excel" aria-label="Exportar a Excel" title="Exportar a Excel">↓</button>
              <button type="button" class="btn-icon-action has-tip" data-action="edit" data-id="${p.id}" data-tip="Editar presupuesto" aria-label="Editar presupuesto" title="Editar presupuesto">✎</button>
              <button type="button" class="btn-icon-action has-tip" data-action="dup" data-id="${p.id}" data-tip="Duplicar presupuesto" aria-label="Duplicar presupuesto" title="Duplicar presupuesto">⧉</button>
              <button type="button" class="btn-icon-action btn-icon-danger has-tip" data-action="del" data-id="${p.id}" data-tip="Eliminar presupuesto" aria-label="Eliminar presupuesto" title="Eliminar presupuesto">✕</button>
            </div>
          </td>
        </tr>`;
      })
      .join('');
  }

  async function savePresupuesto() {
    const form = readForm();
    if (!form.cliente) {
      alert('Ingresá el nombre del cliente antes de guardar.');
      $('#cliente').focus();
      return;
    }
    if (!Storage.getCurrentUser().name) {
      openUserModal();
      alert('Configurá tu nombre de usuario primero.');
      return;
    }
    if (!lastResult) await recalculate();

    const payload = {
      ...form,
      id: currentId,
      areaM2: form.roomWidthM * form.roomLengthM,
      totalTiles: lastResult?.totalTiles,
      totalSpareTiles: lastResult?.totalSpareTiles,
      totalTilesWithSpare: lastResult?.totalTilesWithSpare,
      totalBoxes: lastResult?.totalBoxes,
      cols: lastResult?.cols,
      rows: lastResult?.rows,
      coveredM2: lastResult?.coveredM2,
      actualWidthM: lastResult?.actualWidthM,
      actualLengthM: lastResult?.actualLengthM,
      canvasThumb: createThumb($('#floorCanvas')) || $('#photoThumbData').value || null,
      breakdown: lastResult?.breakdown,
      excludedCells: [...excludedCells],
      columnRects: columnRects.map((r) => ({ ...r })),
      roomPolygon: shapeClosed && roomPolygon.length >= 3 ? roomPolygon.map((p) => ({ ...p })) : null,
      roomShapeType: shapeClosed ? roomShapeType : 'rect',
      customPaint: TileCalc.hasCustomPaint(customPaint) ? { ...customPaint } : null,
      logoEnabled: form.logoEnabled && selectedPattern === 'trama',
      logoImage: form.logoEnabled ? logoImageData : null,
      logoTileBg: form.logoTileBg,
      logoSpan: form.logoSpan,
    };

    Storage.save(payload);
    showView('dashboard');
  }

  function openEditor(id) {
    currentId = id || null;
    if (id) {
      const p = Storage.getById(id);
      if (p) fillForm(p);
      $('#editorTitle').textContent = p?.cliente ? `Editar: ${p.cliente}` : 'Editar presupuesto';
    } else {
      resetEditorForNew();
      fillForm(defaultFormState());
      $('#editorTitle').textContent = 'Nuevo presupuesto';
    }
    showView('editor');
    debounce(recalculate);
  }

  function initTheme() {
    const theme = Storage.getTheme();
    document.documentElement.dataset.theme = theme;
    $('#themeToggle').textContent = theme === 'dark' ? '☀️' : '🌙';
  }

  function toggleTheme() {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    Storage.setTheme(next);
    $('#themeToggle').textContent = next === 'dark' ? '☀️' : '🌙';
    if (lastResult) recalculate();
  }

  async function shareWhatsApp() {
    if (!lastResult) { alert('Calculá el piso primero.'); return; }
    const form = readForm();
    const canvas = $('#floorCanvas');
    const lines = [
      `*Presupuesto — ${form.cliente || 'Cliente'}*`,
      form.referencia ? `Ref: ${form.referencia}` : '',
      `Superficie: ${lastResult.areaM2.toFixed(2)} m² (${form.roomWidthM.toFixed(2)} × ${form.roomLengthM.toFixed(2)} m)`,
      `Piso: ${TileCalc.PATTERNS[form.pattern]}`,
      `Baldosas netas: ${lastResult.totalTiles}`,
      `Repuesto cortes (+${form.sparePercent}%): +${lastResult.totalSpareTiles ?? 0}`,
      `Total a comprar: ${lastResult.totalTilesWithSpare}`,
      `Cajas: ${lastResult.totalBoxes}`,
      ...lastResult.breakdown.map((r) => {
        const spare = r.spareTiles ?? (r.tilesWithSpare - r.tiles);
        return `• ${r.name}: ${r.tiles} netas + ${spare} rep. = ${r.tilesWithSpare} u. (${r.boxes} cajas)`;
      }),
    ].filter(Boolean);

    try {
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
      const file = new File([blob], 'plano-piso.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: 'Presupuesto baldosa', text: lines.join('\n'), files: [file] });
        return;
      }
    } catch { /* fallback */ }

    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank');
  }

  function formatMetrosLabel(m) {
    return `${Number(m || 0).toFixed(2).replace('.', ',')} m`;
  }

  function printPresupuesto() {
    if (!lastResult) { alert('Calculá el piso primero.'); return; }
    const form = readForm();
    const cliente = form.cliente?.trim() || 'Sin nombre';
    const referencia = form.referencia?.trim();
    const patron = TileCalc.PATTERNS[form.pattern] || form.pattern || '—';

    document.title = `Armado ${cliente} — Nexa`;

    const headerParts = [cliente];
    if (referencia) headerParts.push(referencia);
    headerParts.push(`${formatMetrosLabel(form.roomWidthM)} × ${formatMetrosLabel(form.roomLengthM)}`);
    headerParts.push(patron);
    $('#printHeaderLine').textContent = headerParts.join(' · ');

    const planImg = $('#printPlanImg');
    planImg.src = TileCalc.renderAssemblyPlanImage(lastResult, {
      columnRects,
      customPaint: TileCalc.hasCustomPaint(customPaint) ? customPaint : null,
      roomPolygon: shapeClosed && roomPolygon.length >= 3 ? roomPolygon : null,
      roomPolygonClosed: shapeClosed,
    });
    planImg.classList.remove('hidden');

    const legend = $('#printLegend');
    const legendCounts = TileCalc.hasCustomPaint(customPaint)
      ? TileCalc.countByCustomPaint(customPaint, form.colorCount || 1)
      : lastResult.breakdown.map((r) => r.tiles);
    legend.innerHTML = lastResult.breakdown.map((r, i) => `
      <span class="print-legend-item">
        <span class="print-swatch" style="background:${r.hex}"></span>
        ${escapeHtml(r.name)}: <strong>${legendCounts[i] ?? 0}</strong>
      </span>
    `).join('');

    window.print();
    document.title = 'Nexa Soluciones';
  }

  function buildPatternGrids() {
    const floorGrid = $('#floorTypeGrid');
    floorGrid.innerHTML = Object.entries(TileCalc.FLOOR_TYPES)
      .map(([key, label]) => {
        const img = TileCalc.FLOOR_TYPE_IMAGES[key] || '';
        return `<button type="button" class="pattern-btn floor-type-btn${key === selectedPattern ? ' active' : ''}" data-pattern="${key}">
          <img src="${img}" alt="${label}" loading="lazy">
          <span>${label}</span>
        </button>`;
      }).join('');

    $$('.floor-type-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedPattern = btn.dataset.pattern;
        updatePatternSelection();
        applyFloorTypeColors(true);
        debounce(recalculate);
      });
    });
  }

  function updateMeasureUI(result) {
    const status = $('#measureStatus');
    const step1 = $('#measureStep1');
    const step2 = $('#measureStep2');
    const step3 = $('#measureStep3');
    const btnRef = $('#btnRefDone');
    if (!measureSession || !status) return;

    const data = result ?? measureSession.getResult();
    const hasImage = measureSession.hasImage();
    const mode = measureSession.getMode();
    const refPts = data.refPoints?.length ?? 0;
    const contourPts = data.contourPoints?.length ?? 0;

    step1?.classList.toggle('done', hasImage);
    step1?.classList.toggle('active', !hasImage);
    step2?.classList.toggle('done', !!data.scale);
    step2?.classList.toggle('active', hasImage && !data.scale);
    step3?.classList.toggle('done', data.ready);
    step3?.classList.toggle('active', !!data.scale && !data.ready);

    if (!hasImage) {
      status.textContent = 'Subí una foto del ambiente para empezar.';
    } else if (!data.scale) {
      status.textContent = `Paso 2: tocá ${2 - refPts} punto(s) en la foto sobre una medida conocida (ej. ancho de puerta).`;
    } else if (mode === 'reference') {
      status.textContent = 'Referencia lista. Tocá «Paso 2 → contorno» o seguí: ya podés marcar el perímetro.';
    } else if (!data.ready) {
      status.textContent = `Paso 3: marcá el contorno del piso (${contourPts}/3 puntos mínimo).`;
    } else {
      status.textContent = `Medición lista: ${data.areaM2.toFixed(2)} m² · ${data.widthM.toFixed(2)} × ${data.lengthM.toFixed(2)} m. Tocá «Usar medidas de la foto» o cargá a mano abajo.`;
    }

    if (btnRef) btnRef.disabled = !data.scale;
    $('#btnApplyPhotoMeasure')?.classList.toggle('hidden', !data.ready);

    $('#btnClearPhoto')?.classList.toggle('hidden', !hasImage);
    $('#measureCanvasEmpty')?.classList.toggle('hidden', hasImage);
    measureSession.redraw();
  }

  function setPhotoFileName(name) {
    const el = $('#photoFileName');
    if (el) el.textContent = name || 'Ninguna foto';
  }

  function clearMeasurePhoto() {
    measureSession?.clearImage();
    $('#photoFile').value = '';
    setPhotoFileName('Ninguna foto');
    updateMeasureUI();
  }

  function applyMeasureResult(result) {
    updateMeasureUI(result);
  }

  function initMeasurePhoto() {
    const canvas = $('#measureCanvas');
    measureSession = PhotoMeasure.createMeasureSession(canvas);
    measureSession.setOnUpdate((result) => applyMeasureResult(result));

    $('#btnPickPhoto')?.addEventListener('click', () => $('#photoFile')?.click());

    $('#photoFile').addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      measureSession.setImage(await PhotoMeasure.loadImageFromFile(file));
      measureSession.resetAll();
      setPhotoFileName(file.name);
      updateMeasureUI();
    });

    $('#btnClearPhoto')?.addEventListener('click', clearMeasurePhoto);

    $('#refLength').addEventListener('input', () => {
      measureSession.setRefLength(parseFloat($('#refLength').value) || 0.9);
      updateMeasureUI();
    });
    $('#btnRefDone').addEventListener('click', () => {
      if (!measureSession.getResult().scale) return;
      measureSession.setMode('contour');
      updateMeasureUI();
    });
    $('#btnContourUndo').addEventListener('click', () => {
      measureSession.undoContour();
      updateMeasureUI();
    });
    $('#btnMeasureReset').addEventListener('click', () => {
      measureSession.resetAll();
      updateMeasureUI();
    });

    $('#btnApplyPhotoMeasure')?.addEventListener('click', () => {
      applyPhotoMeasureDims(measureSession.getResult());
    });

    $('#photoRoomWidth')?.addEventListener('input', applyPhotoManualDims);
    $('#photoRoomLength')?.addEventListener('input', applyPhotoManualDims);

    syncDimsToPhotoPanel();
    updateMeasureUI();
  }

  function initUser() {
    const user = Storage.getCurrentUser();
    updateUserDisplay(user.name);

    $('#btnUser').addEventListener('click', openUserModal);
    $('#userForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = $('#userNameInput').value.trim();
      if (!name) return;
      Storage.setCurrentUser(name);
      updateUserDisplay(name);
      $('#userModal').close();
    });

    if (!user.name) setTimeout(openUserModal, 500);
  }

  function updateUserDisplay(name) {
    $('#userNameDisplay').textContent = name || 'Configurar usuario';
  }

  function openUserModal() {
    const user = Storage.getCurrentUser();
    $('#userNameInput').value = user.name || '';
    $('#userModal').showModal();
  }

  function initLogo() {
    $('#logoEnabled').addEventListener('change', () => {
      if ($('#logoEnabled').checked && !logoImageData) {
        const saved = Storage.getCompanyLogo();
        if (saved) setLogoPreview(saved);
      }
      if (!$('#logoEnabled').checked) setLogoPreview(null);
      updateLogoUI();
      debounce(recalculate);
    });

    $('#btnPickLogo')?.addEventListener('click', () => $('#logoFile')?.click());

    $('#logoFile').addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      $('#logoFileName').textContent = file.name;
      const reader = new FileReader();
      reader.onload = () => {
        logoImageData = reader.result;
        Storage.setCompanyLogo(logoImageData);
        setLogoPreview(logoImageData);
        $('#logoEnabled').checked = true;
        updateLogoUI();
      };
      reader.readAsDataURL(file);
    });

    $('#logoTileBg').addEventListener('input', () => debounce(recalculate));
    $('#logoSpan')?.addEventListener('change', () => debounce(recalculate));
  }

  function initPlanViewer() {
    planViewerControls = PlanViewer.createPlanViewer($('#planStage'), $('#floorCanvas'), {
      zoomIn: $('#planZoomIn'),
      zoomOut: $('#planZoomOut'),
      zoomLabel: $('#planZoomLabel'),
      rotateLeft: $('#planRotateLeft'),
      rotateRight: $('#planRotateRight'),
      rotationRange: $('#planRotation'),
      rotationValue: $('#planRotationValue'),
      reset: $('#planResetView'),
    });

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (lastResult) planViewerControls?.fitView();
      }, 150);
    });
  }

  function initPWA() {
    const btn = $('#btnInstall');
    const modal = $('#installModal');
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    const isFile = window.location.protocol === 'file:';

    function openInstallModal() {
      modal?.showModal();
    }

    if (isStandalone) {
      btn?.classList.add('hidden');
      return;
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      $('#installNative')?.classList.remove('hidden');
    });

    if (isFile) {
      const warn = $('#installFileWarning');
      if (warn) {
        warn.textContent = 'Estás abriendo el archivo directo. Para instalar, usá: python3 -m http.server 8080 y abrí http://localhost:8080';
      }
    }

    btn?.addEventListener('click', openInstallModal);

    $('#btnInstallNative')?.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      modal?.close();
    });
  }

  function buildPresupuestoFromEditor() {
    const form = readForm();
    return {
      ...form,
      id: currentId,
      areaM2: form.roomWidthM * form.roomLengthM,
      totalTiles: lastResult?.totalTiles,
      totalSpareTiles: lastResult?.totalSpareTiles,
      totalTilesWithSpare: lastResult?.totalTilesWithSpare,
      totalBoxes: lastResult?.totalBoxes,
      cols: lastResult?.cols,
      rows: lastResult?.rows,
      coveredM2: lastResult?.coveredM2,
      actualWidthM: lastResult?.actualWidthM,
      actualLengthM: lastResult?.actualLengthM,
      breakdown: lastResult?.breakdown,
      createdBy: Storage.getCurrentUser().name,
      updatedBy: Storage.getCurrentUser().name,
      createdAt: currentId ? Storage.getById(currentId)?.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async function exportCurrentToExcel() {
    if (!lastResult) await recalculate();
    if (!lastResult) {
      alert('Completá las medidas y elegí patrón y colores antes de exportar.');
      return;
    }
    const result = NexaExport.exportOne(buildPresupuestoFromEditor());
    if (!result.ok) alert(result.error);
  }

  function exportAllToExcel() {
    const items = Storage.getAll();
    if (!items.length) {
      alert('No hay presupuestos guardados para exportar.');
      return;
    }
    const q = getSearchQuery();
    const toExport = q ? filterItems(items) : items;
    if (!toExport.length) {
      alert('No hay presupuestos que coincidan con la búsqueda.');
      return;
    }
    const result = NexaExport.exportPresupuestos(toExport);
    if (!result.ok) alert(result.error);
  }

  function bindEvents() {
    $('#btnNew').addEventListener('click', () => openEditor(null));
    $('#btnNewEmpty')?.addEventListener('click', () => openEditor(null));
    $('#btnBack').addEventListener('click', () => showView('dashboard'));
    $('#btnSave').addEventListener('click', savePresupuesto);
    $('#btnShare').addEventListener('click', shareWhatsApp);
    $('#btnExportExcel').addEventListener('click', exportCurrentToExcel);
    $('#btnPrint').addEventListener('click', printPresupuesto);
    $('#btnExportAllExcel')?.addEventListener('click', exportAllToExcel);
    $('#themeToggle').addEventListener('click', toggleTheme);

    $$('.measure-tab').forEach((tab) => tab.addEventListener('click', () => setMeasureTab(tab.dataset.tab)));

    $('#areaInput')?.addEventListener('input', applyAreaInput);

    $('#planObstacleToggle')?.addEventListener('click', () => {
      if (obstacleMode) setPlanInteractionMode('none');
      else setPlanInteractionMode('obstacle');
    });
    $('#planObstacleClear')?.addEventListener('click', clearExcludedCells);

    $('#planColumnToggle')?.addEventListener('click', () => {
      if (columnMode) setPlanInteractionMode('none');
      else startColumnMode();
    });
    $('#planColumnClear')?.addEventListener('click', clearColumnRects);
    $('#columnList')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.column-remove-btn');
      if (!btn) return;
      removeColumnRect(parseInt(btn.dataset.colIdx, 10));
    });

    $('#planShapeToggle')?.addEventListener('click', () => {
      if (shapeMode) setPlanInteractionMode('none');
      else startShapeDrawing();
    });
    $('#planShapeClose')?.addEventListener('click', closeRoomShape);
    $('#planShapeUndo')?.addEventListener('click', undoShapePoint);
    $('#planShapeClear')?.addEventListener('click', clearRoomShape);

    $('#btnShapeL')?.addEventListener('click', () => applyLShapePreset());
    $('#btnShapeCircle')?.addEventListener('click', () => applyCircleShape());
    $$('.shape-type-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.shape;
        if (type === 'rect') {
          applyRectangleShape();
          return;
        }
        setShapeTypeUI(type);
        if (type === 'draw') startShapeDrawing();
      });
    });
    $('#btnShapeDraw')?.addEventListener('click', () => {
      if (shapeMode) setPlanInteractionMode('none');
      else startShapeDrawing();
    });
    $('#btnShapeClose')?.addEventListener('click', closeRoomShape);
    $('#btnShapeUndo')?.addEventListener('click', undoShapePoint);
    $('#btnShapeClear')?.addEventListener('click', clearRoomShape);

    function handlePlanPointer(clientX, clientY) {
      if (shapeMode && lastResult) {
        addShapePoint(clientX, clientY);
        return;
      }
      if (paintMode && lastResult) {
        const cell = TileCalc.cellFromPoint($('#floorCanvas'), clientX, clientY, lastResult.cols, lastResult.rows);
        if (cell) paintCell(cell.col, cell.row, activePaintIndex);
        return;
      }
      if (columnMode && lastResult) {
        const cell = TileCalc.cellFromPoint($('#floorCanvas'), clientX, clientY, lastResult.cols, lastResult.rows);
        if (cell) {
          columnDragStart = { col: cell.col, row: cell.row };
          columnPreview = TileCalc.normalizeColumnRect(cell.col, cell.row, cell.col, cell.row);
          isColumnDragging = true;
          redrawPlan();
        }
        return;
      }
      if (!obstacleMode || !lastResult) return;
      const cell = TileCalc.cellFromPoint($('#floorCanvas'), clientX, clientY, lastResult.cols, lastResult.rows);
      if (cell) toggleExcludedCell(cell.col, cell.row);
    }

    $('#planPaintToggle')?.addEventListener('click', () => {
      if (paintMode) setPlanInteractionMode('none');
      else startPaintMode();
    });
    $('#planPaintClear')?.addEventListener('click', clearCustomPaint);
    $('#paintBrushes')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.paint-brush-btn');
      if (!btn) return;
      activePaintIndex = parseInt(btn.dataset.paintIdx, 10) || 0;
      buildPaintBrushes();
    });

    $('#planStage')?.addEventListener('pointerdown', (e) => {
      if (!shapeMode && !obstacleMode && !paintMode && !columnMode) return;
      if (e.target.closest('.plan-toolbar') || e.target.closest('.paint-toolbar') || e.target.closest('.column-toolbar')) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      isPaintingDrag = paintMode;
      handlePlanPointer(e.clientX, e.clientY);
    });
    $('#planStage')?.addEventListener('pointermove', (e) => {
      if (isColumnDragging && columnMode && lastResult) {
        e.preventDefault();
        const cell = TileCalc.cellFromPoint($('#floorCanvas'), e.clientX, e.clientY, lastResult.cols, lastResult.rows);
        if (cell) updateColumnPreview(cell.col, cell.row);
        return;
      }
      if (!isPaintingDrag || !paintMode || !lastResult) return;
      e.preventDefault();
      handlePlanPointer(e.clientX, e.clientY);
    });
    window.addEventListener('pointerup', (e) => {
      if (isColumnDragging && columnMode && lastResult) {
        const cell = TileCalc.cellFromPoint($('#floorCanvas'), e.clientX, e.clientY, lastResult.cols, lastResult.rows);
        if (cell && columnDragStart) finishColumnDrag(cell.col, cell.row);
        else {
          columnDragStart = null;
          columnPreview = null;
          isColumnDragging = false;
          redrawPlan();
        }
      }
      isPaintingDrag = false;
    });
    $('#roomWidth').addEventListener('input', () => {
      excludedCells.clear();
      columnRects = [];
      customPaint = {};
      clearRoomShape();
      updateAreaFromDims();
      debounce(recalculate);
    });
    $('#roomLength').addEventListener('input', () => {
      excludedCells.clear();
      columnRects = [];
      customPaint = {};
      clearRoomShape();
      updateAreaFromDims();
      debounce(recalculate);
    });

    $$('.color-count-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        setColorCount(parseInt(btn.dataset.count, 10));
        applyFloorTypeColors(true);
        debounce(recalculate);
      });
    });

    $$('.color-chip').forEach((chip) => {
      chip.addEventListener('click', (e) => {
        if (e.target.matches('input')) return;
        setActiveColorSlot(parseInt(chip.dataset.slot, 10));
      });
    });
    setActiveColorSlot(1);

    const inputs = '#cliente, #referencia, #link, #notas, #sparePercent, #color1Name, #color1Hex, #color2Name, #color2Hex, #color3Name, #color3Hex';
    $$(inputs).forEach((el) => el.addEventListener('input', () => debounce(recalculate)));

    $('#searchPresupuestos')?.addEventListener('input', () => renderDashboard());

    $('#dashboardTableBody').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (btn) {
        const { id, action } = btn.dataset;
        if (action === 'edit') openEditor(id);
        else if (action === 'excel') {
          const p = Storage.getById(id);
          const result = NexaExport.exportOne(p);
          if (!result.ok) alert(result.error);
        }
        else if (action === 'dup') { Storage.duplicate(id); renderDashboard(); }
        else if (action === 'del' && confirm('¿Borrar este presupuesto?')) { Storage.remove(id); renderDashboard(); }
        return;
      }
      const row = e.target.closest('.budget-row');
      if (row?.dataset.id) openEditor(row.dataset.id);
    });

    $('#dashboardTableBody').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const row = e.target.closest('.budget-row');
        if (row?.dataset.id) openEditor(row.dataset.id);
      }
    });
  }

  function init() {
    initTheme();
    buildPatternGrids();
    buildColorPalette([]);
    setShapeTypeUI('rect');
    updateShapeStatus();
    bindEvents();
    initPlanViewer();
    initMeasurePhoto();
    initUser();
    initLogo();
    initPWA();
    showView('dashboard');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
