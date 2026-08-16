import { describe, expect, it } from 'vitest'
import { buildNextDrawSignals } from './market-signal-interpreter.js'

function analysis(overrides = {}) {
  return {
    compressionScore: 30,
    patterns: {
      current: {
        ham: false,
        bottomDouble: false,
        sibling: false,
        nearSibling: false,
      },
      double: { pressure: 20, rate5: 0, rate20: 0, gap: 4 },
      ham: { pressure: 10, rate5: 10, rate20: 10, gap: 5 },
      sibling: { pressure: 18, rate5: 10, rate20: 10, gap: 3 },
      repeat: { pressure: 15, currentExact: false, currentOverlap: 0 },
    },
    transitions: {
      hamToDouble: { samples: 4, hits: 2, percentage: 50 },
      doubleToSibling: { samples: 4, hits: 2, percentage: 50 },
    },
    ...overrides,
  }
}

describe('buildNextDrawSignals', () => {
  it('raises a double alert when the latest top is ham', () => {
    const input = analysis()
    input.patterns.current.ham = true
    const doubleSignal = buildNextDrawSignals(input).find((item) => item.key === 'double')
    expect(doubleSignal.score).toBeGreaterThanOrEqual(55)
    expect(['ALERT', 'STRONG']).toContain(doubleSignal.level)
    expect(doubleSignal.reasons.join(' ')).toContain('DOUBLE ALERT')
  })

  it('raises sibling alert after a bottom double', () => {
    const input = analysis()
    input.patterns.current.bottomDouble = true
    const siblingSignal = buildNextDrawSignals(input).find((item) => item.key === 'sibling')
    expect(siblingSignal.score).toBeGreaterThanOrEqual(55)
    expect(['ALERT', 'STRONG']).toContain(siblingSignal.level)
  })

  it('recognizes near-sibling compression', () => {
    const input = analysis()
    input.patterns.current.nearSibling = true
    const siblingSignal = buildNextDrawSignals(input).find((item) => item.key === 'sibling')
    expect(siblingSignal.score).toBeGreaterThanOrEqual(45)
    expect(siblingSignal.reasons.join(' ')).toContain('เกือบพี่น้อง')
  })

  it('creates a strong reset alert when ham and bottom double collide', () => {
    const input = analysis()
    input.patterns.current.ham = true
    input.patterns.current.bottomDouble = true
    const signals = buildNextDrawSignals(input)
    const reset = signals.find((item) => item.key === 'reset')
    expect(reset.level).toBe('STRONG')
    expect(reset.score).toBeGreaterThanOrEqual(90)
  })
})
