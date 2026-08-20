import { describe, expect, it } from 'vitest'
import {
  analyzeWin6Xgen,
  buildCandidatePool,
  buildPin2,
  buildPin3,
  calculateFGH,
  findFirstValidWin6,
  findHistoryZeroPairs,
  partitionWin6,
  searchCandidateSources,
  selectWin6,
} from './win6xgen.js'

describe('WIN6XGEN CORE', () => {
  it('คำนวณ F/G/H จาก 2 ตัวบนและ 2 ตัวล่าง', () => {
    expect(calculateFGH('294', '73')).toMatchObject({ f: 3, g: 0, h: 3, isTriple: false, rud: [3, 0] })
  })

  it('กรณีตองใช้ A+B+C เพื่อหา F', () => {
    expect(calculateFGH('222', '82')).toMatchObject({ f: 6, g: 0, h: 6, isTriple: true, rud: [6, 0] })
  })

  it('หา G+H เฉพาะ 5 งวดแรก', () => {
    const history = [
      { top3: '111', bottom2: '20' },
      { top3: '222', bottom2: '30' },
      { top3: '333', bottom2: '40' },
      { top3: '444', bottom2: '50' },
      { top3: '555', bottom2: '60' },
      { top3: '195', bottom2: '38' },
    ]
    const search = searchCandidateSources(history, 1, 5)

    expect(search.mode).toBe('H→G')
    expect(search.matches.map((item) => item.kind)).toEqual(['5', '1'])
  })

  it('ใช้ G+H ชุดแรกเมื่อพบภายใน 5 งวด', () => {
    const search = searchCandidateSources([
      { top3: '195', bottom2: '38' },
      { top3: '519', bottom2: '20' },
    ], 1, 5)

    expect(search.mode).toBe('G+H')
    expect(search.matches[0].rowIndex).toBe(0)
  })

  it('Candidate Pool ล็อก F/G/H ก่อนและตัดซ้ำแบบคงลำดับ', () => {
    const fgh = calculateFGH('240', '56')
    const sourceSearch = searchCandidateSources([{ top3: '195', bottom2: '38' }], 1, 5)
    expect(buildCandidatePool(fgh, sourceSearch)).toEqual([4, 1, 5, 9, 3, 8])
  })

  it('รับ WIN6 ที่แบ่งเป็น 3 คู่ MOD10=0', () => {
    expect(partitionWin6([1, 9, 2, 8, 3, 7])).toEqual({
      type: 'PAIR×3',
      groups: [[1, 9], [2, 8], [3, 7]],
    })
  })

  it('รับ WIN6 ที่แบ่งเป็น 2 ชุดสามตัว MOD10=0', () => {
    expect(partitionWin6([4, 1, 5, 9, 3, 8])).toEqual({
      type: 'TRIPLE×2',
      groups: [[4, 1, 5], [9, 3, 8]],
    })
  })

  it('เลือกชุดแรกตามลำดับ Candidate และต้องมี F/G', () => {
    const result = findFirstValidWin6([4, 1, 5, 9, 3, 8, 2, 6], [4, 1])
    expect(result.values).toEqual([4, 1, 5, 9, 3, 8])
  })

  it('หาคู่เติมย้อนหลังคู่แรกที่ผลบวก MOD10=0', () => {
    const pairs = findHistoryZeroPairs([
      { top3: '128', bottom2: '34' },
      { top3: '379', bottom2: '16' },
    ])
    expect(pairs[0].digits).toEqual([2, 8])
  })

  it('เติมคู่แรกที่ไม่ซ้ำชุดหลักเมื่อ Candidate ขาด 2 ตัว', () => {
    const result = selectWin6(
      [1, 9, 4, 6],
      [{ top3: '228', bottom2: '50' }, { top3: '337', bottom2: '41' }],
      [1, 9],
    )
    expect(result.values).toEqual([1, 9, 4, 6, 2, 8])
    expect(result.fillPair.digits).toEqual([2, 8])
    expect(result.selectionMode).toBe('FIRST_HISTORY_MOD10_PAIR')
  })

  it('ไม่ใช้ fallback ขยายย้อนหลังทั่วไปเมื่อ Candidate มีอย่างน้อย 6 ตัว', () => {
    expect(() => selectWin6(
      [0, 1, 2, 3, 4, 5],
      [{ top3: '688', bottom2: '79' }],
      [0, 1],
    )).toThrow('ไม่มี WIN6 ที่ผ่าน MOD10 ตามวิธีที่บันทึกไว้')
  })

  it('สร้าง WIN6XGEN ครบจากตัวอย่างสองชุดสามตัว', () => {
    const result = analyzeWin6Xgen({
      draw_date: '2026-08-20',
      top3: '240',
      bottom2: '56',
      history: [{ draw_date: '2026-08-19', top3: '195', bottom2: '38' }],
    })

    expect(result).toMatchObject({ f: 4, g: 1, h: 5, win6: [4, 1, 5, 9, 3, 8] })
    expect(result.mod10Groups).toEqual([[4, 1, 5], [9, 3, 8]])
  })

  it('เจาะ 2/3 มีอย่างละ 5 ชุดและอิงลำดับ WIN6 เท่านั้น', () => {
    const win6 = [6, 0, 7, 8, 3, 9]
    expect(buildPin2(win6).map((item) => item.pair)).toEqual(['60', '67', '68', '03', '09'])
    expect(buildPin3(win6).map((item) => item.triple)).toEqual(['607', '683', '089', '679', '073'])
  })
})
