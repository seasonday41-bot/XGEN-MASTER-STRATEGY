import { describe, expect, it } from 'vitest'
import {
  analyzeStructuralProbabilityV2,
  classifyStructuralPatternV2,
  walkForwardBacktestV2,
} from './structural-probability-v2.js'

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

describe('STRUCTURAL PROBABILITY v2 PATTERN SIGNALS', () => {
  it('จำแนกเบิ้ล หาม ตอง และพี่น้องได้แยกกัน', () => {
    expect(classifyStructuralPatternV2({ top3: '118', bottom2: '01' }).doubleFront).toBe(true)
    expect(classifyStructuralPatternV2({ top3: '272', bottom2: '39' }).ham).toBe(true)
    expect(classifyStructuralPatternV2({ top3: '777', bottom2: '11' }).triple).toBe(true)
    expect(classifyStructuralPatternV2({ top3: '214', bottom2: '94' })).toMatchObject({
      category: 'SIBLING',
      siblingAB: true,
      sibling: true,
    })
    expect(classifyStructuralPatternV2({ top3: '581', bottom2: '45' }).bottomSibling).toBe(true)
  })

  it('สร้างสัญญาณ 4 แบบพร้อม Structural Rate และสถานะ', () => {
    const result = analyzeStructuralProbabilityV2(history, { includeBacktest: false })
    expect(result.patternSignals.map((item) => item.type).sort()).toEqual(['DOUBLE', 'HAM', 'SIBLING', 'TRIPLE'])
    result.patternSignals.forEach((item) => {
      expect(item.score).toBeGreaterThanOrEqual(0)
      expect(item.score).toBeLessThanOrEqual(100)
      expect(['เด่น', 'เฝ้าดู', 'ต่ำ']).toContain(item.status)
      expect(item.baselineSamples).toBe(20)
    })
  })

  it('ยังรักษา Gap TOP/BOTTOM/ALL และ WIN6 แยกบนล่าง', () => {
    const result = analyzeStructuralProbabilityV2(history, { includeBacktest: false })
    expect(result.rankings.top.find((item) => item.digit === 0).gap).toBe(16)
    expect(result.rankings.bottom.find((item) => item.digit === 8).gap).toBe(10)
    expect(result.rankings.all.find((item) => item.digit === 5).gap).toBe(4)
    expect(new Set(result.win6).size).toBe(6)
    expect(new Set(result.topWin6).size).toBe(6)
    expect(new Set(result.bottomWin6).size).toBe(6)
  })

  it('Walk-forward แยกจำนวนครั้งที่มี Pattern Forecast ก่อนคิด hit rate', () => {
    const backtest = walkForwardBacktestV2(history, 10)
    expect(backtest.samples).toBe(10)
    expect(backtest.patternForecastSamples).toBeGreaterThanOrEqual(0)
    expect(backtest.patternForecastSamples).toBeLessThanOrEqual(10)
    if (backtest.metrics.patternHit !== null) {
      expect(backtest.metrics.patternHit).toBeGreaterThanOrEqual(0)
      expect(backtest.metrics.patternHit).toBeLessThanOrEqual(100)
    }
  })
})
