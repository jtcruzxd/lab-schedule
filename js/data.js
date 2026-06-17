/**
 * data.js — OMSC CAST Computer Laboratory Schedule
 * Default blank state. All edits are stored in localStorage.
 */
const SCHEDULE_DATA = {

  semester:     "1st Semester",
  academicYear: "2026–2027",

  /* departments — used by legend and card coloring */
  departments: [
    { id: "vacant", label: "", fullName: "Vacant / Lab Maintenance", color: "#cbd5e0" }
  ],

  /* column headers */
  columns: ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],

  /* PC inventory */
  pcInventory: [],
  pcTotal: 0,

  /* software */
  software: [],

  /* schedule rows — starts with just a lunch break placeholder */
  rows: [
    { type: "lunch" }
  ]
};
