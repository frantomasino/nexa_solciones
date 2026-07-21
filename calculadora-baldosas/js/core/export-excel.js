/**
 * Exportación de presupuestos a CSV (abre directo en Excel).
 * Separador ; y UTF-8 BOM para compatibilidad en español (es-AR).
 */
(function (global) {
  'use strict';

  const SEP = ';';

  function csvCell(value) {
    if (value == null) return '';
    const s = String(value);
    if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function rowToCsv(cells) {
    return cells.map(csvCell).join(SEP);
  }

  function fmtNum(n, decimals = 2) {
    if (n == null || Number.isNaN(Number(n))) return '';
    return Number(n).toFixed(decimals).replace('.', ',');
  }

  function totalsFromPresupuesto(p) {
    const bd = p.breakdown || [];
    const netas = bd.reduce((s, r) => s + (r.tiles || 0), 0);
    const repuesto = bd.reduce((s, r) => s + (r.spareTiles ?? Math.max(0, (r.tilesWithSpare || 0) - (r.tiles || 0))), 0);
    return {
      netas: p.totalTiles ?? netas,
      repuesto: p.totalSpareTiles ?? repuesto,
      comprar: p.totalTilesWithSpare ?? netas + repuesto,
      cajas: p.totalBoxes ?? bd.reduce((s, r) => s + (r.boxes || 0), 0),
    };
  }

  function formatColors(p) {
    const n = p.colorCount || (p.breakdown?.length ?? 0);
    const names = (p.colors || []).slice(0, n).map((c) => c.name).filter(Boolean);
    return names.join(' · ') || '—';
  }

  function formatDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  function patternLabel(p) {
    const patterns = global.TileCalc?.PATTERNS || {};
    return patterns[p.pattern] || p.pattern || '';
  }

  function summaryHeaders() {
    return [
      'Cliente',
      'Referencia',
      'Link',
      'Notas',
      'Ancho (m)',
      'Largo (m)',
      'm² pedidos',
      'm² cubiertos',
      'Grilla (ancho × largo)',
      'Patrón',
      'Cant. colores',
      'Colores',
      'Baldosa (cm)',
      'Baldosas/caja',
      '% repuesto cortes',
      'Baldosas netas',
      'Repuesto cortes',
      'Total a comprar',
      'Cajas',
      'Usuario',
      'Fecha',
    ];
  }

  function summaryRow(p) {
    const t = totalsFromPresupuesto(p);
    const w = p.roomWidthM || 0;
    const l = p.roomLengthM || 0;
    const area = p.areaM2 ?? w * l;
    const gridLabel = p.cols && p.rows ? `${p.cols} × ${p.rows}` : '';
    const covered = p.coveredM2 != null ? p.coveredM2 : '';

    return [
      p.cliente?.trim() || 'Sin nombre',
      p.referencia || '',
      p.link || '',
      p.notas || '',
      w ? fmtNum(w) : '',
      l ? fmtNum(l) : '',
      area ? fmtNum(area) : '',
      covered !== '' ? fmtNum(covered) : '',
      gridLabel,
      patternLabel(p),
      p.colorCount || '',
      formatColors(p),
      '40×40',
      p.tilesPerBox ?? 4,
      p.sparePercent ?? 10,
      t.netas,
      t.repuesto,
      t.comprar,
      t.cajas,
      p.createdBy || p.updatedBy || '',
      formatDate(p.updatedAt || p.createdAt || new Date().toISOString()),
    ];
  }

  function detailHeaders() {
    return ['Color', 'Código', 'Netas', 'Repuesto', 'A comprar', '%', 'Cajas'];
  }

  function buildSingleBudgetCsv(p) {
    const t = totalsFromPresupuesto(p);
    const w = p.roomWidthM || 0;
    const l = p.roomLengthM || 0;
    const area = p.areaM2 ?? w * l;
    const stamp = formatDate(new Date().toISOString());
    const lines = [];

    lines.push(rowToCsv(['NEXA SOLUCIONES — PRESUPUESTO DE PISO']));
    lines.push(rowToCsv(['Generado', stamp]));
    lines.push('');

    const info = [
      ['Cliente', p.cliente?.trim() || 'Sin nombre'],
      ['Referencia / Obra', p.referencia || ''],
      ['Link', p.link || ''],
      ['Medidas (ancho × largo)', w && l ? `${fmtNum(w)} m × ${fmtNum(l)} m` : ''],
      ['m² pedidos', area ? `${fmtNum(area)} m²` : ''],
      ['m² cubiertos por plano', p.coveredM2 ? `${fmtNum(p.coveredM2)} m²` : ''],
      ['Grilla baldosas', p.cols && p.rows ? `${p.cols} × ${p.rows}` : ''],
      ['Plano (ancho × largo)', p.actualWidthM && p.actualLengthM ? `${fmtNum(p.actualWidthM)} m × ${fmtNum(p.actualLengthM)} m` : ''],
      ['Tipo de piso', patternLabel(p)],
      ['Colores', formatColors(p)],
      ['Baldosa', '40×40 cm'],
      ['Baldosas por caja', p.tilesPerBox ?? 4],
      ['Repuesto cortes', `${p.sparePercent ?? 10}%`],
      ['Baldosas netas', t.netas],
      ['Repuesto', t.repuesto],
      ['Total a comprar', t.comprar],
      ['Cajas totales', t.cajas],
      ['Notas', p.notas || ''],
      ['Elaborado por', p.createdBy || p.updatedBy || ''],
    ];

    lines.push(rowToCsv(['Campo', 'Valor']));
    for (const [label, value] of info) {
      if (value !== '' && value != null) lines.push(rowToCsv([label, value]));
    }

    lines.push('');
    lines.push(rowToCsv(['DETALLE POR COLOR']));
    lines.push(rowToCsv(detailHeaders()));

    for (const r of p.breakdown || []) {
      const spare = r.spareTiles ?? Math.max(0, (r.tilesWithSpare || 0) - (r.tiles || 0));
      lines.push(rowToCsv([
        r.name || '',
        r.hex || '',
        r.tiles ?? 0,
        spare,
        r.tilesWithSpare ?? 0,
        r.percent != null ? fmtNum(r.percent, 1) : '',
        r.boxes ?? 0,
      ]));
    }

    lines.push(rowToCsv(['TOTAL', '', t.netas, t.repuesto, t.comprar, '100', t.cajas]));
    lines.push('');
    lines.push(rowToCsv([`Total final: ${t.netas} netas + ${t.repuesto} repuesto = ${t.comprar} baldosas · ${t.cajas} cajas`]));

    return `\ufeff${lines.join('\r\n')}`;
  }

  function buildMultiBudgetCsv(presupuestos) {
    const lines = [];
    const stamp = formatDate(new Date().toISOString());

    lines.push(rowToCsv(['NEXA SOLUCIONES — LISTADO DE PRESUPUESTOS']));
    lines.push(rowToCsv(['Generado', stamp]));
    lines.push(rowToCsv(['Cantidad', presupuestos.length]));
    lines.push('');
    lines.push(rowToCsv(summaryHeaders()));

    for (const p of presupuestos) {
      lines.push(rowToCsv(summaryRow(p)));
    }

    lines.push('');
    lines.push(rowToCsv(['DETALLE POR COLOR']));
    lines.push(rowToCsv(['Cliente', 'Referencia', ...detailHeaders()]));

    for (const p of presupuestos) {
      const cliente = p.cliente?.trim() || 'Sin nombre';
      const ref = p.referencia || '';
      for (const r of p.breakdown || []) {
        const spare = r.spareTiles ?? Math.max(0, (r.tilesWithSpare || 0) - (r.tiles || 0));
        lines.push(rowToCsv([
          cliente,
          ref,
          r.name || '',
          r.hex || '',
          r.tiles ?? 0,
          spare,
          r.tilesWithSpare ?? 0,
          r.percent != null ? fmtNum(r.percent, 1) : '',
          r.boxes ?? 0,
        ]));
      }
    }

    return `\ufeff${lines.join('\r\n')}`;
  }

  function buildWorkbook(presupuestos) {
    const list = Array.isArray(presupuestos) ? presupuestos.filter(Boolean) : [];
    if (list.length === 1) return buildSingleBudgetCsv(list[0]);
    return buildMultiBudgetCsv(list);
  }

  function safeFilename(name) {
    const cleaned = (name || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);
    return cleaned || 'sin-nombre';
  }

  function dateSlug() {
    return new Date().toISOString().slice(0, 10);
  }

  function downloadCsv(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function exportPresupuestos(presupuestos, options = {}) {
    const list = Array.isArray(presupuestos) ? presupuestos.filter(Boolean) : [];
    if (!list.length) {
      return { ok: false, error: 'No hay presupuestos para exportar.' };
    }

    const content = buildWorkbook(list);
    let filename;

    if (list.length === 1) {
      const p = list[0];
      const slug = safeFilename(p.cliente || p.referencia);
      filename = options.filename || `nexa-${slug}-${dateSlug()}.csv`;
    } else {
      filename = options.filename || `nexa-presupuestos-${dateSlug()}.csv`;
    }

    downloadCsv(content, filename);
    return { ok: true, count: list.length, filename };
  }

  function exportOne(presupuesto) {
    if (!presupuesto) return { ok: false, error: 'Presupuesto no encontrado.' };
    return exportPresupuestos([presupuesto]);
  }

  function exportAll(getAllFn) {
    const items = typeof getAllFn === 'function' ? getAllFn() : [];
    return exportPresupuestos(items);
  }

  global.NexaExport = {
    exportPresupuestos,
    exportOne,
    exportAll,
    buildWorkbook,
    totalsFromPresupuesto,
  };
})(typeof window !== 'undefined' ? window : globalThis);
