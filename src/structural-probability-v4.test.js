import { describe, expect, it } from 'vitest'
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

const canonical = (value) => value.split('').sort().join('')

function expectUniqueCombinations(items, key) {
  const keys = items.map((item) => canonical(item[key]))
  expect(new Set(keys).size).toBe(items.length)
}

describe('STRUCTURAL v4.1 no reverse picks', () => {
  it('keeps five top and bottom pairs without reverse duplicates', () => {
    const result = analyzeStructuralProbabilityV4(history, { includeBacktest: false })
    expect(result.pin2Top).toHaveLength(5)
    expect(result.pin2Bottom).toHaveLength(5)
    expectUniqueCombinations(result.pin2Top, 'pair')
    expectUniqueCombinations(result.pin2Bottom, 'pair')
  })

  it('builds five normal triples with distinct digits and no permutation duplicates', () => {
    const result = analyzeStructuralProbabilityV4(history, { includeBacktest: false })
    expect(result.pin3Normal).toHaveLength(5)
    result.pin3Normal.forEach(({ triple }) => {
      expect(new Set(triple.split('')).size).toBe(3)
    })
    expectUniqueCombinations(result.pin3Normal, 'triple')
  })

  it('builds five double triples as AAB or ABB without reversed structure duplicates', () => {
    const result = analyzeStructuralProbabilityV4(history, { includeBacktest: false })
    expect(result.pin3Double).toHaveLength(5)
    result.pin3Double.forEach(({ triple }) => {
      const [a, b, c] = triple.split('')
      expect((a === b && b !== c) || (b === c && a !== b)).toBe(true)
      expect(a === c && a !== b).toBe(false)
    })
    expectUniqueCombinations(result.pin3Double, 'triple')
  })

  it('reports combination-based walk-forward metrics', () => {
    const result = analyzeStructuralProbabilityV4(history, { includeBacktest: true, maxBacktest: 5 })
    expect(result.backtest.samples).toBe(5)
    for (const key of ['pin2TopPair', 'pin2BottomPair', 'pin3NormalPermutation', 'pin3DoublePermutation']) {
      expect(result.backtest.metrics[key]).toBeGreaterThanOrEqual(0)
      expect(result.backtest.metrics[key]).toBeLessThanOrEqual(100)
    }
  })
})
