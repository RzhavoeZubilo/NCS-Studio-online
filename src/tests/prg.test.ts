import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parsePrg } from '@/lib/prg'

const fixture = (name: string) =>
  new Uint8Array(
    readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url))),
  )

// Reference values produced by BimmerDaten's decoderPrg.py (Python) on the
// same fixtures — the TS port must match them exactly.
const fixturesAvailable = existsSync(
  fileURLToPath(new URL('./fixtures', import.meta.url)),
)
const dsc = fixturesAvailable ? describe : describe.skip

dsc('parsePrg RAD2.prg (E90 radio professional)', () => {
  const prg = parsePrg(fixture('RAD2.prg'))

  it('extracts the header info block', () => {
    expect(prg.info.bipVersion).toBe('06.00.00')
    expect(prg.info.revision).toBe('2.1')
    expect(prg.info.author).toBe('Telemotive AG/Busch')
    expect(prg.info.lastChanged).toBe('Wed Mar 31 15:49:52 2004')
    expect(prg.info.packageVersion).toBe('00000000')
    expect(prg.uses).toEqual([])
    expect(prg.ssize).toBe(0)
  })

  it('finds all tables with columns and rows', () => {
    expect(prg.tables).toHaveLength(41)
    const first = prg.tables[0]
    expect(first.name).toBe('KONZEPT_TABELLE')
    expect(first.columns).toEqual(['NR', 'KONZEPT_TEXT'])
    expect(first.rows[0]).toEqual(['0x0F', 'BMW-FAST'])
    expect(first.rows[1]).toEqual(['0x0C', 'KWP2000'])
    const jobResult = prg.tables.find((t) => t.name === 'JOBRESULT')
    expect(jobResult?.rows[0]).toEqual(['0x10', 'ERROR_ECU_GENERAL_REJECT'])
  })

  it('finds all jobs with addresses and comments', () => {
    expect(prg.jobs).toHaveLength(85)
    expect(prg.jobs[0].name).toBe('INITIALISIERUNG')
    expect(prg.jobs[0].address).toBe(0xa0)
    expect(prg.jobs[0].comments[0]).toBe('JOBNAME:INITIALISIERUNG')
    expect(prg.jobs[1].name).toBe('INFO')
    expect(prg.jobs[1].address).toBe(0x6de)
  })

  it('disassembles BEST/1 bytecode identically to the reference decoder', () => {
    expect(prg.jobs[0].disassembly.slice(0, 12)).toEqual([
      '                    xconnect',
      '                    push       #$00000001.L',
      '                    pop        L1',
      '                    push       L1',
      '                    pop        L0',
      '                    xstopf',
      '                    push       #$00000001.L',
      '                    pop        L1',
      '                    push       L1',
      '                    pop        L0',
      '                    move       L0,#$00000002.L',
      '                    push       L0',
    ])
  })
})

dsc('parsePrg komb87.prg (E9x KOMBI)', () => {
  const prg = parsePrg(fixture('komb87.prg'))

  it('extracts info and section sizes', () => {
    expect(prg.info.bipVersion).toBe('06.04.00')
    expect(prg.info.revision).toBe('2.109')
    expect(prg.tables).toHaveLength(30)
    expect(prg.jobs).toHaveLength(128)
  })

  it('disassembles the first job', () => {
    expect(prg.jobs[0].name).toBe('INITIALISIERUNG')
    expect(prg.jobs[0].address).toBe(0xa0)
    expect(prg.jobs[0].disassembly[0]).toBe('                    clear      S1')
  })
})
