/**
 * Parser and serializer for BMW NCS Expert FSW/PSW coding files
 * (.trc / .man, e.g. FSW_PSW.TRC / FSW_PSW.MAN).
 *
 * File structure: a stream of option blocks — an option name on its own
 * line, followed by one or more indented value lines — mixed with raw
 * lines (headers, binary "B ..." records) that must survive round-trips
 * byte-for-byte.
 */

export interface TrcValue {
  /** Value text without leading indentation. */
  text: string
  /** Original leading whitespace of the value line (preserved for round-trips). */
  indent: string
}

export type Segment =
  | { kind: 'option'; name: string; values: TrcValue[]; original: TrcValue[] }
  | { kind: 'binary'; raw: string }
  | { kind: 'raw'; raw: string }

export interface TrcDocument {
  fileName: string
  eol: '\r\n' | '\n'
  endsWithEol: boolean
  segments: Segment[]
}

const INDENTED = /^[ \t]/
const BINARY_LINE =
  /^B [0-9A-Fa-f]{8},[0-9A-Fa-f]{1,4},(?:[0-9A-Fa-f]{2},)*[0-9A-Fa-f]{2}$/

export function parseTrc(content: string, fileName: string): TrcDocument {
  const eol: '\r\n' | '\n' = content.includes('\r\n') ? '\r\n' : '\n'
  const endsWithEol = content.endsWith('\n') || content.endsWith('\r')
  const lines = content.split(/\r\n|\n/)

  const segments: Segment[] = []
  let option: { name: string; values: TrcValue[] } | null = null

  const flush = () => {
    if (!option) return
    if (BINARY_LINE.test(option.name)) {
      segments.push({ kind: 'binary', raw: option.name })
    } else if (option.values.length === 0) {
      segments.push({ kind: 'raw', raw: option.name })
    } else {
      segments.push({
        kind: 'option',
        name: option.name,
        values: option.values,
        original: option.values.map((v) => ({ ...v })),
      })
    }
    option = null
  }

  for (const line of lines) {
    if (line === '') {
      flush()
      segments.push({ kind: 'raw', raw: '' })
      continue
    }
    if (INDENTED.test(line)) {
      if (option) {
        const indent = line.match(/^[ \t]+/)![0]
        option.values.push({ indent, text: line.slice(indent.length) })
      } else {
        segments.push({ kind: 'raw', raw: line })
      }
      continue
    }
    flush()
    option = { name: line, values: [] }
  }
  flush()

  // The final newline produces one empty split artifact; drop it so that
  // serialization (which re-appends the trailing EOL) reproduces the input.
  const last = segments[segments.length - 1]
  if (endsWithEol && last?.kind === 'raw' && last.raw === '') segments.pop()

  return { fileName, eol, endsWithEol, segments }
}

function serialize(
  doc: TrcDocument,
  eol: '\r\n' | '\n',
  endsWithEol: boolean,
  renderOption: (name: string, values: TrcValue[]) => string[],
): string {
  const lines: string[] = []
  for (const seg of doc.segments) {
    if (seg.kind === 'option') lines.push(...renderOption(seg.name, seg.values))
    else lines.push(seg.raw)
  }
  return lines.join(eol) + (endsWithEol ? eol : '')
}

/** Serialize back to the original TRC flavor (original indents and EOL preserved). */
export function serializeTrc(doc: TrcDocument): string {
  return serialize(doc, doc.eol, doc.endsWithEol, (name, values) => [
    name,
    ...values.map((v) => v.indent + v.text),
  ])
}

/**
 * Serialize as NCS Expert expects a MAN file: CRLF line endings and a
 * single tab before each value.
 */
export function serializeMan(doc: TrcDocument): string {
  return serialize(doc, '\r\n', true, (name, values) => [
    name,
    ...values.map((v) => '\t' + v.text),
  ])
}

export function isChanged(seg: Segment): boolean {
  if (seg.kind !== 'option') return false
  return (
    seg.values.map((v) => v.text).join('\n') !==
    seg.original.map((v) => v.text).join('\n')
  )
}

export interface DocStats {
  options: number
  changed: number
  binary: number
}

export function docStats(doc: TrcDocument): DocStats {
  const stats: DocStats = { options: 0, changed: 0, binary: 0 }
  for (const seg of doc.segments) {
    if (seg.kind === 'option') {
      stats.options++
      if (isChanged(seg)) stats.changed++
    } else if (seg.kind === 'binary') {
      stats.binary++
    }
  }
  return stats
}

/** Most frequent value indent in the document (fallback for edited lines). */
export function dominantIndent(doc: TrcDocument): string {
  const counts = new Map<string, number>()
  for (const seg of doc.segments) {
    if (seg.kind !== 'option') continue
    for (const v of seg.values) counts.set(v.indent, (counts.get(v.indent) ?? 0) + 1)
  }
  let best = '\t'
  let n = -1
  for (const [indent, c] of counts) {
    if (c > n) {
      best = indent
      n = c
    }
  }
  return best
}
