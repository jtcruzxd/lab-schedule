/**
 * render.js — builds the DOM from SCHEDULE_DATA
 */
(function () {
  'use strict';

  /* ── tiny helpers ── */
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ── expose for editor ── */
  window.RenderHelpers = { el, esc };

  /* ── dept color helpers ── */
  window.getDeptColor = function(deptId) {
    if (!deptId) return '#2d5fa6';
    /* match by id first, then by normalised label */
    const d = SCHEDULE_DATA.departments.find(d => d.id === deptId)
           || SCHEDULE_DATA.departments.find(d => d.label.toLowerCase().replace(/[^a-z0-9]/g,'_') === deptId);
    return d ? d.color : '#2d5fa6';
  };
  window.hexToRgba = function(hex, alpha) {
    const h = hex.replace('#','');
    const r = parseInt(h.slice(0,2),16);
    const g = parseInt(h.slice(2,4),16);
    const b = parseInt(h.slice(4,6),16);
    return `rgba(${r},${g},${b},${alpha})`;
  };
  window.applyCardColor = function(card, deptId) {
    const color = window.getDeptColor(deptId);
    card.style.borderLeftColor = color;
    card.style.background = window.hexToRgba(color, 0.09);
    const badge = card.querySelector('.cc-time');
    if (badge) badge.style.background = color;
  };

  /* ══════════════════════
     VACANT CELL
     ══════════════════════ */
  window.buildVacant = function() {
    const d = el('div','vacant-cell');
    d.innerHTML = '<span class="vc-icon">🔧</span><span class="vc-text">Vacant</span>';
    return d;
  };

  /* ══════════════════════
     CLASS CARD
     ══════════════════════ */
  window.buildCard = function(cell) {
    const d = el('div','class-card');
    d.dataset.dept = cell.dept || '';
    d.setAttribute('role','group');
    d.innerHTML =
      `<span class="cc-instructor">${esc(cell.instructor)}</span>` +
      `<span class="cc-subject">${esc(cell.subject)}</span>` +
      `<span class="cc-section">${esc(cell.section)}</span>` +
      `<span class="cc-time">${esc(cell.time)}</span>`;
    window.applyCardColor(d, cell.dept);
    return d;
  };

  /* ══════════════════════
     SCHEDULE TABLE
     ══════════════════════ */
  window.renderTable = function() {
    const thead  = document.getElementById('schedHead');
    const tbody  = document.getElementById('schedBody');
    if (!tbody || !thead) return;

    /* ── column headers ── */
    const headRow = document.getElementById('headRow');
    headRow.innerHTML = '';
    const timeTh = el('th','col-time','Time Slot');
    headRow.appendChild(timeTh);
    (SCHEDULE_DATA.columns || ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']).forEach((col, ci) => {
      const th = el('th','',esc(col));
      th.dataset.colIndex = ci;
      headRow.appendChild(th);
    });

    /* ── body rows ── */
    tbody.innerHTML = '';
    const numCols = (SCHEDULE_DATA.columns || []).length;

    SCHEDULE_DATA.rows.forEach((row, ri) => {
      if (row.type === 'lunch') {
        const tr = el('tr','row-lunch');
        const td = el('td','','🍽️&nbsp; L U N C H &nbsp; B R E A K');
        td.setAttribute('colspan', numCols + 1);
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
      }

      const tr = document.createElement('tr');
      tr.dataset.rowIndex = ri;

      const timeTd = el('td','time-col', esc(row.label));
      timeTd.setAttribute('scope','row');
      tr.appendChild(timeTd);

      /* expand cells to flat array of numCols */
      const flat = expandCells(row.cells, numCols);
      let ci = 0;
      while (ci < numCols) {
        const cell = flat[ci] || { type:'vacant' };
        const td   = el('td','slot');
        td.dataset.colIndex = ci;

        const rs = cell.rowspan || 1;
        const cs = cell.colspan || 1;
        if (rs > 1) td.setAttribute('rowspan', rs);
        if (cs > 1) td.setAttribute('colspan', cs);

        td.appendChild(cell.type === 'class' ? window.buildCard(cell) : window.buildVacant());
        tr.appendChild(td);
        ci += cs;
      }

      tbody.appendChild(tr);
    });
  };

  /* expand cells array to flat numCols-wide array */
  window.expandCells = function(cells, numCols) {
    const flat = [];
    (cells||[]).forEach(c => {
      const span = c.colspan || 1;
      const rs   = c.rowspan || 1;
      for (let i = 0; i < span; i++) {
        flat.push(i === 0 ? {...c, colspan:undefined, rowspan: rs > 1 ? rs : undefined} : { type:'vacant' });
      }
    });
    const n = numCols || 6;
    while (flat.length < n) flat.push({ type:'vacant' });
    return flat.slice(0, n);
  };

  /* ══════════════════════
     LEGEND
     ══════════════════════ */
  window.renderLegend = function() {
    const list = document.getElementById('legendList');
    if (!list) return;
    list.innerHTML = '';
    SCHEDULE_DATA.departments.forEach((dept, idx) => {
      list.appendChild(buildLegendItem(dept, idx));
    });
  };

  window.buildLegendItem = function(dept, idx) {
    const li = el('li','legend-item');

    /* swatch + color picker */
    const wrap = el('span','legend-swatch-wrap');
    const sw   = el('span','legend-swatch');
    sw.style.background = dept.color;
    sw.dataset.deptId   = dept.id;
    const cp = document.createElement('input');
    cp.type = 'color'; cp.value = dept.color;
    cp.className = 'legend-color-input';
    cp.dataset.deptId = dept.id;
    cp.addEventListener('input', e => onLegendColor(dept.id, e.target.value));
    wrap.appendChild(sw); wrap.appendChild(cp);

    /* editable label */
    const lbl = document.createElement('input');
    lbl.type = 'text'; lbl.className = 'legend-label-input';
    lbl.value = dept.id !== 'vacant' ? `${dept.label} – ${dept.fullName}` : dept.fullName;
    lbl.addEventListener('change', e => onLegendLabel(dept.id, e.target.value));

    /* delete btn */
    const del = el('button','legend-del-btn','✕');
    del.title = 'Remove';
    del.addEventListener('click', () => {
      SCHEDULE_DATA.departments.splice(idx, 1);
      window.renderLegend();
      window.persistMeta('deptColors',  buildDeptColorsMap());
      window.persistMeta('deptLabels',  buildDeptLabelsMap());
    });

    li.appendChild(wrap); li.appendChild(lbl); li.appendChild(del);
    return li;
  };

  function onLegendColor(deptId, color) {
    const d = SCHEDULE_DATA.departments.find(x => x.id === deptId);
    if (d) d.color = color;
    const sw = document.querySelector(`.legend-swatch[data-dept-id="${deptId}"]`);
    if (sw) sw.style.background = color;
    document.querySelectorAll(`.class-card[data-dept="${deptId}"]`).forEach(c => window.applyCardColor(c, deptId));
    window.persistMeta('deptColors', buildDeptColorsMap());
  }

  function onLegendLabel(deptId, value) {
    const d = SCHEDULE_DATA.departments.find(x => x.id === deptId);
    if (!d) return;
    const parts = value.split('–').map(s => s.trim());
    if (parts.length >= 2) { d.label = parts[0]; d.fullName = parts.slice(1).join('–').trim(); }
    else d.fullName = value;
    window.persistMeta('deptLabels', buildDeptLabelsMap());
  }

  function buildDeptColorsMap() {
    const m = {}; SCHEDULE_DATA.departments.forEach(d => { m[d.id] = d.color; }); return m;
  }
  function buildDeptLabelsMap() {
    const m = {}; SCHEDULE_DATA.departments.forEach(d => { m[d.id] = {label:d.label, fullName:d.fullName}; }); return m;
  }

  /* ══════════════════════
     PC INVENTORY
     ══════════════════════ */
  window.renderPC = function() {
    const wrap = document.getElementById('pcTableWrap');
    if (!wrap) return;
    wrap.innerHTML = '';

    const tbl  = el('table','pc-table');
    const head = el('thead');
    const htr  = el('tr');
    /* headers: Processor, ≤2022, 2023, 2024, 2025, del */
    ['Processor','≤ 2022','2023','2024','2025',''].forEach((h,i) => {
      const th = el('th','',h);
      if (i === 5) th.style.width = '20px';
      htr.appendChild(th);
    });
    head.appendChild(htr); tbl.appendChild(head);

    const tbody = el('tbody');
    SCHEDULE_DATA.pcInventory.forEach((row, idx) => tbody.appendChild(buildPcRow(row, idx)));
    tbl.appendChild(tbody);

    /* total row */
    const tfoot = el('tfoot');
    const ftr   = el('tr');
    const lbl   = el('td',''); lbl.setAttribute('colspan','1'); lbl.innerHTML = '<strong>Total</strong>';
    const valTd = el('td',''); valTd.setAttribute('colspan','4');
    const valIn = document.createElement('input');
    valIn.className = 'pc-cell-input'; valIn.id = 'pcTotalInput';
    valIn.value = String(SCHEDULE_DATA.pcTotal);
    valIn.addEventListener('change', e => {
      SCHEDULE_DATA.pcTotal = e.target.value.trim();
      window.persistMeta('pcTotal', SCHEDULE_DATA.pcTotal);
    });
    valTd.appendChild(valIn);
    ftr.appendChild(lbl); ftr.appendChild(valTd); tfoot.appendChild(ftr); tbl.appendChild(tfoot);

    wrap.appendChild(tbl);

    const addBtn = el('button','pc-add-row-btn','+ Add Row');
    addBtn.addEventListener('click', () => {
      SCHEDULE_DATA.pcInventory.push({ processor:'', y2022:0, y2023:0, y2024:0, y2025:0 });
      window.renderPC();
      window.persistMeta('pcInventory', SCHEDULE_DATA.pcInventory.map(r=>({...r})));
    });
    wrap.appendChild(addBtn);
  };

  function buildPcRow(row, idx) {
    const tr = el('tr');
    tr.dataset.pcIdx = idx;
    /* keys — no dept */
    ['processor','y2022','y2023','y2024','y2025'].forEach((k,i) => {
      const td  = el('td');
      const inp = document.createElement('input');
      inp.className = 'pc-cell-input' + (i===0?' left':'');
      inp.value = row[k] !== undefined ? String(row[k]) : '';
      inp.addEventListener('change', () => {
        row[k] = inp.value.trim();
        window.persistMeta('pcInventory', SCHEDULE_DATA.pcInventory.map(r=>({...r})));
      });
      td.appendChild(inp); tr.appendChild(td);
    });
    const delTd  = el('td');
    const delBtn = el('button','pc-del-btn','✕');
    delBtn.addEventListener('click', () => {
      SCHEDULE_DATA.pcInventory.splice(idx, 1);
      window.renderPC();
      window.persistMeta('pcInventory', SCHEDULE_DATA.pcInventory.map(r=>({...r})));
    });
    delTd.appendChild(delBtn); tr.appendChild(delTd);
    return tr;
  }

  /* ══════════════════════
     SOFTWARE IN USE
     ══════════════════════ */
  window.renderSoftware = function() {
    const wrap = document.getElementById('softwareList');
    if (!wrap) return;
    wrap.innerHTML = '';

    SCHEDULE_DATA.software.forEach((item, idx) => {
      wrap.appendChild(buildSwRow(item, idx));
    });

    const addBtn = el('button','sw-add-btn','+ Add Row');
    addBtn.addEventListener('click', () => {
      SCHEDULE_DATA.software.push({ dept:'', programs:'' });
      window.renderSoftware();
      window.persistMeta('software', SCHEDULE_DATA.software.map(s=>({...s})));
    });
    wrap.appendChild(addBtn);
  };

  function buildSwRow(item, idx) {
    const row = el('div','software-item');

    const deptIn = document.createElement('input');
    deptIn.className = 'sw-input sw-dept';
    deptIn.value = item.dept;
    deptIn.addEventListener('change', () => {
      item.dept = deptIn.value.trim();
      window.persistMeta('software', SCHEDULE_DATA.software.map(s=>({...s})));
    });

    const progIn = document.createElement('input');
    progIn.className = 'sw-input sw-prog';
    progIn.value = item.programs;
    progIn.addEventListener('change', () => {
      item.programs = progIn.value.trim();
      window.persistMeta('software', SCHEDULE_DATA.software.map(s=>({...s})));
    });

    const del = el('button','sw-del-btn','✕');
    del.addEventListener('click', () => {
      SCHEDULE_DATA.software.splice(idx,1);
      window.renderSoftware();
      window.persistMeta('software', SCHEDULE_DATA.software.map(s=>({...s})));
    });

    row.appendChild(deptIn); row.appendChild(progIn); row.appendChild(del);
    return row;
  }

  /* ══════════════════════
     COMPACT TOGGLE
     ══════════════════════ */
  function initCompact() {
    const btn = document.getElementById('toggleViewBtn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const c = document.body.classList.toggle('compact');
      btn.setAttribute('aria-pressed', String(c));
      btn.textContent = c ? '🖥️ Full View' : '📱 Compact';
    });
  }

  /* ══════════════════════
     PERSIST HELPER
     ══════════════════════ */
  window.persistMeta = function(key, value) {
    try {
      const raw = localStorage.getItem('omsc_schedule_data');
      const s = raw ? JSON.parse(raw) : {};
      s[key] = value;
      localStorage.setItem('omsc_schedule_data', JSON.stringify(s));
    } catch(e) {}
  };

  /* ══════════════════════
     INIT
     ══════════════════════ */
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof window.__applyScheduleOverrides === 'function') {
      window.__applyScheduleOverrides();
    }
    if (!SCHEDULE_DATA.columns) {
      SCHEDULE_DATA.columns = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    }
    window.renderTable();
    window.renderLegend();
    window.renderPC();
    window.renderSoftware();
    initCompact();
  });

})();
