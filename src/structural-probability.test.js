import { describe, expect, it } from 'vitest'
import {
  analyzeStructuralProbability,
  classifyStructuralPattern,
  walkForwardBacktest,
} from './structural-probability.js'

const history = [
  ['2026-08-19', '214', '94'],
  ['2026-08-18', '968', '93'],
  ['2026-08-17', '112', '01'],
  ['2026-08-16', '272', '39'],
  ['2026-08-15', '552', '32'],
  ['2026-08-14', '118', '01'],
  ['2026-08-13', '843', '51'],
  ['2026-08-12', '734', '27'],
  ['2026-08-11', '572', '67'],
  ['2026-08-10', '488', '49'],
  ['2026-08-09', '254', '81'],
  ['2026-08-08', '587', '45'],
  ['2026-08-07', '244', '93'],
  ['2026-08-06', '487', '64'],
  ['2026-08-05', '755', '39'],
  ['2026-08-04', '767', '34'],
  ['2026-08-03', '056', '54'],
  ['2026-08-02', '009', '86'],
  ['2026-08-01', '517', '25'],
  ['2026-07-31', '303', '28'],
  ['2026-07-30', '106', '64'],
].map(([draw_date, top3, bottom2]) => ({ draw_date, top3, bottom2 }))

describe('STRUCTURAL PROBABILITY', () => {
  it('จำแนกเบิ้ล หาม และเก็บเลขศูนย์นำหน้าได้', () => {
    expect(classifyStructuralPattern({ top3: '118', bottom2: '01' }).category).toBe('DOUBLE_FRONT')
    expect(classifyStructuralPattern({ top3: '272', bottom2: '39' }).category).toBe('HAM')
    expect(classifyStructuralPattern({ top3: '755', bottom2: '09' }).category).toBe('DOUBLE_BACK')
  })

  it('แยก Gap ของ TOP / BOTTOM / ALL จริง', () => {
    const result = analyzeStructuralProbability(history, { includeBacktest: false })
    expect(result.rankings.top.find((item) => item.digit === 0).gap).toBe(16)
    expect(result.rankings.bottom.find((item) => item.digit === 8).gap).toBe(10)
    expect(result.rankings.all.find((item) => item.digit === 5).gap).toBe(4)
  })

  it('สร้าง WIN6 ไม่ซ้ำและแยกบนล่าง', () => {
    const result = analyzeStructuralProbability(history, { includeBacktest: false })
    expect(result.win6).toHaveLength(6)
    expect(result.topWin6).toHaveLength(6)
    expect(result.bottomWin6).toHaveLength(6)
    expect(new Set(result.win6).size).toBe(6)
    expect(new Set(result.topWin6).size).toBe(6)
    expect(new Set(result.bottomWin6).size).toBe(6)
    expect(result.pin2Top).toHaveLength(5)
    expect(result.pin2Bottom).toHaveLength(5)
    expect(result.pin3).toHaveLength(5)
  })

  it('ไม่บังคับ Pattern Forecast เมื่อ sample ต่ำ', () => {
    const result = analyzeStructuralProbability(history, { includeBacktest: false })
    expect(result.transition.samples).toBe(3)
    expect(result.patternForecast).toBeNull()
  })

  it('Walk-forward ใช้เฉพาะงวดเก่ากว่าเป้าหมายและรายงาน sample', () => {
    const backtest = walkForwardBacktest(history, 10)
    expect(backtest.samples).toBe(10)
    Object.values(backtest.metrics).forEach((value) => {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(100)
    })
  })
})
