/**
 * data.js — OMSC CAST Computer Laboratory Schedule
 * Default state: 6 columns, 4 morning rows, lunch, 6 afternoon rows.
 * Legend and software are empty by default.
 */

const SCHEDULE_DATA = {

  semester:     "1st Semester",
  academicYear: "2026–2027",

  /* ── Columns ── */
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

  /* ── Rows: 4 morning + lunch + 6 afternoon ── */
  rows: [
    { type: "normal", label: "", cells: [ {type:"vacant"},{type:"vacant"},{type:"vacant"},{type:"vacant"},{type:"vacant"},{type:"vacant"} ] },
    { type: "normal", label: "", cells: [ {type:"vacant"},{type:"vacant"},{type:"vacant"},{type:"vacant"},{type:"vacant"},{type:"vacant"} ] },
    { type: "normal", label: "", cells: [ {type:"vacant"},{type:"vacant"},{type:"vacant"},{type:"vacant"},{type:"vacant"},{type:"vacant"} ] },
    { type: "normal", label: "", cells: [ {type:"vacant"},{type:"vacant"},{type:"vacant"},{type:"vacant"},{type:"vacant"},{type:"vacant"} ] },
    { type: "lunch" },
    { type: "normal", label: "", cells: [ {type:"vacant"},{type:"vacant"},{type:"vacant"},{type:"vacant"},{type:"vacant"},{type:"vacant"} ] },
    { type: "normal", label: "", cells: [ {type:"vacant"},{type:"vacant"},{type:"vacant"},{type:"vacant"},{type:"vacant"},{type:"vacant"} ] },
    { type: "normal", label: "", cells: [ {type:"vacant"},{type:"vacant"},{type:"vacant"},{type:"vacant"},{type:"vacant"},{type:"vacant"} ] },
    { type: "normal", label: "", cells: [ {type:"vacant"},{type:"vacant"},{type:"vacant"},{type:"vacant"},{type:"vacant"},{type:"vacant"} ] },
    { type: "normal", label: "", cells: [ {type:"vacant"},{type:"vacant"},{type:"vacant"},{type:"vacant"},{type:"vacant"},{type:"vacant"} ] },
    { type: "normal", label: "", cells: [ {type:"vacant"},{type:"vacant"},{type:"vacant"},{type:"vacant"},{type:"vacant"},{type:"vacant"} ] },
  ]
};
