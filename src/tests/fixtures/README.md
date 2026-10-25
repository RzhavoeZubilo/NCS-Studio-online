# Test fixtures

Tests use real BMW files that are NOT published with the repository
(licensing). Place your own copies here before running `npm test`:

- `Translations.csv` — NCS Dummy translations database
- `RAD2.prg`, `komb87.prg`, `T_GRTB.prg` — EDIABAS ECU/group files from `EDIABAS\Ecu`
- `RAD22.C32`, `E89SGET.000`, `BR_REF.DAT`, `SWTFSW03.dat`, `SWTPSW03.dat` — SP-Daten chassis files
- `high-box.trc`, `rad2-fsw-psw.trc` — FSW/PSW coding traces

Without them the test suites are skipped (`npm test` passes with 0 tests).
