import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { addOwnTsv, emptyOwnDb, lookupOwn } from '@/lib/ownDescriptions'

const dir = fileURLToPath(new URL('../data/descriptions', import.meta.url))
const files = readdirSync(dir).filter((f) => f.endsWith('.tsv'))

describe('own description format', () => {
  const db = emptyOwnDb()
  addOwnTsv(
    db,
    [
      '// comment',
      'BC_DIGITAL_V\tDigital speed\tЦифровая скорость',
      'CBS_STAT_#H\tService item {1}: status\tСервисная позиция {1}: состояние',
      'CBS_STAT_9H\tSpecial item\tОсобая позиция',
      '*_ALIVE_ZAEHLER\tAlive counter of {1}\tСчётчик активности {1}\t?',
    ].join('\n'),
  )

  it('finds exact names case-insensitively', () => {
    expect(lookupOwn(db, 'bc_digital_v')).toEqual({ en: 'Digital speed', ru: 'Цифровая скорость', unverified: false })
  })

  it('fills numbers from # patterns without leading zeros', () => {
    expect(lookupOwn(db, 'CBS_STAT_05H')?.ru).toBe('Сервисная позиция 5: состояние')
  })

  it('prefers exact names over patterns', () => {
    expect(lookupOwn(db, 'CBS_STAT_9H')?.en).toBe('Special item')
  })

  it('fills name parts from * patterns and keeps the unverified flag', () => {
    expect(lookupOwn(db, 'DSC_ALIVE_ZAEHLER')).toEqual({ en: 'Alive counter of DSC', ru: 'Счётчик активности DSC', unverified: true })
  })

  it('returns undefined for unknown names', () => {
    expect(lookupOwn(db, 'NOT_THERE')).toBeUndefined()
  })
})

describe('bundled description files', () => {
  it('are well formed: name, English, Russian and an optional "?"', () => {
    for (const f of files) {
      const lines = readFileSync(`${dir}/${f}`, 'utf8').split('\n')
      lines.forEach((line, i) => {
        if (!line.trim() || line.startsWith('//')) return
        const cols = line.split('\t')
        expect([3, 4], `${f}:${i + 1}`).toContain(cols.length)
        expect(cols[1] && cols[2], `${f}:${i + 1}`).toBeTruthy()
        if (cols.length === 4) expect(cols[3], `${f}:${i + 1}`).toBe('?')
      })
    }
  })

  it('define every name only once', () => {
    const seen = new Map<string, string>()
    for (const f of files) {
      for (const line of readFileSync(`${dir}/${f}`, 'utf8').split('\n')) {
        if (!line.trim() || line.startsWith('//')) continue
        const name = line.split('\t')[0].toUpperCase()
        expect(seen.get(name), `${name} in ${f} and ${seen.get(name)}`).toBeUndefined()
        seen.set(name, f)
      }
    }
  })
})
