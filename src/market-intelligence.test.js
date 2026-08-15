import { describe, expect, it } from 'vitest'
import { analyzeMarketIntelligence, circularDistance, classifyDraw } from './market-intelligence.js'

const draw = (top3, bottom2, draw_date = '2026-08-01') => ({ top3, bottom2, draw_date })

describe('market intelligence helpers', () => {
  it('handles circular sibling distance correctly', () => {
    expect(circularDistance(9, 0)).toBe(1)
    expect(circularDistance(8, 0)).toBe(2)
    expect(circularDistance(9, 1)).toBe(2)
  })

  it('detects ham, doubles and sibling independently', () => {
    expect(classifyDraw(draw('707', '77'))).toEqual({
      ham: true,
      topDouble: false,
      topTriple: false,
      bottomDouble: true,
      sibling: false,
      nearSibling: false,
    })
    expect(classifyDraw(draw('122', '90')).sibling).toBe(true)
  })
})

describe('analyzeMarketIntelligence', () => {
  it('reproduces the 70% high-bottom saturation example', () => {
    const history = [
      draw('479', '69', '2026-08-16'),
      draw('351', '69', '2026-08-15'),
      draw('240', '71', '2026-08-14'),
      draw('118', '62', '2026-08-13'),
      draw('325', '48', '2026-08-12'),
      draw('794', '56', '2026-08-11'),
      draw('674', '12', '2026-08-10'),
      draw('483', '61', '2026-08-09'),
      draw('718', '25', '2026-08-08'),
      draw('105', '66', '2026-08-07'),
    ]

    const result = analyzeMarketIntelligence(history)
    expect(result.saturation.high.value).toBe(70)
    expect(result.patterns.repeat.currentExact).toBe(true)
    expect(result.saturation.leadingDigits[0].digit).toBe(6)
    expect(result.mode).toBe('SHADOW')
  })

  it('keeps output bounded and exposes expert mix summing to 100', () => {
    const history = Array.from({ length: 20 }, (_, index) => draw(
      `${(index + 1) % 10}${(index + 2) % 10}${(index + 3) % 10}`,
      `${(index + 4) % 10}${(index + 5) % 10}`,
      `2026-07-${String(20 - index).padStart(2, '0')}`,
    ))
    const result = analyzeMarketIntelligence(history)
    expect(result.shiftScore).toBeGreaterThanOrEqual(0)
    expect(result.shiftScore).toBeLessThanOrEqual(100)
    expect(Object.values(result.expertWeights).reduce((sum, value) => sum + value, 0)).toBe(100)
  })
})
