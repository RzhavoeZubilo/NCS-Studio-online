/**
 * Loader for NCS Dummy's Translations.csv (© revtor): a two-column CSV
 * mapping option/value tokens (e.g. "nicht_aktiv") to human-readable
 * English text ("not active"). Never bundled — loaded from disk by the user.
 */

/** Minimal RFC 4180 CSV parser (quoted fields, "" escapes, CRLF). */
export function parseCsv(content: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0
  while (i < content.length) {
    const ch = content[i]
    if (inQuotes) {
      if (ch === '"') {
        if (content[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += ch
      i++
      continue
    }
    if (ch === '"') {
      inQuotes = true
      i++
      continue
    }
    if (ch === ',') {
      row.push(field)
      field = ''
      i++
      continue
    }
    if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && content[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i++
      continue
    }
    field += ch
    i++
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

export type TranslationMap = ReadonlyMap<string, string>

export function parseTranslationsCsv(content: string): TranslationMap {
  const map = new Map<string, string>()
  for (const row of parseCsv(content)) {
    if (row.length < 2) continue
    const key = row[0].trim().toLowerCase()
    const value = row[1].trim()
    if (!key || !value || map.has(key)) continue
    map.set(key, value)
  }
  return map
}

export function translate(map: TranslationMap | null, token: string): string | undefined {
  return map?.get(token.trim().toLowerCase())
}
