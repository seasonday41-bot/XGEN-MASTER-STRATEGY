import { describe, expect, it } from 'vitest'
import { buildRadarPicks } from './market-radar-picks.js'

const draw = (top3, bottom2, draw_date) => ({ top3, bottom2, draw_date })

function analysisFixture() {
  return {
    state: 'FLOW',
    compressionScore: 50,
    saturation: {
      high: { value: 20 },
      even: { value: 80 },
    },
    patterns: {
      current: {
        ham: false,
        topDouble: false,
        topTriple: false,
        bottomDouble: true,
        sibling: false,
        nearSibling: false,
      },
      double: { pressure: 29, gap: 0, rate5: 20, rate20: 20 },
      ham: { pressure: 16, gap: 4, rate5: 20, rate20: 10 },
      sibling: { pressure: 18, gap: 1, rate5: 20, rate20: 20 },
      repeat: { pressure: 52, exactRate5: 0, overlapRate5: 75, currentExact: false, currentOverlap: 2 },
    },
    transitions: {
      hamToDouble: { samples: 1, hits: 0, percentage: null },
      doubleToSibling: { samples: 1, hits: 0, percentage: null },
    },
  }
}

const history = [
  draw('240', '44', '2026-08-16'),
  draw('981', '42', '2026-08-15'),
  draw('123', '40', '2026-08-14'),
  draw('678', '46', '2026-08-13'),
  draw('301', '04', '2026-08-12'),
  draw('555', '71', '2026-08-11'),
  draw('908', '82', '2026-08-10'),
  draw('112', '31', '2026-08-09'),
  draw('760', '90', '2026-08-08'),
  draw('421', '16', '2026-08-07'),
  draw('333', '25', '2026-08-06'),
  draw('654', '37', '2026-08-05'),
  draw('209', '58', '2026-08-04'),
  draw('741', '69', '2026-08-03'),
  draw('870', '73', '2026-08-02'),
  draw('456', '81', '2026-08-01'),
  draw('901', '92', '2026-07-31'),
  draw('234', '13', '2026-07-30'),
  draw('567', '24', '2026-07-29'),
  draw('890', '35', '2026-07-28'),
]

describe('buildRadarPicks', () => {
  it('turns FLOW + repeat + bottom double into concrete digits and sibling pairs', () => {
    const result = buildRadarPicks(analysisFixture(), history)
    expect(result.version).toBe('radar_candidate_v1')
    expect(result.strongDigit).toBe(4)
    expect(result.patternDigits.sibling).toEqual(expect.arrayContaining([3, 5]))
    expect(result.patternDigits.repeat).toContain(4)
    expect(result.pairPicks.map((item) => item.pair)).toEqual(expect.arrayContaining(['34', '44', '45']))
  })

  it('returns ranked core and watch lanes without pretending scores are probabilities', () => {
    const result = buildRadarPicks(analysisFixture(), history)
    expect(result.core).toHaveLength(3)
    expect(result.watch).toHaveLength(3)
    expect(result.core[0].score).toBeGreaterThanOrEqual(result.core[1].score)
    expect(result.pairPicks.length).toBeLessThanOrEqual(5)
  })
})
