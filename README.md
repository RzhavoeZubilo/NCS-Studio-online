# NCS Studio (ncs-web)

Browser-based companion to BMW NCS Expert + NCS Dummy: an FSW/PSW coding file
editor with human-readable parameter names. No installation, no backend — all
parsing happens locally in the browser.

## Run

```bash
cd ncs-web
npm install
npm run dev
```

Open http://localhost:5173 in Chrome or Edge (Chromium needed for the
File System Access API; without it the app falls back to file downloads).

## What it does today

### Coding (FSW/PSW editor)

- Open `.trc` / `.man` FSW/PSW files (drag & drop or file picker)
- Virtualized option table with search across names, values and translations
- Optional English names via NCS Dummy's `Translations.csv` (© revtor) —
  load it from the Translations button; a dropped file named
  `*translations*.csv` is auto-detected
- Edit values (single and multi-value options), quick presets
  `aktiv` / `nicht_aktiv`, per-option and global revert, change list
- Save back to `.trc` (original EOL and indentation preserved — round-trip is
  byte-for-byte, covered by unit tests against real files) or export as
  NCS Expert `.man` (CRLF, single-tab values)
- Binary records (`B ...` lines) are preserved untouched

### ECU Jobs (PRG viewer)

- Open EDIABAS `.prg` ECU descriptions (from `EDIABAS\Ecu`) — several at once
- BEST/1 disassembly of every job with branch labels and job comments,
  byte-identical to the reference decoder (verified against BimmerDaten's
  `decoderPrg.py` on RAD2.prg and komb87.prg)
- All tables (`JOBRESULT`, `KONZEPT_TABELLE`, …) with columns and rows
- Header metadata: BIP version, revision, author, last change, uses, ssize

### Modules (SP-Daten option tree)

- Open a chassis folder (e.g. `SP-Daten 69.0\E89`, which covers E81–E93):
  folder picker or "Choose files" fallback
- Parses `daten\` in the browser: `SWTFSW*`/`SWTPSW*` keyword tables,
  `*SGET.000` module families, `BR_REF.DAT` chassis map and every
  `<module>.Cxx` coding file (record format per NCS-Workbench's `ncsdata.h`,
  GPL-3.0)
- Module list with ECU family and coding index; per module — every coding
  function with **all possible values** and translations, searchable
- Everything stays local: no data is bundled with the app

### Dictionary (Russian overlay)

- Editable Russian translations for every known function/value name,
  stored in IndexedDB, importable/exportable as CSV
- One-click machine draft (EN→RU via an external translate service, with
  progress and cancel) — verify drafts by hand
- Russian/English/original parameter language switch in Settings

### Interface

- Dark and light themes (persisted), language toggle EN/RU, built-in FAQ
- English UI strings and FAQ are bilingual (EN/RU)

## Tests

```bash
npm test        # vitest — TRC round-trip + PRG decode vs Python reference
npm run build   # typecheck + production build
```

## Roadmap

1. **Car I/O via Web Serial** — BMW-FAST over K+DCAN (see
   `../D-CAN_TRANSPORT_RESEARCH.md`): read module FSW/PSW straight into the
   editor and execute jobs from the PRG viewer (no EDIABAS needed).
2. **Coding write** — erase/write/verify sequence through SGBD jobs.

## Credits

- Format knowledge based on [BimmerDaten](https://github.com/zer02dev/BimmerDaten)
  (GPL-3.0) — this project inherits GPL-3.0.
- SP-Daten `.Cxx`/`SWT*`/SGET record format after
  [NCS-Workbench](https://github.com/ak-tr/NCS-Workbench) `ncsdata.h` (GPL-3.0, © ak-tr).
- `Translations.csv` is © revtor and the NCS Dummy community; load it from your
  local NCS Dummy installation, it is never bundled.

Fixtures in `src/tests/fixtures/` are real coding files used for regression
tests; `Translations.csv` there is a local test copy only.
