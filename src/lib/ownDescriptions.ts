/**
 * The project's own parameter descriptions (src/data/descriptions/*.tsv),
 * written from the parameter names themselves — independent of NCS Dummy's
 * Translations.csv. One line per parameter:
 *
 *   NAME <TAB> English <TAB> Russian [<TAB> ?]
 *
 * "#" in NAME matches a number and {1}, {2}… in the texts insert it
 * (CBS_STAT_#H → "CBS item {1}: status"); "*" matches any name part
 * (*_ALIVE_ZAEHLER → "{1}"). Exact names win over "#" patterns, which win
 * over "*" patterns. A trailing "?" marks a description
 * inferred from the name only and not yet checked on a car. Lines starting
 * with "//" are comments.
 */

export interface OwnEntry {
  en: string
  ru: string
  unverified: boolean
}

export interface OwnDb {
  exact: Map<string, OwnEntry>
  /** "#" patterns, then the looser "*" ones */
  patterns: { re: RegExp; entry: OwnEntry }[]
  wildcards: { re: RegExp; entry: OwnEntry }[]
}

export function emptyOwnDb(): OwnDb {
  return { exact: new Map(), patterns: [], wildcards: [] }
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')

/** Adds the lines of one TSV file to the database; returns the number of entries. */
export function addOwnTsv(db: OwnDb, text: string): number {
  let count = 0
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('//')) continue
    const [name, en, ru, flag] = line.split('\t')
    if (!name || !en) continue
    const entry: OwnEntry = { en: en.trim(), ru: (ru ?? '').trim(), unverified: flag?.trim() === '?' }
    const key = name.trim().toUpperCase()
    if (key.includes('#') || key.includes('*')) {
      const source = key
        .split(/([#*])/)
        .map((part) => (part === '#' ? '(\\d+)' : part === '*' ? '([A-Z0-9][A-Z0-9_]*?)' : escape(part)))
        .join('')
      const list = key.includes('*') ? db.wildcards : db.patterns
      list.push({ re: new RegExp('^' + source + '$'), entry })
    } else db.exact.set(key, entry)
    count++
  }
  return count
}

export function lookupOwn(db: OwnDb, name: string): OwnEntry | undefined {
  const key = name.trim().toUpperCase()
  const exact = db.exact.get(key)
  if (exact) return exact
  for (const { re, entry } of [...db.patterns, ...db.wildcards]) {
    const m = re.exec(key)
    if (!m) continue
    // numbers lose their leading zeros ("05" → "5"), name parts stay as they are
    const part = (i: string) => {
      const v = m[Number(i)] ?? ''
      return /^\d+$/.test(v) ? String(Number(v)) : v
    }
    const fill = (s: string) => s.replace(/\{(\d)\}/g, (_, i: string) => part(i))
    return { en: fill(entry.en), ru: fill(entry.ru), unverified: entry.unverified }
  }
  return undefined
}

/** Loads every bundled TSV file (a separate chunk, fetched on first use). */
export async function loadOwnDb(): Promise<OwnDb> {
  const files = import.meta.glob('/src/data/descriptions/*.tsv', { query: '?raw', import: 'default' })
  const db = emptyOwnDb()
  for (const load of Object.values(files)) addOwnTsv(db, (await load()) as string)
  return db
}
