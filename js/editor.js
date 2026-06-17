/**
 * editor.js â€” full schedule editor
 */
(function () {
  'use strict';

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• LAB TABS â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  /* Active lab: 1 or 2. STORAGE_KEY switches on tab change. */
  let _activeLab = parseInt(localStorage.getItem('omsc_active_lab') || '1', 10);

  const STORAGE_KEYS = {
    1: 'omsc_schedule_data_1',
    2: 'omsc_schedule_data_2',
  };

  /* Migrate legacy single-lab data into lab 1 on first load */
  (function migrateLegacy() {
    const legacy = localStorage.getItem('omsc_schedule_data');
    if (legacy && !localStorage.getItem(STORAGE_KEYS[1])) {
      localStorage.setItem(STORAGE_KEYS[1], legacy);
    }
  })();

  let STORAGE_KEY = STORAGE_KEYS[_activeLab];

  /* â”€â”€ Switch labs â”€â”€ */
  function switchLab(labNum) {
    if (labNum === _activeLab) return;

    // Save header text before switching
    if (document.body.classList.contains('edit-mode')) persistAllHeader();

    _activeLab = labNum;
    STORAGE_KEY = STORAGE_KEYS[_activeLab];
    localStorage.setItem('omsc_active_lab', String(_activeLab));

    // Update tab UI
    document.querySelectorAll('.lab-tab').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.lab, 10) === _activeLab);
    });

    // Update toolbar title tab indicator
    const titleEl = document.getElementById('toolbarTitle');
    if (titleEl) {
      // Strip old " â€” Lab X" suffix if present
      let txt = titleEl.textContent.replace(/ â€” Lab \d+$/, '');
      titleEl.textContent = txt;
    }

    // Reset SCHEDULE_DATA to defaults then re-apply stored data for this lab
    resetScheduleDataToDefault();
    applyOverrides();

    // Re-render everything
    window.renderTable();
    window.renderLegend();
    window.renderSoftware();
    window.renderPC();
    patchTableForEditor();

    // Restore header text for this lab
    const s = load();
    if (s) {
      const metaMap = { republic:'hRepublic', institution:'hInstitution', college:'hCollege', contact:'hContact', semester:'hSemester', academicYear:'hYear', labTitle:'toolbarTitle', sig1Name:'sig1Name', sig1Role:'sig1Role', sig2Name:'sig2Name', sig2Role:'sig2Role' };
      Object.entries(metaMap).forEach(([f,id]) => { if (s[f]!==undefined) { const el = document.getElementById(id); if(el) el.textContent = s[f]; } });
    }

    // Restore logo
    if (s && s.logoDataUrl) applyLogo(s.logoDataUrl);
    else {
      const img   = document.getElementById('logoImg');
      const crest = document.getElementById('crestPlaceholder');
      if (img)   { img.src = ''; img.classList.remove('is-open'); }
      if (crest) { crest.classList.add('is-open'); }
    }
  }

  /* â”€â”€ Reset SCHEDULE_DATA to clean default (for tab switching) â”€â”€ */
  function resetScheduleDataToDefault() {
    SCHEDULE_DATA.columns     = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    SCHEDULE_DATA.departments = [];
    SCHEDULE_DATA.software    = [];
    SCHEDULE_DATA.pcInventory = [
      { processor:'Core i7', y2022:47, y2023:0, y2024:0, y2025:4 },
      { processor:'Core i5', y2022:0,  y2023:0, y2024:0, y2025:0 },
      { processor:'Core i3', y2022:0,  y2023:0, y2024:0, y2025:0 },
    ];
    SCHEDULE_DATA.pcTotal = 51;
    const makeRow = () => ({ type:'normal', label:'', cells: Array.from({length:6}, () => ({type:'vacant'})) });
    SCHEDULE_DATA.rows = [
      makeRow(), makeRow(), makeRow(), makeRow(),
      { type:'lunch' },
      makeRow(), makeRow(), makeRow(), makeRow(), makeRow(), makeRow(),
    ];
  }

  function initLabTabs() {
    document.querySelectorAll('.lab-tab').forEach(btn => {
      btn.addEventListener('click', () => switchLab(parseInt(btn.dataset.lab, 10)));
    });
    // Set initial active state
    document.querySelectorAll('.lab-tab').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.lab, 10) === _activeLab);
    });
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• STORAGE â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  function load()      { try { const s = localStorage.getItem(STORAGE_KEY); return s ? JSON.parse(s) : null; } catch(e) { return null; } }
  function save(data)  { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch(e) {} }
  function get()       { return load() || {}; }
  function patch(k, v) { const s = get(); s[k] = v; save(s); }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• APPLY OVERRIDES â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  function applyOverrides() {
    const s = load();
    if (!s) return;

    if (s.columns)       SCHEDULE_DATA.columns      = s.columns;
    if (s.rowLabels)     s.rowLabels.forEach((l,i) => { const r = SCHEDULE_DATA.rows[i]; if (r && r.type==='normal' && l!==null) r.label = l; });
    if (s.cells)         Object.entries(s.cells).forEach(([k,cell]) => { const [ri,ci] = k.split('-').map(Number); const row = SCHEDULE_DATA.rows[ri]; if (!row||row.type!=='normal') return; const nc = SCHEDULE_DATA.columns ? SCHEDULE_DATA.columns.length : 6; const flat = window.expandCells(row.cells, nc); flat[ci] = cell===null?{type:'vacant'}:cell; row.cells = flat; });
    if (s.deptColors)    Object.entries(s.deptColors).forEach(([id,c]) => { const d = SCHEDULE_DATA.departments.find(x=>x.id===id); if(d) d.color=c; });
    if (s.deptLabels)    Object.entries(s.deptLabels).forEach(([id,v]) => { const d = SCHEDULE_DATA.departments.find(x=>x.id===id); if(d) { d.label=v.label; d.fullName=v.fullName; } });
    /* Restore any user-added departments that don't exist in data.js defaults */
    if (s.departments) {
      s.departments.forEach(saved => {
        const exists = SCHEDULE_DATA.departments.find(d => d.id === saved.id);
        if (!exists) SCHEDULE_DATA.departments.push(saved);
        else { exists.color = saved.color; exists.label = saved.label; exists.fullName = saved.fullName; }
      });
    }
    if (s.pcInventory)        SCHEDULE_DATA.pcInventory   = s.pcInventory;
    if (s.pcTotal!==undefined) SCHEDULE_DATA.pcTotal      = s.pcTotal;
    if (s.software)            SCHEDULE_DATA.software     = s.software;
    if (s.logoDataUrl)         applyLogo(s.logoDataUrl);

    /* header text */
    const metaMap = { republic:'hRepublic', institution:'hInstitution', college:'hCollege', contact:'hContact', semester:'hSemester', academicYear:'hYear', labTitle:'toolbarTitle', sig1Name:'sig1Name', sig1Role:'sig1Role', sig2Name:'sig2Name', sig2Role:'sig2Role' };
    Object.entries(metaMap).forEach(([f,id]) => { if (s[f]!==undefined) { const el = document.getElementById(id); if(el) el.textContent = s[f]; } });
  }
  window.__applyScheduleOverrides = applyOverrides;

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• LOGO â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  function applyLogo(dataUrl) {
    const img   = document.getElementById('logoImg');
    const crest = document.getElementById('crestPlaceholder');
    if (img)   { img.src = dataUrl; img.style.display = 'block'; }
    if (crest) { crest.style.display = 'none'; }
  }

  function initLogoUpload() {
    document.getElementById('logoFileInput').addEventListener('change', function() {
      const file = this.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = e => { applyLogo(e.target.result); patch('logoDataUrl', e.target.result); };
      reader.readAsDataURL(file);
    });
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• EDIT MODE â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  function initEditMode() {
    const btn    = document.getElementById('editModeBtn');
    const banner = document.getElementById('editBanner');
    const reset  = document.getElementById('resetAllBtn');

    btn.addEventListener('click', () => {
      const on = document.body.classList.toggle('edit-mode');
      btn.setAttribute('aria-pressed', String(on));
      btn.textContent = on ? 'Done Editing' : 'âœï¸ Edit Schedule';
      banner.style.display = on ? 'flex' : 'none';
      document.getElementById('logoUploadBtn').style.display = on ? 'flex' : 'none';
      document.getElementById('addLegendBtn').style.display  = on ? 'block' : 'none';
      setHeaderEditable(on);
      if (!on) persistAllHeader();
    });

    reset.addEventListener('click', () => {
      if (!confirm('Reset the schedule? Time slots, legend, and software will be cleared. PC Inventory is kept.')) return;

      // Preserve PC inventory
      const pcInventory = SCHEDULE_DATA.pcInventory.map(r => ({...r}));
      const pcTotal     = SCHEDULE_DATA.pcTotal;

      // Clear localStorage
      localStorage.removeItem(STORAGE_KEY);

      // Reset columns to default 6
      SCHEDULE_DATA.columns = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

      // Reset rows: 4 morning + lunch + 6 afternoon, all vacant, no labels
      const makeRow = () => ({ type:'normal', label:'', cells: Array.from({length:6}, () => ({type:'vacant'})) });
      SCHEDULE_DATA.rows = [
        makeRow(), makeRow(), makeRow(), makeRow(),
        { type:'lunch' },
        makeRow(), makeRow(), makeRow(), makeRow(), makeRow(), makeRow(),
      ];

      // Clear legend
      SCHEDULE_DATA.departments = [];

      // Clear software
      SCHEDULE_DATA.software = [];

      // Restore PC inventory
      SCHEDULE_DATA.pcInventory = pcInventory;
      SCHEDULE_DATA.pcTotal     = pcTotal;

      // Re-render
      window.renderTable();
      window.renderLegend();
      window.renderSoftware();
      window.renderPC();
      patchTableForEditor();

      // Reset logo to placeholder
      const img   = document.getElementById('logoImg');
      const crest = document.getElementById('crestPlaceholder');
      if (img)   { img.src = ''; img.classList.remove('is-open'); }
      if (crest) { crest.classList.add('is-open'); }
    });

    /* Add column */
    document.getElementById('addColBtn').addEventListener('click', () => {
      openAddColDialog();
    });

    /* Add row */
    document.getElementById('addRowBtn').addEventListener('click', () => {
      openAddRowDialog();
    });

    /* Add legend entry */
    document.getElementById('addLegendBtn').addEventListener('click', () => {
      const id    = 'dept_' + Date.now();
      const label = 'New Dept';
      SCHEDULE_DATA.departments.push({ id, label, fullName:'New Department', color:'#888888' });
      window.renderLegend();
    });
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• HEADER EDITING â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  function setHeaderEditable(on) {
    document.querySelectorAll('[data-field]').forEach(el => {
      el.contentEditable = on ? 'true' : 'false';
    });
  }

  function persistAllHeader() {
    const metaMap = { republic:'hRepublic', institution:'hInstitution', college:'hCollege', contact:'hContact', semester:'hSemester', academicYear:'hYear', labTitle:'toolbarTitle', sig1Name:'sig1Name', sig1Role:'sig1Role', sig2Name:'sig2Name', sig2Role:'sig2Role' };
    const s = get();
    Object.entries(metaMap).forEach(([f,id]) => { const el = document.getElementById(id); if(el) s[f] = el.textContent.trim(); });
    save(s);
  }

  function initHeaderFields() {
    document.querySelectorAll('[data-field]').forEach(el => {
      el.contentEditable = 'false';
      el.addEventListener('blur', () => { if (document.body.classList.contains('edit-mode')) persistAllHeader(); });
      el.addEventListener('keydown', e => { if (e.key==='Enter'&&!e.shiftKey) { e.preventDefault(); el.blur(); } });
    });
    /* editable column headers â€” dblclick on day-group th in row1 */
    document.getElementById('schedHead').addEventListener('dblclick', e => {
      if (!document.body.classList.contains('edit-mode')) return;
      const th = e.target.closest('th.col-day-group');
      if (!th) return;
      const ci = parseInt(th.dataset.colIndex, 10);
      if (isNaN(ci)) return;
      editColumnHeader(th, ci);
    });
  }

  function editColumnHeader(th, ci) {
    // Strip del-btn text from value
    const orig = (th.firstChild && th.firstChild.nodeType === 3)
      ? th.firstChild.textContent.trim()
      : th.textContent.replace('X','').trim();
    const inp  = document.createElement('input');
    inp.type = 'text'; inp.value = orig;
    inp.style.cssText = 'width:80%;font-size:11px;background:rgba(255,255,255,.2);border:none;color:#fff;text-align:center;padding:2px 4px;';
    th.innerHTML = '';
    th.appendChild(inp);
    inp.focus(); inp.select();
    function commit() {
      const v = inp.value.trim() || orig;
      if (!SCHEDULE_DATA.columns) SCHEDULE_DATA.columns = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      SCHEDULE_DATA.columns[ci] = v;
      patch('columns', SCHEDULE_DATA.columns);
      window.renderTable();
      patchTableForEditor();
    }
    inp.addEventListener('blur', commit);
    inp.addEventListener('keydown', e => { if(e.key==='Enter'){e.preventDefault();inp.blur();} if(e.key==='Escape'){window.renderTable();patchTableForEditor();} });
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• TABLE PATCHING â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  function patchTableForEditor() {
    const tbody = document.getElementById('schedBody');
    if (!tbody) return;

    let si = 0;
    Array.from(tbody.querySelectorAll('tr')).forEach(tr => {
      // Lunch row has the row-lunch class â€” skip it
      if (tr.classList.contains('row-lunch')) {
        while (si < SCHEDULE_DATA.rows.length && SCHEDULE_DATA.rows[si].type !== 'lunch') si++;
        si++; return;
      }

      while (si < SCHEDULE_DATA.rows.length && SCHEDULE_DATA.rows[si].type !== 'normal') si++;
      if (si >= SCHEDULE_DATA.rows.length) return;

      const capturedSi = si;
      tr.dataset.rowIndex = capturedSi;

      // â”€â”€ Row label cell: first .time-col-per-day in this row â”€â”€
      // We no longer have a dedicated time-col for row label.
      // Add a del-row overlay button on the first slot td instead.
      const firstSlot = tr.querySelector('td.slot');
      if (firstSlot) {
        // Remove stale del-row btn
        const stale = firstSlot.querySelector('.del-row-btn');
        if (stale) stale.remove();

        const d = document.createElement('button');
        d.className = 'del-row-btn'; d.textContent = '\u2715'; d.title = 'Remove row';
        d.addEventListener('click', e => { e.stopPropagation(); delRow(capturedSi); });
        firstSlot.appendChild(d);
      }

      // Stamp col index on every slot td
      let ci = 0;
      tr.querySelectorAll('td.slot').forEach(td => {
        td.dataset.colIndex = ci;
        // Each slot occupies cs logical cols; its DOM colspan = cs*2 (sched+time per col)
        const domColspan = parseInt(td.getAttribute('colspan') || '2', 10);
        const logicalCs  = Math.max(1, Math.round(domColspan / 2));
        ci += logicalCs;
      });

      si++;
    });

    // â”€â”€ Del-col buttons on day-group ths (row1) â”€â”€
    const schedHead = document.getElementById('schedHead');
    if (schedHead) {
      schedHead.querySelectorAll('.del-col-btn').forEach(b => b.remove());
      schedHead.querySelectorAll('th.col-day-group').forEach(th => {
        const ci = parseInt(th.dataset.colIndex, 10);
        if (isNaN(ci)) return;
        const d = document.createElement('button');
        d.className = 'del-col-btn'; d.textContent = '\u2715'; d.title = 'Remove column';
        d.addEventListener('click', e => { e.stopPropagation(); delColumn(ci); });
        th.appendChild(d);
      });
    }
  }

  function delRow(ri) {
    if (!confirm('Remove this time slot row?')) return;
    SCHEDULE_DATA.rows.splice(ri, 1);
    persistAllCells();
    window.renderTable();
    patchTableForEditor();
  }

  function delColumn(ci) {
    if (!confirm('Remove this column?')) return;
    if (!SCHEDULE_DATA.columns) SCHEDULE_DATA.columns = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    SCHEDULE_DATA.columns.splice(ci, 1);
    SCHEDULE_DATA.rows.forEach(row => {
      if (row.type !== 'normal') return;
      const nc = SCHEDULE_DATA.columns.length + 1; // before removal
      const flat = window.expandCells(row.cells, nc);
      flat.splice(ci, 1);
      row.cells = flat;
    });
    patch('columns', SCHEDULE_DATA.columns);
    persistAllCells();
    window.renderTable();
    patchTableForEditor();
  }

  function persistAllCells() {
    const s = get();
    s.cells = {};
    s.rowLabels = [];
    SCHEDULE_DATA.rows.forEach((row, ri) => {
      if (row.type !== 'normal') { s.rowLabels.push(null); return; }
      s.rowLabels.push(row.label);
      const nc = (SCHEDULE_DATA.columns||[]).length || 6;
      const flat = window.expandCells(row.cells, nc);
      flat.forEach((cell, ci) => { if (cell && cell.type !== 'vacant') s.cells[`${ri}-${ci}`] = cell; });
    });
    save(s);
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• CELL CLICK HANDLER â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  function attachCellHandlers() {
    const tbody = document.getElementById('schedBody');
    if (!tbody) return;
    tbody.addEventListener('click', e => {
      if (!document.body.classList.contains('edit-mode')) return;
      const td = e.target.closest('td');
      if (!td) return;

      // Time sub-column â€” editable time value for a class cell
      if (td.dataset.isTime === '1') {
        const tr = td.closest('tr');
        const ri = parseInt(tr.dataset.rowIndex, 10);
        const ci = parseInt(td.dataset.colIndex, 10);
        if (!isNaN(ri) && !isNaN(ci)) editTimeCell(ri, ci, td);
        return;
      }

      if (td.classList.contains('slot')) {
        const tr = td.closest('tr');
        const ri = parseInt(tr.dataset.rowIndex, 10);
        const ci = parseInt(td.dataset.colIndex, 10);
        if (!isNaN(ri) && !isNaN(ci)) {
          if (e.shiftKey) { openMergeModal(ri, ci); return; }
          // Don't open modal if del-row-btn was clicked
          if (e.target.classList.contains('del-row-btn')) return;
          openModal(ri, ci);
        }
      }
    });
  }

  /* â”€â”€ Inline time-cell editor â”€â”€ */
  function editTimeCell(ri, ci, td) {
    const row  = SCHEDULE_DATA.rows[ri];
    if (!row || row.type !== 'normal') return;
    const nc   = (SCHEDULE_DATA.columns||[]).length || 6;
    const flat = window.expandCells(row.cells, nc);
    const cell = flat[ci];
    if (!cell || cell.type !== 'class') return; // only editable for class cells

    const cur = td.textContent;
    const inp = document.createElement('input');
    inp.type = 'text'; inp.value = cur; inp.className = 'form-control';
    inp.style.cssText = 'width:100%;font-size:10px;padding:2px 4px;';
    td.innerHTML = ''; td.appendChild(inp);
    inp.focus(); inp.select();

    function commit() {
      const v = inp.value.trim();
      cell.time = v;
      flat[ci]  = cell;
      row.cells = flat;
      td.textContent = v;
      persistAllCells();
    }
    inp.addEventListener('blur', commit);
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); inp.blur(); }
      if (e.key === 'Escape') { td.textContent = cur; }
    });
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• TIMESLOT INLINE EDITOR â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  function openTimeslotEditor(ri, td) {
    const row = SCHEDULE_DATA.rows[ri];
    if (!row || row.type !== 'normal') return;
    const cur = row.label;
    const inp = document.createElement('input');
    inp.type = 'text'; inp.value = cur; inp.className = 'form-control';
    inp.style.cssText = 'width:100%;font-size:11px;padding:3px 6px;';
    const orig = td.innerHTML;
    td.innerHTML = ''; td.appendChild(inp);
    inp.focus(); inp.select();

    function commit() {
      const v = inp.value.trim() || cur;
      row.label = v;
      const s = get();
      if (!s.rowLabels) s.rowLabels = SCHEDULE_DATA.rows.map(r => r.type==='normal' ? r.label : null);
      s.rowLabels[ri] = v;
      save(s);
      // Re-render the full table so all indices stay clean
      window.renderTable();
      patchTableForEditor();
    }

    inp.addEventListener('blur', commit);
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); inp.blur(); }
      if (e.key === 'Escape') { td.innerHTML = orig; }
    });
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• MERGE MODAL â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  let _mergeRi = null, _mergeCi = null;

  function openMergeModal(ri, ci) {
    _mergeRi = ri; _mergeCi = ci;
    const cell = getCellFlat(ri, ci);
    document.getElementById('merge_span').value = cell.rowspan || 1;
    document.getElementById('mergeOverlay').classList.add('is-open');
  }

  document.getElementById('mergeClose').addEventListener('click',   () => { document.getElementById('mergeOverlay').classList.remove('is-open'); });
  document.getElementById('mergeCancelBtn').addEventListener('click',() => { document.getElementById('mergeOverlay').classList.remove('is-open'); });
  document.getElementById('mergeApplyBtn').addEventListener('click', () => {
    const span = Math.max(1, parseInt(document.getElementById('merge_span').value,10)||1);
    const row  = SCHEDULE_DATA.rows[_mergeRi];
    if (!row || row.type!=='normal') return;
    const nc   = (SCHEDULE_DATA.columns||[]).length || 6;
    const flat = window.expandCells(row.cells, nc);
    const cell = flat[_mergeCi];
    if (cell) { cell.rowspan = span > 1 ? span : undefined; flat[_mergeCi] = cell; row.cells = flat; }
    persistAllCells();
    window.renderTable();
    patchTableForEditor();
    document.getElementById('mergeOverlay').classList.remove('is-open');
  });

  function getCellFlat(ri, ci) {
    const row = SCHEDULE_DATA.rows[ri];
    if (!row || row.type!=='normal') return {type:'vacant'};
    const nc = (SCHEDULE_DATA.columns||[]).length || 6;
    return window.expandCells(row.cells, nc)[ci] || {type:'vacant'};
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• CLASS MODAL â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  const overlay = document.getElementById('modalOverlay');
  const form    = document.getElementById('classForm');

  document.getElementById('modalClose').addEventListener('click',    closeModal);
  document.getElementById('modalCancelBtn').addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if(e.target===overlay) closeModal(); });
  document.addEventListener('keydown', e => { if(e.key==='Escape'&&overlay.classList.contains('is-open')) closeModal(); });

  document.getElementById('clearCellBtn').addEventListener('click', () => {
    const ri = parseInt(document.getElementById('f_row').value, 10);
    const ci = parseInt(document.getElementById('f_col').value, 10);
    const row = SCHEDULE_DATA.rows[ri];
    if (row && row.type === 'normal') {
      const nc   = (SCHEDULE_DATA.columns||[]).length || 6;
      const flat = window.expandCells(row.cells, nc);
      flat[ci]   = { type: 'vacant' };
      row.cells  = flat;
    }
    persistAllCells();
    // Full re-render so all data-row-index values are fresh
    window.renderTable();
    patchTableForEditor();
    closeModal();
  });

  function openModal(ri, ci) {
    const cell = getCellFlat(ri, ci);
    const row  = SCHEDULE_DATA.rows[ri];
    const cols = SCHEDULE_DATA.columns || ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    document.getElementById('f_day').value      = cols[ci] || '';
    document.getElementById('f_timeslot').value = row ? row.label : '';
    document.getElementById('f_row').value      = ri;
    document.getElementById('f_col').value      = ci;

    if (cell && cell.type === 'class') {
      document.getElementById('f_subject').value = cell.subject    || '';
      document.getElementById('f_section').value = cell.section    || '';
      document.getElementById('f_course').value  = cell.course     || '';
      document.getElementById('f_teacher').value = cell.instructor || '';
      document.getElementById('f_time').value    = cell.time       || '';
      document.getElementById('f_students').value = cell.students   || '';
      // dept is stored as normalised id; find matching option value
      const deptSel = document.getElementById('f_dept');
      // Try matching by value (normalised id) or by the raw label stored
      const deptStored = cell.dept || '';
      let matched = false;
      Array.from(deptSel.options).forEach(opt => {
        const optId = opt.value.toLowerCase().replace(/[^a-z0-9]/g,'_');
        if (opt.value === deptStored || optId === deptStored) {
          deptSel.value = opt.value; matched = true;
        }
      });
      if (!matched) deptSel.value = '';
      document.getElementById('modalTitle').textContent = 'Edit Class';
    } else {
      form.reset();
      document.getElementById('f_day').value      = cols[ci] || '';
      document.getElementById('f_timeslot').value = row ? row.label : '';
      document.getElementById('modalTitle').textContent = 'Assign Class';
    }
    clearVal();
    overlay.classList.add('is-open');
    setTimeout(() => document.getElementById('f_subject').focus(), 40);
  }

  function closeModal() {
    overlay.classList.remove('is-open');
    form.reset();
    clearVal();
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!validate()) return;

    const ri = parseInt(document.getElementById('f_row').value, 10);
    const ci = parseInt(document.getElementById('f_col').value, 10);
    const row = SCHEDULE_DATA.rows[ri];

    /* update timeslot label */
    const newLabel = document.getElementById('f_timeslot').value.trim();
    if (row && row.type==='normal' && newLabel && newLabel!==row.label) {
      row.label = newLabel;
      const tr = document.querySelector(`tr[data-row-index="${ri}"]`);
      if (tr) { const tc=tr.querySelector('.time-col'); if(tc){ const hin=tc.querySelector('.edit-hint'); const del=tc.querySelector('.del-row-btn'); tc.textContent=newLabel; if(hin)tc.appendChild(hin); if(del)tc.appendChild(del); }}
    }

    const deptRaw   = document.getElementById('f_dept').value.trim();
    const deptId    = deptRaw.toLowerCase().replace(/[^a-z0-9]/g, '_');
    // Get the human-readable label from the selected option
    const deptSel   = document.getElementById('f_dept');
    const deptLabel = deptSel.options[deptSel.selectedIndex]
      ? deptSel.options[deptSel.selectedIndex].text.trim()
      : deptRaw;

    const cell = {
      type:'class',
      dept:       deptId,
      deptLabel:  deptLabel,
      instructor: document.getElementById('f_teacher').value.trim().toUpperCase(),
      subject:    document.getElementById('f_subject').value.trim().toUpperCase(),
      section:    document.getElementById('f_section').value.trim().toUpperCase(),
      course:     document.getElementById('f_course').value.trim(),
      time:       document.getElementById('f_time').value.trim(),
      students:   document.getElementById('f_students').value.trim(),
    };

    if (row && row.type==='normal') {
      const nc = (SCHEDULE_DATA.columns||[]).length||6;
      const flat = window.expandCells(row.cells, nc);
      flat[ci] = cell;
      row.cells = flat;
    }
    persistAllCells();
    // Full re-render keeps all data-row-index attributes fresh
    window.renderTable();
    patchTableForEditor();

    /* Sync dept to legend AFTER saving */
    syncDeptToLegend(deptRaw, deptLabel);

    closeModal();
  });

  function applyCellToDOM(ri, ci, cell) {
    // Always query fresh â€” row index may have shifted after re-render
    const tr = document.querySelector(`tr[data-row-index="${ri}"]`);
    if (!tr) return;
    // Find the td whose data-col-index matches ci (handles colspan gaps)
    let td = tr.querySelector(`td[data-col-index="${ci}"]`);
    if (!td) {
      // Fallback: find the slot td that contains this col index (may be colspan)
      td = Array.from(tr.querySelectorAll('td.slot')).find(t => {
        const start = parseInt(t.dataset.colIndex, 10);
        const span  = parseInt(t.getAttribute('colspan') || '1', 10);
        return ci >= start && ci < start + span;
      });
    }
    if (!td) return;
    td.innerHTML = '';
    td.appendChild(cell.type === 'class' ? window.buildCard(cell) : window.buildVacant());
  }

  function validate() {
    let ok = true;
    ['f_subject','f_section','f_teacher'].forEach(id => {
      const el = document.getElementById(id);
      if (!el.value.trim()) { el.classList.add('invalid'); ok = false; }
    });
    return ok;
  }

  function clearVal() {
    document.querySelectorAll('.form-control.invalid').forEach(e => e.classList.remove('invalid'));
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• ADD ROW DIALOG â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  function lunchIndex() {
    return SCHEDULE_DATA.rows.findIndex(r => r.type === 'lunch');
  }

  function openAddRowDialog() {
    const li = lunchIndex();
    // "Before lunch" is available whenever a lunch row exists (li >= 0)
    // "After lunch" is available when lunch exists and isn't the very last row
    const hasBefore = li >= 0;
    const hasAfter  = li >= 0 && li < SCHEDULE_DATA.rows.length - 1;

    const html = `
      <div class="add-pos-overlay" id="addRowOverlay">
        <div class="add-pos-modal">
          <div class="modal-header">
            <span class="modal-title">Add Time Slot Row</span>
            <button class="modal-close" id="addRowClose">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group" style="margin-bottom:14px">
              <label>Time Slot Label</label>
              <input type="text" id="newRowLabel" class="form-control" value="New Time Slot" />
            </div>
            <div class="form-group" style="margin-bottom:16px">
              <label>Position</label>
              <div class="pos-btn-group">
                ${hasBefore ? '<button class="pos-btn" data-pos="before-lunch">â˜€ï¸ Morning (before lunch)</button>' : ''}
                ${hasAfter  ? '<button class="pos-btn" data-pos="after-lunch">ðŸŒ¤ï¸ Afternoon (after lunch)</button>' : ''}
                <button class="pos-btn" data-pos="bottom">â¬‡ï¸ Bottom</button>
              </div>
            </div>
          </div>
        </div>
      </div>`;

    document.body.insertAdjacentHTML('beforeend', html);

    document.getElementById('addRowClose').addEventListener('click', () => {
      document.getElementById('addRowOverlay').remove();
    });

    document.querySelectorAll('.pos-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const label = document.getElementById('newRowLabel').value.trim() || 'New Time Slot';
        const pos   = btn.dataset.pos;
        insertRow(label, pos);
        document.getElementById('addRowOverlay').remove();
      });
    });
  }

  function insertRow(label, pos) {
    const numCols = (SCHEDULE_DATA.columns||[]).length || 6;
    const cells   = Array.from({length: numCols}, () => ({type:'vacant'}));
    const newRow  = { type:'normal', label, cells };
    const li      = lunchIndex();

    if (pos === 'before-lunch' && li >= 0) {
      SCHEDULE_DATA.rows.splice(li, 0, newRow);       // insert right before lunch
    } else if (pos === 'after-lunch' && li >= 0) {
      SCHEDULE_DATA.rows.splice(li + 1, 0, newRow);   // insert right after lunch
    } else {
      SCHEDULE_DATA.rows.push(newRow);                 // bottom
    }

    persistAllCells();
    window.renderTable();
    patchTableForEditor();
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• ADD COLUMN DIALOG â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  function openAddColDialog() {
    const html = `
      <div class="add-pos-overlay" id="addColOverlay">
        <div class="add-pos-modal">
          <div class="modal-header">
            <span class="modal-title">Add Column</span>
            <button class="modal-close" id="addColClose">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group" style="margin-bottom:14px">
              <label>Column Name</label>
              <input type="text" id="newColName" class="form-control" value="New Day" />
            </div>
            <div class="form-group" style="margin-bottom:16px">
              <label>Insert Position</label>
              <div id="colPosBtns" class="pos-btn-group">
                <!-- populated below -->
              </div>
            </div>
          </div>
        </div>
      </div>`;

    document.body.insertAdjacentHTML('beforeend', html);

    const cols    = SCHEDULE_DATA.columns || ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const btnWrap = document.getElementById('colPosBtns');

    /* "Before X" buttons for each existing column */
    cols.forEach((col, ci) => {
      const b = document.createElement('button');
      b.className = 'pos-btn';
      b.textContent = `Before "${col}"`;
      b.dataset.colPos = ci;
      b.addEventListener('click', () => {
        insertColumn(document.getElementById('newColName').value.trim() || 'New Day', parseInt(b.dataset.colPos,10));
        document.getElementById('addColOverlay').remove();
      });
      btnWrap.appendChild(b);
    });

    /* "After last" */
    const bEnd = document.createElement('button');
    bEnd.className = 'pos-btn';
    bEnd.textContent = `After "${cols[cols.length-1]}" (end)`;
    bEnd.addEventListener('click', () => {
      insertColumn(document.getElementById('newColName').value.trim() || 'New Day', cols.length);
      document.getElementById('addColOverlay').remove();
    });
    btnWrap.appendChild(bEnd);

    document.getElementById('addColClose').addEventListener('click', () => {
      document.getElementById('addColOverlay').remove();
    });
  }

  function insertColumn(name, atIndex) {
    if (!SCHEDULE_DATA.columns) SCHEDULE_DATA.columns = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    SCHEDULE_DATA.columns.splice(atIndex, 0, name);

    SCHEDULE_DATA.rows.forEach(row => {
      if (row.type !== 'normal') return;
      const nc   = SCHEDULE_DATA.columns.length - 1; // before insert
      const flat = window.expandCells(row.cells, nc);
      flat.splice(atIndex, 0, {type:'vacant'});
      row.cells = flat;
    });

    patch('columns', SCHEDULE_DATA.columns);
    persistAllCells();
    window.renderTable();
    patchTableForEditor();
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• DEPT â†’ LEGEND SYNC â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  function syncDeptToLegend(deptStr, fullLabel) {
    if (!deptStr) return;
    const id    = deptStr.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
    const label = fullLabel || deptStr.trim();
    const existing = SCHEDULE_DATA.departments.find(d => d.id === id || d.label.toLowerCase() === label.toLowerCase());
    if (existing) {
      document.querySelectorAll(`.class-card[data-dept="${id}"]`).forEach(c => window.applyCardColor(c, id));
      return;
    }
    const color = stringToColor(label);
    SCHEDULE_DATA.departments.push({ id, label, fullName: label, color });
    window.renderLegend();
    window.persistMeta('departments', SCHEDULE_DATA.departments.map(d => ({...d})));
    window.persistMeta('deptColors', buildDeptColorsMap());
    window.persistMeta('deptLabels', buildDeptLabelsMap());
  }

  function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    const h = Math.abs(hash) % 360;
    return hslToHex(h, 65, 38);
  }

  function hslToHex(h, s, l) {
    s /= 100; l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    const toHex = x => Math.round(x * 255).toString(16).padStart(2, '0');
    return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
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

  /* â”€â”€ Proper case helper â”€â”€ */
  function toProperCase(str) {
    if (!str) return '';
    return str.trim().replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• AUTO-BACKUP â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  const MAX_BACKUPS        = 20;
  const BACKUP_INTERVAL_MS = 10000;

  function backupKey()       { return 'omsc_backups_' + _activeLab; }
  function getBackups()      { try { const s = localStorage.getItem(backupKey()); return s ? JSON.parse(s) : []; } catch(e) { return []; } }
  function saveBackups(list) { try { localStorage.setItem(backupKey(), JSON.stringify(list)); } catch(e) {} }

  function createBackup() {
    const current = load();
    if (!current) return; // nothing to back up

    const backups = getBackups();
    const ts = Date.now();
    const label = new Date(ts).toLocaleString();

    // Avoid duplicate backup if nothing changed since last one
    if (backups.length > 0) {
      const lastData = JSON.stringify(backups[0].data);
      const currData = JSON.stringify(current);
      if (lastData === currData) return; // no change â€” skip
    }

    backups.unshift({ ts, label, data: current });
    if (backups.length > MAX_BACKUPS) backups.splice(MAX_BACKUPS);
    saveBackups(backups);

    // Update status indicator
    const statusEl = document.getElementById('backupStatus');
    if (statusEl) {
      statusEl.textContent = `âœ“ Backed up at ${new Date(ts).toLocaleTimeString()}`;
      statusEl.classList.add('backup-flash');
      setTimeout(() => statusEl.classList.remove('backup-flash'), 1200);
    }
  }

  function initAutoBackup() {
    setInterval(createBackup, BACKUP_INTERVAL_MS);
  }

  function initBackupPanel() {
    const showBtn   = document.getElementById('showBackupsBtn');
    const overlay   = document.getElementById('backupOverlay');
    const closeBtn  = document.getElementById('backupClose');

    if (showBtn) showBtn.addEventListener('click', openBackupPanel);
    if (closeBtn) closeBtn.addEventListener('click', () => { overlay.classList.remove('is-open'); });
    if (overlay) overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('is-open'); });
  }

  function openBackupPanel() {
    const overlay  = document.getElementById('backupOverlay');
    const list     = document.getElementById('backupList');
    const empty    = document.getElementById('backupEmpty');
    const backups  = getBackups();

    // Update title to show current lab
    const titleEl = overlay.querySelector('.modal-title');
    if (titleEl) titleEl.textContent = `Backups â€” Laboratory ${_activeLab}`;

    list.innerHTML = '';

    if (backups.length === 0) {
      empty.style.display = 'block';
    } else {
      empty.classList.remove('is-open');
      backups.forEach((b, idx) => {
        const li = document.createElement('li');
        li.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;background:#f7f9fc;border-radius:6px;border:1px solid #dde5ef;';

        const info = document.createElement('div');
        info.style.cssText = 'font-size:12px;';
        info.innerHTML = `<strong style="color:#1a3a6b">${b.label}</strong>
          <span style="font-size:10px;color:#718096;margin-left:6px">${idx === 0 ? '(latest)' : ''}</span>`;

        const restoreBtn = document.createElement('button');
        restoreBtn.className = 'btn btn-sm btn-primary';
        restoreBtn.textContent = 'Restore';
        restoreBtn.addEventListener('click', () => restoreBackup(b));

        li.appendChild(info);
        li.appendChild(restoreBtn);
        list.appendChild(li);
      });
    }

    overlay.classList.add('is-open');
  }

  function restoreBackup(backup) {
    if (!confirm(`Restore backup from ${backup.label}? Current schedule will be replaced.`)) return;

    // Save the backup data as the current schedule
    try { localStorage.setItem('omsc_schedule_data', JSON.stringify(backup.data)); } catch(e) {}

    // Close panel and reload to apply
    document.getElementById('backupOverlay').classList.remove('is-open');
    location.reload();
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• ARCHIVE â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  const ARCHIVE_KEY = 'omsc_schedule_archives'; // shared across all labs

  function getArchives() {
    try { const s = localStorage.getItem(ARCHIVE_KEY); return s ? JSON.parse(s) : []; } catch(e) { return []; }
  }

  function saveArchives(list) {
    try { localStorage.setItem(ARCHIVE_KEY, JSON.stringify(list)); } catch(e) {}
  }

  function initArchive() {
    // Edit-mode "Archive" button
    const archBtn = document.getElementById('archiveBtn');
    if (archBtn) archBtn.addEventListener('click', () => openArchivePanel(true));

    // Toolbar "Archives" button (always visible)
    const viewBtn = document.getElementById('viewArchivesBtn');
    if (viewBtn) viewBtn.addEventListener('click', () => openArchivePanel(false));

    // Panel close
    document.getElementById('archiveClose').addEventListener('click', () => {
      document.getElementById('archiveOverlay').classList.remove('is-open');
    });
    document.getElementById('archiveOverlay').addEventListener('click', e => {
      if (e.target === document.getElementById('archiveOverlay'))
        document.getElementById('archiveOverlay').classList.remove('is-open');
    });

    // Viewer close
    document.getElementById('archiveViewerClose').addEventListener('click', () => {
      document.getElementById('archiveViewerOverlay').classList.remove('is-open');
    });
    document.getElementById('archiveViewerOverlay').addEventListener('click', e => {
      if (e.target === document.getElementById('archiveViewerOverlay'))
        document.getElementById('archiveViewerOverlay').classList.remove('is-open');
    });

    // Save archive button
    document.getElementById('archiveSaveBtn').addEventListener('click', saveCurrentArchive);
  }

  function openArchivePanel(showSaveRow) {
    const overlay  = document.getElementById('archiveOverlay');
    const saveRow  = document.getElementById('archiveSaveRow');
    const titleEl  = document.getElementById('archivePanelTitle');
    const list     = document.getElementById('archiveList');
    const empty    = document.getElementById('archiveEmpty');
    const archives = getArchives();

    // Pre-fill label with current semester + lab
    const semEl  = document.getElementById('hSemester');
    const yearEl = document.getElementById('hYear');
    const sem    = (semEl  ? semEl.textContent.trim()  : '1st Semester');
    const year   = (yearEl ? yearEl.textContent.trim() : '');
    document.getElementById('archiveLabel').value =
      `${sem} ${year} Â· Laboratory ${_activeLab}`.trim();

    saveRow.style.display = showSaveRow ? 'block' : 'none';
    titleEl.textContent   = showSaveRow ? 'Archive Current Semester' : 'Schedule Archives';

    list.innerHTML = '';
    if (archives.length === 0) {
      empty.style.display = 'block';
    } else {
      empty.classList.remove('is-open');
      archives.forEach((arc, idx) => {
        list.appendChild(buildArchiveRow(arc, idx));
      });
    }

    overlay.classList.add('is-open');
  }

  function buildArchiveRow(arc, idx) {
    const li = document.createElement('li');
    li.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;background:#f7f9fc;border-radius:8px;border:1px solid #dde5ef;';

    const info = document.createElement('div');
    info.style.cssText = 'flex:1;min-width:0';
    info.innerHTML = `
      <div style="font-size:12px;font-weight:700;color:#1a3a6b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
        ðŸ“¦ ${escHtml(arc.label)}
      </div>
      <div style="font-size:10px;color:#a0aec0;margin-top:2px">
        Saved ${new Date(arc.ts).toLocaleString()}
      </div>`;

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:6px;flex-shrink:0';

    const viewBtn = document.createElement('button');
    viewBtn.className = 'btn btn-sm btn-outline';
    viewBtn.textContent = 'ðŸ‘ View';
    viewBtn.addEventListener('click', () => viewArchive(arc));

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-sm btn-danger';
    delBtn.textContent = 'X';
    delBtn.title = 'Delete archive';
    delBtn.addEventListener('click', () => {
      if (!confirm(`Delete archive "${arc.label}"?`)) return;
      const archives = getArchives();
      archives.splice(idx, 1);
      saveArchives(archives);
      openArchivePanel(document.getElementById('archiveSaveRow').style.display !== 'none');
    });

    actions.appendChild(viewBtn);
    actions.appendChild(delBtn);
    li.appendChild(info);
    li.appendChild(actions);
    return li;
  }

  function saveCurrentArchive() {
    const label = document.getElementById('archiveLabel').value.trim();
    if (!label) { alert('Please enter a label for this archive.'); return; }

    const current = load();
    if (!current) { alert('Nothing to archive â€” schedule is empty.'); return; }

    const archives = getArchives();
    archives.unshift({
      ts:    Date.now(),
      label: label,
      lab:   _activeLab,
      data:  current,
    });
    saveArchives(archives);

    // Refresh panel
    openArchivePanel(true);
    alert(`âœ… Archived as "${label}"`);
  }

  function viewArchive(arc) {
    document.getElementById('archiveOverlay').classList.remove('is-open');

    const viewer  = document.getElementById('archiveViewerOverlay');
    const content = document.getElementById('archiveViewerContent');
    const title   = document.getElementById('archiveViewerTitle');

    title.textContent = `ðŸ“¦ ${arc.label}`;

    // Build a read-only HTML table from the archived data
    content.innerHTML = renderArchiveHTML(arc);
    viewer.classList.add('is-open');
  }

  function renderArchiveHTML(arc) {
    const d    = arc.data;
    const cols = d.columns || ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const rows = d.rows    || [];
    const depts = d.departments || [];

    function getDeptColor(id) {
      const dept = depts.find(x => x.id === id);
      return dept ? dept.color : '#2d5fa6';
    }
    function hexToRgba(hex, a) {
      const h = hex.replace('#','');
      const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
      return `rgba(${r},${g},${b},${a})`;
    }
    function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

    let html = `
      <div style="margin-bottom:16px">
        <div style="font-size:11px;color:#718096">Laboratory ${arc.lab || ''} Â· Saved ${new Date(arc.ts).toLocaleString()}</div>
      </div>
      <div style="overflow-x:auto">
      <table style="border-collapse:collapse;font-size:11px;width:100%">
        <thead>
          <tr>`;

    cols.forEach(col => {
      html += `<th colspan="2" style="background:#1a3a6b;color:#fff;padding:8px 6px;text-align:center;font-size:11px;border:1px solid #163060">${esc(col)}</th>`;
    });
    html += `</tr><tr>`;
    cols.forEach(() => {
      html += `<th style="background:#1e4a8a;color:rgba(255,255,255,.8);font-size:9px;padding:3px 4px;text-align:center;border:1px solid #163060">Schedule</th>
               <th style="background:#1e4a8a;color:rgba(255,255,255,.8);font-size:9px;padding:3px 4px;text-align:center;border:1px solid #163060;width:60px">Time</th>`;
    });
    html += `</tr></thead><tbody>`;

    rows.forEach(row => {
      if (row.type === 'lunch') {
        html += `<tr><td colspan="${cols.length * 2}" style="background:#fff8e1;text-align:center;font-size:11px;font-weight:700;color:#795200;padding:7px;border:1px solid #ffe082;letter-spacing:.08em">ðŸ½ï¸ &nbsp; L U N C H &nbsp; B R E A K</td></tr>`;
        return;
      }
      html += '<tr>';
      const cells = row.cells || [];
      let ci = 0;
      while (ci < cols.length) {
        const cell = cells[ci] || { type:'vacant' };
        const cs = cell.colspan || 1;
        const rs = cell.rowspan || 1;
        const domCs = cs * 2;

        if (cell.type === 'class') {
          const color  = getDeptColor(cell.dept || '');
          const bg     = hexToRgba(color, 0.09);
          const border = `3px solid ${color}`;
          html += `<td colspan="${domCs}" ${rs>1?`rowspan="${rs}"`:''}
            style="border:1px solid #dde5ef;padding:0;vertical-align:top">
            <div style="padding:7px 9px;border-left:${border};background:${bg}">
              <div style="font-size:10.5px;font-weight:700;color:#2d5fa6">${esc(cell.subject)}</div>
              <div style="font-size:10px;color:#1a3a6b">${esc(cell.instructor)}</div>
              <div style="font-size:9.5px;color:#718096">${esc(cell.section)}</div>
              ${cell.deptLabel ? `<div style="font-size:9px;color:#a0aec0;font-style:italic">${esc(cell.deptLabel)}</div>` : ''}
            </div></td>
            <td style="border:1px solid #dde5ef;background:#f7f9fc;text-align:center;font-size:10px;font-weight:600;color:#718096;width:60px;vertical-align:middle">${esc(cell.time||'')}</td>`;
        } else {
          html += `<td colspan="${domCs}" ${rs>1?`rowspan="${rs}"`:''}
            style="border:1px solid #dde5ef;background:#fafbfc;text-align:center;color:#b0bec5;font-size:10px;font-style:italic;padding:10px 4px">
            ðŸ”§ Vacant</td>`;
        }
        ci += cs;
      }
      html += '</tr>';
    });

    html += `</tbody></table></div>`;

    // Legend
    if (depts.length > 0) {
      html += `<div style="margin-top:20px"><strong style="font-size:11px;color:#1a3a6b">Legend</strong><div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:8px">`;
      depts.forEach(dept => {
        html += `<div style="display:flex;align-items:center;gap:6px;font-size:11px">
          <span style="width:12px;height:12px;border-radius:2px;background:${esc(dept.color)};flex-shrink:0;display:inline-block"></span>
          ${esc(dept.label || dept.fullName)}
        </div>`;
      });
      html += `</div></div>`;
    }

    return html;
  }

  function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• INIT â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

  /* Expose internal functions for excel-import.js */
  window.persistAllCellsPublic    = () => persistAllCells();
  window.patchTableForEditorPublic= () => patchTableForEditor();
  window.syncDeptToLegendPublic   = (raw, label) => syncDeptToLegend(raw, label);

  /* â”€â”€ Excel Import UI â”€â”€ */
  function initExcelImport() {
    const btn       = document.getElementById('importExcelBtn');
    const overlay   = document.getElementById('importOverlay');
    const closeBtn  = document.getElementById('importClose');
    const cancelBtn = document.getElementById('importCancelBtn');
    const fileInput = document.getElementById('importFileInput');
    const runBtn    = document.getElementById('importRunBtn');
    const preview   = document.getElementById('importPreview');
    const result    = document.getElementById('importResult');

    if (!btn) return;

    btn.addEventListener('click', () => {
      fileInput.value = '';
      runBtn.disabled = true;
      preview.classList.remove('is-open');
      result.classList.remove('is-open');
      overlay.classList.add('is-open');
    });

    function closeImport() { overlay.classList.remove('is-open'); }
    closeBtn.addEventListener('click',  closeImport);
    cancelBtn.addEventListener('click', closeImport);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeImport(); });

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) { runBtn.disabled = true; return; }
      try {
        const rows = await window.ExcelImport.parseFile(file);
        const valid = rows.filter(r => r.day && r.timeSlot && r.subject && r.instructor);
        preview.innerHTML = `<strong style="color:#1a3a6b">Preview:</strong> Found <strong>${valid.length}</strong> valid class entries` +
          (rows.length - valid.length > 0 ? ` (${rows.length - valid.length} rows will be skipped â€” missing required fields)` : '') + '.';
        preview.style.display = 'block';
        runBtn.disabled = valid.length === 0;
      } catch(e) {
        preview.innerHTML = `<span style="color:#c62828">Could not read file: ${e.message}</span>`;
        preview.style.display = 'block';
        runBtn.disabled = true;
      }
    });

    runBtn.addEventListener('click', () => {
      const file = fileInput.files[0];
      if (!file) return;
      runBtn.disabled = true;
      runBtn.textContent = 'Importing...';
      window.ExcelImport.importFile(file, (err, res) => {
        runBtn.textContent = 'Import';
        if (err) {
          result.style.cssText = 'display:block;background:#ffebee;color:#c62828;padding:10px 12px;border-radius:6px;font-size:12px;margin-top:12px';
          result.textContent = 'Import failed: ' + err.message;
        } else {
          result.style.cssText = 'display:block;background:#e8f5e9;color:#2e7d32;padding:10px 12px;border-radius:6px;font-size:12px;margin-top:12px';
          result.textContent = `âœ… Imported ${res.imported} class entries.` +
            (res.skipped > 0 ? ` ${res.skipped} rows skipped.` : '');
          setTimeout(closeImport, 2000);
        }
      });
    });
  }
  window.addEventListener('load', () => {
    initLabTabs();
    patchTableForEditor();
    initEditMode();
    attachCellHandlers();
    initHeaderFields();
    initLogoUpload();
    initAutoBackup();
    initBackupPanel();
    initArchive();
    initExcelImport();
    /* restore logo if stored */
    const s = load();
    if (s && s.logoDataUrl) applyLogo(s.logoDataUrl);
    /* restore header text */
    if (s) {
      const metaMap = { republic:'hRepublic', institution:'hInstitution', college:'hCollege', contact:'hContact', semester:'hSemester', academicYear:'hYear', labTitle:'toolbarTitle', sig1Name:'sig1Name', sig1Role:'sig1Role', sig2Name:'sig2Name', sig2Role:'sig2Role' };
      Object.entries(metaMap).forEach(([f,id]) => { if(s[f]!==undefined) { const el = document.getElementById(id); if(el) el.textContent = s[f]; } });
    }
  });

})();

