/**
 * Runtime translation of BMW diagnostic tokens into Russian or English:
 * "GEBLAESE_MIT_LUEFTER" → RU "Вентилятор с вентилятором" / EN "Blower with fan".
 * Works by splitting the token into words and looking each up in the
 * built-in BMW term dictionary; unknown words stay as-is.
 */

import { TERMS, FUNCTION_OVERRIDES, VALUE_OVERRIDES, type TermPair } from '@/data/bmwTerms'

export type OutputLang = 'ru' | 'en'

const TECHNICAL_RE = /^\d/

function pick(pair: TermPair, lang: OutputLang): string {
  return lang === 'ru' ? pair.ru : pair.en
}

function translateWord(word: string, lang: OutputLang): string | null {
  const lower = word.toLowerCase()
  const term = TERMS[lower]
  if (term) return pick(term, lang)
  const fn = FUNCTION_OVERRIDES[lower]
  if (fn) return pick(fn, lang)
  const val = VALUE_OVERRIDES[lower]
  if (val) return pick(val, lang)
  return null
}

function isTechnical(word: string): boolean {
  return TECHNICAL_RE.test(word) || /^[0-9a-f]{1,2}$/.test(word)
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function translatePhrase(phrase: string, lang: OutputLang): string {
  const words = phrase.split(/[_\s]+/).filter(Boolean)
  const out: string[] = []
  let translated = false
  for (const word of words) {
    if (isTechnical(word)) {
      out.push(word)
      continue
    }
    const t = translateWord(word, lang)
    if (t === null) {
      out.push(word)
      continue
    }
    translated = true
    out.push(t)
  }
  if (!translated) return phrase
  const joined = out.join(' ').replace(/\s+/g, ' ').trim()
  return capitalize(joined)
}

/** Перевод имени функции: точные оверрайды, затем пословная сборка. */
export function translateFunctionName(name: string, lang: OutputLang): string {
  const key = name.toLowerCase()
  const exact = FUNCTION_OVERRIDES[key]
  if (exact) return pick(exact, lang)
  return translatePhrase(name, lang)
}

/** Только точный перевод из словаря (без пословной сборки), или null. */
export function translateExact(token: string, lang: OutputLang): string | null {
  const key = token.toLowerCase()
  const exact = VALUE_OVERRIDES[key] ?? FUNCTION_OVERRIDES[key]
  return exact ? pick(exact, lang) : null
}

/** Перевод значения. */
export function translateValue(value: string, lang: OutputLang): string {
  const key = value.toLowerCase()
  const exact = VALUE_OVERRIDES[key]
  if (exact) return pick(exact, lang)
  const fn = FUNCTION_OVERRIDES[key]
  if (fn) return pick(fn, lang)
  return translatePhrase(value, lang)
}
