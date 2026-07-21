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
    return names.join(' / ') || '—';
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
      'Creado',
      'Actualizado',
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
      p.cliente || '',
      p.referencia || '',
      p.link || '',
      p.notas || '',
      w ? w.toFixed(2) : '',
      l ? l.toFixed(2) : '',
      area ? area.toFixed(2) : '',
      covered !== '' ? Number(covered).toFixed(2) : '',
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
      formatDate(p.createdAt),
      formatDate(p.updatedAt),
    ];
  }

  function detailHeaders() {
    return [
      'Cliente',
      'Referencia',
      'Patrón',
      'Color',
      'Código color',
      'Baldosas netas',
      'Repuesto',
      'A comprar',
      '% del total',
      'Cajas',
    ];
  }

  function detailRows(p) {
    const patron = patternLabel(p);
    const cliente = p.cliente || '';
    const ref = p.referencia || '';
    const rows = [];

    for (const r of p.breakdown || []) {
      const spare = r.spareTiles ?? Math.max(0, (r.tilesWithSpare || 0) - (r.tiles || 0));
      rows.push([
        cliente,
        ref,
        patron,
        r.name || '',
        r.hex || '',
        r.tiles ?? 0,
        spare,
        r.tilesWithSpare ?? 0,
        r.percent ?? '',
        r.boxes ?? 0,
      ]);
    }

    return rows;
  }

  function buildWorkbook(presupuestos) {
    const lines = [];
    const stamp = formatDate(new Date().toISOString());
    lines.push(rowToCsv(['Nexa Soluciones — Exportación de presupuestos']));
    lines.push(rowToCsv([`Generado: ${stamp}`]));
    lines.push('');

    lines.push(rowToCsv(['RESUMEN']));
    lines.push(rowToCsv(summaryHeaders()));
    for (const p of presupuestos) {
      lines.push(rowToCsv(summaryRow(p)));
    }

    lines.push('');
    lines.push(rowToCsv(['DETALLE POR COLOR']));
    lines.push(rowToCsv(detailHeaders()));
    for (const p of presupuestos) {
      for (const row of detailRows(p)) {
        lines.push(rowToCsv(row));
      }
    }

    return `\ufeff${lines.join('\r\n')}`;
  }

  function safeFilename(name) {
    return (name || 'presupuesto')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'presupuesto';
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
      const slug = safeFilename(list[0].cliente);
      filename = options.filename || `presupuesto-${slug}-${dateSlug()}.csv`;
    } else {
      filename = options.filename || `presupuestos-nexa-${dateSlug()}.csv`;
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
