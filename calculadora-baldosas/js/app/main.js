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

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  function debounce(fn) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fn, DEBOUNCE_MS);
  }

  function defaultFormState() {
    return {
      cliente: '',
      link: '',
      roomWidthM: 6,
      roomLengthM: 8,
      tileWidthCm: 50,
      tileLengthCm: 50,
      tilesPerBox: 20,
      sparePercent: 10,
      pattern: 'solid',
      aisleWidth: 2,
      stripeWidth: 1,
      colors: TileCalc.DEFAULT_COLORS.map((c) => ({ ...c })),
      customPercents: [50, 30, 20],
      measureMethod: 'manual',
      photoThumb: null,
    };
  }

  function readForm() {
    return {
      cliente: $('#cliente').value.trim(),
      link: $('#link').value.trim(),
      roomWidthM: parseFloat($('#roomWidth').value) || 0,
      roomLengthM: parseFloat($('#roomLength').value) || 0,
      tileWidthCm: parseFloat($('#tileWidth').value) || 50,
      tileLengthCm: parseFloat($('#tileLength').value) || 50,
      tilesPerBox: parseInt($('#tilesPerBox').value, 10) || 20,
      sparePercent: parseFloat($('#sparePercent').value) || 0,
      pattern: $('#pattern').value,
      aisleWidth: parseInt($('#aisleWidth').value, 10) || 2,
      stripeWidth: parseInt($('#stripeWidth').value, 10) || 1,
      colors: [
        { name: $('#color1Name').value, hex: $('#color1Hex').value },
        { name: $('#color2Name').value, hex: $('#color2Hex').value },
        { name: $('#color3Name').value, hex: $('#color3Hex').value },
      ],
      customPercents: [
        parseFloat($('#customPct1').value) || 0,
        parseFloat($('#customPct2').value) || 0,
        parseFloat($('#customPct3').value) || 0,
      ],
      measureMethod: document.querySelector('.measure-tab.active')?.dataset.tab || 'manual',
      photoThumb: $('#photoThumbData').value || null,
    };
  }

  function fillForm(data) {
    $('#cliente').value = data.cliente || '';
    $('#link').value = data.link || '';
    $('#roomWidth').value = data.roomWidthM ?? 6;
    $('#roomLength').value = data.roomLengthM ?? 8;
    $('#tileWidth').value = data.tileWidthCm ?? 50;
    $('#tileLength').value = data.tileLengthCm ?? 50;
    $('#tilesPerBox').value = data.tilesPerBox ?? 20;
    $('#sparePercent').value = data.sparePercent ?? 10;
    $('#pattern').value = data.pattern || 'solid';
    $('#aisleWidth').value = data.aisleWidth ?? 2;
    $('#stripeWidth').value = data.stripeWidth ?? 1;

    const colors = data.colors || TileCalc.DEFAULT_COLORS;
    $('#color1Name').value = colors[0]?.name || 'Gris';
    $('#color1Hex').value = colors[0]?.hex || '#6b7280';
    $('#color2Name').value = colors[1]?.name || 'Negro';
    $('#color2Hex').value = colors[1]?.hex || '#1f2937';
    $('#color3Name').value = colors[2]?.name || 'Rojo';
    $('#color3Hex').value = colors[2]?.hex || '#dc2626';

    const pcts = data.customPercents || [50, 30, 20];
    $('#customPct1').value = pcts[0];
    $('#customPct2').value = pcts[1];
    $('#customPct3').value = pcts[2];

    $('#photoThumbData').value = data.photoThumb || '';
    setMeasureTab(data.measureMethod || 'manual');
    updatePatternUI();
    recalculate();
  }

  function setMeasureTab(tab) {
    $$('.measure-tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
    $$('.measure-panel').forEach((p) => p.classList.toggle('hidden', p.dataset.panel !== tab));
  }

  function updatePatternUI() {
    const pattern = $('#pattern').value;
    const needs2 = pattern !== 'solid' && pattern !== 'custom';
    const needs3 = pattern === 'custom';
    const needsAisle = pattern === 'center-aisle';
    const needsStripe = pattern === 'stripes-h' || pattern === 'stripes-v';

    $('#color2Group').classList.toggle('hidden', !needs2 && !needs3);
    $('#color3Group').classList.toggle('hidden', !needs3);
    $('#customPctGroup').classList.toggle('hidden', !needs3);
    $('#aisleWidthGroup').classList.toggle('hidden', !needsAisle);
    $('#stripeWidthGroup').classList.toggle('hidden', !needsStripe);
  }

  function recalculate() {
    const form = readForm();
    if (form.roomWidthM <= 0 || form.roomLengthM <= 0) {
      renderResults(null);
      return;
    }

    lastResult = TileCalc.calculate(form);
    const canvas = $('#floorCanvas');
    const thumb = TileCalc.drawFloorPlan(canvas, lastResult);
    if (thumb) $('#photoThumbData').value = thumb;

    renderResults(lastResult);
    renderSummary(form, lastResult);
  }

  function renderResults(result) {
    const tbody = $('#resultsBody');
    const empty = $('#resultsEmpty');
    if (!result) {
      tbody.innerHTML = '';
      empty.classList.remove('hidden');
      $('#totalTiles').textContent = '—';
      $('#totalBoxes').textContent = '—';
      $('#areaDisplay').textContent = '—';
      return;
    }

    empty.classList.add('hidden');
    tbody.innerHTML = result.breakdown
      .map(
        (row) => `
      <tr>
        <td><span class="color-swatch" style="background:${row.hex}"></span> ${escapeHtml(row.name)}</td>
        <td>${row.tiles}</td>
        <td>${row.tilesWithSpare}</td>
        <td>${row.boxes}</td>
        <td>${row.percent}%</td>
      </tr>`
      )
      .join('');

    $('#totalTiles').textContent = result.totalTilesWithSpare;
    $('#totalBoxes').textContent = result.totalBoxes;
    $('#areaDisplay').textContent = `${result.areaM2.toFixed(2)} m²`;
    $('#gridInfo').textContent = `${result.cols} × ${result.rows} baldosas (${result.actualWidthM.toFixed(2)} × ${result.actualLengthM.toFixed(2)} m cubiertos)`;
  }

  function renderSummary(form, result) {
    $('#summaryCliente').textContent = form.cliente || '—';
    $('#summaryMedidas').textContent = `${form.roomWidthM} × ${form.roomLengthM} m`;
    $('#summaryPatron').textContent = TileCalc.PATTERNS[form.pattern] || form.pattern;
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function showView(view) {
    $('#viewDashboard').classList.toggle('hidden', view !== 'dashboard');
    $('#viewEditor').classList.toggle('hidden', view !== 'editor');
    document.body.dataset.view = view;
    if (view === 'dashboard') renderDashboard();
  }

  function renderDashboard() {
    const items = Storage.getAll();
    const grid = $('#dashboardGrid');
    const empty = $('#dashboardEmpty');

    if (!items.length) {
      grid.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }

    empty.classList.add('hidden');
    grid.innerHTML = items
      .map((p) => {
        const date = new Date(p.updatedAt || p.createdAt).toLocaleDateString('es-AR');
        const area = (p.roomWidthM * p.roomLengthM).toFixed(1);
        const thumb = p.photoThumb || p.canvasThumb;
        const tiles = p.totalTilesWithSpare ?? '—';
        const boxes = p.totalBoxes ?? '—';
        return `
        <article class="card presupuesto-card" data-id="${p.id}">
          <div class="card-thumb">${thumb ? `<img src="${thumb}" alt="">` : '<div class="thumb-placeholder">📐</div>'}</div>
          <div class="card-body">
            <h3>${escapeHtml(p.cliente || 'Sin cliente')}</h3>
            <p class="card-meta">${date} · ${area} m²</p>
            <p class="card-stats">${tiles} baldosas · ${boxes} cajas</p>
            ${p.link ? `<a href="${escapeHtml(p.link)}" class="card-link" target="_blank" rel="noopener">Ver ubicación</a>` : ''}
          </div>
          <div class="card-actions">
            <button type="button" class="btn btn-sm" data-action="edit" data-id="${p.id}">Editar</button>
            <button type="button" class="btn btn-sm btn-ghost" data-action="dup" data-id="${p.id}">Duplicar</button>
            <button type="button" class="btn btn-sm btn-danger" data-action="del" data-id="${p.id}">Borrar</button>
          </div>
        </article>`;
      })
      .join('');
  }

  function savePresupuesto() {
    const form = readForm();
    if (!form.cliente) {
      alert('Ingresá el nombre del cliente antes de guardar.');
      $('#cliente').focus();
      return;
    }

    const payload = {
      ...form,
      id: currentId,
      totalTilesWithSpare: lastResult?.totalTilesWithSpare,
      totalBoxes: lastResult?.totalBoxes,
      canvasThumb: $('#photoThumbData').value || null,
      breakdown: lastResult?.breakdown,
    };

    const saved = Storage.save(payload);
    currentId = saved.id;
    alert('Presupuesto guardado.');
    showView('dashboard');
  }

  function openEditor(id) {
    currentId = id || null;
    if (id) {
      const p = Storage.getById(id);
      if (p) fillForm(p);
      $('#editorTitle').textContent = 'Editar presupuesto';
    } else {
      fillForm(defaultFormState());
      $('#editorTitle').textContent = 'Nuevo presupuesto';
    }
    showView('editor');
  }

  function initTheme() {
    const theme = Storage.getTheme();
    document.documentElement.dataset.theme = theme;
    updateThemeIcon(theme);
  }

  function toggleTheme() {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    Storage.setTheme(next);
    updateThemeIcon(next);
    recalculate();
  }

  function updateThemeIcon(theme) {
    $('#themeToggle').textContent = theme === 'dark' ? '☀️' : '🌙';
    $('#themeToggle').title = theme === 'dark' ? 'Modo claro' : 'Modo oscuro';
  }

  async function shareWhatsApp() {
    if (!lastResult) {
      alert('Completá las medidas primero.');
      return;
    }

    const form = readForm();
    const canvas = $('#floorCanvas');
    const lines = [
      `*Presupuesto — ${form.cliente || 'Cliente'}*`,
      `Medidas: ${form.roomWidthM} × ${form.roomLengthM} m (${lastResult.areaM2.toFixed(2)} m²)`,
      `Patrón: ${TileCalc.PATTERNS[form.pattern]}`,
      `Baldosas: ${lastResult.totalTilesWithSpare} (+${form.sparePercent}% repuesto)`,
      `Cajas: ${lastResult.totalBoxes}`,
      ...lastResult.breakdown.map((r) => `• ${r.name}: ${r.tilesWithSpare} u. (${r.boxes} cajas)`),
    ];

    try {
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
      const file = new File([blob], 'plano-piso.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: 'Presupuesto baldosa',
          text: lines.join('\n'),
          files: [file],
        });
        return;
      }
    } catch {
      /* fallback */
    }

    const text = encodeURIComponent(lines.join('\n'));
    window.open(`https://wa.me/?text=${text}`, '_blank');
  }

  function printPresupuesto() {
    if (!lastResult) {
      alert('Completá las medidas primero.');
      return;
    }
    const form = readForm();
    $('#printCliente').textContent = form.cliente || '—';
    $('#printMedidas').textContent = `${form.roomWidthM} × ${form.roomLengthM} m`;
    $('#printArea2').textContent = `${lastResult.areaM2.toFixed(2)} m²`;
    $('#printPatron').textContent = TileCalc.PATTERNS[form.pattern] || form.pattern;

    const wrap = $('#printCanvasWrap');
    wrap.innerHTML = '';
    const clone = $('#floorCanvas').cloneNode(true);
    wrap.appendChild(clone);

    const pt = $('#printTable');
    pt.innerHTML = `
      <thead><tr><th>Color</th><th>Baldosas</th><th>Con repuesto</th><th>Cajas</th></tr></thead>
      <tbody>${lastResult.breakdown
        .map(
          (r) =>
            `<tr><td>${escapeHtml(r.name)}</td><td>${r.tiles}</td><td>${r.tilesWithSpare}</td><td>${r.boxes}</td></tr>`
        )
        .join('')}</tbody>
      <tfoot><tr><td colspan="2"><strong>Total</strong></td><td>${lastResult.totalTilesWithSpare}</td><td>${lastResult.totalBoxes}</td></tr></tfoot>`;

    window.print();
  }

  function exportBackup() {
    const json = Storage.exportAll();
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `presupuestos_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importBackup(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        Storage.importAll(reader.result, true);
        alert('Backup importado correctamente.');
        renderDashboard();
      } catch (e) {
        alert('Error al importar: ' + e.message);
      }
    };
    reader.readAsText(file);
  }

  function initMeasurePhoto() {
    const canvas = $('#measureCanvas');
    const fileInput = $('#photoFile');
    const refLength = $('#refLength');

    measureSession = PhotoMeasure.createMeasureSession(canvas);
    measureSession.setOnUpdate((result) => {
      if (result.ready) {
        $('#roomWidth').value = result.widthM.toFixed(2);
        $('#roomLength').value = result.lengthM.toFixed(2);
        debounce(recalculate);
      }
    });

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const img = await PhotoMeasure.loadImageFromFile(file);
      measureSession.setImage(img);
      measureSession.resetAll();
      $('#measureStep').textContent = '1. Marcá los dos extremos de una referencia conocida';
    });

    refLength.addEventListener('input', () => {
      measureSession.setRefLength(parseFloat(refLength.value) || 1);
    });

    $('#btnRefDone').addEventListener('click', () => {
      measureSession.setMode('contour');
      $('#measureStep').textContent = '2. Marcá el contorno del piso (clic para agregar puntos)';
    });

    $('#btnContourUndo').addEventListener('click', () => measureSession.undoContour());
    $('#btnMeasureReset').addEventListener('click', () => {
      measureSession.resetAll();
      $('#measureStep').textContent = '1. Marcá los dos extremos de una referencia conocida';
    });
  }

  function initMeasureVideo() {
    const video = $('#measureVideo');
    const fileInput = $('#videoFile');
    const canvas = $('#measureVideoCanvas');
    let session = null;

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      video.src = URL.createObjectURL(file);
      video.classList.remove('hidden');
    });

    $('#btnCaptureFrame').addEventListener('click', () => {
      if (video.readyState < 2) {
        alert('Esperá a que cargue el video.');
        return;
      }
      const frame = PhotoMeasure.captureVideoFrame(video);
      canvas.classList.remove('hidden');
      if (!session) {
        session = PhotoMeasure.createMeasureSession(canvas);
        session.setOnUpdate((result) => {
          if (result.ready) {
            $('#roomWidth').value = result.widthM.toFixed(2);
            $('#roomLength').value = result.lengthM.toFixed(2);
            debounce(recalculate);
          }
        });
      }
      session.setImage(frame);
      session.resetAll();
      $('#videoMeasureStep').textContent = '1. Marcá referencia en el cuadro capturado';
    });

    $('#refLengthVideo').addEventListener('input', () => {
      session?.setRefLength(parseFloat($('#refLengthVideo').value) || 1);
    });

    $('#btnVideoRefDone').addEventListener('click', () => {
      session?.setMode('contour');
      $('#videoMeasureStep').textContent = '2. Marcá el contorno del piso';
    });
  }

  function bindEvents() {
    $('#btnNew').addEventListener('click', () => openEditor(null));
    $('#btnBack').addEventListener('click', () => showView('dashboard'));
    $('#btnSave').addEventListener('click', savePresupuesto);
    $('#btnShare').addEventListener('click', shareWhatsApp);
    $('#btnPrint').addEventListener('click', printPresupuesto);
    $('#themeToggle').addEventListener('click', toggleTheme);
    $('#btnExport').addEventListener('click', exportBackup);
    $('#importFile').addEventListener('change', (e) => {
      const f = e.target.files?.[0];
      if (f) importBackup(f);
      e.target.value = '';
    });

    $$('.measure-tab').forEach((tab) => {
      tab.addEventListener('click', () => setMeasureTab(tab.dataset.tab));
    });

    $('#pattern').addEventListener('change', () => {
      updatePatternUI();
      debounce(recalculate);
    });

    const inputs = '#cliente, #link, #roomWidth, #roomLength, #tileWidth, #tileLength, #tilesPerBox, #sparePercent, #aisleWidth, #stripeWidth, #color1Name, #color1Hex, #color2Name, #color2Hex, #color3Name, #color3Hex, #customPct1, #customPct2, #customPct3';
    $$(inputs).forEach((el) => {
      el.addEventListener('input', () => debounce(recalculate));
    });

    $('#dashboardGrid').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      if (action === 'edit') openEditor(id);
      else if (action === 'dup') {
        Storage.duplicate(id);
        renderDashboard();
      } else if (action === 'del') {
        if (confirm('¿Borrar este presupuesto?')) {
          Storage.remove(id);
          renderDashboard();
        }
      }
    });

    $$('.color-hex').forEach((input) => {
      input.addEventListener('input', () => {
        const preview = input.parentElement.querySelector('.color-preview');
        if (preview) preview.style.background = input.value;
        debounce(recalculate);
      });
    });
  }

  function init() {
    initTheme();
    bindEvents();
    initMeasurePhoto();
    initMeasureVideo();
    populatePatterns();
    showView('dashboard');
  }

  function populatePatterns() {
    const sel = $('#pattern');
    sel.innerHTML = Object.entries(TileCalc.PATTERNS)
      .map(([k, v]) => `<option value="${k}">${v}</option>`)
      .join('');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
