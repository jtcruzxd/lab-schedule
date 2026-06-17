/**
 * editor.js — Full schedule editor
 *
 * Features:
 * - Editable header fields (click-to-edit contenteditable)
 * - Logo upload
 * - Editable legend (color picker + label)
 * - Editable PC inventory + software rows
 * - Editable time slots
 * - Cell class entry modal
 * - localStorage persistence
 * - Dept color syncs to schedule cards
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'omsc_schedule_data';
  const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  /* ══════════════════════
     STORAGE HELPERS
     ══════════════════════ */
  function loadData() {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      return s ? JSON.parse(s) : null;
    } catch(e) { return null; }
  }

  function saveData(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch(e) {}
  }

  function getStored() { return loadData() || {}; }

  function patchStored(key, value) {
    const s = getStored();
    s[key] = value;
    saveData(s);
  }

  /* ══════════════════════
     APPLY OVERRIDES (pre-render)
     ══════════════════════ */
  function applyOverrides() {
    const s = loadData();
    if (!s) return;

    // Row labels
    if (s.rowLabels) {
      s.rowLabels.forEach((lbl, i) => {
        const row = SCHEDULE_DATA.rows[i];
        if (row && row.type === 'normal' && lbl !== null) row.label = lbl;
      });
    }

    // Cell overrides
    if (s.cells) {
      Object.entries(s.cells).forEach(([key, cell]) => {
        const [ri, ci] = key.split('-').map(Number);
        const row = SCHEDULE_DATA.rows[ri];
        if (!row || row.type !== 'normal') return;
        const flat = expandCells(row.cells);
        flat[ci] = cell === null ? { type:'vacant' } : cell;
        row.cells = flat;
      });
    }

    // Dept colors
    if (s.deptColors) {
      Object.entries(s.deptColors).forEach(([id, color]) => {
        const dept = SCHEDULE_DATA.departments.find(d => d.id === id);
        if (dept) dept.color = color;
      });
    }

    // Dept labels
    if (s.deptLabels) {
      Object.entries(s.deptLabels).forEach(([id, val]) => {
        const dept = SCHEDULE_DATA.departments.find(d => d.id === id);
        if (dept) { dept.label = val.label; dept.fullName = val.fullName; }
      });
    }

    // PC inventory
    if (s.pcInventory) SCHEDULE_DATA.pcInventory = s.pcInventory;
    if (s.pcTotal !== undefined) SCHEDULE_DATA.pcTotal = s.pcTotal;

    // Software
    if (s.software) SCHEDULE_DATA.software = s.software;

    // Header / meta text fields
    const metaFields = ['republic','institution','college','contact','semester','academicYear','labTitle','sig1Name','sig1Role','sig2Name','sig2Role'];
    metaFields.forEach(f => {
      if (s[f] !== undefined) {
        const el = document.getElementById(fieldToId(f));
        if (el) el.textContent = s[f];
      }
    });

    // Logo
    if (s.logoDataUrl) {
      applyLogo(s.logoDataUrl);
    }
  }

  function fieldToId(field) {
    const map = {
      republic: 'hRepublic', institution: 'hInstitution', college: 'hCollege',
      contact: 'hContact', semester: 'hSemester', academicYear: 'hYear',
      labTitle: 'toolbarTitle', sig1Name: 'sig1Name', sig1Role: 'sig1Role',
      sig2Name: 'sig2Name', sig2Role: 'sig2Role'
    };
    return map[field] || field;
  }

  /* ══════════════════════
     CELL HELPERS
     ══════════════════════ */
  function expandCells(cells) {
    const flat = [];
    (cells || []).forEach(c => {
      const span = c.colspan || 1;
      for (let i = 0; i < span; i++) {
        flat.push(i === 0 ? { ...c, colspan: undefined } : { type:'vacant' });
      }
    });
    while (flat.length < 6) flat.push({ type:'vacant' });
    return flat.slice(0, 6);
  }

  function getCell(rowIndex, colIndex) {
    const row = SCHEDULE_DATA.rows[rowIndex];
    if (!row || row.type !== 'normal') return null;
    return expandCells(row.cells)[colIndex] || { type:'vacant' };
  }

  function persistCell(ri, ci, cell) {
    const s = getStored();
    if (!s.cells) s.cells = {};
    s.cells[`${ri}-${ci}`] = cell;
    saveData(s);
  }

  function persistRowLabel(ri, label) {
    const s = getStored();
    if (!s.rowLabels) {
      s.rowLabels = SCHEDULE_DATA.rows.map(r => r.type === 'normal' ? r.label : null);
    }
    s.rowLabels[ri] = label;
    saveData(s);
  }

  /* ══════════════════════
     EDIT MODE TOGGLE
     ══════════════════════ */
  function initEditMode() {
    const btn    = document.getElementById('editModeBtn');
    const banner = document.getElementById('editBanner');
    const resetBtn = document.getElementById('resetAllBtn');

    btn.addEventListener('click', () => {
      const active = document.body.classList.toggle('edit-mode');
      btn.setAttribute('aria-pressed', String(active));
      btn.innerHTML = active
        ? '<span class="btn-icon">✅</span> Done Editing'
        : '<span class="btn-icon">✏️</span> Edit Schedule';
      if (banner) banner.hidden = !active;

      // Show/hide logo upload button
      const uploadBtn = document.getElementById('logoUploadBtn');
      if (uploadBtn) uploadBtn.hidden = !active;

      // Make header fields contenteditable
      setHeaderEditable(active);
    });

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Reset everything to defaults? All your changes will be lost.')) {
          localStorage.removeItem(STORAGE_KEY);
          location.reload();
        }
      });
    }
  }

  /* ══════════════════════
     EDITABLE HEADER FIELDS
     ══════════════════════ */
  function setHeaderEditable(on) {
    document.querySelectorAll('[data-field]').forEach(el => {
      el.contentEditable = on ? 'true' : 'false';
      if (!on) {
        // Persist on exit
        const field = el.dataset.field;
        patchStored(field, el.textContent.trim());
      }
    });
  }

  function initHeaderFields() {
    document.querySelectorAll('[data-field]').forEach(el => {
      el.contentEditable = 'false';
      el.addEventListener('blur', () => {
        if (!document.body.classList.contains('edit-mode')) return;
        patchStored(el.dataset.field, el.textContent.trim());
      });
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); el.blur(); }
      });
    });
  }

  /* ══════════════════════
     LOGO UPLOAD
     ══════════════════════ */
  function initLogoUpload() {
    const fileInput = document.getElementById('logoFileInput');
    if (!fileInput) return;
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        applyLogo(dataUrl);
        patchStored('logoDataUrl', dataUrl);
      };
      reader.readAsDataURL(file);
    });
  }

  function applyLogo(dataUrl) {
    const img = document.getElementById('logoImg');
    const crest = document.getElementById('crestCircle');
    if (img) { img.src = dataUrl; img.hidden = false; }
    if (crest) crest.hidden = true;
  }

  /* ══════════════════════
     TABLE PATCHING
     ══════════════════════ */
  function patchTableForEditor() {
    const tbody = document.getElementById('schedBody');
    if (!tbody) return;

    let schedIdx = 0;
    Array.from(tbody.querySelectorAll('tr')).forEach(tr => {
      const timeCol = tr.querySelector('.time-col');
      if (!timeCol) {
        while (schedIdx < SCHEDULE_DATA.rows.length && SCHEDULE_DATA.rows[schedIdx].type !== 'lunch') schedIdx++;
        schedIdx++;
        return;
      }
      while (schedIdx < SCHEDULE_DATA.rows.length && SCHEDULE_DATA.rows[schedIdx].type !== 'normal') schedIdx++;
      if (schedIdx >= SCHEDULE_DATA.rows.length) return;

      tr.dataset.rowIndex = schedIdx;

      if (!timeCol.querySelector('.edit-hint')) {
        const hint = document.createElement('span');
        hint.className = 'edit-hint';
        hint.textContent = 'click to rename';
        timeCol.appendChild(hint);
      }

      let ci = 0;
      tr.querySelectorAll('.slot').forEach(td => {
        td.dataset.colIndex = ci;
        ci += parseInt(td.getAttribute('colspan') || '1', 10);
      });

      schedIdx++;
    });
  }

  /* ══════════════════════
     CELL CLICK HANDLER
     ══════════════════════ */
  function attachCellHandlers() {
    const tbody = document.getElementById('schedBody');
    if (!tbody) return;

    tbody.addEventListener('click', (e) => {
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
        if (!isNaN(ri) && !isNaN(ci)) openModal(ri, ci);
      }
    });
  }

  /* ══════════════════════
     TIMESLOT INLINE EDITOR
     ══════════════════════ */
  function openTimeslotEditor(ri, td) {
    const row = SCHEDULE_DATA.rows[ri];
    if (!row || row.type !== 'normal') return;
    const current = row.label;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = current;
    input.className = 'form-control';
    input.style.cssText = 'width:100%;font-size:11px;padding:3px 6px;';

    const orig = td.innerHTML;
    td.innerHTML = '';
    td.appendChild(input);
    input.focus(); input.select();

    function commit() {
      const val = input.value.trim() || current;
      row.label = val;
      persistRowLabel(ri, val);
      td.innerHTML = `${esc(val)}<span class="edit-hint">click to rename</span>`;
    }

    function esc(s) {
      return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') { td.innerHTML = orig; }
    });
  }

  /* ══════════════════════
     MODAL
     ══════════════════════ */
  const overlay   = document.getElementById('modalOverlay');
  const form      = document.getElementById('classForm');
  const closeBtn  = document.getElementById('modalClose');
  const cancelBtn = document.getElementById('modalCancelBtn');
  const clearBtn  = document.getElementById('clearCellBtn');

  function openModal(ri, ci) {
    const cell = getCell(ri, ci);
    const row  = SCHEDULE_DATA.rows[ri];

    document.getElementById('f_day').value      = DAYS[ci] || '';
    document.getElementById('f_timeslot').value = row ? row.label : '';
    document.getElementById('f_row').value      = ri;
    document.getElementById('f_col').value      = ci;

    if (cell && cell.type === 'class') {
      document.getElementById('f_subject').value = cell.subject     || '';
      document.getElementById('f_section').value = cell.section     || '';
      document.getElementById('f_course').value  = cell.course      || '';
      document.getElementById('f_teacher').value = cell.instructor  || '';
      document.getElementById('f_time').value    = cell.time        || '';
      document.getElementById('f_dept').value    = cell.dept        || 'scoa';
      document.getElementById('modalTitle').textContent = 'Edit Class';
    } else {
      form.reset();
      document.getElementById('f_day').value      = DAYS[ci] || '';
      document.getElementById('f_timeslot').value = row ? row.label : '';
      document.getElementById('f_time').value     = row ? row.label : '';
      document.getElementById('modalTitle').textContent = 'Assign Class';
    }

    clearValidation();
    overlay.hidden = false;
    setTimeout(() => document.getElementById('f_subject').focus(), 50);
  }

  function closeModal() {
    overlay.hidden = true;
    form.reset();
    clearValidation();
  }

  if (closeBtn)  closeBtn.addEventListener('click',  closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  if (overlay)   overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !overlay.hidden) closeModal(); });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      const ri = parseInt(document.getElementById('f_row').value, 10);
      const ci = parseInt(document.getElementById('f_col').value, 10);
      persistCell(ri, ci, null);
      applyCellToDOM(ri, ci, { type:'vacant' });
      closeModal();
    });
  }

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!validateForm()) return;

      const ri = parseInt(document.getElementById('f_row').value, 10);
      const ci = parseInt(document.getElementById('f_col').value, 10);
      const row = SCHEDULE_DATA.rows[ri];

      // Update time slot label if changed
      const newLabel = document.getElementById('f_timeslot').value.trim();
      if (row && row.type === 'normal' && newLabel && newLabel !== row.label) {
        row.label = newLabel;
        persistRowLabel(ri, newLabel);
        const tr = document.querySelector(`tr[data-row-index="${ri}"]`);
        if (tr) {
          const tc = tr.querySelector('.time-col');
          if (tc) tc.innerHTML = `${escHtml(newLabel)}<span class="edit-hint">click to rename</span>`;
        }
      }

      const cell = {
        type:       'class',
        dept:       document.getElementById('f_dept').value,
        instructor: document.getElementById('f_teacher').value.trim(),
        subject:    document.getElementById('f_subject').value.trim(),
        section:    document.getElementById('f_section').value.trim(),
        course:     document.getElementById('f_course').value.trim(),
        time:       document.getElementById('f_time').value.trim(),
      };

      if (row) {
        const flat = expandCells(row.cells);
        flat[ci] = cell;
        row.cells = flat;
      }

      persistCell(ri, ci, cell);
      applyCellToDOM(ri, ci, cell);
      closeModal();
    });
  }

  function applyCellToDOM(ri, ci, cell) {
    const tr = document.querySelector(`tr[data-row-index="${ri}"]`);
    if (!tr) return;
    const td = tr.querySelector(`td[data-col-index="${ci}"]`);
    if (!td) return;
    td.innerHTML = '';
    if (cell.type === 'class') {
      const card = buildCard(cell);
      td.appendChild(card);
    } else {
      td.innerHTML = `<div class="vacant-cell"><span class="vc-icon">🔧</span><span class="vc-text">${escHtml(cell.label||'Vacant / Maintenance')}</span></div>`;
    }
  }

  function buildCard(cell) {
    const div = document.createElement('div');
    div.className = 'class-card';
    div.dataset.dept = cell.dept || '';
    div.innerHTML = `
      <span class="cc-instructor">${escHtml(cell.instructor)}</span>
      <span class="cc-subject">${escHtml(cell.subject)}</span>
      <span class="cc-section">${escHtml(cell.section)}</span>
      <span class="cc-time">${escHtml(cell.time)}</span>
    `;
    if (typeof window.applyCardColor === 'function') window.applyCardColor(div, cell.dept);
    return div;
  }

  function escHtml(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ══════════════════════
     VALIDATION
     ══════════════════════ */
  function validateForm() {
    let ok = true;
    ['f_subject','f_section','f_teacher'].forEach(id => {
      const inp = document.getElementById(id);
      if (!inp.value.trim()) { inp.classList.add('invalid'); ok = false; }
    });
    return ok;
  }

  function clearValidation() {
    document.querySelectorAll('.form-control.invalid')
      .forEach(e => e.classList.remove('invalid'));
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.form-control').forEach(inp => {
      inp.addEventListener('input', () => inp.classList.remove('invalid'));
    });
  });

  /* ══════════════════════
     APPLY STORED META (header text, logo)
     after DOM is ready but before render
     ══════════════════════ */
  function applyStoredMeta() {
    const s = loadData();
    if (!s) return;

    const metaFields = ['republic','institution','college','contact','semester','academicYear','labTitle','sig1Name','sig1Role','sig2Name','sig2Role'];
    metaFields.forEach(f => {
      if (s[f] !== undefined) {
        const el = document.getElementById(fieldToId(f));
        if (el) el.textContent = s[f];
      }
    });

    if (s.logoDataUrl) applyLogo(s.logoDataUrl);
  }

  function fieldToId(field) {
    const map = {
      republic:'hRepublic', institution:'hInstitution', college:'hCollege',
      contact:'hContact', semester:'hSemester', academicYear:'hYear',
      labTitle:'toolbarTitle', sig1Name:'sig1Name', sig1Role:'sig1Role',
      sig2Name:'sig2Name', sig2Role:'sig2Role'
    };
    return map[field] || field;
  }

  /* ══════════════════════
     EXPOSE & INIT
     ══════════════════════ */
  window.__applyScheduleOverrides = applyOverrides;

  window.addEventListener('load', () => {
    patchTableForEditor();
    initEditMode();
    attachCellHandlers();
    initHeaderFields();
    initLogoUpload();
    applyStoredMeta();
  });

})();
