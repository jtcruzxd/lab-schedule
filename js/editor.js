/**
 * editor.js — full schedule editor
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'omsc_schedule_data';

  /* ══════════════════════ STORAGE ══════════════════════ */
  function load()      { try { const s = localStorage.getItem(STORAGE_KEY); return s ? JSON.parse(s) : null; } catch(e) { return null; } }
  function save(data)  { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch(e) {} }
  function get()       { return load() || {}; }
  function patch(k, v) { const s = get(); s[k] = v; save(s); }

  /* ══════════════════════ APPLY OVERRIDES ══════════════════════ */
  function applyOverrides() {
    const s = load();
    if (!s) return;

    if (s.columns)       SCHEDULE_DATA.columns      = s.columns;
    if (s.rowLabels)     s.rowLabels.forEach((l,i) => { const r = SCHEDULE_DATA.rows[i]; if (r && r.type==='normal' && l!==null) r.label = l; });
    if (s.cells)         Object.entries(s.cells).forEach(([k,cell]) => { const [ri,ci] = k.split('-').map(Number); const row = SCHEDULE_DATA.rows[ri]; if (!row||row.type!=='normal') return; const nc = SCHEDULE_DATA.columns ? SCHEDULE_DATA.columns.length : 6; const flat = window.expandCells(row.cells, nc); flat[ci] = cell===null?{type:'vacant'}:cell; row.cells = flat; });
    if (s.deptColors)    Object.entries(s.deptColors).forEach(([id,c]) => { const d = SCHEDULE_DATA.departments.find(x=>x.id===id); if(d) d.color=c; });
    if (s.deptLabels)    Object.entries(s.deptLabels).forEach(([id,v]) => { const d = SCHEDULE_DATA.departments.find(x=>x.id===id); if(d) { d.label=v.label; d.fullName=v.fullName; } });
    if (s.pcInventory)   SCHEDULE_DATA.pcInventory   = s.pcInventory;
    if (s.pcTotal!==undefined) SCHEDULE_DATA.pcTotal = s.pcTotal;
    if (s.software)      SCHEDULE_DATA.software      = s.software;
    if (s.logoDataUrl)   applyLogo(s.logoDataUrl);

    /* header text */
    const metaMap = { republic:'hRepublic', institution:'hInstitution', college:'hCollege', contact:'hContact', semester:'hSemester', academicYear:'hYear', labTitle:'toolbarTitle', sig1Name:'sig1Name', sig1Role:'sig1Role', sig2Name:'sig2Name', sig2Role:'sig2Role' };
    Object.entries(metaMap).forEach(([f,id]) => { if (s[f]!==undefined) { const el = document.getElementById(id); if(el) el.textContent = s[f]; } });
  }
  window.__applyScheduleOverrides = applyOverrides;

  /* ══════════════════════ LOGO ══════════════════════ */
  function applyLogo(dataUrl) {
    const img    = document.getElementById('logoImg');
    const crest  = document.getElementById('crestPlaceholder');
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

  /* ══════════════════════ EDIT MODE ══════════════════════ */
  function initEditMode() {
    const btn    = document.getElementById('editModeBtn');
    const banner = document.getElementById('editBanner');
    const reset  = document.getElementById('resetAllBtn');

    btn.addEventListener('click', () => {
      const on = document.body.classList.toggle('edit-mode');
      btn.setAttribute('aria-pressed', String(on));
      btn.textContent = on ? '✅ Done Editing' : '✏️ Edit Schedule';
      banner.style.display = on ? 'flex' : 'none';
      document.getElementById('logoUploadBtn').style.display = on ? 'flex' : 'none';
      document.getElementById('addLegendBtn').style.display  = on ? 'block' : 'none';
      setHeaderEditable(on);
      if (!on) persistAllHeader();
    });

    reset.addEventListener('click', () => {
      if (!confirm('Reset everything? All time slots, columns, rows, classes and settings will be cleared.')) return;

      // 1. Wipe localStorage
      localStorage.removeItem(STORAGE_KEY);

      // 2. Reset in-memory SCHEDULE_DATA to blank state
      SCHEDULE_DATA.columns     = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      SCHEDULE_DATA.rows        = [{ type: 'lunch' }];
      SCHEDULE_DATA.departments = [{ id:'vacant', label:'', fullName:'Vacant / Lab Maintenance', color:'#cbd5e0' }];
      SCHEDULE_DATA.pcInventory = [];
      SCHEDULE_DATA.pcTotal     = 0;
      SCHEDULE_DATA.software    = [];

      // 3. Reset header text to defaults
      const defaults = {
        hRepublic:    'Republic of the Philippines',
        hInstitution: 'Occidental Mindoro State College',
        hCollege:     'College of Arts, Sciences and Technology',
        hContact:     'San Jose, Occidental Mindoro · www.omsc.edu.ph · omsc_9747@yahoo.com · Tel/Fax: (043) 491-1460',
        hSemester:    '1st Semester',
        hYear:        '2026 – 2027',
        toolbarTitle: '🖥️ Computer Laboratory — Main Campus',
        sig1Name:     'JOVEN T. CRUZ',
        sig1Role:     'Laboratory Custodian',
        sig2Name:     'JOSELITO D. AGUID, PhDs, LPT, CHRA',
        sig2Role:     'Director for Instruction, CAST / Immediate Supervisor'
      };
      Object.entries(defaults).forEach(([id, text]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
      });

      // 4. Reset logo — show placeholder, hide image
      const logoImg = document.getElementById('logoImg');
      const crest   = document.getElementById('crestPlaceholder');
      if (logoImg) { logoImg.src = ''; logoImg.style.display = 'none'; }
      if (crest)   { crest.style.display = 'flex'; }

      // 5. Re-render all sections
      window.renderTable();
      window.renderLegend();
      window.renderPC();
      window.renderSoftware();
      patchTableForEditor();
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

  /* ══════════════════════ HEADER EDITING ══════════════════════ */
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
    /* editable column headers */
    document.getElementById('schedHead').addEventListener('dblclick', e => {
      if (!document.body.classList.contains('edit-mode')) return;
      const th = e.target.closest('th');
      if (!th || th.classList.contains('col-time')) return;
      const ci = parseInt(th.dataset.colIndex, 10);
      if (isNaN(ci)) return;
      editColumnHeader(th, ci);
    });
  }
  function editColumnHeader(th, ci) {
    const orig = th.textContent;
    const inp  = document.createElement('input');
    inp.type = 'text'; inp.value = orig;
    inp.style.cssText = 'width:100%;font-size:11px;background:rgba(255,255,255,.2);border:none;color:#fff;text-align:center;padding:2px 4px;';
    th.textContent = '';
    th.appendChild(inp);
    inp.focus(); inp.select();
    function commit() {
      const v = inp.value.trim() || orig;
      if (!SCHEDULE_DATA.columns) SCHEDULE_DATA.columns = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      SCHEDULE_DATA.columns[ci] = v;
      th.textContent = v;
      th.dataset.colIndex = ci;
      patch('columns', SCHEDULE_DATA.columns);
    }
    inp.addEventListener('blur', commit);
    inp.addEventListener('keydown', e => { if(e.key==='Enter'){e.preventDefault();inp.blur();} if(e.key==='Escape'){th.textContent=orig;} });
  }

  /* ══════════════════════ TABLE PATCHING ══════════════════════ */
  function patchTableForEditor() {
    const tbody = document.getElementById('schedBody');
    if (!tbody) return;
    let si = 0;
    Array.from(tbody.querySelectorAll('tr')).forEach(tr => {
      const tc = tr.querySelector('.time-col');
      if (!tc) {
        // lunch row — advance past the lunch entry in SCHEDULE_DATA
        while (si < SCHEDULE_DATA.rows.length && SCHEDULE_DATA.rows[si].type !== 'lunch') si++;
        si++; return;
      }
      while (si < SCHEDULE_DATA.rows.length && SCHEDULE_DATA.rows[si].type !== 'normal') si++;
      if (si >= SCHEDULE_DATA.rows.length) return;

      // Stamp the CURRENT index on the TR so click handlers always read it fresh
      tr.dataset.rowIndex = si;

      // Edit hint
      if (!tc.querySelector('.edit-hint')) {
        const h = document.createElement('span'); h.className = 'edit-hint'; h.textContent = '✎';
        tc.appendChild(h);
      }

      // Delete-row button — remove stale ones first, then add fresh one with correct captured index
      const existingDel = tc.querySelector('.del-row-btn');
      if (existingDel) existingDel.remove();

      const capturedSi = si; // capture correct index for this closure
      const d = document.createElement('button');
      d.className = 'del-row-btn'; d.textContent = '✕'; d.title = 'Remove row';
      d.addEventListener('click', e => { e.stopPropagation(); delRow(capturedSi); });
      tc.appendChild(d);

      // Stamp col index on every slot td
      let ci = 0;
      tr.querySelectorAll('.slot').forEach(td => {
        td.dataset.colIndex = ci;
        ci += parseInt(td.getAttribute('colspan') || '1', 10);
      });

      si++;
    });

    // Delete-column buttons in thead — always rebuild to avoid stale indices
    const headRow = document.getElementById('headRow');
    if (headRow) {
      headRow.querySelectorAll('.del-col-btn').forEach(b => b.remove());
      Array.from(headRow.querySelectorAll('th')).forEach(th => {
        const ci = parseInt(th.dataset.colIndex, 10);
        if (isNaN(ci)) return;
        const d = document.createElement('button');
        d.className = 'del-col-btn'; d.textContent = '✕'; d.title = 'Remove column';
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

  /* ══════════════════════ CELL CLICK HANDLER ══════════════════════ */
  function attachCellHandlers() {
    const tbody = document.getElementById('schedBody');
    if (!tbody) return;
    tbody.addEventListener('click', e => {
      if (!document.body.classList.contains('edit-mode')) return;
      const td = e.target.closest('td');
      if (!td) return;
      if (td.classList.contains('time-col')) {
        const tr = td.closest('tr');
        const ri = parseInt(tr.dataset.rowIndex, 10);
        if (!isNaN(ri)) openTimeslotEditor(ri, td);
        return;
      }
      if (td.classList.contains('slot')) {
        const tr = td.closest('tr');
        const ri = parseInt(tr.dataset.rowIndex, 10);
        const ci = parseInt(td.dataset.colIndex, 10);
        if (!isNaN(ri) && !isNaN(ci)) {
          if (e.shiftKey) { openMergeModal(ri, ci); return; }
          openModal(ri, ci);
        }
      }
    });
  }

  /* ══════════════════════ TIMESLOT INLINE EDITOR ══════════════════════ */
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

  /* ══════════════════════ MERGE MODAL ══════════════════════ */
  let _mergeRi = null, _mergeCi = null;

  function openMergeModal(ri, ci) {
    _mergeRi = ri; _mergeCi = ci;
    const cell = getCellFlat(ri, ci);
    document.getElementById('merge_span').value = cell.rowspan || 1;
    document.getElementById('mergeOverlay').style.display = 'flex';
  }

  document.getElementById('mergeClose').addEventListener('click',  () => { document.getElementById('mergeOverlay').style.display='none'; });
  document.getElementById('mergeCancelBtn').addEventListener('click',() => { document.getElementById('mergeOverlay').style.display='none'; });
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
    document.getElementById('mergeOverlay').style.display='none';
  });

  function getCellFlat(ri, ci) {
    const row = SCHEDULE_DATA.rows[ri];
    if (!row || row.type!=='normal') return {type:'vacant'};
    const nc = (SCHEDULE_DATA.columns||[]).length || 6;
    return window.expandCells(row.cells, nc)[ci] || {type:'vacant'};
  }

  /* ══════════════════════ CLASS MODAL ══════════════════════ */
  const overlay   = document.getElementById('modalOverlay');
  const form      = document.getElementById('classForm');

  document.getElementById('modalClose').addEventListener('click',    closeModal);
  document.getElementById('modalCancelBtn').addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if(e.target===overlay) closeModal(); });
  document.addEventListener('keydown', e => { if(e.key==='Escape'&&overlay.style.display!=='none') closeModal(); });

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

    if (cell && cell.type==='class') {
      document.getElementById('f_subject').value = cell.subject    || '';
      document.getElementById('f_section').value = cell.section    || '';
      document.getElementById('f_course').value  = cell.course     || '';
      document.getElementById('f_teacher').value = cell.instructor || '';
      document.getElementById('f_time').value    = cell.time       || '';
      /* show the human-readable label, fall back to raw dept id */
      const deptDisplay = cell.deptLabel || cell.dept || '';
      document.getElementById('f_dept').value    = deptDisplay;
      document.getElementById('modalTitle').textContent = 'Edit Class';
    } else {
      form.reset();
      document.getElementById('f_day').value      = cols[ci] || '';
      document.getElementById('f_timeslot').value = row ? row.label : '';
      document.getElementById('f_time').value     = row ? row.label : '';
      document.getElementById('modalTitle').textContent = 'Assign Class';
    }
    clearVal();
    overlay.style.display = 'flex';
    setTimeout(()=>document.getElementById('f_subject').focus(), 40);
  }

  function closeModal() {
    overlay.style.display = 'none';
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

    const deptRaw = document.getElementById('f_dept').value.trim();
    const deptId  = deptRaw.toLowerCase().replace(/[^a-z0-9]/g, '_');

    const cell = {
      type:'class',
      dept:       deptId,
      deptLabel:  deptRaw,
      instructor: document.getElementById('f_teacher').value.trim(),
      subject:    document.getElementById('f_subject').value.trim(),
      section:    document.getElementById('f_section').value.trim(),
      course:     document.getElementById('f_course').value.trim(),
      time:       document.getElementById('f_time').value.trim(),
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
    syncDeptToLegend(deptRaw);

    closeModal();
  });

  function applyCellToDOM(ri, ci, cell) {
    // Always query fresh — row index may have shifted after re-render
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
    let ok=true;
    ['f_subject','f_section','f_teacher'].forEach(id=>{
      const el=document.getElementById(id);
      if(!el.value.trim()){el.classList.add('invalid');ok=false;}
    });
    return ok;
  }
  function clearVal() {
    document.querySelectorAll('.form-control.invalid').forEach(e=>e.classList.remove('invalid'));
  }

  /* ══════════════════════ ADD ROW DIALOG ══════════════════════ */
  function lunchIndex() {
    return SCHEDULE_DATA.rows.findIndex(r => r.type === 'lunch');
  }

  function openAddRowDialog() {
    /* Build a small inline modal */
    const li = lunchIndex();
    const hasBefore = li > 0;
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
                ${hasBefore ? '<button class="pos-btn" data-pos="before-lunch">☀️ Morning (before lunch)</button>' : ''}
                ${hasAfter  ? '<button class="pos-btn" data-pos="after-lunch">🌤️ Afternoon (after lunch)</button>' : ''}
                <button class="pos-btn" data-pos="bottom">⬇️ Bottom</button>
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

    if (pos === 'before-lunch' && li > 0) {
      SCHEDULE_DATA.rows.splice(li, 0, newRow);        // insert right before lunch
    } else if (pos === 'after-lunch' && li >= 0) {
      SCHEDULE_DATA.rows.splice(li + 1, 0, newRow);    // insert right after lunch
    } else {
      SCHEDULE_DATA.rows.push(newRow);                  // bottom
    }

    persistAllCells();
    window.renderTable();
    patchTableForEditor();
  }

  /* ══════════════════════ ADD COLUMN DIALOG ══════════════════════ */
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

  /* ══════════════════════ DEPT → LEGEND SYNC ══════════════════════ */
  /**
   * When a class is saved with a dept string, auto-add it to the legend
   * if no entry with that id already exists. Uses the dept string as both
   * id and label, assigns a stable auto-generated color.
   */
  function syncDeptToLegend(deptStr) {
    if (!deptStr) return;

    /* Normalise: trim, lowercase for id */
    const id    = deptStr.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
    const label = deptStr.trim();

    const existing = SCHEDULE_DATA.departments.find(d => d.id === id || d.label.toLowerCase() === label.toLowerCase());
    if (existing) {
      /* Update card colors to use existing color */
      document.querySelectorAll(`.class-card[data-dept="${id}"]`).forEach(c => window.applyCardColor(c, id));
      return;
    }

    /* Generate a color based on string hash for consistency */
    const color = stringToColor(label);
    SCHEDULE_DATA.departments.push({ id, label, fullName: label, color });
    window.renderLegend();
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
    const m = {}; SCHEDULE_DATA.departments.forEach(d => { m[d.id] = d.color; }); return m;
  }
  function buildDeptLabelsMap() {
    const m = {}; SCHEDULE_DATA.departments.forEach(d => { m[d.id] = {label:d.label, fullName:d.fullName}; }); return m;
  }

  /* ══════════════════════ INIT ══════════════════════ */
  window.addEventListener('load', () => {
    patchTableForEditor();
    initEditMode();
    attachCellHandlers();
    initHeaderFields();
    initLogoUpload();
    /* restore logo if stored */
    const s = load();
    if (s && s.logoDataUrl) applyLogo(s.logoDataUrl);
    /* restore header text */
    if (s) {
      const metaMap = { republic:'hRepublic', institution:'hInstitution', college:'hCollege', contact:'hContact', semester:'hSemester', academicYear:'hYear', labTitle:'toolbarTitle', sig1Name:'sig1Name', sig1Role:'sig1Role', sig2Name:'sig2Name', sig2Role:'sig2Role' };
      Object.entries(metaMap).forEach(([f,id])=>{if(s[f]!==undefined){const el=document.getElementById(id);if(el)el.textContent=s[f];}});
    }
  });

})();
