# XtractIQ — Complete Project Explanation & Study Guide

> **Purpose of this document**
> This file is written for a developer who is **taking over this project without prior context**. It explains *what* the project is, *why* it exists, *how* it is built, *how the pieces talk to each other*, *how to run and deploy it*, and — just as importantly — *what is incomplete, fragile, or unsafe* so you know exactly what you are inheriting.
>
> Read this top-to-bottom once, then use it as a reference. A suggested study order is given at the very end (see **§16 Study Guide**).
>
> *This was originally an internship project (a "Document Data Extractor", internal name `doc-ocr-app` / `backend-DDE`) that was later cleaned up, rebranded to **XtractIQ**, and deployed publicly.*

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [The Problem It Solves](#2-the-problem-it-solves)
3. [High-Level Architecture](#3-high-level-architecture)
4. [End-to-End Data Flow](#4-end-to-end-data-flow-the-most-important-section)
5. [Full Tech Stack (every dependency explained)](#5-full-tech-stack)
6. [Repository / Folder Structure](#6-repository--folder-structure)
7. [Backend Deep Dive](#7-backend-deep-dive)
8. [Frontend Deep Dive](#8-frontend-deep-dive)
9. [The AI & OCR Layer](#9-the-ai--ocr-layer)
10. [Database Design](#10-database-design)
11. [Configuration & Environment Variables](#11-configuration--environment-variables)
12. [Running the Project Locally](#12-running-the-project-locally)
13. [Deployment](#13-deployment)
14. [⚠️ Known Issues, Gaps & Technical Debt](#14-️-known-issues-gaps--technical-debt-read-this)
15. [🔐 Security Notes](#15--security-notes-important)
16. [Study Guide & Suggested Reading Order](#16-study-guide--suggested-reading-order)
17. [Glossary](#17-glossary)
18. [Future Improvements](#18-future-improvements)

---

## 1. Executive Summary

**XtractIQ** is an **end-to-end intelligent document processing system**. A user uploads a scanned document (a PDF or an image of a form), and the system:

1. **Reads the text** off the image using OCR (Optical Character Recognition).
2. **Understands the text** using a Large Language Model (LLM), turning messy raw text into clean, structured key–value pairs (e.g. `"Full Name": "John Doe"`).
3. **Stores** that structured data in a PostgreSQL database.
4. **Shows** the data in an editable web table so a human can review/correct it ("verification").
5. (Intended) **Saves** the human-verified version into a separate "verified" database.

In short: **scanned form → structured, verifiable data → database.**

It is a classic **three-tier web application** (frontend → backend → data/AI services) with an AI twist: two external AI/cloud services do the heavy lifting (Azure for OCR, Groq for language understanding).

| | |
|---|---|
| **Project name** | XtractIQ (internal: `doc-ocr-app`, `backend-DDE`) |
| **Type** | Full-stack web app + AI integration |
| **Frontend** | React 19 + Vite + Material UI |
| **Backend** | Node.js + Express |
| **AI/OCR** | Azure Computer Vision (OCR) + Groq LLM (`llama-3.3-70b-versatile`) |
| **Database** | PostgreSQL hosted on Neon (cloud) |
| **Helper** | A Python script (`insert_to_pg.py`) for dynamic DB inserts |
| **Deployment** | Render (current) + a leftover Azure GitHub Actions pipeline |

---

## 2. The Problem It Solves

In industries like **banking, insurance, HR, healthcare, and customer onboarding**, huge volumes of paper or scanned forms must be typed into computer systems by hand. Manual data entry is:

- **Slow** — a human reads each field and types it.
- **Error-prone** — typos, skipped fields, misread handwriting.
- **Expensive** — it's a labour cost that scales linearly with volume.

XtractIQ automates the *first pass* of that work. The AI extracts the fields automatically; the human only **reviews and corrects** rather than typing everything from scratch. That's the core value proposition, and it's also why the app is built around a **two-stage data model**: "extracted but not yet checked" data vs. "human-verified" data (see [§10 Database Design](#10-database-design)).

---

## 3. High-Level Architecture

The system is split into clearly separated layers. Each layer only talks to its immediate neighbours.

```
        ┌─────────────────────────────────────────────┐
        │                  USER (browser)              │
        └───────────────────────┬─────────────────────┘
                                 │  HTTPS (uploads files, views table)
                                 ▼
        ┌─────────────────────────────────────────────┐
        │        FRONTEND — React + Vite (SPA)         │
        │   my-react-app/  →  served as a static site  │
        └───────────────────────┬─────────────────────┘
                                 │  REST/JSON over HTTP  (fetch → /api/...)
                                 ▼
        ┌─────────────────────────────────────────────┐
        │        BACKEND — Node.js + Express           │
        │   backend/server.js + routes/uploadroutes.js │
        └───┬───────────────┬───────────────────┬──────┘
            │               │                   │
            ▼               ▼                   ▼
   ┌────────────────┐ ┌──────────────┐  ┌────────────────────┐
   │  Azure OCR     │ │  Groq LLM    │  │  PostgreSQL (Neon)  │
   │ (image→text)   │ │ (text→JSON)  │  │  before_verify2 /   │
   │                │ │              │  │  after_verify2      │
   └────────────────┘ └──────────────┘  └─────────┬──────────┘
                                                   ▲
                                                   │ inserts done by
                                          ┌────────┴─────────┐
                                          │ insert_to_pg.py  │  (Python child process,
                                          │  (psycopg2)      │   spawned by Node)
                                          └──────────────────┘
```

### Architectural characteristics

- **Separation of concerns.** The UI knows nothing about Azure or Groq — it only calls the backend. The AI services are completely abstracted behind backend functions.
- **Stateless backend.** The Express server keeps almost no state; everything persistent lives in PostgreSQL.
- **Dynamic schema.** There is *no fixed list of fields*. Whatever fields the AI finds become database columns on the fly. This is a deliberate design choice so the app can handle *any* form layout, not just one specific form.
- **Hybrid Node + Python data layer.** This is unusual and worth flagging early: the backend uses **two different mechanisms** to talk to the same database. Node's `pg` library is used to **read** data (`SELECT`), while a **separate Python script** (`insert_to_pg.py`, using `psycopg2`) is spawned as a child process to **write/insert** data. See [§7.4](#74-insert_to_pgpy--the-python-insert-helper) for the full explanation and [§14](#14-️-known-issues-gaps--technical-debt-read-this) for why this matters.

---

## 4. End-to-End Data Flow (the most important section)

This is the heart of the system. Follow a single file from upload to display.

**Step 1 — User uploads a file (frontend).**
In `my-react-app/src/App.jsx`, the user clicks the upload card and picks one or more files. The frontend splits them into **PDFs** and **images** and sends them to two different backend endpoints:
- PDFs → `POST /api/upload-scanned-pdfs`
- Images → `POST /api/upload-images`

Files are sent as `multipart/form-data` under the field name `files`.

**Step 2 — Backend receives & validates (Express + Multer).**
In `backend/routes/uploadroutes.js`, the `multer` middleware saves the uploaded file to a temporary `backend/uploads/` folder and rejects anything that isn't a PDF or image (via a `fileFilter`).

**Step 3 — OCR: image/PDF → raw text (Azure).**
The route calls `extractTextFromImage()` or `extractTextFromScannedPDF()` in `backend/extractor/aiApiCall.js`.
- For **images**: the file bytes are POSTed to Azure's **Read API** (`/vision/v3.2/read/analyze`). Azure OCR is *asynchronous* — it returns an `operation-location` URL, and the code **polls** that URL once per second (up to 15 seconds) until the status is `succeeded`, then concatenates all detected text lines.
- For **PDFs**: the PDF is first **converted to one JPEG image per page** using the external `pdftoppm` command (from poppler-utils) at 300 DPI, then *each page image* is run through Azure OCR and the text is concatenated. Temp images are deleted afterward.

**Step 4 — Structuring: raw text → clean JSON (Groq LLM).**
The raw OCR text is passed to `processTextWithAI()`. This sends a chat-completion request to the **Groq API** using the model `llama-3.3-70b-versatile`. A carefully written **system prompt** instructs the model to:
- find meaningful key–value pairs,
- ignore OCR noise/artifacts,
- standardize field names ("Full Name", "Email Address", …),
- return **only valid JSON**, no prose.

The response is run through `extractJsonFromText()`, a robust parser that tries multiple strategies (parse whole string, pull JSON out of a ```` ```json ```` code block, regex-grab the first `{...}` block, etc.). If parsing fails, it **retries once**; if it still fails, it returns an error object.

**Step 5 — Flatten the data.**
Back in the route, `flattenForDb()` ensures every value is a primitive: any nested object/array is converted to a JSON **string** so it can fit into a single `TEXT` column.

**Step 6 — Insert into PostgreSQL (via Python).**
The route calls `insertToPostgres()`, which **spawns the Python script** `insert_to_pg.py` and pipes the JSON to it over `stdin`. The Python script (using `psycopg2`):
- dynamically figures out the set of columns from the data,
- creates/extends the `documents` table to have those columns (all `TEXT`),
- inserts the rows.
- ⚠️ **It also drops the `documents` table at the start of each run** — see [§14](#14-️-known-issues-gaps--technical-debt-read-this).

**Step 7 — Read back & return to frontend.**
After inserting, the route runs `SELECT * FROM documents;` (this time using Node's `pg` pool) and returns all rows as JSON: `{ data: [...] }`.

**Step 8 — Display in an editable table (frontend).**
React receives the rows and renders them in a **Material React Table**. Columns are generated **dynamically** from the keys of the first row. Cells that contain stringified JSON are detected and rendered as nice **nested sub-tables** (the recursive `SubTable` component), with an "Edit" button that opens a modal for editing nested fields.

**Step 9 — Human verification (intended).**
The user reviews/edits the data, then clicks **"Save Verified Data"**, which is *supposed* to POST to `/api/save-verified` to persist the corrected data into the separate `after_verify2` database.
⚠️ **This endpoint does not currently exist in the backend** — see [§14](#14-️-known-issues-gaps--technical-debt-read-this). This is the single most important "gotcha" for the new owner.

---

## 5. Full Tech Stack

### Frontend (`my-react-app/`)
| Package | Why it's here |
|---|---|
| **react** / **react-dom** `^19` | UI framework. The whole app is one component, `App.jsx`. |
| **vite** `^6` | Build tool + dev server (fast, modern replacement for Create-React-App). |
| **@vitejs/plugin-react** | Lets Vite compile React/JSX with Fast Refresh. |
| **@mui/material**, **@emotion/react**, **@emotion/styled** | Material UI component library + its CSS-in-JS engine. Used for the Dialog/Modal, Buttons, TextFields. |
| **@mui/icons-material**, **@mui/x-date-pickers** | MUI icon set and date-picker (date-picker pulled in but not central to the UI). |
| **material-react-table** `^3` | The powerful data-grid that renders the extracted documents with inline editing. |
| **lucide-react**, **react-icons** | Icon sets (Upload, FileText, Database, Sparkles icons in the header/upload card). |
| **tailwindcss / postcss / autoprefixer** | Present in devDependencies, but the UI is actually styled with **inline `style={}` objects** + a small injected `<style>` block, *not* Tailwind utility classes. (Tailwind is essentially unused — see [§14](#14-️-known-issues-gaps--technical-debt-read-this).) |
| **eslint** + plugins | Linting. |

### Backend (`backend/`)
| Package | Why it's here |
|---|---|
| **express** `^4` | The web server / routing framework. |
| **cors** | Allows the browser frontend (different origin) to call the API. |
| **multer** | Handles `multipart/form-data` file uploads, writes them to `uploads/`. |
| **axios** | HTTP client used to call Azure OCR and Groq APIs. |
| **pdf-lib** | Can build a PDF from an image (`imageToPdf` helper). *(Currently a helper that isn't wired into the main flow — PDFs are handled via `pdftoppm` instead.)* |
| **pg** | PostgreSQL client — used to **read** (`SELECT`) data and to set up the `afterVerifyPool`. |
| **dotenv** | Loads secrets from a `.env` file into `process.env`. |

### External services / runtimes (not npm packages)
| Thing | Role |
|---|---|
| **Azure Computer Vision (Read API v3.2)** | OCR — turns images into raw text. |
| **Groq API** (`llama-3.3-70b-versatile`) | LLM — turns raw text into structured JSON. Groq is an inference provider known for very fast LLM responses; the API is OpenAI-compatible. |
| **Neon** | Serverless cloud PostgreSQL host. Two databases: `before_verify2` and `after_verify2`. |
| **Python 3 + psycopg2** | The `insert_to_pg.py` script that performs the dynamic table creation + inserts. |
| **poppler-utils (`pdftoppm`)** | System-level CLI tool to rasterize PDF pages into images. Must be installed on the server. |
| **Render** | Cloud host for both the frontend (static site) and backend (Node web service). |

---

## 6. Repository / Folder Structure

```
Xtract-IQ-Forms--main/                 ← project root (this is what goes on GitHub)
│
├── README.md                          ← marketing/overview README
├── PROJECT_EXPLANATION.md             ← (this file)
├── DEPLOYMENT.md                      ← deployment checklist
├── RENDER_DEPLOY.md                   ← step-by-step Render deploy guide
├── render.yaml                        ← Render "Blueprint": defines both services
├── package.json                       ← root convenience scripts (build/start)
├── .gitignore                         ← ignores node_modules, .env, uploads, dist, etc.
│
├── .github/
│   └── workflows/
│       └── main_backend-dde.yml       ← OLD GitHub Actions → Azure Web App pipeline
│
├── backend/                           ← Node.js + Express API
│   ├── server.js                      ← app entry point, CORS, health check, mounts routes
│   ├── routes/
│   │   └── uploadroutes.js            ← ALL API endpoints (upload, fetch, DB pools)
│   ├── extractor/
│   │   └── aiApiCall.js               ← Azure OCR + Groq LLM logic
│   ├── insert_to_pg.py                ← Python: dynamic table create + insert (psycopg2)
│   ├── render-build.sh                ← Render build script (installs psycopg2 + npm)
│   ├── startup.sh                     ← alt startup script (installs graphicsmagick) [legacy]
│   ├── package.json                   ← backend dependencies
│   ├── .env.example                   ← template for required secrets
│   └── uploads/                       ← temp upload dir (git-ignored, created at runtime)
│
└── my-react-app/                      ← React + Vite frontend (SPA)
    ├── index.html                     ← HTML shell Vite injects the app into
    ├── vite.config.js                 ← Vite config + dev proxy (/api → localhost:5000)
    ├── eslint.config.js
    ├── package.json
    ├── .env.example / .env.production  ← VITE_API_URL config
    ├── public/                         ← static assets (favicon, logo)
    └── src/
        ├── main.jsx                    ← React entry point (mounts <App/>)
        ├── App.jsx                     ← THE entire UI (upload + table + edit modal)
        ├── AllDocumentsTable.jsx       ← a separate table component — NOT USED (legacy)
        └── App.css                     ← a few CSS animations/utility classes
```

> **Note on the doubled folder:** on disk this currently sits inside an outer `Xtract-IQ-Forms--main/` wrapper folder. When you push to GitHub, push the **inner** folder (the one containing `backend/`, `my-react-app/`, and `render.yaml`) as the repository root.

---

## 7. Backend Deep Dive

The backend is small — four meaningful files. Here's each one.

### 7.1 `server.js` — the entry point
- Loads environment variables with `dotenv`.
- Creates the `uploads/` directory if missing.
- Configures **CORS** (allows `process.env.FRONTEND_URL`, or `*` if unset).
- Adds `express.json()` to parse JSON request bodies.
- Exposes a **health check** at `GET /api/health` returning `{status:"ok"}` — Render pings this to know the service is alive.
- Mounts all the real routes under `/api` via `uploadRoutes`.
- Listens on `process.env.PORT` (Render sets this) or `5000` locally.

> Minor note: the request-logging middleware is registered *after* the routes, so it doesn't actually log the upload requests. Harmless, but worth knowing.

### 7.2 `routes/uploadroutes.js` — all the endpoints
This file defines the API and both database connection pools.

**Database pools (two of them):**
- `dbPool` → connects to the **`before_verify2`** database (the "extracted, unverified" data). Used for `SELECT`s.
- `afterVerifyPool` → connects to the **`after_verify2`** database (intended for verified data). It has helper methods `ensureColumns()` and `createTableIfNotExists()` attached, **but no route currently uses it** (this is the missing "save verified" feature).

⚠️ Both pools have a **hardcoded Neon connection string (with a real password) as a fallback.** See [§15 Security](#15--security-notes-important).

**Endpoints:**

| Method & Path | Purpose |
|---|---|
| `POST /api/upload-image` | Single image → OCR → AI → insert → return all docs. |
| `POST /api/upload-scanned-pdf` | Single PDF → (pages→images) → OCR → AI → insert → return all docs. |
| `POST /api/upload-images` | **Multiple** images (batch). Processes each, collects results, batch-inserts. |
| `POST /api/upload-scanned-pdfs` | **Multiple** PDFs (batch). Same pattern. |
| `GET /api/all-documents` | Returns every row from the `documents` table. The frontend calls this on load. |

> The frontend only uses the **batch** endpoints (`/upload-images`, `/upload-scanned-pdfs`) plus `/all-documents`. The single-file endpoints exist but aren't called by the current UI.

**Key helper functions in this file:**
- `insertToPostgres(data)` — spawns the Python script and pipes JSON to it (the write path).
- `isFlatObject(obj)` — sanity check that the AI returned a flat object of strings.
- `imageToPdf(...)` — converts an image to a single-page PDF using `pdf-lib` (a helper, not in the main flow).
- `flattenForDb(obj)` — stringifies nested values so they fit in `TEXT` columns.

### 7.3 `extractor/aiApiCall.js` — the AI/OCR brain
Covered in detail in [§9](#9-the-ai--ocr-layer). Exports two functions: `extractTextFromImage` and `extractTextFromScannedPDF`. Internally it has `extractTextWithAzure` (OCR), `pdfToImages` (poppler), `processTextWithAI` (Groq), and `extractJsonFromText` (robust JSON parser).

### 7.4 `insert_to_pg.py` — the Python insert helper
A standalone Python script that reads a JSON array from **stdin** and inserts it into PostgreSQL using `psycopg2`. Why Python and not just Node's `pg`? Most likely a historical/intern decision — the insert logic (dynamic column discovery + `ALTER TABLE ... ADD COLUMN`) was prototyped in Python and kept.

What it does:
1. Parses the Neon DB URL from `NEON_DB_URL`.
2. Connects with `sslmode='require'`.
3. **`DROP TABLE IF EXISTS documents`** (once per process run) — ⚠️ this *wipes all previous data* on every upload. See [§14](#14-️-known-issues-gaps--technical-debt-read-this).
4. Computes the union of all keys across the incoming rows → creates a `documents` table with those columns (all `TEXT`).
5. `ensure_columns()` — `ALTER TABLE` to add any missing columns (supports the dynamic-schema idea).
6. Inserts each row, then commits.

> Because Node spawns a *fresh* Python process for every insert, the `_table_dropped` "drop only once" guard only protects within a single batch — it does **not** prevent the table being dropped on the *next* upload. Net effect: **each upload replaces the entire table.**

### 7.5 Build/run scripts
- `render-build.sh` — what Render runs at build time: upgrades pip, installs `psycopg2-binary`, runs `npm install`.
- `startup.sh` — an older script that installs `graphicsmagick` and starts the server. *Note the inconsistency:* the PDF flow actually needs **poppler-utils (`pdftoppm`)**, not graphicsmagick — see [§14](#14-️-known-issues-gaps--technical-debt-read-this).

---

## 8. Frontend Deep Dive

### 8.1 `src/App.jsx` — the whole app
This single ~820-line component is the entire UI. Responsibilities:

- **State management** (React hooks): `documents` (the table data), `uploading`, `feedback`/`error` messages, `editModal` (for nested editing), `saving`.
- **`API_URL`** is read from `import.meta.env.VITE_API_URL`, defaulting to `http://localhost:5000`. This is how the same code points at localhost in dev and at the Render backend in production.
- **`fetchDocuments()`** — called on mount (`useEffect`) to load existing rows from `GET /api/all-documents`.
- **`handleFileChange()`** — splits selected files into PDFs vs images and uploads each group to the right batch endpoint.
- **`SubTable`** — a *recursive* component that renders nested objects/arrays (including JSON stored as a string) as clean nested HTML tables. It even tries to repair single-quoted "JSON" by replacing `'` with `"`.
- **`columns`** (a `useMemo`) — dynamically builds Material React Table columns from `Object.keys(documents[0])`. Object-valued cells render as a `SubTable` + an "Edit" button; primitive cells are inline-editable.
- **`renderEditFields()`** — recursively renders MUI `TextField`s for editing nested objects inside the modal.
- **The "Save Verified Data" button** → `handleSaveVerified()` → POSTs to `/api/save-verified`. ⚠️ As noted, that endpoint isn't implemented on the backend yet.
- **Styling** is done with a big inline `styles` object plus an injected `<style>` tag for keyframe animations (spinner, fade-in, pulse) and forcing table hover backgrounds to white.

### 8.2 `src/AllDocumentsTable.jsx` — legacy/unused
A simpler standalone table component that fetches from a *relative* `/api/all-documents` (relying on the Vite dev proxy). **It is not imported anywhere** (`main.jsx` renders only `App`). Treat it as dead/legacy code — safe to delete, but kept here so you know what it is.

### 8.3 `src/main.jsx`, `index.html`, `vite.config.js`
- `main.jsx` mounts `<App/>` into `#root` inside React `StrictMode`.
- `vite.config.js` sets up a **dev proxy** so that during local development, requests to `/api` are forwarded to `http://localhost:5000` (the backend). This is why the legacy component's relative fetch works in dev.

---

## 9. The AI & OCR Layer

This is the most "interesting" part technically. All of it lives in `backend/extractor/aiApiCall.js`.

### 9.1 OCR with Azure (`extractTextWithAzure`)
- Endpoint: `{AZURE_ENDPOINT}/vision/v3.2/read/analyze`.
- Auth header: `Ocp-Apim-Subscription-Key: {AZURE_API_KEY}`.
- The Read API is **async**: the initial POST returns an `operation-location` URL. The code **polls** that URL every 1 second, up to 15 attempts, until `status === 'succeeded'`, then joins all `lines[].text` across all pages.
- Throws if it fails or times out.

### 9.2 PDF → images (`pdfToImages`)
- Shells out to: `pdftoppm -jpeg -r 300 "<pdf>" "<outputPrefix>"`.
- Produces one JPEG per page at 300 DPI in a temp `_images` folder, sorted to preserve page order.
- **Requires poppler-utils installed on the host.** This is a hard external dependency.

### 9.3 Text → structured JSON with Groq (`processTextWithAI`)
- Endpoint: `https://api.groq.com/openai/v1/chat/completions` (OpenAI-compatible).
- Model: **`llama-3.3-70b-versatile`**.
- Parameters chosen for **deterministic, structured** output: `temperature: 0.3`, `max_tokens: 2048`, `top_p: 1`.
- **Prompt engineering** — the system prompt is the secret sauce. It tells the model to extract key–value pairs, ignore OCR noise, standardize field names, and **return only JSON**. (See the exact prompt in the source; it even includes an example output.)

### 9.4 Robust JSON extraction (`extractJsonFromText`)
LLMs sometimes wrap JSON in markdown or add stray prose. This function tries, in order:
1. Parse the entire response as JSON.
2. Extract from a ```` ```json … ``` ```` block.
3. Extract from any ```` ``` … ``` ```` block.
4. Regex-grab the first `{ … }`.

If all fail and it's the first attempt, the whole AI call is **retried once**. If still failing, it returns an error object (which the route turns into a 500 with details).

> **Why this matters:** OCR + LLM pipelines are inherently *probabilistic*. The retry logic and multi-strategy parser are defensive measures against the model occasionally "misbehaving". Expect to tune the prompt and these guards as you encounter new form types.

---

## 10. Database Design

### 10.1 Two databases (a deliberate "before/after" pattern)
| Database (Neon) | Env var | Holds | Status |
|---|---|---|---|
| `before_verify2` | `NEON_DB_URL` | Raw AI-extracted data (unverified) | **Active** |
| `after_verify2` | `NEON_AFTER_DB_URL` | Human-verified data | **Wired up but unused** (no endpoint writes to it yet) |

The intent: keep machine output separate from human-approved output, which is good practice for **audit trails** in regulated domains (banking/insurance). You can always see what the AI produced vs. what a human signed off on.

### 10.2 The `documents` table & dynamic schema
- There is no migration / fixed schema. The `documents` table is **created at runtime** from whatever keys the AI returns, with every column typed `TEXT`.
- `ensure_columns()` (`ALTER TABLE … ADD COLUMN`) lets new fields appear over time without breaking.
- Nested data is stored as **stringified JSON** inside a `TEXT` cell; the frontend re-parses and renders it as a sub-table.

### 10.3 ⚠️ The table-drop behaviour
As covered in [§7.4](#74-insert_to_pgpy--the-python-insert-helper), `insert_to_pg.py` runs `DROP TABLE IF EXISTS documents` at the start of each process. Since a new process is spawned per upload, **every upload effectively clears the table and replaces it with the latest batch.** If you want documents to *accumulate* across uploads, this is the first thing you'll need to change.

---

## 11. Configuration & Environment Variables

### Backend (`backend/.env` — never commit this)
```env
GROQ_API_KEY=gsk_...                # from https://console.groq.com/keys
AZURE_ENDPOINT=https://<resource>.cognitiveservices.azure.com/
AZURE_API_KEY=...                   # Azure Portal → Computer Vision resource
NEON_DB_URL=postgresql://user:pass@host/before_verify2
NEON_AFTER_DB_URL=postgresql://user:pass@host/after_verify2
# optional:
FRONTEND_URL=https://your-frontend.onrender.com   # tightens CORS
PORT=5000
```
A template lives in `backend/.env.example`.

### Frontend (`my-react-app/.env.production`)
```env
VITE_API_URL=https://<your-backend>.onrender.com
```
Vite inlines `VITE_*` variables at **build time**, so this must be set *before* `npm run build`.

---

## 12. Running the Project Locally

> **Prerequisites:** Node.js ≥ 16, Python 3 (with pip), and **poppler-utils** installed (for `pdftoppm`). On Windows, install poppler and ensure `pdftoppm` is on your `PATH`. You also need valid Azure, Groq, and Neon credentials.

**1. Backend**
```bash
cd backend
npm install
pip install psycopg2-binary
# create backend/.env from .env.example and fill in your keys
node server.js          # → http://localhost:5000  (health: /api/health)
```

**2. Frontend** (in a second terminal)
```bash
cd my-react-app
npm install
npm run dev             # → http://localhost:5173 (Vite), proxies /api to :5000
```

**3. Try it:** open the Vite URL, upload a form image or PDF, watch it get extracted into the table.

> If `VITE_API_URL` is unset in dev, the frontend defaults to `http://localhost:5000`, which matches the backend — so no extra config is needed locally.

---

## 13. Deployment

There are **two deployment setups** in the repo. The current/intended one is **Render**; the Azure one is leftover history.

### 13.1 Render (current) — defined in `render.yaml`
The `render.yaml` "Blueprint" declares **two services**:

1. **`xtract-iq-backend`** (Node web service)
   - `rootDir: backend`, builds with `render-build.sh`, starts with `node server.js`.
   - Health check at `/api/health`.
   - Secrets (`GROQ_API_KEY`, `AZURE_*`, `NEON_*`) set in the Render dashboard (`sync: false` = not stored in the repo).
2. **`xtract-iq-frontend`** (static site)
   - `rootDir: my-react-app`, builds with `npm install && npm run build`, publishes `dist/`.
   - Needs `VITE_API_URL` set to the backend's public URL.
   - Includes security headers and a SPA rewrite (`/* → /index.html`).

`RENDER_DEPLOY.md` and `DEPLOYMENT.md` contain detailed click-by-click instructions and a checklist.

> **Render free-tier caveat:** services **sleep after 15 min** of inactivity; the first request after sleeping takes 30–50s to wake. Groq free tier is ~30 req/min.
>
> ⚠️ **Poppler on Render:** the PDF path needs `pdftoppm`. `render-build.sh` installs `psycopg2-binary` and npm deps but **does not install poppler-utils**. If PDF uploads fail in production with a `pdftoppm: not found` error, this is why — you'll need to add it (e.g. via an apt step / a Docker-based service, since Render's native Node env may not have it).

### 13.2 Azure (legacy) — `.github/workflows/main_backend-dde.yml`
A GitHub Actions workflow that, on push to `main`, builds the Node app and deploys it to an **Azure Web App** named `backend-DDE` using OIDC auth. This reflects an **earlier deployment target** (the internal name "DDE" = Document Data Extractor). If you're standardizing on Render, you can disable or delete this workflow to avoid confusing double-deploys.

---

## 14. ⚠️ Known Issues, Gaps & Technical Debt (READ THIS)

The new owner should be fully aware of these. None of them are hidden — they're just things that were never finished or were prototyped and left in.

1. **`/api/save-verified` is not implemented.**
   The frontend's "Save Verified Data" button POSTs to `/api/save-verified`, but **no such route exists** in `uploadroutes.js`. The `afterVerifyPool` and its helper methods (`ensureColumns`, `createTableIfNotExists`) were set up *for* this feature but never connected. **The verification → permanent save loop is incomplete.** Implementing this endpoint is the most valuable next task.

2. **Every upload wipes the database.**
   `insert_to_pg.py` does `DROP TABLE IF EXISTS documents` at process start, and Node spawns a fresh Python process per upload. Result: uploads don't accumulate — each replaces all prior data. If accumulation is desired, remove/guard the drop.

3. **Hybrid Node + Python data layer.**
   Reads use Node `pg`; writes use a spawned Python `psycopg2` script. This adds a Python runtime dependency and process-spawn overhead for no strong reason. A clean refactor would do inserts directly in Node with `pg` and drop the Python script entirely.

4. **Poppler dependency is not guaranteed in deploy.**
   PDF processing needs `pdftoppm` (poppler-utils). `startup.sh` installs *graphicsmagick* (wrong tool), and `render-build.sh` installs neither. Image uploads work without poppler; **PDF uploads will fail wherever poppler isn't installed.**

5. **Tailwind is configured but unused.**
   `tailwindcss`, `postcss`, `autoprefixer` are in devDependencies, but the UI is styled with inline `style={}` objects. There's no `tailwind.config` driving real utility classes. Either adopt Tailwind properly or remove it.

6. **Dead/legacy code.** `AllDocumentsTable.jsx` is unused. `imageToPdf()` and the single-file upload routes aren't used by the current UI.

7. **Missing null-check on single-image route.** `POST /upload-image` reads `req.file.mimetype` before checking `req.file` exists (the PDF route does check). Low impact since the UI doesn't call it, but it would 500 on a missing file.

8. **No authentication / authorization.** Anyone with the URL can upload and read all documents. Fine for a demo/portfolio; not production-ready.

9. **Logging middleware ordered after routes** in `server.js`, so it doesn't log API hits.

---

## 15. 🔐 Security Notes (IMPORTANT)

**Before this goes onto someone else's GitHub, rotate the leaked credentials.**

- A **real Neon PostgreSQL connection string with password** (`npg_PVs3ewizcxA5@ep-shiny-math-...neon.tech`) is **hardcoded as a fallback** in:
  - `backend/routes/uploadroutes.js` (both `dbPool` and `afterVerifyPool`)
  - `backend/insert_to_pg.py`

  Even though `.env` is git-ignored, **these fallback strings are committed in the source code**. Anyone who gets the repo gets the database password.

  **Action items for the new owner:**
  1. In the Neon console, **rotate/reset the database password** (the current one must be considered compromised).
  2. **Remove the hardcoded connection strings** from the three locations above; rely solely on `process.env.NEON_DB_URL` / `NEON_AFTER_DB_URL` and fail loudly if they're missing.
  3. Confirm `.env` is never committed (it is correctly listed in `.gitignore`).
  4. Set all real secrets only in the Render dashboard (or your host's secret manager).

- CORS currently defaults to `*` when `FRONTEND_URL` is unset — set `FRONTEND_URL` in production to lock it down.

---

## 16. Study Guide & Suggested Reading Order

If you're new to this project, read the code in this order — it follows the data:

1. **`README.md`** — the elevator pitch (5 min).
2. **This file, §3–§4** — architecture + data flow (the mental model). Re-read §4 until the upload-to-display path is clear.
3. **`backend/server.js`** — see how the app boots (small, ~45 lines).
4. **`backend/routes/uploadroutes.js`** — the endpoints. Trace `/api/upload-images` from request to response.
5. **`backend/extractor/aiApiCall.js`** — the OCR + LLM pipeline. This is where the "AI" is.
6. **`backend/insert_to_pg.py`** — how data lands in PostgreSQL (and note the table-drop).
7. **`my-react-app/src/App.jsx`** — the UI. Trace `handleFileChange` → `fetch` → `setDocuments` → table render.
8. **`render.yaml` + `RENDER_DEPLOY.md`** — how it's deployed.
9. **§14 + §15 of this file** — the gaps and the security cleanup, so you don't get surprised.

**Concepts worth brushing up on if unfamiliar:** REST APIs & `multipart/form-data` uploads, OCR, LLM prompt engineering & chat-completion APIs, async polling (Azure Read API), React hooks (`useState`/`useEffect`/`useMemo`), dynamic SQL / schema, and environment-based config.

**First hands-on exercises:**
- Run it locally (§12) and upload a sample form.
- Add the missing `/api/save-verified` endpoint (§14 item 1) — the best way to understand the whole stack end-to-end.
- Fix the table-drop so documents accumulate (§14 item 2).

---

## 17. Glossary

| Term | Meaning |
|---|---|
| **OCR** | Optical Character Recognition — converting an image of text into machine-readable text. Here, done by Azure. |
| **LLM** | Large Language Model — the AI (Groq's Llama 3.3 70B) that turns messy text into structured JSON. |
| **Groq** | A fast LLM inference provider with an OpenAI-compatible API. (Not to be confused with Grok.) |
| **Neon** | A serverless cloud PostgreSQL provider. |
| **SPA** | Single-Page Application — the React frontend; one HTML page, JS swaps content. |
| **Multer** | Express middleware for handling file uploads. |
| **psycopg2** | The Python PostgreSQL driver used by `insert_to_pg.py`. |
| **`pdftoppm`** | A poppler-utils CLI tool that converts PDF pages to images. |
| **Blueprint (Render)** | Render's term for a `render.yaml`-defined multi-service deployment. |
| **before/after verify** | The two-database pattern: machine-extracted data vs. human-verified data. |
| **dynamic schema** | DB columns are created on the fly from the AI's output keys rather than fixed in advance. |

---

## 18. Future Improvements

From the original README, plus things surfaced in this review:

- **Finish the verification loop** — implement `/api/save-verified` writing to `after_verify2`.
- **Stop wiping data** — make uploads append instead of replacing the table.
- **Add authentication & role-based access** (e.g. uploader vs. verifier roles).
- **Batch & queue processing** for large document volumes (background jobs).
- **Retry / rollback mechanisms** for failed OCR/AI/DB steps.
- **Consolidate the data layer** — drop the Python insert script; do everything in Node `pg`.
- **Guarantee poppler in deploy** (or switch to a Dockerfile so dependencies are pinned).
- **Schema normalization & validation** rather than all-`TEXT` columns.
- **Analytics dashboard** (extraction accuracy, throughput).
- **Security hardening** — rotate the leaked DB password, remove hardcoded secrets, lock down CORS.
- **Adopt or remove Tailwind**, and delete dead code (`AllDocumentsTable.jsx`, unused routes).

---

*End of document. If anything here drifts from the code over time, the source files in `backend/` and `my-react-app/src/` are the source of truth — this guide explains the intent and the shape of things as of handover.*
