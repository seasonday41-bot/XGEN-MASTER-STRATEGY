import { describe, expect, it } from 'vitest'
import { analyzeStructuralProbabilityV5 } from './structural-probability-v5.js'
import { analyzeStructuralProbabilityV6 } from './structural-probability-v6.js'
import { classifyStructuralPatternV2 } from './structural-probability-v2.js'

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

function matchesPattern(triple, type) {
  const p = classifyStructuralPatternV2({ top3: triple, bottom2: '00' })
  if (type === 'DOUBLE') return p.doubleFront || p.doubleBack
  if (type === 'HAM') return p.ham
  if (type === 'TRIPLE') return p.triple
  if (type === 'SIBLING') return p.sibling && !p.doubleFront && !p.doubleBack && !p.ham && !p.triple
  return p.category === 'NORMAL'
}

describe('STRUCTURAL v6 WIN6 pattern picks', () => {
  it('keeps the original WIN6 and does not apply MOD0', () => {
    const v5 = analyzeStructuralProbabilityV5(history, { includeBacktest: false })
    const v6 = analyzeStructuralProbabilityV6(history, { includeBacktest: false })
    expect(v6.version).toBe('v6.0-win6-pattern-picks')
    expect(v6.pickPolicy).toBe('WIN6_PATTERN_ONLY')
    expect(v6.win6).toEqual(v5.win6)
  })

  it('builds every 2-digit pick only from WIN6', () => {
    const result = analyzeStructuralProbabilityV6(history, { includeBacktest: false })
    const win = new Set(result.win6.map(String))
    ;[...result.pin2Top, ...result.pin2Bottom].forEach(({ pair }) => {
      pair.split('').forEach((digit) => expect(win.has(digit)).toBe(true))
    })
  })

  it('builds every 3-digit pick from WIN6 and selected pattern', () => {
    const result = analyzeStructuralProbabilityV6(history, { includeBacktest: false })
    const win = new Set(result.win6.map(String))
    expect(result.pin3Pattern.length).toBeGreaterThan(0)
    result.pin3Pattern.forEach(({ triple }) => {
      triple.split('').forEach((digit) => expect(win.has(digit)).toBe(true))
      expect(matchesPattern(triple, result.pickPattern.type)).toBe(true)
    })
  })

  it('keeps no-reverse / no-permutation duplicate policy', () => {
    const result = analyzeStructuralProbabilityV6(history, { includeBacktest: false })
    expect(new Set(result.pin2Top.map((item) => canonical(item.pair))).size).toBe(result.pin2Top.length)
    expect(new Set(result.pin2Bottom.map((item) => canonical(item.pair))).size).toBe(result.pin2Bottom.length)
    expect(new Set(result.pin3Pattern.map((item) => canonical(item.triple))).size).toBe(result.pin3Pattern.length)
  })

  it('runs no-lookahead walk-forward for the new pick policy', () => {
    const result = analyzeStructuralProbabilityV6(history, { includeBacktest: true, maxBacktest: 10 })
    expect(result.backtest.samples).toBe(10)
    const keys = ['win6TopFull', 'win6BottomFull', 'pin2TopPair', 'pin2BottomPair', 'pin3PatternPermutation', 'patternTypeHit']
    keys.forEach((key) => {
      expect(result.backtest.metrics[key]).toBeGreaterThanOrEqual(0)
      expect(result.backtest.metrics[key]).toBeLessThanOrEqual(100)
    })
  })
})
