import { describe, expect, it } from 'vitest'
import { analyzeStructuralProbabilityV3 } from './structural-probability-v3.js'
import { analyzeStructuralProbabilityV4 } from './structural-probability-v4.js'

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

describe('STRUCTURAL v4 triple split', () => {
  it('keeps existing pair picks unchanged', () => {
    const v3 = analyzeStructuralProbabilityV3(history, { includeBacktest: false })
    const v4 = analyzeStructuralProbabilityV4(history, { includeBacktest: false })
    expect(v4.pin2Top).toEqual(v3.pin2Top)
    expect(v4.pin2Bottom).toEqual(v3.pin2Bottom)
    expect(v4.win6).toEqual(v3.win6)
    expect(v4.reserve).toBe(v3.reserve)
  })

  it('builds five normal triples with three distinct digits', () => {
    const result = analyzeStructuralProbabilityV4(history, { includeBacktest: false })
    expect(result.pin3Normal).toHaveLength(5)
    result.pin3Normal.forEach(({ triple }) => {
      expect(new Set(triple.split('')).size).toBe(3)
    })
  })

  it('builds five double triples as AAB or ABB, never ABA', () => {
    const result = analyzeStructuralProbabilityV4(history, { includeBacktest: false })
    expect(result.pin3Double).toHaveLength(5)
    result.pin3Double.forEach(({ triple }) => {
      const [a, b, c] = triple.split('')
      expect((a === b && b !== c) || (b === c && a !== b)).toBe(true)
      expect(a === c && a !== b).toBe(false)
    })
  })

  it('adds separate walk-forward metrics for normal and double triples', () => {
    const result = analyzeStructuralProbabilityV4(history, { includeBacktest: true, maxBacktest: 5 })
    expect(result.backtest.samples).toBe(5)
    expect(result.backtest.metrics.pin3NormalPermutation).toBeGreaterThanOrEqual(0)
    expect(result.backtest.metrics.pin3NormalPermutation).toBeLessThanOrEqual(100)
    expect(result.backtest.metrics.pin3DoublePermutation).toBeGreaterThanOrEqual(0)
    expect(result.backtest.metrics.pin3DoublePermutation).toBeLessThanOrEqual(100)
  })
})
