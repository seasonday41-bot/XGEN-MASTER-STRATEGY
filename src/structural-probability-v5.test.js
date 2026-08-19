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

const chinaAfternoon = [
  ['2026-08-18', '250', '77'],
  ['2026-08-17', '427', '96'],
  ['2026-08-14', '431', '87'],
  ['2026-08-13', '944', '99'],
  ['2026-08-12', '443', '99'],
  ['2026-08-11', '944', '52'],
  ['2026-08-10', '696', '95'],
  ['2026-08-07', '101', '89'],
  ['2026-08-06', '012', '08'],
  ['2026-08-05', '420', '49'],
  ['2026-08-04', '571', '42'],
  ['2026-08-03', '829', '64'],
  ['2026-07-31', '893', '13'],
  ['2026-07-30', '580', '64'],
  ['2026-07-29', '844', '76'],
  ['2026-07-28', '968', '05'],
  ['2026-07-27', '873', '05'],
  ['2026-07-24', '468', '63'],
  ['2026-07-23', '331', '87'],
].map(([draw_date, top3, bottom2]) => ({ draw_date, top3, bottom2 }))

const canonical = (value) => String(value).split('').sort().join('')

describe('STRUCTURAL v5.4 matrix challenger', () => {
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

  it('builds six-digit gates independently for every number position', () => {
    const result = analyzeStructuralProbabilityV5(chinaAfternoon, { includeBacktest: false })
    expect(result.version).toBe('v5.4-matrix-challenger')
    expect(result.positionGateSize).toBe(6)
    expect(result.positionGates.top.hundreds).toHaveLength(6)
    expect(result.positionGates.top.tens).toHaveLength(6)
    expect(result.positionGates.top.units).toHaveLength(6)
    expect(result.positionGates.bottom.tens).toHaveLength(6)
    expect(result.positionGates.bottom.units).toHaveLength(6)
  })

  it('keeps the 015-35 digits alive in their own positions before final pick ranking', () => {
    const result = analyzeStructuralProbabilityV5(chinaAfternoon, { includeBacktest: false })
    expect(result.positionGates.top.hundreds).toContain(0)
    expect(result.positionGates.top.tens).toContain(1)
    expect(result.positionGates.top.units).toContain(5)
    expect(result.positionGates.bottom.tens).toContain(3)
    expect(result.positionGates.bottom.units).toContain(5)
  })

  it('only creates champion picks from digits allowed by each position gate', () => {
    const result = analyzeStructuralProbabilityV5(chinaAfternoon, { includeBacktest: false })
    const topTens = new Set(result.positionGates.top.tens)
    const topUnits = new Set(result.positionGates.top.units)
    const bottomTens = new Set(result.positionGates.bottom.tens)
    const bottomUnits = new Set(result.positionGates.bottom.units)
    const hundreds = new Set(result.positionGates.top.hundreds)

    result.pin2Top.forEach(({ pair }) => {
      expect(topTens.has(Number(pair[0]))).toBe(true)
      expect(topUnits.has(Number(pair[1]))).toBe(true)
    })
    result.pin2Bottom.forEach(({ pair }) => {
      expect(bottomTens.has(Number(pair[0]))).toBe(true)
      expect(bottomUnits.has(Number(pair[1]))).toBe(true)
    })
    result.pin3Normal.forEach(({ triple }) => {
      expect(hundreds.has(Number(triple[0]))).toBe(true)
      expect(topTens.has(Number(triple[1]))).toBe(true)
      expect(topUnits.has(Number(triple[2]))).toBe(true)
    })
  })

  it('builds matrix challenger without hard locks', () => {
    const result = analyzeStructuralProbabilityV5(chinaAfternoon, { includeBacktest: false })
    const matrix = result.matrixChallenger
    expect(matrix.version).toBe('matrix-v1-adaptive-score')
    expect(matrix.policy).toBe('SCORE_ONLY_NO_HARD_LOCK')
    expect(matrix.pin2Top.length).toBeGreaterThan(0)
    expect(matrix.pin2Bottom.length).toBeGreaterThan(0)
    expect(matrix.pin3Normal.length).toBeGreaterThan(0)
    expect(matrix.pin3Ham.length).toBeGreaterThan(0)
    expect(matrix.pin3Double.length).toBeGreaterThan(0)
    expect(matrix.pin2Top.length).toBeLessThanOrEqual(5)
    expect(matrix.pin3Normal.length).toBeLessThanOrEqual(5)
  })

  it('matrix scores expose position, missing, polarity/gap and shape evidence', () => {
    const result = analyzeStructuralProbabilityV5(chinaAfternoon, { includeBacktest: false })
    const pair = result.matrixChallenger.pin2Top[0]
    const triple = result.matrixChallenger.pin3Normal[0]
    expect(Object.keys(pair.components)).toEqual(['position', 'missing', 'polarity', 'gap'])
    expect(Object.keys(triple.components)).toEqual(['position', 'shape', 'transition', 'step'])
    Object.values(pair.components).forEach((value) => expect(Number.isFinite(value)).toBe(true))
    Object.values(triple.components).forEach((value) => expect(Number.isFinite(value)).toBe(true))
  })

  it('keeps no-reverse pick policy for champion and challenger', () => {
    const result = analyzeStructuralProbabilityV5(history, { includeBacktest: false })
    const lists = [
      result.pin2Top.map((item) => item.pair),
      result.pin2Bottom.map((item) => item.pair),
      result.pin3Normal.map((item) => item.triple),
      result.pin3Double.map((item) => item.triple),
      result.matrixChallenger.pin2Top.map((item) => item.pair),
      result.matrixChallenger.pin2Bottom.map((item) => item.pair),
      result.matrixChallenger.pin3Normal.map((item) => item.triple),
      result.matrixChallenger.pin3Ham.map((item) => item.triple),
      result.matrixChallenger.pin3Double.map((item) => item.triple),
    ]
    lists.forEach((items) => expect(new Set(items.map(canonical)).size).toBe(items.length))
  })

  it('classifies all digits into market pulse states', () => {
    const result = analyzeStructuralProbabilityV5(history, { includeBacktest: false })
    expect(Object.keys(result.marketPulse)).toEqual(['HOT', 'RETURNING', 'WARM', 'COLD'])
    const digits = Object.values(result.marketPulse).flat().map((item) => item.digit)
    expect(new Set(digits).size).toBe(10)
  })

  it('runs same-sample walk-forward for champion and matrix challenger', () => {
    const result = analyzeStructuralProbabilityV5(history, { includeBacktest: true, maxBacktest: 10 })
    expect(result.backtest.samples).toBe(10)
    const keys = [
      'pin2TopPair',
      'pin2BottomPair',
      'pin3NormalPermutation',
      'pin3DoublePermutation',
      'matrixPin2TopPair',
      'matrixPin2BottomPair',
      'matrixPin3NormalPermutation',
      'matrixPin3HamPermutation',
      'matrixPin3DoublePermutation',
    ]
    keys.forEach((key) => {
      expect(result.backtest.metrics[key]).toBeGreaterThanOrEqual(0)
      expect(result.backtest.metrics[key]).toBeLessThanOrEqual(100)
    })
  })
})
