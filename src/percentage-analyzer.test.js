import { describe, expect, it } from 'vitest'
import {
  analyzePercentageHistory,
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
})
