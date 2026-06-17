/**
 * render.js — reads SCHEDULE_DATA and builds the DOM
 */

(function () {
  'use strict';

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function esc(str) {
    return String(str || '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ── Dept color lookup (live, respects user edits) ── */
  window.getDeptColor = function(deptId) {
    const dept = SCHEDULE_DATA.departments.find(d => d.id === deptId);
    return dept ? dept.color : '#cbd5e0';
  };

  /* ── Apply dept color to a card element ── */
  window.applyCardColor = function(cardEl, deptId) {
    const color = window.getDeptColor(deptId);
    // Lighten the color for background (10% opacity)
    cardEl.style.borderLeftColor = color;
    cardEl.style.background = hexToRgba(color, 0.08);
    // Update time badge
    const badge = cardEl.querySelector('.cc-time');
    if (badge) badge.style.background = color;
  };

  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  /* ── Vacant cell ── */
  function buildVacant(label) {
    const div = el('div','vacant-cell');
    div.innerHTML = `<span class="vc-icon">🔧</span><span class="vc-text">${esc(label||'Vacant / Maintenance')}</span>`;
    return div;
  }

  /* ── Class card ── */
  function buildCard(cell) {
    const div = el('div', `class-card`);
    div.dataset.dept = cell.dept || '';
    div.setAttribute('role','group');
    div.setAttribute('aria-label',`${cell.instructor} – ${cell.subject}`);
    div.innerHTML = `
      <span class="cc-instructor">${esc(cell.instructor)}</span>
      <span class="cc-subject">${esc(cell.subject)}</span>
      <span class="cc-section">${esc(cell.section)}</span>
      <span class="cc-time">${esc(cell.time)}</span>
    `;
    window.applyCardColor(div, cell.dept);
    return div;
  }

  /* ── Schedule table ── */
  function renderTable() {
    const tbody = document.getElementById('schedBody');
    if (!tbody) return;

    SCHEDULE_DATA.rows.forEach(row => {
      if (row.type === 'lunch') {
        const tr = el('tr','row-lunch');
        const td = el('td','','🍽️&nbsp; L U N C H &nbsp; B R E A K');
        td.setAttribute('colspan','7');
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
      }

      const tr = document.createElement('tr');
      const timeTd = el('td','time-col');
      timeTd.textContent = row.label;
      timeTd.setAttribute('scope','row');
      tr.appendChild(timeTd);

      row.cells.forEach(cell => {
        const td = el('td','slot');
        const span = cell.colspan || 1;
        if (span > 1) td.setAttribute('colspan', span);
        td.appendChild(cell.type === 'class'
          ? buildCard(cell)
          : buildVacant(cell.type === 'vacant-time' ? cell.label : null));
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });
  }

  /* ── Legend ── */
  window.renderLegend = function() {
    const list = document.getElementById('legendList');
    if (!list) return;
    list.innerHTML = '';

    SCHEDULE_DATA.departments.forEach(dept => {
      const li = el('li','legend-item');

      // Swatch + color picker
      const swWrap = el('span','legend-swatch-wrap');
      const sw = el('span','legend-swatch');
      sw.style.background = dept.color;
      sw.dataset.deptId = dept.id;
      const colorIn = document.createElement('input');
      colorIn.type = 'color';
      colorIn.value = dept.color;
      colorIn.className = 'legend-color-input';
      colorIn.dataset.deptId = dept.id;
      colorIn.addEventListener('input', (e) => onLegendColorChange(dept.id, e.target.value));
      swWrap.appendChild(sw);
      swWrap.appendChild(colorIn);

      // Editable label
      const labelIn = document.createElement('input');
      labelIn.type = 'text';
      labelIn.className = 'legend-label-input';
      labelIn.dataset.deptId = dept.id;
      labelIn.value = dept.id !== 'vacant'
        ? `${dept.label} – ${dept.fullName}`
        : dept.fullName;
      labelIn.addEventListener('change', (e) => onLegendLabelChange(dept.id, e.target.value));

      li.appendChild(swWrap);
      li.appendChild(labelIn);
      list.appendChild(li);
    });
  };

  function onLegendColorChange(deptId, color) {
    // Update data
    const dept = SCHEDULE_DATA.departments.find(d => d.id === deptId);
    if (dept) dept.color = color;
    // Update swatch
    const sw = document.querySelector(`.legend-swatch[data-dept-id="${deptId}"]`);
    if (sw) sw.style.background = color;
    // Update all class cards with this dept
    document.querySelectorAll(`.class-card[data-dept="${deptId}"]`).forEach(card => {
      window.applyCardColor(card, deptId);
    });
    // Update dept select option color indicator
    updateDeptSelectColors();
    // Persist
    persistMetaChange('deptColors', buildDeptColorsMap());
  }

  function onLegendLabelChange(deptId, value) {
    const dept = SCHEDULE_DATA.departments.find(d => d.id === deptId);
    if (!dept) return;
    // Parse "LABEL – Full Name" format
    const parts = value.split('–').map(s => s.trim());
    if (parts.length >= 2) {
      dept.label = parts[0];
      dept.fullName = parts.slice(1).join('–').trim();
    } else {
      dept.fullName = value;
    }
    updateDeptSelectOptions();
    persistMetaChange('deptLabels', buildDeptLabelsMap());
  }

  function buildDeptColorsMap() {
    const m = {};
    SCHEDULE_DATA.departments.forEach(d => { m[d.id] = d.color; });
    return m;
  }

  function buildDeptLabelsMap() {
    const m = {};
    SCHEDULE_DATA.departments.forEach(d => { m[d.id] = { label: d.label, fullName: d.fullName }; });
    return m;
  }

  function updateDeptSelectOptions() {
    const sel = document.getElementById('f_dept');
    if (!sel) return;
    sel.innerHTML = '';
    SCHEDULE_DATA.departments.filter(d => d.id !== 'vacant').forEach(dept => {
      const opt = document.createElement('option');
      opt.value = dept.id;
      opt.textContent = `${dept.label} – ${dept.fullName}`;
      sel.appendChild(opt);
    });
  }

  function updateDeptSelectColors() {
    // no-op visual (select options don't support custom colors cross-browser)
  }

  /* ── PC Inventory ── */
  window.renderPC = function() {
    const wrap = document.getElementById('pcTableWrap');
    if (!wrap) return;
    wrap.innerHTML = '';

    const tbl = el('table','pc-table');
    tbl.setAttribute('aria-label','PC inventory');

    const thead = el('thead');
    const htr = el('tr');
    ['Dept','Processor','≤ 2022','2023','2024','2025',''].forEach((h,i) => {
      const th = el('th','',h);
      if (i === 6) th.style.width = '20px'; // del col
      htr.appendChild(th);
    });
    thead.appendChild(htr);
    tbl.appendChild(thead);

    const tbody = el('tbody', '', '');
    tbl.appendChild(tbody);

    SCHEDULE_DATA.pcInventory.forEach((row, idx) => {
      tbody.appendChild(buildPcRow(row, idx));
    });

    // Total row
    const tfoot = el('tfoot');
    const ftr = el('tr');
    const ftd1 = el('td'); ftd1.setAttribute('colspan','2');
    ftd1.innerHTML = '<strong>Total</strong>';
    const ftd2 = el('td','',''); ftd2.id = 'pcTotalCell';
    ftd2.innerHTML = `<input class="pc-cell-input" id="pcTotalInput" value="${esc(SCHEDULE_DATA.pcTotal)}" style="font-weight:700;" />`;
    const ftd3 = el('td'); ftd3.setAttribute('colspan','3');
    ftd3.innerHTML = `<span id="pcTotalLabel">${SCHEDULE_DATA.pcTotal} units</span>`;
    ftr.appendChild(ftd1); ftr.appendChild(ftd2); ftr.appendChild(ftd3);
    tfoot.appendChild(ftr);
    tbl.appendChild(tfoot);

    wrap.appendChild(tbl);

    // Add row button
    const addBtn = el('button','pc-add-row-btn','+ Add Row');
    addBtn.addEventListener('click', addPcRow);
    wrap.appendChild(addBtn);

    // Wire total input
    document.getElementById('pcTotalInput').addEventListener('change', (e) => {
      const v = e.target.value.trim();
      SCHEDULE_DATA.pcTotal = v;
      document.getElementById('pcTotalLabel').textContent = `${v} units`;
      persistMetaChange('pcTotal', v);
    });

    wireAllPcInputs();
  };

  function buildPcRow(row, idx) {
    const tr = el('tr');
    tr.dataset.pcIdx = idx;
    const keys = ['dept','processor','y2022','y2023','y2024','y2025'];
    keys.forEach((k,i) => {
      const td = el('td');
      const inp = document.createElement('input');
      inp.className = 'pc-cell-input' + (i===0?' left':'');
      inp.value = row[k] !== undefined ? String(row[k]) : '';
      inp.dataset.key = k;
      inp.addEventListener('change', () => {
        row[k] = inp.value.trim();
        persistMetaChange('pcInventory', SCHEDULE_DATA.pcInventory.map(r=>({...r})));
      });
      td.appendChild(inp);
      tr.appendChild(td);
    });
    // Del button
    const delTd = el('td');
    const delBtn = el('button','pc-del-btn','✕');
    delBtn.title = 'Remove row';
    delBtn.addEventListener('click', () => {
      SCHEDULE_DATA.pcInventory.splice(idx, 1);
      window.renderPC();
      persistMetaChange('pcInventory', SCHEDULE_DATA.pcInventory.map(r=>({...r})));
    });
    delTd.appendChild(delBtn);
    tr.appendChild(delTd);
    return tr;
  }

  function addPcRow() {
    const newRow = { dept:'', processor:'', y2022:0, y2023:0, y2024:0, y2025:0 };
    SCHEDULE_DATA.pcInventory.push(newRow);
    window.renderPC();
    persistMetaChange('pcInventory', SCHEDULE_DATA.pcInventory.map(r=>({...r})));
  }

  function wireAllPcInputs() {
    // already wired in buildPcRow
  }

  /* ── Software ── */
  window.renderSoftware = function() {
    const wrap = document.getElementById('softwareList');
    if (!wrap) return;
    wrap.innerHTML = '';

    SCHEDULE_DATA.software.forEach((item, idx) => {
      wrap.appendChild(buildSwRow(item, idx));
    });

    const addBtn = el('button','sw-add-btn','+ Add Row');
    addBtn.addEventListener('click', addSwRow);
    wrap.appendChild(addBtn);
  };

  function buildSwRow(item, idx) {
    const row = el('div','software-item');
    row.dataset.swIdx = idx;

    const dtInput = document.createElement('input');
    dtInput.className = 'sw-input sw-dept';
    dtInput.value = item.dept;
    dtInput.placeholder = 'Dept';
    dtInput.addEventListener('change', () => {
      item.dept = dtInput.value.trim();
      persistMetaChange('software', SCHEDULE_DATA.software.map(s=>({...s})));
    });

    const ddInput = document.createElement('input');
    ddInput.className = 'sw-input sw-prog';
    ddInput.value = item.programs;
    ddInput.placeholder = 'Programs used';
    ddInput.addEventListener('change', () => {
      item.programs = ddInput.value.trim();
      persistMetaChange('software', SCHEDULE_DATA.software.map(s=>({...s})));
    });

    const delBtn = el('button','sw-del-btn','✕');
    delBtn.title = 'Remove row';
    delBtn.addEventListener('click', () => {
      SCHEDULE_DATA.software.splice(idx, 1);
      window.renderSoftware();
      persistMetaChange('software', SCHEDULE_DATA.software.map(s=>({...s})));
    });

    row.appendChild(dtInput);
    row.appendChild(ddInput);
    row.appendChild(delBtn);
    return row;
  }

  function addSwRow() {
    SCHEDULE_DATA.software.push({ dept:'', programs:'' });
    window.renderSoftware();
    persistMetaChange('software', SCHEDULE_DATA.software.map(s=>({...s})));
  }

  /* ── Dept select ── */
  function initDeptSelect() {
    updateDeptSelectOptions();
  }

  /* ── Compact toggle ── */
  function initCompactToggle() {
    const btn = document.getElementById('toggleViewBtn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const isCompact = document.body.classList.toggle('compact');
      btn.setAttribute('aria-pressed', String(isCompact));
      btn.innerHTML = isCompact
        ? '<span class="btn-icon">🖥️</span> Full View'
        : '<span class="btn-icon">📱</span> Compact View';
    });
  }

  /* ── Expose persist helper for editor.js ── */
  window.persistMetaChange = function(key, value) {
    try {
      const raw = localStorage.getItem('omsc_schedule_data');
      const stored = raw ? JSON.parse(raw) : {};
      stored[key] = value;
      localStorage.setItem('omsc_schedule_data', JSON.stringify(stored));
    } catch(e) {}
  };

  /* ── Init ── */
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof window.__applyScheduleOverrides === 'function') {
      window.__applyScheduleOverrides();
    }
    renderTable();
    window.renderLegend();
    window.renderPC();
    window.renderSoftware();
    initDeptSelect();
    initCompactToggle();
  });

})();
