import { describe, expect, it } from 'vitest'
import {
  analyzeWin6Xgen,
  buildPin2,
  buildPin3,
  calculateFGH,
  collectWinDigits,
  searchCandidateSources,
} from './win6xgen.js'

const filler = { top3: '222', bottom2: '35' }

describe('WIN6XGEN CORE', () => {
  it('คำนวณ F/G/H จาก 2 ตัวบนและ 2 ตัวล่าง', () => {
    expect(calculateFGH('294', '73')).toMatchObject({ f: 3, g: 0, h: 3, isTriple: false, rud: [3, 0] })
  })

  it('กรณีตองใช้ A+B+C เพื่อหา F', () => {
    expect(calculateFGH('222', '82')).toMatchObject({ f: 6, g: 0, h: 6, isTriple: true, rud: [6, 0] })
  })

  it('ให้ลำดับ G+H มาก่อน F+G แม้ F+G จะอยู่ในงวดที่ใหม่กว่า', () => {
    const result = searchCandidateSources([
      { top3: '140', bottom2: '22' },
      { top3: '470', bottom2: '22' },
      filler,
      filler,
      filler,
    ], 1, 4, 7)

    expect(result).toMatchObject({ mode: 'G+H', searchWindowUsed: 5 })
    expect(result.match.rowIndex).toBe(1)
  })

  it.each([
    ['F+G', { top3: '140', bottom2: '22' }],
    ['H', { top3: '700', bottom2: '22' }],
    ['G', { top3: '400', bottom2: '22' }],
    ['F', { top3: '100', bottom2: '22' }],
  ])('ใช้ fallback %s ตามลำดับที่บันทึกไว้', (mode, matchingRow) => {
    const result = searchCandidateSources([matchingRow, filler, filler, filler, filler], 1, 4, 7)
    expect(result.mode).toBe(mode)
    expect(result.match.rowIndex).toBe(0)
  })

  it.each([6, 7, 8])('ขยายการหางวดเริ่มต้นไปงวดที่ %i ตามลำดับ', (window) => {
    const history = Array.from({ length: window }, () => filler)
    history[window - 1] = { top3: '470', bottom2: '22' }

    const result = searchCandidateSources(history, 1, 4, 7)
    expect(result).toMatchObject({ mode: 'G+H', searchWindowUsed: window })
    expect(result.match.rowIndex).toBe(window - 1)
  })

  it('ไม่ข้ามงวดที่ 8 เพื่อหางวดเริ่มต้น', () => {
    const history = Array.from({ length: 9 }, () => filler)
    history[8] = { top3: '470', bottom2: '22' }

    expect(() => searchCandidateSources(history, 1, 4, 7)).toThrowError(
      expect.objectContaining({ code: 'SOURCE_NOT_FOUND' }),
    )
  })

  it('ล็อก F/G/H แล้วเก็บเลขไม่ซ้ำตามลำดับจากงวดที่พบ', () => {
    const result = collectWinDigits([
      { top3: '222', bottom2: '33' },
      { top3: '444', bottom2: '44' },
      { top3: '555', bottom2: '55' },
      { top3: '666', bottom2: '66' },
      { top3: '123', bottom2: '45' },
    ], { f: 1, g: 2, h: 3 }, { match: { rowIndex: 0 } })

    expect(result.baseDigits).toEqual([1, 2, 3])
    expect(result.candidatePool).toEqual([1, 2, 3, 4, 5, 6])
    expect(result.collectionWindowUsed).toBe(5)
  })

  it('ไม่หยิบเลขจากงวดที่ใหม่กว่างวดเริ่มต้น', () => {
    const result = collectWinDigits([
      { top3: '789', bottom2: '00' },
      { top3: '222', bottom2: '33' },
      { top3: '444', bottom2: '44' },
      { top3: '555', bottom2: '55' },
      { top3: '666', bottom2: '66' },
      { top3: '123', bottom2: '45' },
    ], { f: 1, g: 2, h: 3 }, { match: { rowIndex: 1 } })

    expect(result.candidatePool).toEqual([1, 2, 3, 4, 5, 6])
    expect(result.candidatePool).not.toContain(7)
  })

  it.each([6, 7, 8])('ถ้า 5 งวดยังไม่ครบ ให้เปิดงวดที่ %i เพียงขั้นถัดไป', (window) => {
    const history = [
      { top3: '222', bottom2: '33' },
      { top3: '444', bottom2: '44' },
      { top3: '555', bottom2: '55' },
      { top3: '444', bottom2: '55' },
      { top3: '555', bottom2: '44' },
      ...Array.from({ length: window - 5 }, () => ({ top3: '444', bottom2: '55' })),
    ]
    history[window - 1] = { top3: '666', bottom2: '66' }

    const result = collectWinDigits(history, { f: 1, g: 2, h: 3 }, { match: { rowIndex: 0 } })
    expect(result.candidatePool).toEqual([1, 2, 3, 4, 5, 6])
    expect(result.collectionWindowUsed).toBe(window)
  })

  it('หยุดที่งวด 8 และแจ้งเมื่อเลขยังไม่ครบ 6 ตัว', () => {
    const history = [
      { top3: '222', bottom2: '33' },
      ...Array.from({ length: 7 }, () => ({ top3: '444', bottom2: '55' })),
    ]

    expect(() => collectWinDigits(
      history,
      { f: 1, g: 2, h: 3 },
      { match: { rowIndex: 0 } },
    )).toThrowError(expect.objectContaining({ code: 'INSUFFICIENT_WIN_DIGITS' }))
  })

  it('จัด WIN6 ได้ทันทีโดยไม่ใช้เงื่อนไขแบ่งกลุ่ม MOD10', () => {
    const result = analyzeWin6Xgen({
      draw_date: '2026-08-20',
      top3: '001',
      bottom2: '02',
      history: [
        { draw_date: '2026-08-19', top3: '222', bottom2: '33' },
        { draw_date: '2026-08-18', top3: '444', bottom2: '44' },
        { draw_date: '2026-08-17', top3: '555', bottom2: '55' },
        { draw_date: '2026-08-16', top3: '666', bottom2: '66' },
        { draw_date: '2026-08-15', top3: '123', bottom2: '45' },
      ],
    })

    expect(result).toMatchObject({
      f: 1,
      g: 2,
      h: 3,
      selectionMode: 'HISTORY_FIRST_UNIQUE',
      win6: [1, 2, 3, 4, 5, 6],
      reserve: null,
    })
    expect(result).not.toHaveProperty('mod10Groups')
    expect(result).not.toHaveProperty('partitionType')
  })

  it('เก็บได้สูงสุด 7 ตัวและส่งตัวที่ 7 เป็นเลขวงเล็บ', () => {
    const result = analyzeWin6Xgen({
      draw_date: '2026-08-20',
      top3: '001',
      bottom2: '02',
      history: [
        { draw_date: '2026-08-19', top3: '222', bottom2: '33' },
        { draw_date: '2026-08-18', top3: '444', bottom2: '44' },
        { draw_date: '2026-08-17', top3: '555', bottom2: '55' },
        { draw_date: '2026-08-16', top3: '666', bottom2: '66' },
        { draw_date: '2026-08-15', top3: '789', bottom2: '00' },
      ],
    })

    expect(result.candidatePool).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(result.win6).toEqual([1, 2, 3, 4, 5, 6])
    expect(result.reserve).toBe(7)
    expect(result.pinDigits).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(result.pin2.some((item) => item.usesParenthesizedDigit)).toBe(true)
    expect(result.pin3.some((item) => item.usesParenthesizedDigit)).toBe(true)
  })

  it('เจาะ 2/3 จาก WIN6 มีอย่างละ 5 ชุด', () => {
    const win6 = [6, 0, 7, 8, 3, 9]
    expect(buildPin2(win6).map((item) => item.pair)).toEqual(['60', '67', '68', '03', '09'])
    expect(buildPin3(win6).map((item) => item.triple)).toEqual(['607', '683', '089', '679', '073'])
  })

  it('เจาะ 2/3 จาก 7 ตัวมีอย่างละ 5 ชุดและใช้เลขวงเล็บจริง', () => {
    const win7 = [9, 4, 3, 7, 5, 2, 0]
    const pin2 = buildPin2(win7)
    const pin3 = buildPin3(win7)

    expect(pin2.map((item) => item.pair)).toEqual(['94', '93', '97', '45', '20'])
    expect(pin3.map((item) => item.triple)).toEqual(['943', '975', '472', '932', '940'])
    expect(pin2).toHaveLength(5)
    expect(pin3).toHaveLength(5)
    expect(pin2.filter((item) => item.usesParenthesizedDigit)).toHaveLength(1)
    expect(pin3.filter((item) => item.usesParenthesizedDigit)).toHaveLength(1)
  })
})
