import { describe, expect, it } from 'vitest'
import {
  analyzePercentCore,
  calculateFormulaResults,
  detectPatterns,
  rankDigits,
} from './formula.js'

describe('PERCENT CORE', () => {
  it('คำนวณ 8 สูตรของ 978-63 ได้ตรงตำรา', () => {
    expect(calculateFormulaResults('978', '63')).toEqual([
      '1956',
      '8802',
      '3528',
      '7287',
      '10065',
      '293589',
      '4395',
      '75088',
    ])
  })

  it('จัด Ranking แบบ Equal Weight ได้ตัวแรง 5-8 และรอง 2-9', () => {
    const ranking = rankDigits(calculateFormulaResults('978', '63'))
    expect(ranking.slice(0, 4).map((item) => item.digit)).toEqual([5, 8, 2, 9])
    expect(ranking.slice(0, 2).map((item) => item.score)).toEqual([12, 12])
  })

  it('Strong Lock + MOD10 สร้าง WIN6 และตัวที่ 7 ตรงตัวอย่าง', () => {
    const result = analyzePercentCore({ top3: '978', bottom2: '63' })
    expect(result.strong).toEqual([5, 8])
    expect(result.secondary).toEqual([2, 9])
    expect(result.win6).toEqual([5, 8, 2, 3, 7, 9])
    expect(result.seventh).toBe(0)
    expect(result.keyPairs).toEqual(['28', '37'])
  })

  it('Pair Collision คัดเจาะ 2 ตาม formulaHits ก่อน', () => {
    const result = analyzePercentCore({ top3: '978', bottom2: '63' })
    expect(result.pin2.map((item) => item.pair)).toEqual(['28', '58', '59', '35', '08'])
    expect(result.pin2.map((item) => item.formulaHits)).toEqual([4, 3, 3, 3, 2])
  })

  it('คัดเจาะ 3 และชุดเสริมตรงตัวอย่าง', () => {
    const result = analyzePercentCore({ top3: '978', bottom2: '63' })
    expect(result.pin3.map((item) => item.triple)).toEqual(['258', '058', '358'])
    expect(result.pin3Extra.map((item) => item.triple)).toEqual(['589', '028'])
  })

  it('ตรวจเบิ้ล ตอง และพี่น้องจาก 8 สูตรเท่านั้น', () => {
    expect(detectPatterns(calculateFormulaResults('978', '63'))).toEqual({
      doubles: ['88', '00'],
      triples: [],
      siblings: ['56', '78', '01', '89', '34'],
    })
  })

  it('รับผลล่าสุดเพียง 1 งวดโดยไม่ต้องมี history', () => {
    const result = analyzePercentCore({
      draw_date: '2026-08-19',
      top3: '978',
      bottom2: '63',
    })
    expect(result.source.draw_date).toBe('2026-08-19')
    expect(result.formulaResults).toHaveLength(8)
  })
})
