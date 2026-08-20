import { describe, expect, it } from 'vitest'
import {
  analyzeWin6Xgen,
  buildPin2,
  buildPin3,
  calculateFG,
  collectFirstFoundWinDigits,
} from './win6xgen.js'

describe('WIN6XGEN CORE', () => {
  it('คงสูตร F/G เดิมจาก 2 ตัวบนและ 2 ตัวล่าง', () => {
    const result = calculateFG('294', '73')
    expect(result).toMatchObject({ f: 3, g: 0, isTriple: false, rud: [3, 0] })
    expect(result).not.toHaveProperty('h')
  })

  it('กรณีตองยังใช้ A+B+C เพื่อหา F', () => {
    expect(calculateFG('222', '82')).toMatchObject({ f: 6, g: 0, isTriple: true, rud: [6, 0] })
  })

  it('FG SEARCH เก็บเฉพาะงวดที่มีทั้ง F/G ตามลำดับและหยุดสูงสุด 7 ตัว', () => {
    const result = collectFirstFoundWinDigits([
      { top3: '888', bottom2: '90' },
      { top3: '231', bottom2: '45' },
      { top3: '231', bottom2: '67' },
      { top3: '238', bottom2: '90' },
    ], { f: 2, g: 3 })

    expect(result.candidatePool).toEqual([2, 3, 1, 4, 5, 6, 7])
    expect(result.winningPhase).toBe('FG')
    expect(result.phases.map((phase) => phase.mode)).toEqual(['FG'])
    expect(result.phases[0].matchedRows.map((match) => match.rowIndex)).toEqual([1, 2])
    expect(result.candidatePool).not.toContain(8)
  })

  it('ไม่ใส่ F/G เป็นเลขตั้งต้นหากยังไม่พบจริงในงวดที่ผ่านเงื่อนไข', () => {
    let thrown
    try {
      collectFirstFoundWinDigits(
        Array.from({ length: 8 }, () => ({ top3: '222', bottom2: '22' })),
        { f: 2, g: 3 },
      )
    } catch (error) {
      thrown = error
    }

    expect(thrown).toMatchObject({ code: 'INSUFFICIENT_WIN_DIGITS' })
    expect(thrown.details.candidatePool).toEqual([2])
  })

  it('เปิด F SEARCH เมื่อ FG SEARCH ครบ 5 งวดแล้วยังสร้าง WIN ไม่ครบ', () => {
    const result = collectFirstFoundWinDigits([
      { top3: '140', bottom2: '00' },
      { top3: '125', bottom2: '67' },
      { top3: '100', bottom2: '00' },
      { top3: '111', bottom2: '11' },
      { top3: '100', bottom2: '00' },
    ], { f: 1, g: 4 })

    expect(result.candidatePool).toEqual([1, 4, 0, 2, 5, 6, 7])
    expect(result.phases.map((phase) => phase.mode)).toEqual(['FG', 'F'])
    expect(result.winningPhase).toBe('F')
  })

  it('เปิด G SEARCH หลัง FG และ F ยังไม่ครบเท่านั้น', () => {
    const result = collectFirstFoundWinDigits([
      { top3: '140', bottom2: '00' },
      { top3: '425', bottom2: '67' },
      { top3: '100', bottom2: '00' },
      { top3: '111', bottom2: '11' },
      { top3: '400', bottom2: '00' },
    ], { f: 1, g: 4 })

    expect(result.candidatePool).toEqual([1, 4, 0, 2, 5, 6, 7])
    expect(result.phases.map((phase) => phase.mode)).toEqual(['FG', 'F', 'G'])
    expect(result.winningPhase).toBe('G')
  })

  it('FG EXTRA ใช้เฉพาะ 3 งวดถัดจากช่วงหลัก', () => {
    const result = collectFirstFoundWinDigits([
      { top3: '140', bottom2: '00' },
      { top3: '111', bottom2: '11' },
      { top3: '400', bottom2: '00' },
      { top3: '111', bottom2: '11' },
      { top3: '400', bottom2: '00' },
      { top3: '145', bottom2: '26' },
      { top3: '147', bottom2: '88' },
    ], { f: 1, g: 4 })

    expect(result.candidatePool).toEqual([1, 4, 0, 5, 2, 6, 7])
    expect(result.winningPhase).toBe('FG_EXTRA')
    expect(result.phases.map((phase) => phase.mode)).toEqual(['FG', 'F', 'G', 'FG_EXTRA'])
    expect(result.usedExtraSearch).toBe(true)
  })

  it('F EXTRA มาก่อน G EXTRA', () => {
    const result = collectFirstFoundWinDigits([
      { top3: '140', bottom2: '00' },
      { top3: '111', bottom2: '11' },
      { top3: '400', bottom2: '00' },
      { top3: '111', bottom2: '11' },
      { top3: '400', bottom2: '00' },
      { top3: '125', bottom2: '67' },
      { top3: '489', bottom2: '23' },
    ], { f: 1, g: 4 })

    expect(result.candidatePool).toEqual([1, 4, 0, 2, 5, 6, 7])
    expect(result.winningPhase).toBe('F_EXTRA')
    expect(result.phases.map((phase) => phase.mode)).toEqual([
      'FG', 'F', 'G', 'FG_EXTRA', 'F_EXTRA',
    ])
  })

  it('G EXTRA ใช้เมื่อทุกช่วงก่อนหน้ายังไม่ครบ', () => {
    const result = collectFirstFoundWinDigits([
      { top3: '140', bottom2: '00' },
      { top3: '111', bottom2: '11' },
      { top3: '400', bottom2: '00' },
      { top3: '111', bottom2: '11' },
      { top3: '400', bottom2: '00' },
      { top3: '425', bottom2: '67' },
      { top3: '488', bottom2: '89' },
    ], { f: 1, g: 4 })

    expect(result.candidatePool).toEqual([1, 4, 0, 2, 5, 6, 7])
    expect(result.winningPhase).toBe('G_EXTRA')
    expect(result.phases.map((phase) => phase.mode)).toEqual([
      'FG', 'F', 'G', 'FG_EXTRA', 'F_EXTRA', 'G_EXTRA',
    ])
  })

  it('ไม่ค้นเกิน 5 งวดหลัก + 3 งวด Extra', () => {
    const history = Array.from({ length: 9 }, () => ({ top3: '111', bottom2: '11' }))
    history[8] = { top3: '145', bottom2: '26' }

    expect(() => collectFirstFoundWinDigits(history, { f: 1, g: 4 })).toThrowError(
      expect.objectContaining({
        code: 'INSUFFICIENT_WIN_DIGITS',
        details: expect.objectContaining({ candidatePool: [1] }),
      }),
    )
  })

  it('เมื่อ FG ได้ 6 ตัวพอดี จะไม่เปิด F เพียงเพื่อหาตัวสำรอง', () => {
    const result = collectFirstFoundWinDigits([
      { top3: '140', bottom2: '23' },
      { top3: '141', bottom2: '25' },
      { top3: '167', bottom2: '89' },
    ], { f: 1, g: 4 })

    expect(result.candidatePool).toEqual([1, 4, 0, 2, 3, 5])
    expect(result.winningPhase).toBe('FG')
    expect(result.phases.map((phase) => phase.mode)).toEqual(['FG'])
  })

  it('หลังได้ 6 ตัว สามารถเก็บตัวที่ 7 จากงวดถัดไปที่ผ่านเงื่อนไขเดิม', () => {
    const result = collectFirstFoundWinDigits([
      { top3: '140', bottom2: '23' },
      { top3: '141', bottom2: '25' },
      { top3: '149', bottom2: '99' },
    ], { f: 1, g: 4 })

    expect(result.candidatePool).toEqual([1, 4, 0, 2, 3, 5, 9])
    expect(result.winningPhase).toBe('FG')
    expect(result.phases[0].matchedRows.map((match) => match.rowIndex)).toEqual([0, 1, 2])
  })

  it('ไม่เติมเลขจากความถี่ คะแนน การสุ่ม หรือเลขเงาเมื่อครบทุกช่วงแล้วยังไม่พอ', () => {
    let thrown
    try {
      collectFirstFoundWinDigits(
        Array.from({ length: 8 }, () => ({ top3: '111', bottom2: '11' })),
        { f: 1, g: 4 },
      )
    } catch (error) {
      thrown = error
    }

    expect(thrown).toMatchObject({ code: 'INSUFFICIENT_WIN_DIGITS' })
    expect(thrown.details.candidatePool).toEqual([1, 4])
    expect(thrown.details).not.toHaveProperty('shadowDigitsAdded')
  })

  it('วิเคราะห์ WIN6 และตัวสำรองด้วย First Found Sequential', () => {
    const result = analyzeWin6Xgen({
      draw_date: '2026-08-20',
      top3: '001',
      bottom2: '02',
      history: [
        { draw_date: '2026-08-19', top3: '123', bottom2: '45' },
        { draw_date: '2026-08-18', top3: '126', bottom2: '70' },
      ],
    })

    expect(result).toMatchObject({
      version: '5.0.0',
      f: 1,
      g: 2,
      selectionMode: 'FIRST_FOUND_SEQUENTIAL',
      candidatePool: [1, 2, 3, 4, 5, 6, 7],
      win6: [1, 2, 3, 4, 5, 6],
      reserve: 7,
      pinDigits: [1, 2, 3, 4, 5, 6],
    })
    expect(result).not.toHaveProperty('h')
    expect(result).not.toHaveProperty('usedShadowFill')
    expect(result.pin2.some((item) => item.pair.includes('7'))).toBe(false)
    expect(result.pin3.some((item) => item.triple.includes('7'))).toBe(false)
  })

  it('เจาะ 2/3 สร้างจาก WIN6 มีอย่างละ 5 ชุด', () => {
    const win6 = [6, 0, 7, 8, 3, 9]
    expect(buildPin2(win6).map((item) => item.pair)).toEqual(['60', '67', '68', '03', '09'])
    expect(buildPin3(win6).map((item) => item.triple)).toEqual(['607', '683', '089', '679', '073'])
  })

  it('เลขสำรองตัวที่ 7 ไม่ถูกนำไปสร้างเจาะ 2/3', () => {
    const win7 = [9, 4, 3, 7, 5, 2, 0]
    const pin2 = buildPin2(win7)
    const pin3 = buildPin3(win7)

    expect(pin2.map((item) => item.pair)).toEqual(['94', '93', '97', '45', '42'])
    expect(pin3.map((item) => item.triple)).toEqual(['943', '975', '472', '932', '435'])
    expect(pin2.every((item) => item.usesParenthesizedDigit === false)).toBe(true)
    expect(pin3.every((item) => item.usesParenthesizedDigit === false)).toBe(true)
  })
})
