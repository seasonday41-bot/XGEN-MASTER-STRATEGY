import { describe, expect, it } from 'vitest'
import {
  analyzePercentCore,
  calculateFG,
  matchHistoryByFG,
  rankMatchedDigits,
} from './formula.js'

describe('FG HISTORY CORE', () => {
  it('หา F และ G จาก 2 ตัวบน/2 ตัวล่างด้วย mod10', () => {
    expect(calculateFG('294', '73')).toEqual({ f: 3, g: 0, digits: [3, 0] })
  })

  it('คัดเฉพาะงวดที่มี F และ G อยู่พร้อมกันในชุดเดียว', () => {
    const history = [
      { draw_date: '2026-08-14', top3: '039', bottom2: '61' },
      { draw_date: '2026-08-05', top3: '305', bottom2: '37' },
      { draw_date: '2026-08-04', top3: '751', bottom2: '48' },
      { draw_date: '2026-08-03', top3: '226', bottom2: '40' },
    ]

    expect(matchHistoryByFG(history, 3, 0).map((row) => `${row.top3}-${row.bottom2}`))
      .toEqual(['039-61', '305-37'])
  })

  it('นับความถี่ทุกหลักและใช้ความใกล้ปัจจุบันเป็นตัวตัดสินเมื่อคะแนนเท่ากัน', () => {
    const ranking = rankMatchedDigits([
      { draw_date: '2026-08-14', top3: '039', bottom2: '61' },
      { draw_date: '2026-08-05', top3: '305', bottom2: '37' },
    ])

    expect(ranking.map((item) => [item.digit, item.occurrences])).toEqual([
      [3, 3],
      [0, 2],
      [9, 1],
      [6, 1],
      [1, 1],
      [5, 1],
      [7, 1],
    ])
  })

  it('ล็อก FG ก่อน แล้วเติม WIN6 จากความถี่ของงวดที่ผ่านเท่านั้น', () => {
    const result = analyzePercentCore({
      draw_date: '2026-08-18',
      top3: '294',
      bottom2: '73',
      history: [
        { draw_date: '2026-08-14', top3: '039', bottom2: '61' },
        { draw_date: '2026-08-05', top3: '305', bottom2: '37' },
        { draw_date: '2026-08-04', top3: '751', bottom2: '48' },
      ],
    })

    expect(result.fg).toEqual([3, 0])
    expect(result.matchCount).toBe(2)
    expect(result.win6).toEqual([3, 0, 9, 6, 1, 5])
    expect(result.seventh).toBe(7)
    expect(result.strong).toEqual([3, 0])
    expect(result.secondary).toEqual([9, 6])
  })

  it('ไม่ยอมเอางวดที่มี F หรือ G เพียงตัวเดียวมาปน', () => {
    expect(() => analyzePercentCore({
      top3: '448',
      bottom2: '17',
      history: [
        { draw_date: '2026-08-13', top3: '483', bottom2: '69' },
        { draw_date: '2026-08-11', top3: '240', bottom2: '56' },
      ],
    })).toThrow('ไม่พบงวดย้อนหลังที่มี FG 28')
  })

  it('ไม่สร้าง WIN6 จากเลขที่ไม่เคยอยู่ในชุด FG ที่ผ่าน', () => {
    expect(() => analyzePercentCore({
      top3: '574',
      bottom2: '25',
      history: [
        { draw_date: '2026-08-07', top3: '717', bottom2: '11' },
      ],
    })).toThrow('ยังสร้าง WIN6 ไม่ได้')
  })

  it('โหมด legacy มีไว้เฉพาะ caller เก่าที่ไม่ส่ง history', () => {
    const result = analyzePercentCore({ top3: '118', bottom2: '01' })
    expect(result.engine).toContain('LEGACY PERCENT COMPATIBILITY')
    expect(result.win6).toEqual([0, 3, 4, 6, 2, 8])
  })
})
