# OMSC CAST – Computer Laboratory Schedule

> 1st Semester 2026–2027 · Main Campus · Occidental Mindoro State College

Live site → **https://\<your-username\>.github.io/\<repo-name\>/**

---

## 🚀 Deploy to GitHub Pages (step-by-step)

### 1. Create a GitHub repository

1. Go to [github.com/new](https://github.com/new)
2. Name it (e.g. `lab-schedule`)
3. Set it to **Public**
4. Leave "Initialize repository" **unchecked**
5. Click **Create repository**

### 2. Push these files

Open a terminal in this folder and run:

```bash
git init
git add .
git commit -m "Initial lab schedule site"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

### 3. Enable GitHub Pages

1. Open your repo on GitHub
2. Go to **Settings → Pages**
3. Under **Source**, select **GitHub Actions**
4. The workflow will run automatically — your site will be live at:
   `https://<your-username>.github.io/<repo-name>/`

---

## ✏️ Updating the schedule

All schedule content lives in **`js/data.js`** — no HTML knowledge needed.

### To add a class:
Find the right time-slot row and replace a `vacant` cell with a `class` entry:

```js
{
  type: "class",
  dept: "scoa",           // scoa | cbam | hm | cast
  instructor: "Mr. Santos",
  subject: "Data Structures",
  section: "BSIT 2A",
  time: "9:15 – 10:45"
}
```

### To mark a slot vacant:
```js
{ type: "vacant" }
// or with a specific window:
{ type: "vacant-time", label: "7:30 – 8:30" }
```

After editing, commit and push — GitHub Actions redeploys automatically.

---

## 📁 Project structure

```
├── index.html          # Page shell (rarely needs editing)
├── css/
│   └── style.css       # All styles
├── js/
│   ├── data.js         # ← Edit this to update the schedule
│   └── render.js       # Builds the DOM from data.js
└── .github/
    └── workflows/
        └── deploy.yml  # Auto-deploy to GitHub Pages
```

---

*Prepared by: Joven T. Cruz, Laboratory Custodian*  
*Noted by: Joselito D. Aguid, PhDs, LPT, CHRA*
