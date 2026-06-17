/**
 * editor.js — Schedule editor with localStorage persistence
 *
 * Adds edit-mode toggle, modal form for class entry,
 * inline time-slot renaming, and reset-to-default.
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'omsc_schedule_data';
  const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  /* ── Load persisted data or fall back to SCHEDULE_DATA ── */
  function loadData() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) { /* ignore */ }
    return null;
  }

  function saveData(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch(e) {}
  }

  function resetData() {
    localStorage.removeItem(STORAGE_KEY);
  }

  /* ── Merge stored overrides into live SCHEDULE_DATA ──
     We store only the overrides (cells + row labels) to
     keep localStorage small and preserve future data.js updates. */
  function applyOverrides() {
    const stored = loadData();
    if (!stored) return;

    // Row labels
    if (stored.rowLabels) {
      stored.rowLabels.forEach((lbl, i) => {
        const row = SCHEDULE_DATA.rows[i];
        if (row && row.type === 'normal' && lbl !== null) row.label = lbl;
      });
    }

    // Cell overrides: { "rowIndex-colIndex": cellObject | null }
    if (stored.cells) {
      Object.entries(stored.cells).forEach(([key, cell]) => {
        const [ri, ci] = key.split('-').map(Number);
        const row = SCHEDULE_DATA.rows[ri];
        if (!row || row.type !== 'normal') return;

        // Expand cells if needed (handle colspan rows)
        const flatCells = expandCells(row.cells);
        if (ci < flatCells.length) {
          if (cell === null) {
            flatCells[ci] = { type: 'vacant' };
          } else {
            flatCells[ci] = cell;
          }
          row.cells = compressCells(flatCells);
        }
      });
    }
  }

  /* Expand colspan cells into flat 6-cell array */
  function expandCells(cells) {
    const flat = [];
    cells.forEach(c => {
      const span = c.colspan || 1;
      for (let i = 0; i < span; i++) {
        flat.push(i === 0 ? { ...c, colspan: undefined } : { type: 'vacant' });
      }
    });
    while (flat.length < 6) flat.push({ type: 'vacant' });
    return flat.slice(0, 6);
  }

  /* Re-compress consecutive vacant cells back (optional, keeps it clean) */
  function compressCells(flat) {
    return flat; // keep flat for simplicity
  }

  /* ── Get flat cell from a row by day index ── */
  function getCell(rowIndex, colIndex) {
    const row = SCHEDULE_DATA.rows[rowIndex];
    if (!row || row.type !== 'normal') return null;
    return expandCells(row.cells)[colIndex] || { type: 'vacant' };
  }

  /* ── Persist a cell change ── */
  function persistCellChange(rowIndex, colIndex, cellObj) {
    const stored = loadData() || {};
    if (!stored.cells) stored.cells = {};
    stored.cells[`${rowIndex}-${colIndex}`] = cellObj;
    saveData(stored);
  }

  function persistRowLabel(rowIndex, label) {
    const stored = loadData() || {};
    if (!stored.rowLabels) {
      stored.rowLabels = SCHEDULE_DATA.rows.map(r => r.type === 'normal' ? r.label : null);
    }
    stored.rowLabels[rowIndex] = label;
    saveData(stored);
  }

  /* ════════════════════════════
     EDIT MODE TOGGLE
     ════════════════════════════ */
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
    });

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Reset the schedule to the original default? All your changes will be lost.')) {
          resetData();
          location.reload();
        }
      });
    }
  }

  /* ════════════════════════════
     CELL CLICK HANDLERS
     ════════════════════════════ */
  function attachCellHandlers() {
    const tbody = document.getElementById('schedBody');
    if (!tbody) return;

    tbody.addEventListener('click', (e) => {
      if (!document.body.classList.contains('edit-mode')) return;

      const td = e.target.closest('td');
      if (!td) return;

      // Time col click → rename slot
      if (td.classList.contains('time-col')) {
        const tr = td.closest('tr');
        const rowIndex = parseInt(tr.dataset.rowIndex, 10);
        if (isNaN(rowIndex)) return;
        openTimeslotEditor(rowIndex, td);
        return;
      }

      // Slot click → open class modal
      if (td.classList.contains('slot')) {
        const tr   = td.closest('tr');
        const rowIndex = parseInt(tr.dataset.rowIndex, 10);
        const colIndex = parseInt(td.dataset.colIndex, 10);
        if (isNaN(rowIndex) || isNaN(colIndex)) return;
        openModal(rowIndex, colIndex);
      }
    });
  }

  /* ════════════════════════════
     TIMESLOT INLINE EDITOR
     ════════════════════════════ */
  function openTimeslotEditor(rowIndex, td) {
    const row = SCHEDULE_DATA.rows[rowIndex];
    if (!row || row.type !== 'normal') return;

    const current = row.label;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = current;
    input.className = 'form-control timeslot-inline';
    input.style.cssText = 'width:100%;font-size:11px;padding:3px 6px;';

    const originalContent = td.innerHTML;
    td.innerHTML = '';
    td.appendChild(input);
    input.focus();
    input.select();

    function commit() {
      const val = input.value.trim() || current;
      row.label = val;
      persistRowLabel(rowIndex, val);
      td.innerHTML = originalContent;
      // Update the text node
      td.childNodes.forEach(n => {
        if (n.nodeType === 3) n.textContent = val;
      });
      // Re-render just this cell text
      td.innerHTML = `${val}<span class="edit-hint">click to rename</span>`;
    }

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') { td.innerHTML = originalContent; }
    });
  }

  /* ════════════════════════════
     MODAL
     ════════════════════════════ */
  const overlay   = document.getElementById('modalOverlay');
  const form      = document.getElementById('classForm');
  const closeBtn  = document.getElementById('modalClose');
  const cancelBtn = document.getElementById('modalCancelBtn');
  const clearBtn  = document.getElementById('clearCellBtn');

  function openModal(rowIndex, colIndex) {
    const cell = getCell(rowIndex, colIndex);
    const row  = SCHEDULE_DATA.rows[rowIndex];

    // Populate read-only context fields
    document.getElementById('f_day').value      = DAYS[colIndex] || '';
    document.getElementById('f_timeslot').value = row ? row.label : '';
    document.getElementById('f_row').value      = rowIndex;
    document.getElementById('f_col').value      = colIndex;

    // Populate class fields if already assigned
    if (cell && cell.type === 'class') {
      document.getElementById('f_subject').value = cell.subject  || '';
      document.getElementById('f_section').value = cell.section  || '';
      document.getElementById('f_course').value  = cell.course   || '';
      document.getElementById('f_teacher').value = cell.instructor || '';
      document.getElementById('f_time').value    = cell.time     || '';
      document.getElementById('f_dept').value    = cell.dept     || 'scoa';
      document.getElementById('modalTitle').textContent = 'Edit Class';
    } else {
      form.reset();
      document.getElementById('f_day').value      = DAYS[colIndex] || '';
      document.getElementById('f_timeslot').value = row ? row.label : '';
      document.getElementById('f_time').value     = row ? row.label : '';
      document.getElementById('modalTitle').textContent = 'Assign Class';
    }

    clearValidation();
    overlay.hidden = false;
    document.getElementById('f_subject').focus();
  }

  function closeModal() {
    overlay.hidden = true;
    form.reset();
    clearValidation();
  }

  if (closeBtn)  closeBtn.addEventListener('click',  closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  /* Clear cell */
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      const ri = parseInt(document.getElementById('f_row').value, 10);
      const ci = parseInt(document.getElementById('f_col').value, 10);
      persistCellChange(ri, ci, null);
      applyCellToDOM(ri, ci, { type: 'vacant' });
      closeModal();
    });
  }

  /* Form submit */
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!validateForm()) return;

      const ri = parseInt(document.getElementById('f_row').value, 10);
      const ci = parseInt(document.getElementById('f_col').value, 10);

      const newLabel = document.getElementById('f_timeslot').value.trim();
      const row = SCHEDULE_DATA.rows[ri];
      if (row && row.type === 'normal' && newLabel && newLabel !== row.label) {
        row.label = newLabel;
        persistRowLabel(ri, newLabel);
        // Update DOM time cell
        const tr = document.querySelector(`tr[data-row-index="${ri}"]`);
        if (tr) {
          const tc = tr.querySelector('.time-col');
          if (tc) tc.innerHTML = `${newLabel}<span class="edit-hint">click to rename</span>`;
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

      // Update in-memory data
      const flat = expandCells(row.cells);
      flat[ci] = cell;
      row.cells = flat;

      persistCellChange(ri, ci, cell);
      applyCellToDOM(ri, ci, cell);
      closeModal();
    });
  }

  /* ── Update a single TD in the table ── */
  function applyCellToDOM(rowIndex, colIndex, cell) {
    const tr = document.querySelector(`tr[data-row-index="${rowIndex}"]`);
    if (!tr) return;
    const td = tr.querySelector(`td[data-col-index="${colIndex}"]`);
    if (!td) return;

    td.innerHTML = '';
    if (cell.type === 'class') {
      td.appendChild(buildCard(cell));
    } else {
      td.appendChild(buildVacant(cell.label || null));
    }
  }

  function buildCard(cell) {
    const div = document.createElement('div');
    div.className = `class-card dept-${cell.dept}`;
    div.innerHTML = `
      <span class="cc-instructor">${esc(cell.instructor)}</span>
      <span class="cc-subject">${esc(cell.subject)}</span>
      <span class="cc-section">${esc(cell.section)}</span>
      <span class="cc-time">${esc(cell.time)}</span>
    `;
    return div;
  }

  function buildVacant(label) {
    const div = document.createElement('div');
    div.className = 'vacant-cell';
    div.innerHTML = `<span class="vc-icon">🔧</span><span class="vc-text">${esc(label || 'Vacant / Maintenance')}</span>`;
    return div;
  }

  function esc(str) {
    return String(str || '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ── Validation ── */
  function validateForm() {
    let valid = true;
    ['f_subject','f_section','f_teacher'].forEach(id => {
      const inp = document.getElementById(id);
      if (!inp.value.trim()) {
        inp.classList.add('invalid');
        valid = false;
      }
    });
    return valid;
  }

  function clearValidation() {
    document.querySelectorAll('.form-control.invalid')
      .forEach(el => el.classList.remove('invalid'));
  }

  document.querySelectorAll('.form-control').forEach(inp => {
    inp.addEventListener('input', () => inp.classList.remove('invalid'));
  });

  /* ════════════════════════════
     PATCH render.js — add data
     attributes and edit hints
     after table is built
     ════════════════════════════ */
  function patchTableForEditor() {
    const tbody = document.getElementById('schedBody');
    if (!tbody) return;

    const trs = Array.from(tbody.querySelectorAll('tr'));
    // Map each TR to its SCHEDULE_DATA row index
    // Lunch rows have no .time-col, normal rows do
    let schedIdx = 0;
    trs.forEach(tr => {
      const timeCol = tr.querySelector('.time-col');

      // Skip lunch rows (no time-col)
      if (!timeCol) {
        // Find the lunch row index and skip past it
        while (schedIdx < SCHEDULE_DATA.rows.length && SCHEDULE_DATA.rows[schedIdx].type !== 'lunch') schedIdx++;
        schedIdx++; // skip the lunch row itself
        return;
      }

      // Find the matching normal row index
      while (schedIdx < SCHEDULE_DATA.rows.length && SCHEDULE_DATA.rows[schedIdx].type !== 'normal') schedIdx++;
      if (schedIdx >= SCHEDULE_DATA.rows.length) return;

      tr.dataset.rowIndex = schedIdx;

      // Add edit hint span to time cell
      if (!timeCol.querySelector('.edit-hint')) {
        const hint = document.createElement('span');
        hint.className = 'edit-hint';
        hint.textContent = 'click to rename';
        timeCol.appendChild(hint);
      }

      // Annotate each slot td with its column index (0-5)
      let ci = 0;
      tr.querySelectorAll('.slot').forEach(td => {
        td.dataset.colIndex = ci;
        ci += parseInt(td.getAttribute('colspan') || '1', 10);
      });

      schedIdx++;
    });
  }

  /* ── Wait for render.js to finish, then patch ── */
  document.addEventListener('DOMContentLoaded', () => {
    // Apply any stored overrides BEFORE render
    applyOverrides();
  });

  /* Expose override function for render.js to call */
  window.__applyScheduleOverrides = applyOverrides;

  /* render.js fires after DOMContentLoaded too, so we use a small timeout
     to patch after it has built the table. */
  window.addEventListener('load', () => {
    patchTableForEditor();
    initEditMode();
    attachCellHandlers();
  });

})();
