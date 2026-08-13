import { describe, expect, it } from 'vitest'
import { analyzeHistory, calculateWin6, selectColdPairs } from './formula.js'

describe('Xgen formula', () => {
  it('คำนวณ 240-56 เป็นรูด 6-7 และ WIN6 675280', () => {
    expect(calculateWin6('240', '56')).toEqual({
      rud: [6, 7],
      win6: [6, 7, 5, 2, 8, 0],
    })
  })

  it('คัดเจาะ 2 ตัวอย่างลาวพัฒนาได้ตามกติกาย้อนหลัง 4 งวด', () => {
    const history = [
      { top3: '718', bottom2: '97' },
      { top3: '670', bottom2: '96' },
      { top3: '030', bottom2: '30' },
      { top3: '677', bottom2: '76' },
    ]
    const result = analyzeHistory(history)
    expect(result.win6.join('')).toBe('562017')
    expect(result.pin2.map((item) => item.pair)).toEqual(['25', '15', '12', '56', '05'])
    expect(result.pin2.map((item) => item.score)).toEqual([0, 1, 1, 4, 4])
  })

  it('ไม่สร้างเลขเบิ้ลใน 15 คู่ของ WIN6', () => {
    const history = Array.from({ length: 4 }, () => ({ top3: '000', bottom2: '00' }))
    const pairs = selectColdPairs([0, 1, 2, 3, 4, 5], history, 15)
    expect(pairs).toHaveLength(15)
    expect(pairs.every((item) => item.pair[0] !== item.pair[1])).toBe(true)
  })
})

