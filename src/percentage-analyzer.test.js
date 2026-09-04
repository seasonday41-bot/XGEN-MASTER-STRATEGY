import { describe, expect, it } from 'vitest'
import {
  analyzePercentageHistory,
  buildPublicCopy,
  calculatePercentDigits,
  classifyHundreds,
  evaluateCalculatedDigits,
} from './percentage-analyzer.js'

describe('percentage analyzer', () => {
  it('keeps duplicate and trailing zero digits from the calculated result', () => {
    expect(calculatePercentDigits('030', 7)).toMatchObject({
      formatted: '2.10',
      digits: [2, 1, 0],
    })
    expect(calculatePercentDigits('866', 8)).toMatchObject({
      formatted: '69.28',
      digits: [6, 9, 2, 8],
    })
  })

  it('requires two matches on the same side and never combines top one + bottom one', () => {
    const miss = evaluateCalculatedDigits([5, 7], { top3: '592', bottom2: '65' })
    expect(miss.topMatched).toEqual([5])
    expect(miss.bottomMatched).toEqual([5])
    expect(miss.topHit).toBe(false)
    expect(miss.bottomHit).toBe(false)
    expect(miss.anyHit).toBe(false)

    const hit = evaluateCalculatedDigits([6, 2, 0, 2], { top3: '222', bottom2: '22' })
    expect(hit.topHit).toBe(true)
    expect(hit.bottomHit).toBe(true)
    expect(hit.bothHit).toBe(true)
  })

  it('classifies the hundreds digit into four groups', () => {
    expect(classifyHundreds('227').key).toBe('even-low')
    expect(classifyHundreds('866').key).toBe('even-high')
    expect(classifyHundreds('389').key).toBe('odd-low')
    expect(classifyHundreds('970').key).toBe('odd-high')
  })

  it('groups a transition by the source draw weekday and keeps the next market draw as target', () => {
    const rows = [
      { draw_date: '2026-08-31', top3: '389', bottom2: '43' },
      { draw_date: '2026-09-01', top3: '659', bottom2: '96' },
      { draw_date: '2026-09-02', top3: '920', bottom2: '69' },
    ]
    const analysis = analyzePercentageHistory(rows)

    expect(analysis.transitions).toHaveLength(2)
    expect(analysis.transitions[0].dayLabel).toBe('จันทร์')
    expect(analysis.transitions[0].next.top3).toBe('659')
    expect(analysis.transitions[1].dayLabel).toBe('อังคาร')
  })

  it('builds a fusion win from all three calculations and keeps public copy free of formulas', () => {
    const rows = [
      { draw_date: '2026-09-01', top3: '475', bottom2: '84' },
      { draw_date: '2026-09-02', top3: '351', bottom2: '53' },
      { draw_date: '2026-09-03', top3: '088', bottom2: '50' },
    ]
    const analysis = analyzePercentageHistory(rows)
    const fusion = analysis.recommendation.fusion

    expect(fusion.win7.length).toBeGreaterThanOrEqual(6)
    expect(new Set(fusion.win7).size).toBe(fusion.win7.length)
    expect(fusion.pairs.length).toBeGreaterThan(0)

    const text = buildPublicCopy({
      marketName: 'ตลาดทดลอง',
      latest: analysis.recommendation.latest,
      fusion,
    })

    expect(text).toContain('XGEN LAB')
    expect(text).toContain('WIN7')
    expect(text).not.toContain('%')
    expect(text).not.toContain('×')
    expect(text).not.toContain('DAY MODEL')
    expect(text).not.toContain('NUMBER MODEL')
  })
})
