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
     VACANT CELL — renders as truly empty (no "Vacant" label)
     ══════════════════════ */
  window.buildVacant = function() {
    const d = el('div','vacant-cell');
    // Empty — no icon, no text
    return d;
  };

  /* ══════════════════════
     CLASS CARD
     ══════════════════════ */
  window.buildCard = function(cell) {
    const d = el('div','class-card');
    d.dataset.dept = cell.dept || '';
    d.setAttribute('role','group');
    // Use deptLabel (full dropdown text) if available, otherwise fall back to dept id
    const deptDisplay = cell.deptLabel || cell.dept || '';
    d.innerHTML =
      `<span class="cc-subject">${esc(cell.subject)}</span>` +
      `<span class="cc-instructor">${esc(cell.instructor)}</span>` +
      `<span class="cc-section">${esc(cell.section)}</span>` +
      (cell.students ? `<span class="cc-students">👥 ${esc(cell.students)} students</span>` : '') +
      (deptDisplay ? `<span class="cc-dept">${esc(deptDisplay)}</span>` : '');
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

    const STATIC_COLS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const cols    = STATIC_COLS;
    const numCols = cols.length;

    /* ── TWO HEADER ROWS ──
       Row 1: Day names (each spans 2 cols: content + time) — STATIC, not editable
       Row 2: "Schedule" | "Time" repeated per day              */
    thead.innerHTML = '';

    const row1 = el('tr','head-row-days');
    const row2 = el('tr','head-row-labels', '');
    row2.id    = 'headRow';

    cols.forEach((col, ci) => {
      /* Day group header — static, no colIndex data needed for edit */
      const dayTh = el('th','col-day-group', esc(col));
      dayTh.setAttribute('colspan', '2');
      row1.appendChild(dayTh);

      const schedTh = el('th','col-sched','Schedule');
      const timeTh2 = el('th','col-time-sub','Time');
      row2.appendChild(schedTh);
      row2.appendChild(timeTh2);
    });

    // Keep SCHEDULE_DATA.columns in sync so existing cell logic works
    SCHEDULE_DATA.columns = cols.slice();

    thead.appendChild(row1);
    thead.appendChild(row2);

    /* ── BODY ── */
    tbody.innerHTML = '';

    // Empty state
    if (numCols === 0 && SCHEDULE_DATA.rows.length === 0) {
      const tr = el('tr');
      const td = el('td');
      td.setAttribute('colspan','1');
      td.style.cssText = 'text-align:center;padding:40px;color:#a0aec0;font-size:13px;font-style:italic;';
      td.textContent   = 'Schedule is empty. Use + Column and + Row to build your schedule.';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    SCHEDULE_DATA.rows.forEach((row, ri) => {
      if (row.type === 'lunch') {
        const tr = el('tr','row-lunch');
        const td = el('td','','🍽️&nbsp; L U N C H &nbsp; B R E A K');
        td.setAttribute('colspan', numCols * 2);
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
      }

      const tr = document.createElement('tr');
      tr.dataset.rowIndex = ri;

      const flat = expandCells(row.cells, numCols);

      let ci = 0;
      while (ci < numCols) {
        const cell = flat[ci] || { type:'vacant' };
        const cs   = cell.colspan || 1;
        const rs   = cell.rowspan || 1;

        /* ── Schedule (content) cell ── */
        const schedTd = el('td','slot');
        schedTd.dataset.colIndex = ci;
        if (rs > 1) schedTd.setAttribute('rowspan', rs);
        if (cs > 1) schedTd.setAttribute('colspan', cs * 2); // each col = 2 DOM cols
        schedTd.appendChild(cell.type === 'class' ? window.buildCard(cell) : window.buildVacant());
        tr.appendChild(schedTd);

        /* ── Time cell (only when colspan = 1 — merged cells skip it) ── */
        if (cs === 1) {
          const timeTd = el('td','time-col-per-day');
          timeTd.dataset.colIndex = ci;
          timeTd.dataset.isTime   = '1';
          if (rs > 1) timeTd.setAttribute('rowspan', rs);
          timeTd.textContent = cell.type === 'class' ? (cell.time || '') : '';
          tr.appendChild(timeTd);
        }

        ci += cs;
      }

      tbody.appendChild(tr);
    });

    // Run conflict detection after table is built
    setTimeout(detectConflicts, 0);
  };

  /* ══════════════════════
     CONFLICT DETECTION
     ══════════════════════ */

  /* Parse "7:30 - 9:00" or "7:30 – 9:00" → { start, end } in minutes since midnight.
     Returns null if unparseable. */
  function parseTimeRange(str) {
    if (!str) return null;
    // normalise dashes/en-dashes
    const s = str.replace(/[–—−]/g, '-').trim();
    const parts = s.split('-').map(p => p.trim());
    if (parts.length < 2) return null;

    function toMins(t) {
      const m = t.match(/(\d{1,2}):(\d{2})/);
      if (!m) return null;
      let h = parseInt(m[1], 10);
      const min = parseInt(m[2], 10);
      // Ambiguous single-digit hours: treat < 7 as PM (1:00 = 13:00, etc.)
      // The schedule runs 7:00 AM – 11:00 PM
      // AM block: 7:00 – 12:59  → hours 7-12 stay as-is
      // PM block: 1:00 – 11:00  → hours 1-6 become 13-18, 7-11 become 19-23
      // We rely on row position (AM vs PM) passed in, not time string alone.
      // For overlap detection we just need relative ordering, so leave as 24h:
      return h * 60 + min;
    }

    const start = toMins(parts[0]);
    const end   = toMins(parts[1]);
    if (start === null || end === null) return null;
    return { start, end };
  }

  /* Two ranges overlap if one starts before the other ends */
  function rangesOverlap(a, b) {
    return a.start < b.end && b.start < a.end;
  }

  function detectConflicts() {
    const tbody = document.getElementById('schedBody');
    if (!tbody) return;

    const numCols = (SCHEDULE_DATA.columns || []).length;

    // Clear old conflict markers
    tbody.querySelectorAll('.conflict-card').forEach(el => el.classList.remove('conflict-card'));
    tbody.querySelectorAll('.conflict-badge').forEach(el => el.remove());
    tbody.querySelectorAll('.time-col-per-day.conflict-time').forEach(el => el.classList.remove('conflict-time'));

    // Collect all class cells per column with parsed time ranges
    // colEntries[ci] = [ { range, card, timeTd } ]
    const colEntries = {};
    for (let ci = 0; ci < numCols; ci++) colEntries[ci] = [];

    const lunchIdx = SCHEDULE_DATA.rows.findIndex(r => r.type === 'lunch');

    Array.from(tbody.querySelectorAll('tr')).forEach(tr => {
      if (tr.classList.contains('row-lunch')) return;
      const ri = parseInt(tr.dataset.rowIndex, 10);
      const isAM = !isNaN(ri) && lunchIdx >= 0 && ri < lunchIdx;

      tr.querySelectorAll('td.slot').forEach(td => {
        const ci   = parseInt(td.dataset.colIndex, 10);
        if (isNaN(ci)) return;
        const card = td.querySelector('.class-card');
        if (!card) return;
        const timeTd  = tr.querySelector(`td[data-col-index="${ci}"][data-is-time="1"]`);
        const timeStr = timeTd ? timeTd.textContent.trim() : '';
        if (!timeStr) return;

        let range = parseTimeRange(timeStr);
        if (!range) return;

        // Adjust PM times: if after lunch and start < 7*60 (i.e. 1:00–6:59), add 12 hours
        if (!isAM) {
          if (range.start < 7 * 60)  range.start += 12 * 60;
          if (range.end   <= range.start) range.end += 12 * 60;
        }

        colEntries[ci].push({ range, card, timeTd });
      });
    });

    // Detect overlaps per column
    let conflictCount = 0;
    Object.values(colEntries).forEach(entries => {
      for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
          if (!rangesOverlap(entries[i].range, entries[j].range)) continue;

          // Flag both
          [entries[i], entries[j]].forEach(e => {
            e.card.classList.add('conflict-card');
            if (e.timeTd) e.timeTd.classList.add('conflict-time');
            if (!e.card.querySelector('.conflict-badge')) {
              const badge = document.createElement('span');
              badge.className = 'conflict-badge';
              badge.textContent = 'TIME CONFLICT';
              e.card.insertBefore(badge, e.card.firstChild);
              conflictCount++;
            }
          });
        }
      }
    });

    // Show/hide conflict banner
    let banner = document.getElementById('conflictBanner');
    if (conflictCount > 0) {
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'conflictBanner';
        banner.className = 'conflict-banner';
        const main = document.getElementById('schedule');
        if (main) main.insertAdjacentElement('beforebegin', banner);
      }
      banner.innerHTML = `<strong>⚠️ ${conflictCount} time conflict${conflictCount > 1 ? 's' : ''} detected</strong> — Overlapping class times found in the same day column. Review the highlighted cells.`;
      banner.style.display = 'flex';
    } else {
      if (banner) banner.style.display = 'none';
    }
  }

  window.detectConflicts = detectConflicts;

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
      window.persistMeta('departments', SCHEDULE_DATA.departments.map(d => ({...d})));
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
    window.persistMeta('departments', SCHEDULE_DATA.departments.map(d => ({...d})));
    window.persistMeta('deptColors', buildDeptColorsMap());
  }

  function onLegendLabel(deptId, value) {
    const d = SCHEDULE_DATA.departments.find(x => x.id === deptId);
    if (!d) return;
    const parts = value.split('–').map(s => s.trim());
    if (parts.length >= 2) { d.label = parts[0]; d.fullName = parts.slice(1).join('–').trim(); }
    else d.fullName = value;
    window.persistMeta('departments', SCHEDULE_DATA.departments.map(d => ({...d})));
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
