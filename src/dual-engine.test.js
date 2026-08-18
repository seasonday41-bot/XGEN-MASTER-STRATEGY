import { describe, expect, it } from 'vitest'
import { analyzePercentCore } from './formula.js'
import { analyzeMarketIntelligence } from './market-intelligence.js'
import { buildDualSystems, buildPin3FromSystem } from './dual-engine.js'
import { buildStatisticalMotion } from './statistical-motion.js'
import { evaluateSystem } from './forward-ab.js'

const draw = (top3, bottom2, draw_date) => ({ top3, bottom2, draw_date })

const history = [
  draw('928', '13', '2026-08-16'),
  draw('988', '42', '2026-08-15'),
  draw('713', '34', '2026-08-14'),
  draw('017', '65', '2026-08-13'),
  draw('302', '16', '2026-08-12'),
  draw('700', '72', '2026-08-11'),
  draw('737', '40', '2026-08-10'),
  draw('674', '38', '2026-08-09'),
  draw('670', '96', '2026-08-08'),
  draw('718', '97', '2026-08-07'),
  draw('606', '36', '2026-08-06'),
  draw('030', '30', '2026-08-05'),
  draw('238', '62', '2026-08-04'),
  draw('767', '97', '2026-08-03'),
  draw('413', '02', '2026-08-02'),
  draw('185', '13', '2026-08-01'),
  draw('429', '83', '2026-07-31'),
  draw('417', '94', '2026-07-30'),
  draw('483', '69', '2026-07-29'),
  draw('088', '07', '2026-07-28'),
]

function percentCoreBase(source) {
  const core = analyzePercentCore(source)
  return {
    ...core,
    rud: [...core.strong],
    strongDigit: { digit: core.strong[0] },
  }
}

describe('Statistical Motion', () => {
  it('exposes describe-style statistics for 3/5/10/20/30 windows', () => {
    const motion = buildStatisticalMotion(history)
    expect(motion.windows[3].count).toBe(15)
    expect(motion.windows[5].count).toBe(25)
    expect(motion.windows[20].count).toBe(100)
    expect(motion.windows[30].count).toBe(100)
    expect(motion.rankedDigits).toHaveLength(10)
    expect(['STABLE', 'UP_SHIFT', 'DOWN_SHIFT', 'COMPRESSION', 'EXPANSION']).toContain(motion.state)
  })
})

describe('Dual Engine compatibility', () => {
  it('can consume the latest-draw Percent Core base without calling legacy history formula', () => {
    const base = percentCoreBase(history[0])
    const intelligence = analyzeMarketIntelligence(history)
    const dual = buildDualSystems(base, intelligence, history)

    expect(dual.classic.win6).toEqual(base.win6)
    expect(dual.classic.rud).toEqual(base.rud)
    expect(dual.classic.pin2.map((item) => item.pair)).toEqual(base.pin2.map((item) => item.pair))
    expect(dual.classic.pin3).toHaveLength(4)
    expect(dual.fusion.win6).toHaveLength(6)
    expect(new Set(dual.fusion.win6).size).toBe(6)
    expect(dual.fusion.pin2).toHaveLength(5)
    expect(dual.fusion.pin3).toHaveLength(4)
  })

  it('builds two pin3 sets from each rud lane when possible', () => {
    const pin3 = buildPin3FromSystem(
      [2, 7],
      [
        { pair: '03', digits: [0, 3], score: 10 },
        { pair: '15', digits: [1, 5], score: 11 },
        { pair: '46', digits: [4, 6], score: 12 },
      ],
      [2, 7, 0, 3, 1, 5],
    )
    expect(pin3).toHaveLength(4)
    expect(pin3.filter((item) => item.lead === 2)).toHaveLength(2)
    expect(pin3.filter((item) => item.lead === 7)).toHaveLength(2)
  })
})

describe('Forward A/B evaluation', () => {
  it('measures top coverage, pin2 and pin3 without using hundreds for rud hit', () => {
    const system = {
      strongDigit: 9,
      rud: [1, 3],
      win6: [9, 2, 8, 1, 3, 6],
      pin2: ['13', '28', '29', '38', '89'],
      pin3: ['928', '138', '129', '389'],
    }
    const result = evaluateSystem(system, draw('928', '13', '2026-08-16'))
    expect(result.topCoverage).toBe(3)
    expect(result.bottomCoverage).toBe(2)
    expect(result.rudHit).toBe(true)
    expect(result.pin2Bottom).toBe(true)
    expect(result.pin3Top).toBe(true)
  })
})
