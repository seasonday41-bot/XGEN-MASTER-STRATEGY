import { describe, expect, it } from 'vitest'
import {
  analyzePercentCore,
  buildFirstMatchSet,
  buildShadowSearchPairs,
  calculateFG,
  findFirstHistoryPairMatch,
  shadowDigit,
} from './formula.js'

describe('FG SHADOW FIRST MATCH CORE', () => {
  it('หา F/G แบบปกติจากหลักสิบ+หลักหน่วยของ 3 บน และ 2 ล่าง', () => {
    expect(calculateFG('294', '73')).toEqual({ f: 3, g: 0, digits: [3, 0], isTriple: false })
  })

  it('ใช้กฎเลขตอง: ถ้า 3 บนเป็น AAA ให้ F = A+B+C mod10', () => {
    expect(calculateFG('222', '45')).toEqual({ f: 6, g: 9, digits: [6, 9], isTriple: true })
    expect(calculateFG('777', '60')).toEqual({ f: 1, g: 6, digits: [1, 6], isTriple: true })
  })

  it('แปลงเลขเงาแบบ 0↔5 1↔6 2↔7 3↔8 4↔9', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(shadowDigit))
      .toEqual([5, 6, 7, 8, 9, 0, 1, 2, 3, 4])
  })

  it('สร้างคู่ค้นตามลำดับ F-เงาG, F-G, G-เงาF', () => {
    expect(buildShadowSearchPairs(4, 3).map((item) => item.pair))
      .toEqual(['48', '43', '39'])
  })

  it('ไล่จากงวดล่าสุดย้อนหลังและเลือกงวดแรกที่มีคู่ค้น ไม่ใช้เลขเดี่ยว', () => {
    const history = [
      { draw_date: '2026-08-17', top3: '748', bottom2: '12' },
      { draw_date: '2026-08-14', top3: '292', bottom2: '85' },
      { draw_date: '2026-08-12', top3: '863', bottom2: '89' },
    ]
    const match = findFirstHistoryPairMatch(history, buildShadowSearchPairs(4, 3))

    expect(`${match.row.top3}-${match.row.bottom2}`).toBe('748-12')
    expect(match.rowIndex).toBe(0)
    expect(match.matchedPairs.map((item) => item.pair)).toEqual(['48'])
  })

  it('ถ้าคู่เป็นเลขเดียวกัน เช่น 44 ต้องมีเลขนั้นอย่างน้อย 2 ตำแหน่ง', () => {
    const match = findFirstHistoryPairMatch([
      { top3: '410', bottom2: '26' },
      { top3: '414', bottom2: '26' },
    ], [{ pair: '44', digits: [4, 4] }])

    expect(`${match.row.top3}-${match.row.bottom2}`).toBe('414-26')
    expect(match.rowIndex).toBe(1)
  })

  it('ล็อก FG + เงา แล้วเติมเลขใหม่ทั้งหมดจากงวดแรกที่เจอ', () => {
    expect(buildFirstMatchSet(4, 3, { top3: '748', bottom2: '12' })).toEqual({
      base: [4, 3, 9, 8],
      values: [4, 3, 9, 8, 7, 1, 2],
    })
  })

  it('เคสดาวโจนส์สตาร์ 704-76 ต้องได้ 4 3 9 8 7 1 2', () => {
    const result = analyzePercentCore({
      draw_date: '2026-08-18',
      top3: '704',
      bottom2: '76',
      history: [
        { draw_date: '2026-08-17', top3: '748', bottom2: '12' },
        { draw_date: '2026-08-16', top3: '617', bottom2: '60' },
        { draw_date: '2026-08-15', top3: '264', bottom2: '77' },
        { draw_date: '2026-08-14', top3: '292', bottom2: '85' },
        { draw_date: '2026-08-12', top3: '863', bottom2: '89' },
      ],
    })

    expect(result.fg).toEqual([4, 3])
    expect(result.shadow).toEqual([9, 8])
    expect(result.searchPairs).toEqual(['48', '43', '39'])
    expect(result.matchedPairs).toEqual(['48'])
    expect(`${result.firstMatch.top3}-${result.firstMatch.bottom2}`).toBe('748-12')
    expect(result.win6).toEqual([4, 3, 9, 8, 7, 1, 2])
    expect(result.coreSet).toEqual([4, 3, 9, 8, 7, 1, 2])
    expect(result.seventh).toBeNull()
  })

  it('ไม่ fallback ไปใช้เลขเดี่ยวหรือความถี่ถ้าไม่มีคู่ค้น', () => {
    expect(() => analyzePercentCore({
      top3: '704',
      bottom2: '76',
      history: [
        { draw_date: '2026-08-17', top3: '750', bottom2: '12' },
        { draw_date: '2026-08-16', top3: '204', bottom2: '26' },
      ],
    })).toThrow('ไม่พบงวดย้อนหลังที่มีคู่ 48 / 43 / 39')
  })

  it('โหมด legacy มีไว้เฉพาะ caller เก่าที่ไม่ส่ง history', () => {
    const result = analyzePercentCore({ top3: '118', bottom2: '01' })
    expect(result.engine).toContain('LEGACY PERCENT COMPATIBILITY')
    expect(result.win6).toEqual([0, 3, 4, 6, 2, 8])
  })
})
