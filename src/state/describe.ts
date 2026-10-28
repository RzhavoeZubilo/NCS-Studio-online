import { useMemo } from 'react'
import { useStore, useTranslator } from '@/state/store'
import { splitDescription, type Description } from '@/lib/descriptions'
import { translateExact } from '@/lib/ruTranslate'

export interface FunctionText {
  /** main line: Russian when known, else the English description, else the name */
  title: string
  /** English description, when the title is its Russian translation */
  original?: string
  /** coding hint from the description, e.g. "frequency_Hz=10/data" */
  hint?: string
  /** value → meaning, from the description's "[wert_01: …]" list */
  values: Map<string, string>
}

/**
 * Texts for functions and values, honoring the parameter language: the RU
 * overlay and exact dictionary entries, then Translations.csv descriptions.
 * The word-by-word translation is used only when no description exists.
 */
export function useDescribe() {
  const descriptions = useStore((s) => s.descriptions)
  const overlay = useStore((s) => s.overlay)
  const paramLang = useStore((s) => s.paramLang)
  const tr = useTranslator()

  return useMemo(() => {
    const cache = new Map<string, Description | null>()
    const describe = (name: string): Description | null => {
      const key = name.toLowerCase()
      if (!cache.has(key)) {
        const raw = descriptions?.get(key)
        cache.set(key, raw ? splitDescription(raw) : null)
      }
      return cache.get(key)!
    }
    const ruExact = (token: string) =>
      paramLang === 'ru' ? (overlay?.[token.toLowerCase()] ?? translateExact(token, 'ru') ?? undefined) : undefined

    const fn = (name: string): FunctionText => {
      const d = describe(name)
      const values = d?.values ?? new Map<string, string>()
      if (paramLang === 'original') return { title: name, values }
      const en = d?.text || undefined
      const ru = ruExact(name) ?? (paramLang === 'ru' && !en ? tr(name) : undefined)
      const fallback = paramLang === 'en' && !en ? tr(name) : undefined
      return { title: ru ?? en ?? fallback ?? name, original: ru && en ? en : undefined, hint: d?.hint, values }
    }

    const value = (fnName: string, v: string): string | undefined => {
      if (paramLang === 'original') return undefined
      // the function's own meaning ("corrected speed") is more telling than "включено"
      const ru = ruExact(v)
      const note = describe(fnName)?.values.get(v.toLowerCase())
      if (note) return ru ? `${ru} (${note})` : note
      if (ru) return ru
      // the shared entries only restate generic names ("wert_01" → "Value 01")
      const shared = descriptions?.get(v.toLowerCase()) ?? tr(v)
      return shared && !/^(value|wert|значение)\s*\d+$/i.test(shared) ? shared : undefined
    }

    return { fn, value }
  }, [descriptions, overlay, paramLang, tr])
}
