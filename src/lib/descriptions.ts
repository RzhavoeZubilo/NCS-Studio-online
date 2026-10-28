/**
 * Function descriptions from NCS Dummy's Translations.csv (© revtor):
 * "ALARM_TYPE,Alarm type [wert_01: 1 cycle Europe sound, wert_02: 8 cycles USA sound]".
 * The bracket lists what each value means; other brackets ("[frequency_Hz=10/data]")
 * are coding hints. The file is never bundled — the user loads it once.
 */

import { parseTranslationsCsv, type TranslationMap } from '@/lib/translations'

export interface Description {
  /** description without the value list, e.g. "Alarm type" */
  text: string
  /** value → meaning, from "[wert_01: …, wert_02: …]" */
  values: Map<string, string>
  /** a bracket that is not a value list, e.g. "frequency_Hz=10/data" */
  hint?: string
}

/** True for the Translations.csv layout: first row "CONTRIBUTORS,…". */
export function looksLikeTranslationsCsv(content: string): boolean {
  return /^﻿?CONTRIBUTORS,/.test(content.slice(0, 64))
}

export function parseDescriptions(content: string): TranslationMap {
  return parseTranslationsCsv(content.replace(/^﻿/, ''))
}

// "wert_01: text" items start after the bracket or a comma; value names have no spaces
const VALUE_ITEM = /(?:^|,\s*)([A-Za-z0-9_.\-/%]+):\s/g

export function splitDescription(raw: string): Description {
  const m = /^(.*?)\s*\[([^\]]*)\]\s*$/.exec(raw)
  if (!m) return { text: raw, values: new Map() }
  const [, text, inner] = m
  const starts = [...inner.matchAll(VALUE_ITEM)]
  if (starts.length === 0) return { text, values: new Map(), hint: inner }
  const values = new Map<string, string>()
  starts.forEach((s, i) => {
    const from = s.index! + s[0].length
    const to = i + 1 < starts.length ? starts[i + 1].index! : inner.length
    values.set(s[1].toLowerCase(), inner.slice(from, to).trim())
  })
  return { text, values }
}
