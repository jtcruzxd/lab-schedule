/**
 * render.js — reads SCHEDULE_DATA and builds the DOM
 */

(function () {
  'use strict';

  /* ── helpers ── */
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── build vacant cell ── */
  function buildVacant(label) {
    const div = el('div', 'vacant-cell');
    const icon = el('span', 'vc-icon'); icon.textContent = '🔧';
    const txt  = el('span', 'vc-text');
    txt.textContent = label || 'Vacant / Maintenance';
    div.appendChild(icon);
    div.appendChild(txt);
    return div;
  }

  /* ── build class card ── */
  function buildCard(cell) {
    const div = el('div', `class-card dept-${esc(cell.dept)}`);
    div.setAttribute('role', 'group');
    div.setAttribute('aria-label', `${cell.instructor} – ${cell.subject}`);

    const ins  = el('span', 'cc-instructor', esc(cell.instructor));
    const subj = el('span', 'cc-subject',    esc(cell.subject));
    const sec  = el('span', 'cc-section',    esc(cell.section));
    const time = el('span', 'cc-time',       esc(cell.time));

    div.appendChild(ins);
    div.appendChild(subj);
    div.appendChild(sec);
    div.appendChild(time);
    return div;
  }

  /* ── render schedule table ── */
  function renderTable() {
    const tbody = document.getElementById('schedBody');
    if (!tbody) return;

    SCHEDULE_DATA.rows.forEach(row => {

      if (row.type === 'lunch') {
        const tr = el('tr', 'row-lunch');
        const td = el('td', '', '🍽️&nbsp; L U N C H &nbsp; B R E A K');
        td.setAttribute('colspan', '7');
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
      }

      const tr = document.createElement('tr');

      // time cell
      const timeTd = el('td', 'time-col');
      timeTd.textContent = row.label;
      timeTd.setAttribute('scope', 'row');
      tr.appendChild(timeTd);

      // data cells
      let cellIndex = 0;
      row.cells.forEach(cell => {
        const td = el('td', 'slot');
        const span = cell.colspan || 1;
        if (span > 1) td.setAttribute('colspan', span);

        if (cell.type === 'class') {
          td.appendChild(buildCard(cell));
        } else {
          td.appendChild(buildVacant(
            cell.type === 'vacant-time' ? cell.label : null
          ));
        }

        tr.appendChild(td);
        cellIndex += span;
      });

      tbody.appendChild(tr);
    });
  }

  /* ── render legend ── */
  function renderLegend() {
    const list = document.getElementById('legendList');
    if (!list) return;

    SCHEDULE_DATA.departments.forEach(dept => {
      const li   = el('li', 'legend-item');
      const sw   = el('span', 'legend-swatch');
      sw.style.background = dept.color;
      sw.setAttribute('aria-hidden', 'true');
      const lbl  = el('span', 'legend-label');
      lbl.innerHTML = dept.id !== 'vacant'
        ? `<strong>${esc(dept.label)}</strong> – ${esc(dept.fullName)}`
        : esc(dept.fullName);
      li.appendChild(sw);
      li.appendChild(lbl);
      list.appendChild(li);
    });
  }

  /* ── render PC table ── */
  function renderPC() {
    const tbody = document.getElementById('pcBody');
    if (!tbody) return;

    SCHEDULE_DATA.pcInventory.forEach(row => {
      const tr = el('tr', '');
      ['dept','processor','y2022','y2023','y2024','y2025'].forEach(k => {
        const td = el('td', '', esc(row[k]));
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    // totals row in tfoot
    const table = tbody.closest('table');
    const tfoot = document.createElement('tfoot');
    const tr    = el('tr', '');
    const tdLbl = el('td', ''); tdLbl.setAttribute('colspan', '2');
    tdLbl.innerHTML = '<strong>Total / Overall</strong>';
    const tdVal = el('td', ''); tdVal.textContent = SCHEDULE_DATA.pcTotal;
    const tdRest = el('td', ''); tdRest.setAttribute('colspan', '3');
    tdRest.textContent = `${SCHEDULE_DATA.pcTotal} units`;
    tr.appendChild(tdLbl);
    tr.appendChild(tdVal);
    tr.appendChild(tdRest);
    tfoot.appendChild(tr);
    table.appendChild(tfoot);
  }

  /* ── render software ── */
  function renderSoftware() {
    const list = document.getElementById('softwareList');
    if (!list) return;

    SCHEDULE_DATA.software.forEach(item => {
      const div = el('div', 'software-item');
      const dt  = el('dt',  'sw-dept', esc(item.dept));
      const dd  = el('dd',  'sw-prog', esc(item.programs));
      div.appendChild(dt);
      div.appendChild(dd);
      list.appendChild(div);
    });
  }

  /* ── compact view toggle ── */
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

  /* ── init ── */
  document.addEventListener('DOMContentLoaded', () => {
    // Allow editor.js to apply stored overrides first
    if (typeof window.__applyScheduleOverrides === 'function') {
      window.__applyScheduleOverrides();
    }
    renderTable();
    renderLegend();
    renderPC();
    renderSoftware();
    initCompactToggle();
  });

})();
