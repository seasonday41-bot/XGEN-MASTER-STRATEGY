import { describe, expect, it } from 'vitest'
import { analyzeStructuralProbabilityV5 } from './structural-probability-v5.js'

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

const canonical = (value) => String(value).split('').sort().join('')

describe('STRUCTURAL v5 adaptive frequency', () => {
  it('uses fast-market frequency weights', () => {
    const result = analyzeStructuralProbabilityV5(history, { includeBacktest: false })
    expect(result.frequencyWeights).toEqual({ 5: 0.60, 10: 0.25, 15: 0.10, 30: 0.05 })
  })

  it('classifies all digits into market pulse states', () => {
    const result = analyzeStructuralProbabilityV5(history, { includeBacktest: false })
    expect(Object.keys(result.marketPulse)).toEqual(['HOT', 'RETURNING', 'WARM', 'COLD'])
    const digits = Object.values(result.marketPulse).flat().map((item) => item.digit)
    expect(new Set(digits).size).toBe(10)
    result.rankings.all.forEach((item) => {
      expect(['HOT', 'RETURNING', 'WARM', 'COLD']).toContain(item.trendState)
      expect(item.components.trend).toBeGreaterThanOrEqual(0)
      expect(item.components.trend).toBeLessThanOrEqual(100)
    })
  })

  it('keeps no-reverse pick policy', () => {
    const result = analyzeStructuralProbabilityV5(history, { includeBacktest: false })
    expect(new Set(result.pin2Top.map((item) => canonical(item.pair))).size).toBe(result.pin2Top.length)
    expect(new Set(result.pin2Bottom.map((item) => canonical(item.pair))).size).toBe(result.pin2Bottom.length)
    expect(new Set(result.pin3Normal.map((item) => canonical(item.triple))).size).toBe(result.pin3Normal.length)
    expect(new Set(result.pin3Double.map((item) => canonical(item.triple))).size).toBe(result.pin3Double.length)
  })

  it('runs 10-draw walk-forward when enough history exists', () => {
    const result = analyzeStructuralProbabilityV5(history, { includeBacktest: true, maxBacktest: 10 })
    expect(result.backtest.samples).toBe(10)
    expect(result.backtest.metrics.rudTop).toBeGreaterThanOrEqual(0)
    expect(result.backtest.metrics.rudTop).toBeLessThanOrEqual(100)
    expect(result.backtest.metrics.pin3NormalPermutation).toBeGreaterThanOrEqual(0)
    expect(result.backtest.metrics.pin3NormalPermutation).toBeLessThanOrEqual(100)
  })
})
