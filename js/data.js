/**
 * data.js — OMSC CAST Computer Laboratory Schedule
 * Default state: fixed 6 columns (Mon–Sat), no rows, just a lunch break row.
 * Days are static — always Monday through Saturday.
 */

const SCHEDULE_DATA = {

  semester:     "1st Semester",
  academicYear: "2026–2027",

  /* ── Columns — STATIC, always Mon–Sat ── */
  columns: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],

  /* ── Departments / Legend — empty by default ── */
  departments: [],

  /* ── PC Inventory ── */
  pcInventory: [
    { processor: "Core i7", y2022: 47, y2023: 0, y2024: 0, y2025: 4 },
    { processor: "Core i5", y2022: 0,  y2023: 0, y2024: 0, y2025: 0 },
    { processor: "Core i3", y2022: 0,  y2023: 0, y2024: 0, y2025: 0 },
  ],
  pcTotal: 51,

  /* ── Software — empty by default ── */
  software: [],

  /* ── Rows: only the lunch break row by default (no vacant rows) ── */
  rows: [
    { type: "lunch" }
  ]
};
