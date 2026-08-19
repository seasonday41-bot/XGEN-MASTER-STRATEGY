import { describe, expect, it } from 'vitest'
import {
  analyzeStructuralProbabilityV6,
  selectMod0Win6FromRanking,
  selectWin7RescueDigit,
} from './structural-probability-v6.js'
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
const sum = (digits) => digits.reduce((total, digit) => total + digit, 0)

function matchesPattern(triple, type) {
  const p = classifyStructuralPatternV2({ top3: triple, bottom2: '00' })
  if (type === 'DOUBLE') return p.doubleFront || p.doubleBack
  if (type === 'HAM') return p.ham
  if (type === 'TRIPLE') return p.triple
  if (type === 'SIBLING') return p.sibling && !p.doubleFront && !p.doubleBack && !p.ham && !p.triple
  return p.category === 'NORMAL'
}

describe('STRUCTURAL v6.2 WIN7 rescue pattern picks', () => {
  it('reproduces the ranked MOD0 example with minimum replacement', () => {
    const ranking = [0, 6, 5, 7, 9, 4, 1, 8, 3, 2]
      .map((digit, index) => ({ digit, score: 100 - index }))
    const result = selectMod0Win6FromRanking(ranking)

    expect(result.baseWin6).toEqual([0, 6, 5, 7, 9, 4])
    expect(result.primary.digits).toEqual([0, 6, 5, 7, 4, 8])
    expect(result.reserve.digits).toEqual([0, 6, 5, 7, 9, 3])
    expect(result.primary.replacements).toBe(1)
    expect(result.reserve.replacements).toBe(1)
    expect(result.primary.sum % 10).toBe(0)
    expect(result.reserve.sum % 10).toBe(0)
  })

  it('chooses the highest-ranked digit outside MOD0 primary as rescue', () => {
    const ranking = [9, 6, 4, 1, 3, 7, 0, 8, 5, 2]
      .map((digit, index) => ({ digit, score: 100 - index }))
    expect(selectWin7RescueDigit(ranking, [9, 6, 4, 1, 3, 7])).toBe(0)
  })

  it('keeps six MOD0 digits and adds one rescue digit as WIN7', () => {
    const result = analyzeStructuralProbabilityV6(history, { includeBacktest: false })
    const expectedRescue = result.rankings.fusion.find((item) => !result.win6.includes(item.digit))?.digit ?? null

    expect(result.version).toBe('v6.2-win7-rescue-pattern-picks')
    expect(result.pickPolicy).toBe('WIN7_RESCUE_PATTERN_ONLY')
    expect(result.win6).toHaveLength(6)
    expect(sum(result.win6) % 10).toBe(0)
    expect(result.rescueDigit).toBe(expectedRescue)
    expect(result.win7).toEqual([...result.win6, result.rescueDigit])
    expect(result.win7).toHaveLength(7)
    expect(new Set(result.win7).size).toBe(7)
    expect(result.pickPool).toEqual(result.win7)
  })

  it('allows all 7 digits, including rescue, to be used by 2-digit picks', () => {
    const result = analyzeStructuralProbabilityV6(history, { includeBacktest: false })
    const pool = new Set(result.win7.map(String))
    ;[...result.pin2Top, ...result.pin2Bottom].forEach(({ pair }) => {
      pair.split('').forEach((digit) => expect(pool.has(digit)).toBe(true))
    })
  })

  it('builds every 3-digit pick from WIN7 and selected pattern', () => {
    const result = analyzeStructuralProbabilityV6(history, { includeBacktest: false })
    const pool = new Set(result.win7.map(String))
    expect(result.pin3Pattern.length).toBeGreaterThan(0)
    result.pin3Pattern.forEach(({ triple }) => {
      triple.split('').forEach((digit) => expect(pool.has(digit)).toBe(true))
      expect(matchesPattern(triple, result.pickPattern.type)).toBe(true)
    })
  })

  it('keeps no-reverse / no-permutation duplicate policy', () => {
    const result = analyzeStructuralProbabilityV6(history, { includeBacktest: false })
    expect(new Set(result.pin2Top.map((item) => canonical(item.pair))).size).toBe(result.pin2Top.length)
    expect(new Set(result.pin2Bottom.map((item) => canonical(item.pair))).size).toBe(result.pin2Bottom.length)
    expect(new Set(result.pin3Pattern.map((item) => canonical(item.triple))).size).toBe(result.pin3Pattern.length)
  })

  it('runs no-lookahead comparison for base, MOD0 and WIN7 rescue coverage', () => {
    const result = analyzeStructuralProbabilityV6(history, { includeBacktest: true, maxBacktest: 10 })
    expect(result.backtest.samples).toBe(10)
    const keys = [
      'baseTop3', 'baseTop2', 'baseTop1',
      'mod0Top3', 'mod0Top2', 'mod0Top1',
      'win7Top3', 'win7Top2', 'win7Top1',
      'mod0EitherTop3', 'win6TopFull', 'win7TopFull', 'win6BottomFull', 'win7BottomFull',
      'pin2TopPair', 'pin2BottomPair', 'pin3PatternPermutation', 'patternTypeHit',
    ]
    keys.forEach((key) => {
      expect(result.backtest.metrics[key]).toBeGreaterThanOrEqual(0)
      expect(result.backtest.metrics[key]).toBeLessThanOrEqual(100)
    })
    expect(Object.values(result.backtest.topCoverage.base).reduce((a, b) => a + b, 0)).toBe(10)
    expect(Object.values(result.backtest.topCoverage.mod0Primary).reduce((a, b) => a + b, 0)).toBe(10)
    expect(Object.values(result.backtest.topCoverage.win7).reduce((a, b) => a + b, 0)).toBe(10)
  })
})
