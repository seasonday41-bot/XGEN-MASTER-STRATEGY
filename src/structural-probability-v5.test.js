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

describe('STRUCTURAL v5.1 five-draw frequency', () => {
  it('uses only the latest five draws for frequency', () => {
    const result = analyzeStructuralProbabilityV5(history, { includeBacktest: false })
    expect(result.frequencyWindow).toBe(5)
    expect(result.frequencyWeights).toEqual({ 5: 1 })
  })

  it('older draws cannot change the frequency component when the latest five stay the same', () => {
    const changedOlder = history.map((draw, index) => index < 5 ? draw : { ...draw, top3: '999', bottom2: '99' })
    const left = analyzeStructuralProbabilityV5(history, { includeBacktest: false })
    const right = analyzeStructuralProbabilityV5(changedOlder, { includeBacktest: false })
    const leftFrequency = Object.fromEntries(left.rankings.all.map((item) => [item.digit, item.components.frequency]))
    const rightFrequency = Object.fromEntries(right.rankings.all.map((item) => [item.digit, item.components.frequency]))
    expect(rightFrequency).toEqual(leftFrequency)
  })

  it('keeps older draws available to structural evidence', () => {
    const result = analyzeStructuralProbabilityV5(history, { includeBacktest: false })
    expect(result.sampleSize).toBe(history.length)
    expect(result.transition.samples).toBeGreaterThanOrEqual(0)
    expect(result.mirror.samples).toBeGreaterThanOrEqual(0)
  })

  it('classifies all digits into market pulse states', () => {
    const result = analyzeStructuralProbabilityV5(history, { includeBacktest: false })
    expect(Object.keys(result.marketPulse)).toEqual(['HOT', 'RETURNING', 'WARM', 'COLD'])
    const digits = Object.values(result.marketPulse).flat().map((item) => item.digit)
    expect(new Set(digits).size).toBe(10)
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
