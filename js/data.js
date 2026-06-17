/**
 * data.js — OMSC CAST Computer Laboratory Schedule
 *
 * Edit this file to update schedule content.
 * No HTML knowledge needed — just change the values below.
 */

const SCHEDULE_DATA = {

  /* ── Semester info ── */
  semester: "1st Semester",
  academicYear: "2026–2027",

  /* ── Department colour map ──
     Keys must match the 'dept' field on class entries. */
  departments: [
    { id: "scoa",   label: "SCOA",    fullName: "School of Computing & Allied",     color: "#2d5fa6" },
    { id: "cbam",   label: "CBAM",    fullName: "Business & Accountancy Management", color: "#2e7d32" },
    { id: "hm",     label: "HM",      fullName: "Hospitality Management",            color: "#e65100" },
    { id: "cast",   label: "CAST/IT", fullName: "Arts, Sciences & Technology",       color: "#6a1b9a" },
    { id: "vacant", label: "",        fullName: "Vacant / Lab Maintenance",          color: "#cbd5e0" },
  ],

  /* ── PC Inventory ── */
  pcInventory: [
    { dept: "SCOA", processor: "Core i7", y2022: 47, y2023: 0, y2024: 0, y2025: 4  },
    { dept: "CBAM", processor: "Core i5", y2022: 0,  y2023: 0, y2024: 0, y2025: 0  },
    { dept: "HM",   processor: "Core i3", y2022: 0,  y2023: 0, y2024: 0, y2025: 0  },
  ],
  pcTotal: 51,

  /* ── Software ── */
  software: [
    { dept: "SCOA",    programs: "MS Office" },
    { dept: "CBAM",    programs: "Canva / Project Dev / MS Office" },
    { dept: "HM",      programs: "MyHotel PMS" },
    { dept: "CAST/IT", programs: "Canva / MS Office" },
  ],

  /* ══════════════════════════════════════════════════════
     TIME ROWS
     Each row = one horizontal band in the table.
     Special types:
       "lunch"  → renders a full-width lunch break bar
       "normal" → a regular time slot row

     For "normal" rows, supply a `cells` array with 6 items
     (Mon → Sat). Each cell is either:
       { type: "vacant", label: "optional text" }
       { type: "class",  dept, instructor, subject, section, time }
       { type: "vacant-time", label: "8:30–9:30" }   (vacant with specific window)
     ══════════════════════════════════════════════════════ */
  rows: [
    {
      type: "normal",
      label: "7:30 – 9:00",
      cells: [
        { type: "vacant" },
        { type: "vacant-time", label: "7:30 – 8:30" },
        { type: "vacant" },
        { type: "vacant-time", label: "7:30 – 8:30" },
        { type: "vacant-time", label: "8:00 – 9:30" },
        { type: "vacant-time", label: "7:30 – 8:30" },
      ]
    },
    {
      type: "normal",
      label: "9:00 – 9:15",
      cells: [
        { type: "vacant" },
        { type: "vacant-time", label: "8:30 – 9:30" },
        { type: "vacant" },
        { type: "vacant-time", label: "8:30 – 9:30" },
        { type: "vacant-time", label: "9:30 – 10:30" },
        { type: "vacant-time", label: "8:30 – 9:30" },
      ]
    },
    {
      type: "normal",
      label: "9:15 – 10:45",
      cells: [
        { type: "vacant" },
        { type: "vacant-time", label: "9:45 – 10:45" },
        { type: "vacant" },
        { type: "vacant-time", label: "9:45 – 10:45" },
        { type: "vacant" },
        { type: "vacant-time", label: "9:45 – 10:45" },
      ]
    },
    {
      type: "normal",
      label: "10:45 – 12:15",
      cells: [
        { type: "vacant" },
        { type: "vacant-time", label: "10:45 – 12:00" },
        { type: "vacant" },
        { type: "vacant-time", label: "10:45 – 12:00" },
        { type: "vacant" },
        { type: "vacant-time", label: "10:45 – 12:00" },
      ]
    },
    { type: "lunch" },
    {
      type: "normal",
      label: "1:00 – 2:30",
      cells: [
        { type: "vacant" },
        { type: "vacant-time", label: "1:00 – 2:30" },
        { type: "vacant" },
        { type: "vacant-time", label: "1:00 – 2:30" },
        { type: "vacant" },
        { type: "vacant-time", label: "1:00 – 2:00" },
      ]
    },
    {
      type: "normal",
      label: "2:00 – 3:00",
      cells: [
        { type: "vacant", colspan: 5 },
        { type: "vacant-time", label: "2:00 – 3:00" },
      ]
    },
    {
      type: "normal",
      label: "3:00 – 4:00",
      cells: [
        { type: "vacant", colspan: 5 },
        { type: "vacant-time", label: "3:00 – 4:00" },
      ]
    },
    {
      type: "normal",
      label: "4:00 – 5:00",
      cells: [
        { type: "vacant", colspan: 5 },
        { type: "vacant-time", label: "4:00 – 5:00" },
      ]
    },
    {
      type: "normal",
      label: "2:30 – 5:30",
      cells: [
        {
          type: "class", dept: "scoa",
          instructor: "Ms. Benoya",
          subject: "Programming 1",
          section: "BSIT 1E",
          time: "2:30 – 5:30"
        },
        {
          type: "class", dept: "scoa",
          instructor: "Mr. Panganiban",
          subject: "Web Systems Technology 1",
          section: "BSIT 1H",
          time: "2:30 – 5:30"
        },
        {
          type: "class", dept: "scoa",
          instructor: "Mr. Panganiban",
          subject: "Web Systems & Technology 1",
          section: "BSIT 1F",
          time: "2:30 – 5:30"
        },
        { type: "vacant" },
        { type: "vacant" },
        { type: "vacant" },
      ]
    },
    {
      type: "normal",
      label: "5:00 – 8:30",
      cells: [
        {
          type: "class", dept: "scoa",
          instructor: "Ms. Benoya",
          subject: "Programming 1",
          section: "BSIT 1D",
          time: "5:30 – 8:30"
        },
        {
          type: "class", dept: "scoa",
          instructor: "Mr. De Dios",
          subject: "Computer Programming 1",
          section: "BSIT 1H",
          time: "5:30 – 8:30"
        },
        {
          type: "class", dept: "scoa",
          instructor: "Mr. De Dios",
          subject: "Computer Programming 1",
          section: "BSIT 1F",
          time: "5:30 – 8:30"
        },
        {
          type: "class", dept: "scoa",
          instructor: "Mr. Cruz",
          subject: "IT Fundamentals",
          section: "BSIT 1E",
          time: "5:30 – 8:30"
        },
        {
          type: "class", dept: "scoa",
          instructor: "Mr. De Dios",
          subject: "Computer Programming 1",
          section: "BSIT 1G",
          time: "5:00 – 8:30"
        },
        { type: "vacant-time", label: "5:00 – 8:30" },
      ]
    },
  ] // end rows
};
