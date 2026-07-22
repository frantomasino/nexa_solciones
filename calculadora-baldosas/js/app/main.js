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
  let activeColorSlot = 1;

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
    clearMeasureFields();
    measureSession?.clearImage();
    setPhotoFileName('Ninguna foto');
    updateLogoPanel();
    updateTilesPerBoxUI();
    updatePatternSelection();
    setColorCount(null);
    updateCanvasPlaceholder();
    renderResults(null);
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
    updateAreaFromDims();
    debounce(recalculate);
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

  function updateObstacleUI() {
    const n = excludedCells.size;
    $('#planObstacleClear')?.classList.toggle('hidden', n === 0);
    $('#planObstacleToggle')?.classList.toggle('active', obstacleMode);
    const hint = $('#planViewerHint');
    if (hint && lastResult) {
      hint.textContent = obstacleMode
        ? `Modo obstáculos: tocá baldosas para marcar zonas sin piso (${n} marcadas).`
        : 'Arrastrá para mover · Rueda o +/− para zoom · Usá Obstáculos para esquivar columnas o piletas.';
    }
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
    obstacleMode = false;
    updateObstacleUI();

    selectedPattern = resolvePattern(data);
    setColorCount(resolveColorCount(data));
    updatePatternSelection();

    const colors = data.colors || TileCalc.NEXA_COLOR_CATALOG;
    $('#color1Name').value = colors[0]?.name || TileCalc.NEXA_COLOR_CATALOG[0].name;
    $('#color1Hex').value = colors[0]?.hex || TileCalc.NEXA_COLOR_CATALOG[0].hex;
    $('#color2Name').value = colors[1]?.name || TileCalc.NEXA_COLOR_CATALOG[1].name;
    $('#color2Hex').value = colors[1]?.hex || TileCalc.NEXA_COLOR_CATALOG[1].hex;
    $('#color3Name').value = colors[2]?.name || TileCalc.NEXA_COLOR_CATALOG[2].name;
    $('#color3Hex').value = colors[2]?.hex || TileCalc.NEXA_COLOR_CATALOG[2].hex;

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
    return opts;
  }

  function setActiveColorSlot(slot) {
    activeColorSlot = Math.min(3, Math.max(1, slot));
    $$('.color-chip').forEach((chip) => {
      chip.classList.toggle('color-chip-active', parseInt(chip.dataset.slot, 10) === activeColorSlot);
    });
  }

  function applyCatalogColor(color) {
    const hexEl = $(`#color${activeColorSlot}Hex`);
    const nameEl = $(`#color${activeColorSlot}Name`);
    if (!hexEl || !nameEl) return;
    hexEl.value = color.hex;
    nameEl.value = color.name;
    debounce(recalculate);
  }

  function buildColorPalette() {
    const palette = $('#colorPalette');
    if (!palette) return;
    palette.innerHTML = TileCalc.NEXA_COLOR_CATALOG.map((color) => `
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
    hint?.classList.add('hidden');
    row?.classList.remove('hidden');
    palette?.classList.remove('hidden');
    $('#color2Group').classList.toggle('hidden', colorCount < 2);
    $('#color3Group').classList.toggle('hidden', colorCount < 3);
    if (activeColorSlot > colorCount) setActiveColorSlot(colorCount);
    else setActiveColorSlot(activeColorSlot);
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
      renderResults(null);
      return;
    }
    if (!selectedPattern || !colorCount) {
      updateCanvasPlaceholder();
      renderResults(null);
      return;
    }

    lastResult = TileCalc.calculate(form);
    const canvas = $('#floorCanvas');
    const empty = $('#canvasEmpty');
    const viewer = $('#planViewer');
    await TileCalc.drawFloorPlanAsync(canvas, lastResult, getDrawOptions(form));
    empty.classList.add('hidden');
    viewer.classList.remove('hidden');
    requestAnimationFrame(() => planViewerControls?.fitView());

    $('#photoThumbData').value = canvas.toDataURL('image/png');
    renderResults(lastResult, form);
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
    if (result.excludedCount > 0) {
      $('#gridHint').textContent += ` · ${result.excludedCount} baldosa(s) marcadas como obstáculo (sin contar).`;
    }
    updateObstacleUI();
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
    const referencia = form.referencia?.trim() || '—';
    const patron = TileCalc.PATTERNS[form.pattern] || form.pattern || '—';
    const colores = (form.colors || []).slice(0, form.colorCount || 0).map((c) => c.name).join(' · ') || '—';
    const fecha = new Date().toLocaleString('es-AR', {
      day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    document.title = `Presupuesto ${cliente} — Nexa`;

    $('#printDate').textContent = fecha;
    $('#printCliente').textContent = cliente;
    $('#printReferencia').textContent = referencia;
    $('#printMedidas').textContent = `${formatMetrosLabel(form.roomWidthM)} × ${formatMetrosLabel(form.roomLengthM)}`;
    $('#printArea2').textContent = `${lastResult.areaM2.toFixed(2).replace('.', ',')} m² pedidos`;
    $('#printCubierto').textContent = `${lastResult.coveredM2.toFixed(2).replace('.', ',')} m² (${lastResult.cols}×${lastResult.rows} baldosas)`;
    $('#printGrilla').textContent = `${lastResult.actualWidthM.toFixed(2).replace('.', ',')} × ${lastResult.actualLengthM.toFixed(2).replace('.', ',')} m en plano`;
    $('#printPatron').textContent = patron;
    $('#printColores').textContent = colores;

    const notasEl = $('#printNotas');
    if (form.notas?.trim()) {
      notasEl.textContent = `Notas: ${form.notas.trim()}`;
      notasEl.classList.remove('hidden');
    } else {
      notasEl.classList.add('hidden');
    }

    const canvas = $('#floorCanvas');
    const planImg = $('#printPlanImg');
    if (canvas?.width) {
      planImg.src = canvas.toDataURL('image/png');
      planImg.classList.remove('hidden');
      $('#printPlanCaption').textContent = `Plano ${patron} · ${form.colorCount || ''} color(es) · repuesto ${form.sparePercent}%`;
    } else {
      planImg.src = '';
      planImg.classList.add('hidden');
      $('#printPlanCaption').textContent = '';
    }

    $('#printTable').innerHTML = `
      <thead><tr><th>Color</th><th>Netas</th><th>Repuesto</th><th>A comprar</th><th>%</th><th>Cajas</th></tr></thead>
      <tbody>${lastResult.breakdown.map((r) => {
        const spare = r.spareTiles ?? (r.tilesWithSpare - r.tiles);
        return `<tr>
          <td><span class="print-swatch" style="background:${r.hex}"></span>${escapeHtml(r.name)}</td>
          <td>${r.tiles}</td>
          <td>+${spare}</td>
          <td><strong>${r.tilesWithSpare}</strong></td>
          <td>${r.percent}%</td>
          <td>${r.boxes}</td>
        </tr>`;
      }).join('')}</tbody>
      <tfoot>
        <tr>
          <td>Subtotal</td>
          <td>${lastResult.totalTiles}</td>
          <td>+${lastResult.totalSpareTiles ?? 0}</td>
          <td>${lastResult.totalTilesWithSpare}</td>
          <td>100%</td>
          <td>${lastResult.totalBoxes}</td>
        </tr>
      </tfoot>`;

    $('#printTotal').textContent =
      `Total: ${lastResult.totalTiles} baldosas netas + ${lastResult.totalSpareTiles ?? 0} repuesto (${form.sparePercent}%) = ${lastResult.totalTilesWithSpare} a comprar · ${lastResult.totalBoxes} cajas`;

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
      obstacleMode = !obstacleMode;
      $('#planStage')?.classList.toggle('obstacle-mode', obstacleMode);
      updateObstacleUI();
    });
    $('#planObstacleClear')?.addEventListener('click', clearExcludedCells);

    $('#planStage')?.addEventListener('click', (e) => {
      if (!obstacleMode || !lastResult) return;
      if (e.target.closest('.plan-toolbar')) return;
      const cell = TileCalc.cellFromPoint($('#floorCanvas'), e.clientX, e.clientY, lastResult.cols, lastResult.rows);
      if (cell) toggleExcludedCell(cell.col, cell.row);
    });
    $('#roomWidth').addEventListener('input', () => {
      excludedCells.clear();
      updateAreaFromDims();
      debounce(recalculate);
    });
    $('#roomLength').addEventListener('input', () => {
      excludedCells.clear();
      updateAreaFromDims();
      debounce(recalculate);
    });

    $$('.color-count-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        setColorCount(parseInt(btn.dataset.count, 10));
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
    buildColorPalette();
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
