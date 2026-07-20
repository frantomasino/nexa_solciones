/**
 * Orquestación: vistas, formularios, eventos y cálculo en vivo.
 */
(function () {
  'use strict';

  const DEBOUNCE_MS = 300;
  const OTHER_PATTERNS = [
    'solid', 'border-center', 'checkerboard',
    'stripes-h', 'stripes-v', 'center-aisle', 'transverse-aisle', 'custom',
  ];

  let currentId = null;
  let measureSession = null;
  let debounceTimer = null;
  let lastResult = null;
  let selectedPattern = 'rejilla';
  let tileSizeMode = '50';
  let logoImageData = null;
  let logoImageEl = null;
  let deferredInstallPrompt = null;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  function debounce(fn) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fn, DEBOUNCE_MS);
  }

  function defaultFormState() {
    const dims = TileCalc.dimensionsFromArea(22);
    return {
      cliente: '',
      referencia: '',
      link: '',
      notas: '',
      roomWidthM: dims.roomWidthM,
      roomLengthM: dims.roomLengthM,
      areaM2: 22,
      tileWidthCm: 50,
      tileLengthCm: 50,
      tilesPerBox: 4,
      sparePercent: 10,
      pattern: 'rejilla',
      aisleWidth: 2,
      stripeWidth: 1,
      colors: TileCalc.DEFAULT_COLORS.map((c) => ({ ...c })),
      customPercents: [50, 30, 20],
      measureMethod: 'manual',
      logoEnabled: false,
      logoImage: null,
      logoTileBg: '#ffffff',
      logoSpan: 1,
      photoThumb: null,
    };
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
      tileWidthCm: parseFloat($('#tileWidth').value) || 50,
      tileLengthCm: parseFloat($('#tileLength').value) || 50,
      tilesPerBox: parseInt($('#tilesPerBox').value, 10) || 4,
      sparePercent: parseFloat($('#sparePercent').value) || 0,
      pattern: selectedPattern,
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
    const area = w * l;
    $('#areaFromDims').textContent = `${area.toFixed(2)} m²`;
    if ($('#areaInput')) $('#areaInput').value = area.toFixed(2);
  }

  function applyAreaInput() {
    const area = parseFloat($('#areaInput').value);
    if (!area || area <= 0) return;
    const dims = TileCalc.dimensionsFromArea(area);
    $('#roomWidth').value = dims.roomWidthM.toFixed(2);
    $('#roomLength').value = dims.roomLengthM.toFixed(2);
    updateAreaFromDims();
  }

  function fillForm(data) {
    $('#cliente').value = data.cliente || '';
    $('#referencia').value = data.referencia || '';
    $('#link').value = data.link || '';
    $('#notas').value = data.notas || '';
    $('#roomWidth').value = (data.roomWidthM ?? 4.69).toFixed(2);
    $('#roomLength').value = (data.roomLengthM ?? 4.69).toFixed(2);
    if ($('#areaInput')) {
      const area = data.areaM2 ?? (data.roomWidthM * data.roomLengthM);
      $('#areaInput').value = area.toFixed(2);
    }
    updateAreaFromDims();

    const tw = data.tileWidthCm ?? 50;
    const preset = Object.keys(TileCalc.TILE_PRESETS).find(
      (k) => TileCalc.TILE_PRESETS[k].w === tw && TileCalc.TILE_PRESETS[k].l === tw
    );
    setTileSize(preset || 'custom', tw, data.tileLengthCm ?? tw);

    $('#tilesPerBox').value = data.tilesPerBox ?? 4;
    $('#sparePercent').value = data.sparePercent ?? 10;

    selectedPattern = data.pattern || 'rejilla';
    updatePatternSelection();

    $('#aisleWidth').value = data.aisleWidth ?? 2;
    $('#stripeWidth').value = data.stripeWidth ?? 1;

    const colors = data.colors || TileCalc.DEFAULT_COLORS;
    $('#color1Name').value = colors[0]?.name || 'Gris (fondo)';
    $('#color1Hex').value = colors[0]?.hex || '#7a7a7a';
    $('#color2Name').value = colors[1]?.name || 'Negro';
    $('#color2Hex').value = colors[1]?.hex || '#1a1a1a';
    $('#color3Name').value = colors[2]?.name || 'Rojo';
    $('#color3Hex').value = colors[2]?.hex || '#c41e1e';

    const pcts = data.customPercents || [50, 30, 20];
    $('#customPct1').value = pcts[0];
    $('#customPct2').value = pcts[1];
    $('#customPct3').value = pcts[2];

    $('#photoThumbData').value = data.photoThumb || '';
    setMeasureTab(data.measureMethod || 'manual');

    const logoOn = !!data.logoEnabled;
    $('#logoEnabled').checked = logoOn;
    $('#logoTileBg').value = data.logoTileBg || '#ffffff';
    $('#logoSpan').value = String(data.logoSpan || 1);
        logoImageData = data.logoImage || Storage.getCompanyLogo();
        if (data.logoImage) setLogoPreview(data.logoImage);
        else if (logoOn && logoImageData) setLogoPreview(logoImageData);
    updateLogoUI();

    updatePatternUI();
    recalculate();
  }

  function updateLogoUI() {
    const on = $('#logoEnabled')?.checked;
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
    if (form?.logoEnabled && logoImageData) {
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

  function setTileSize(mode, w, l) {
    tileSizeMode = mode;
    $$('.tile-size-btn').forEach((b) => b.classList.toggle('active', b.dataset.size === mode));
    const customRow = $('#customSizeRow');
    if (mode === 'custom') {
      customRow.classList.remove('hidden');
      $('#tileWidth').value = w ?? 50;
      $('#tileLength').value = l ?? 50;
    } else {
      customRow.classList.add('hidden');
      const p = TileCalc.TILE_PRESETS[mode];
      if (p) {
        $('#tileWidth').value = p.w;
        $('#tileLength').value = p.l;
      }
    }
  }

  function setMeasureTab(tab) {
    $$('.measure-tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
    $$('.measure-panel').forEach((p) => p.classList.toggle('hidden', p.dataset.panel !== tab));
  }

  function updatePatternUI() {
    const pattern = selectedPattern;
    const needs2 = !['solid', 'custom', 'rejilla', 'trama', 'moneda'].includes(pattern);
    const needs3 = ['custom', 'rejilla', 'trama', 'moneda'].includes(pattern);
    const needsAisle = pattern === 'center-aisle' || pattern === 'transverse-aisle';
    const needsStripe = pattern === 'stripes-h' || pattern === 'stripes-v';

    $('#color2Group').classList.toggle('hidden', !needs2 && !needs3);
    $('#color3Group').classList.toggle('hidden', !needs3);
    $('#customPctGroup').classList.toggle('hidden', pattern !== 'custom');
    $('#aisleWidthGroup').classList.toggle('hidden', !needsAisle);
    $('#stripeWidthGroup').classList.toggle('hidden', !needsStripe);
  }

  function updatePatternSelection() {
    $$('.pattern-btn, .floor-type-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.pattern === selectedPattern);
    });
    updatePatternUI();
  }

  async function recalculate() {
    const form = readForm();
    if (form.roomWidthM <= 0 || form.roomLengthM <= 0) {
      renderResults(null);
      return;
    }

    lastResult = TileCalc.calculate(form);
    const canvas = $('#floorCanvas');
    const empty = $('#canvasEmpty');
    await TileCalc.drawFloorPlanAsync(canvas, lastResult, getDrawOptions(form));
    canvas.classList.remove('hidden');
    empty.classList.add('hidden');

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
      $('#statComprar').textContent = '—';
      $('#statCubierto').textContent = '—';
      $('#statGrilla').textContent = '—';
      $('#totalTiles').textContent = '—';
      $('#totalBoxes').textContent = '—';
      $('#canvasEmpty').classList.remove('hidden');
      $('#floorCanvas').classList.add('hidden');
      return;
    }

    empty.classList.add('hidden');
    tbody.innerHTML = result.breakdown
      .map(
        (row) => `
      <tr>
        <td><span class="color-swatch" style="background:${row.hex}"></span>${escapeHtml(row.name)}</td>
        <td>${row.tilesWithSpare}</td>
        <td>${row.percent}%</td>
        <td>${row.boxes}</td>
      </tr>`
      )
      .join('');

    $('#statNetas').textContent = result.totalTiles;
    $('#statComprar').textContent = result.totalTilesWithSpare;
    $('#statCubierto').textContent = `${result.coveredM2.toFixed(1)} m²`;
    $('#statGrilla').textContent = `${result.cols}×${result.rows}`;
    $('#totalTiles').textContent = result.totalTilesWithSpare;
    $('#totalBoxes').textContent = result.totalBoxes;
    $('#totalPct').textContent = '100%';
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
    closeMoreMenu();
  }

  function closeMoreMenu() {
    $('#moreMenu')?.classList.add('hidden');
    $('#btnMoreMenu')?.setAttribute('aria-expanded', 'false');
  }

  function toggleMoreMenu() {
    const menu = $('#moreMenu');
    menu?.classList.toggle('hidden');
    const isOpen = !menu?.classList.contains('hidden');
    $('#btnMoreMenu')?.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
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
              <button type="button" class="btn-icon-action" data-action="edit" data-id="${p.id}" title="Editar">✎</button>
              <button type="button" class="btn-icon-action" data-action="dup" data-id="${p.id}" title="Duplicar">⧉</button>
              <button type="button" class="btn-icon-action btn-icon-danger" data-action="del" data-id="${p.id}" title="Borrar">✕</button>
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
      totalTilesWithSpare: lastResult?.totalTilesWithSpare,
      totalBoxes: lastResult?.totalBoxes,
      canvasThumb: createThumb($('#floorCanvas')) || $('#photoThumbData').value || null,
      breakdown: lastResult?.breakdown,
      logoEnabled: form.logoEnabled,
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
      fillForm(defaultFormState());
      $('#editorTitle').textContent = 'Nuevo presupuesto';
    }
    showView('editor');
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
      `A comprar (+${form.sparePercent}% cortes): ${lastResult.totalTilesWithSpare}`,
      `Cajas: ${lastResult.totalBoxes}`,
      ...lastResult.breakdown.map((r) => `• ${r.name}: ${r.tilesWithSpare} u. (${r.boxes} cajas)`),
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

  function printPresupuesto() {
    if (!lastResult) { alert('Calculá el piso primero.'); return; }
    const form = readForm();
    $('#printCliente').textContent = form.cliente || '—';
    $('#printReferencia').textContent = form.referencia || '—';
    $('#printMedidas').textContent = `${form.roomWidthM.toFixed(2)} × ${form.roomLengthM.toFixed(2)} m`;
    $('#printArea2').textContent = `${lastResult.areaM2.toFixed(2)} m²`;
    $('#printPatron').textContent = TileCalc.PATTERNS[form.pattern] || form.pattern;

    const wrap = $('#printCanvasWrap');
    wrap.innerHTML = '';
    wrap.appendChild($('#floorCanvas').cloneNode(true));

    $('#printTable').innerHTML = `
      <thead><tr><th>Color</th><th>Netas</th><th>Con repuesto</th><th>Cajas</th></tr></thead>
      <tbody>${lastResult.breakdown.map((r) =>
        `<tr><td>${escapeHtml(r.name)}</td><td>${r.tiles}</td><td>${r.tilesWithSpare}</td><td>${r.boxes}</td></tr>`
      ).join('')}</tbody>
      <tfoot><tr><td><strong>Total</strong></td><td>${lastResult.totalTiles}</td><td>${lastResult.totalTilesWithSpare}</td><td>${lastResult.totalBoxes}</td></tr></tfoot>`;

    window.print();
  }

  function buildPatternGrids() {
    const floorGrid = $('#floorTypeGrid');
    floorGrid.innerHTML = Object.entries(TileCalc.FLOOR_TYPES)
      .map(([key, label]) => {
        const preview = TileCalc.getPatternPreview(key);
        return `<button type="button" class="pattern-btn floor-type-btn${key === selectedPattern ? ' active' : ''}" data-pattern="${key}">
          <img src="${preview}" alt="${label}" width="48" height="48">
          <span>${label}</span>
        </button>`;
      }).join('');

    const patGrid = $('#patternGrid');
    patGrid.innerHTML = OTHER_PATTERNS
      .map((key) => {
        const label = TileCalc.PATTERNS[key];
        const preview = TileCalc.getPatternPreview(key);
        return `<button type="button" class="pattern-btn${key === selectedPattern ? ' active' : ''}" data-pattern="${key}">
          <img src="${preview}" alt="${label}" width="48" height="48">
          <span>${label}</span>
        </button>`;
      }).join('');

    $$('.pattern-btn, .floor-type-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedPattern = btn.dataset.pattern;
        updatePatternSelection();
        debounce(recalculate);
      });
    });
  }

  function initMeasurePhoto() {
    const canvas = $('#measureCanvas');
    measureSession = PhotoMeasure.createMeasureSession(canvas);
    measureSession.setOnUpdate((result) => {
      if (result.ready) {
        $('#roomWidth').value = result.widthM.toFixed(2);
        $('#roomLength').value = result.lengthM.toFixed(2);
        updateAreaFromDims();
        debounce(recalculate);
      }
    });

    $('#photoFile').addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      measureSession.setImage(await PhotoMeasure.loadImageFromFile(file));
      measureSession.resetAll();
    });

    $('#refLength').addEventListener('input', () => measureSession.setRefLength(parseFloat($('#refLength').value) || 1));
    $('#btnRefDone').addEventListener('click', () => measureSession.setMode('contour'));
    $('#btnContourUndo').addEventListener('click', () => measureSession.undoContour());
    $('#btnMeasureReset').addEventListener('click', () => measureSession.resetAll());
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
    const saved = Storage.getCompanyLogo();
    if (saved) {
      logoImageData = saved;
      setLogoPreview(saved);
    }

    $('#logoEnabled').addEventListener('change', () => {
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

  function initPWA() {
    const btn = $('#btnInstall');
    const modal = $('#installModal');
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    const isFile = window.location.protocol === 'file:';

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

    btn?.addEventListener('click', () => modal?.showModal());

    $('#btnInstallNative')?.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      modal?.close();
    });
  }

  function bindEvents() {
    $('#btnNew').addEventListener('click', () => openEditor(null));
    $('#btnNewEmpty')?.addEventListener('click', () => openEditor(null));
    $('#btnBack').addEventListener('click', () => showView('dashboard'));
    $('#btnSave').addEventListener('click', savePresupuesto);
    $('#btnShare').addEventListener('click', shareWhatsApp);
    $('#btnPrint').addEventListener('click', printPresupuesto);
    $('#btnCalculate').addEventListener('click', recalculate);
    $('#themeToggle').addEventListener('click', toggleTheme);
    $('#btnMoreMenu')?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMoreMenu();
    });
    document.addEventListener('click', closeMoreMenu);
    $('#moreMenu')?.addEventListener('click', (e) => e.stopPropagation());
    $('#btnExport').addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([Storage.exportAll()], { type: 'application/json' }));
      a.download = `presupuestos_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
    });
    $('#importFile').addEventListener('change', (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try { Storage.importAll(reader.result, true); alert('Backup importado.'); renderDashboard(); }
        catch (err) { alert('Error: ' + err.message); }
      };
      reader.readAsText(f);
      e.target.value = '';
    });

    $$('.measure-tab').forEach((tab) => tab.addEventListener('click', () => setMeasureTab(tab.dataset.tab)));

    $('#areaInput')?.addEventListener('input', () => { applyAreaInput(); debounce(recalculate); });
    $('#roomWidth').addEventListener('input', () => { updateAreaFromDims(); debounce(recalculate); });
    $('#roomLength').addEventListener('input', () => { updateAreaFromDims(); debounce(recalculate); });

    $$('.tile-size-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const size = btn.dataset.size;
        if (size === 'custom') setTileSize('custom', parseFloat($('#tileWidth').value), parseFloat($('#tileLength').value));
        else setTileSize(size);
        debounce(recalculate);
      });
    });

    const inputs = '#cliente, #referencia, #link, #notas, #tileWidth, #tileLength, #tilesPerBox, #sparePercent, #aisleWidth, #stripeWidth, #color1Name, #color1Hex, #color2Name, #color2Hex, #color3Name, #color3Hex, #customPct1, #customPct2, #customPct3';
    $$(inputs).forEach((el) => el.addEventListener('input', () => debounce(recalculate)));

    $('#searchPresupuestos')?.addEventListener('input', () => renderDashboard());

    $('#dashboardTableBody').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (btn) {
        const { id, action } = btn.dataset;
        if (action === 'edit') openEditor(id);
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
    bindEvents();
    initMeasurePhoto();
    initUser();
    initLogo();
    initPWA();
    showView('dashboard');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
