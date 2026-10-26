# Test fixtures

Tests use real BMW files that are NOT published with the repository
(licensing). Place your own copies here before running `npm test`:

- `RAD2.prg`, `komb87.prg`, `t-grtb.prg` — EDIABAS ECU/group files from `EDIABAS\Ecu`
- `RAD22.C32`, `E89SGET.000`, `BR_REF.DAT`, `SWTFSW03.dat`, `SWTPSW03.dat` — SP-Daten chassis files
- `high-box.trc`, `rad2-fsw-psw.trc` — FSW/PSW coding traces

Suites whose fixtures are missing are skipped (the skip lists the missing files);
fixture-free tests (telegram framing, CSV parsing) always run.
