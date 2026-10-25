/**
 * Runtime Russian translation of BMW diagnostic tokens:
 * "GEBLAESE_AUTO_MIT_A" → "Вентилятор автомат. с автоматикой".
 * Works by splitting the token into words and looking each up in the
 * built-in BMW term dictionary; unknown words stay as-is.
 */

import { TERMS, FUNCTION_OVERRIDES, VALUE_OVERRIDES } from '@/data/bmwTerms'

function translateWord(word: string): string {
  const lower = word.toLowerCase()
  if (TERMS[lower]) return TERMS[lower]
  if (FUNCTION_OVERRIDES[lower]) return FUNCTION_OVERRIDES[lower]
  if (VALUE_OVERRIDES[lower]) return VALUE_OVERRIDES[lower]
  return word
}

function isTechnical(word: string): boolean {
  return /^\d/.test(word) || /^[0-9a-f]{1,2}$/.test(word)
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function translatePhrase(phrase: string): string {
  const words = phrase
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => (isTechnical(word) ? word : translateWord(word)))
  if (words.length === 0) return phrase
  return capitalize(words.join(' ').replace(/\s+/g, ' ').trim())
}

/** Перевод имени функции: сначала точное совпадение, затем пословная сборка. */
export function translateFunctionName(name: string): string {
  const key = name.toLowerCase()
  if (FUNCTION_OVERRIDES[key]) return FUNCTION_OVERRIDES[key]
  return translatePhrase(name)
}

/** Перевод значения: точные оверрайды, затем пословная сборка. */
export function translateValue(value: string): string {
  const key = value.toLowerCase()
  if (VALUE_OVERRIDES[key]) return VALUE_OVERRIDES[key]
  if (FUNCTION_OVERRIDES[key]) return FUNCTION_OVERRIDES[key]
  return translatePhrase(value)
}
