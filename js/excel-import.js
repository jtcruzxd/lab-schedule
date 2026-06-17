/**
 * excel-import.js
 * Reads an uploaded .xlsx / .csv file and populates the schedule.
 *
 * Expected columns (case-insensitive, order doesn't matter):
 *   Day         — Monday / Tuesday / Wednesday / Thursday / Friday / Saturday
 *   Time Slot   — Row label (e.g. "7:30 – 9:00")
 *   Subject     — Subject name
 *   Instructor  — Teacher name
 *   Section     — Year & Section (e.g. BSIT 1A)
 *   Course      — Course code (e.g. BSIT)
 *   Class Time  — Specific time shown on card (e.g. "7:30 – 8:30")
 *   Department  — Department value (e.g. CAST)
 *
 * Rows with missing Day, Time Slot, Subject, or Instructor are skipped.
 */

(function () {
  'use strict';

  /* ── SheetJS is loaded via CDN script tag in index.html ── */

  const DAYS_NORM = ['monday','tuesday','wednesday','thursday','friday','saturday'];

  function normalise(s) { return String(s||'').trim().toLowerCase(); }

  function toProperCase(str) {
    return String(str||'').trim().replace(/\w\S*/g, w =>
      w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  }

  /* Map header names → canonical field names */
  function mapHeader(h) {
    const n = normalise(h);
    if (n === 'day')                       return 'day';
    if (n.includes('time slot') || n === 'timeslot' || n === 'slot') return 'timeSlot';
    if (n === 'subject')                   return 'subject';
    if (n === 'instructor' || n === 'teacher' || n === 'name') return 'instructor';
    if (n === 'section' || n.includes('year'))  return 'section';
    if (n === 'course')                    return 'course';
    if (n.includes('class time') || n === 'classtime' || n === 'time') return 'time';
    if (n === 'department' || n === 'dept') return 'dept';
    return null;
  }

  /* Parse XLSX/CSV bytes → array of row objects */
  function parseFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb   = XLSX.read(e.target.result, { type: 'binary' });
          const ws   = wb.Sheets[wb.SheetNames[0]];
          const raw  = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          if (raw.length < 2) { reject(new Error('Empty sheet')); return; }

          // First row = headers
          const headers = raw[0].map(mapHeader);
          const rows = [];
          for (let i = 1; i < raw.length; i++) {
            const row = {};
            headers.forEach((field, col) => {
              if (field) row[field] = String(raw[i][col] || '').trim();
            });
            rows.push(row);
          }
          resolve(rows);
        } catch(err) { reject(err); }
      };
      reader.onerror = () => reject(new Error('File read error'));
      reader.readAsBinaryString(file);
    });
  }

  /* Apply parsed rows to SCHEDULE_DATA */
  function applyRows(rows) {
    const cols   = SCHEDULE_DATA.columns || [];
    let imported = 0;
    let skipped  = 0;

    rows.forEach(row => {
      const day       = normalise(row.day || '');
      const timeSlot  = (row.timeSlot || '').trim();
      const subject   = (row.subject  || '').trim();
      const instructor= (row.instructor|| '').trim();

      if (!day || !timeSlot || !subject || !instructor) { skipped++; return; }

      // Find column index
      const colIdx = cols.findIndex(c => normalise(c) === day ||
        DAYS_NORM.some(d => d === day && normalise(c) === d));
      if (colIdx === -1) {
        // Column doesn't exist yet — check if day name matches any column loosely
        const looseIdx = cols.findIndex(c => normalise(c).includes(day) || day.includes(normalise(c)));
        if (looseIdx === -1) { skipped++; return; }
      }
      const ci = colIdx !== -1 ? colIdx : cols.findIndex(c => normalise(c).includes(day));

      // Find or create the time slot row
      let rowIdx = SCHEDULE_DATA.rows.findIndex(r =>
        r.type === 'normal' && normalise(r.label) === normalise(timeSlot));

      if (rowIdx === -1) {
        // Create a new row at the bottom
        const numCols = cols.length;
        const newRow = {
          type: 'normal',
          label: timeSlot,
          cells: Array.from({ length: numCols }, () => ({ type: 'vacant' }))
        };
        SCHEDULE_DATA.rows.push(newRow);
        rowIdx = SCHEDULE_DATA.rows.length - 1;
      }

      // Build cell
      const deptRaw   = (row.dept || '').trim();
      const deptId    = deptRaw.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const deptLabel = deptRaw;

      const cell = {
        type:       'class',
        dept:       deptId,
        deptLabel:  deptLabel,
        instructor: toProperCase(instructor),
        subject:    toProperCase(subject),
        section:    (row.section   || '').trim().toUpperCase(),
        course:     (row.course   || '').trim(),
        time:       (row.time     || '').trim(),
      };

      // Write into flat cells array
      const targetRow = SCHEDULE_DATA.rows[rowIdx];
      const nc  = cols.length;
      const flat = window.expandCells(targetRow.cells, nc);
      flat[ci]  = cell;
      targetRow.cells = flat;

      // Sync dept to legend
      if (deptRaw && typeof window.syncDeptToLegendPublic === 'function') {
        window.syncDeptToLegendPublic(deptRaw, deptLabel);
      }

      imported++;
    });

    return { imported, skipped };
  }

  /* ── Public API ── */
  window.ExcelImport = {
    parseFile,
    applyRows,

    /* High-level: parse + apply + re-render */
    async importFile(file, onDone) {
      try {
        const rows = await parseFile(file);
        const result = applyRows(rows);

        // Persist
        if (typeof window.persistAllCellsPublic === 'function') {
          window.persistAllCellsPublic();
        }

        // Re-render
        window.renderTable();
        if (typeof window.patchTableForEditorPublic === 'function') {
          window.patchTableForEditorPublic();
        }
        window.renderLegend();

        if (onDone) onDone(null, result);
      } catch(err) {
        if (onDone) onDone(err, null);
      }
    }
  };

})();
