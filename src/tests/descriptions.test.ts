import { describe, expect, it } from 'vitest'
import { looksLikeTranslationsCsv, splitDescription } from '@/lib/descriptions'

describe('splitDescription', () => {
  it('splits the value list out of the description', () => {
    const d = splitDescription('Alarm type [wert_01: 1 cycle Europe sound, wert_02: 8 cycles USA sound]')
    expect(d.text).toBe('Alarm type')
    expect(d.values.get('wert_01')).toBe('1 cycle Europe sound')
    expect(d.values.get('wert_02')).toBe('8 cycles USA sound')
  })

  it('keeps commas inside a value meaning', () => {
    const d = splitDescription('Speed display [aktiv: corrected speed, rounded, nicht_aktiv: true speed]')
    expect(d.values.get('aktiv')).toBe('corrected speed, rounded')
    expect(d.values.get('nicht_aktiv')).toBe('true speed')
  })

  it('treats other brackets as a coding hint', () => {
    const d = splitDescription('Check control slow flashing frequency [frequency_Hz=10/data]')
    expect(d).toEqual({ text: 'Check control slow flashing frequency', values: new Map(), hint: 'frequency_Hz=10/data' })
  })

  it('leaves plain descriptions alone', () => {
    expect(splitDescription('On-board computer (OBC) digital speed display').text).toBe(
      'On-board computer (OBC) digital speed display',
    )
  })
})

describe('looksLikeTranslationsCsv', () => {
  it('recognizes the NCS Dummy database by its first row', () => {
    expect(looksLikeTranslationsCsv('﻿CONTRIBUTORS,"revtor,IcemanBHE"\r\n')).toBe(true)
    expect(looksLikeTranslationsCsv('CODIERUNG_ERFOLGT\r\n\tcodierung_erfolgt')).toBe(false)
  })
})
