import { describe, expect, it } from 'vitest'
import {
  analyzeHistory,
  calculateDoubleAnalysis,
  calculateWin6,
  resolveUniqueRud,
  selectColdPairs,
  selectStrongDigit,
} from './formula.js'

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
    expect(result.strongDigit).toMatchObject({ digit: 5, appearances: 4 })
  })

  it('ไม่สร้างเลขเบิ้ลใน 15 คู่ของ WIN6', () => {
    const history = Array.from({ length: 4 }, () => ({ top3: '000', bottom2: '00' }))
    const pairs = selectColdPairs([0, 1, 2, 3, 4, 5], history, 15)
    expect(pairs).toHaveLength(15)
    expect(pairs.every((item) => item.pair[0] !== item.pair[1])).toBe(true)
  })

  it('คัดตัวแรงจากเลขที่ซ้ำในเจาะ 2 มากที่สุดและใช้คะแนนตัดสินเมื่อเสมอ', () => {
    const pin2 = [
      { digits: [1, 2], pair: '12', score: 1 },
      { digits: [1, 3], pair: '13', score: 2 },
      { digits: [2, 4], pair: '24', score: 8 },
      { digits: [3, 4], pair: '34', score: 8 },
    ]

    expect(selectStrongDigit(pin2, [1, 2, 3, 4])).toMatchObject({
      digit: 1,
      appearances: 2,
      scoreTotal: 3,
    })
  })

  it('ใช้ตัวแรงแทนรูดรองเมื่อรูดหลักและรูดรองซ้ำกัน', () => {
    expect(resolveUniqueRud([7, 7], { digit: 0 }, [7, 9, 3, 4, 0, 6])).toEqual([7, 0])
  })

  it('ใช้เลขถัดไปใน WIN6 เมื่อตัวแรงยังซ้ำกับรูดหลัก', () => {
    expect(resolveUniqueRud([7, 7], { digit: 7 }, [7, 9, 3, 4, 0, 6])).toEqual([7, 9])
  })

  it('คงรูดเดิมเมื่อรูดหลักและรูดรองไม่ซ้ำกัน', () => {
    expect(resolveUniqueRud([6, 7], { digit: 5 }, [6, 7, 5, 2, 8, 0])).toEqual([6, 7])
  })

  it('คำนวณเลขเบิ้ล 681-16 เป็น 77 และ 88 ตามสูตร HTML', () => {
    expect(calculateDoubleAnalysis('681', '16')).toEqual({
      pattern: 'ปกติ',
      message: 'ผลล่าสุดไม่พบเบิ้ลหรือหาม • เน้นรูดสลับ',
      doubles: ['77', '88'],
    })
  })

  it('วิเคราะห์ 088 เป็นเบิ้ลหลังและไม่แสดง 88 ซ้ำ', () => {
    expect(calculateDoubleAnalysis('088', '07')).toEqual({
      pattern: 'เบิ้ลหลัง',
      message: 'พบเบิ้ลหลังในผลล่าสุด • เฝ้าระวังเบิ้ล/หาม',
      doubles: ['88'],
    })
  })

  it('แยกเบิ้ลหน้า หาม และตองได้', () => {
    expect(calculateDoubleAnalysis('881', '00').pattern).toBe('เบิ้ลหน้า')
    expect(calculateDoubleAnalysis('818', '00').pattern).toBe('หาม')
    expect(calculateDoubleAnalysis('888', '00').pattern).toBe('ตอง')
  })
})
