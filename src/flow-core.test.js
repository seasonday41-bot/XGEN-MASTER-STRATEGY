import { describe, expect, it } from 'vitest'
import { analyzeFlowCore, calculateFlowPoints } from './flow-core.js'

const history = [
  { draw_date: '2026-08-18', top3: '968', bottom2: '93' },
  { draw_date: '2026-08-17', top3: '112', bottom2: '01' },
  { draw_date: '2026-08-16', top3: '272', bottom2: '39' },
]

describe('FLOW CORE 3 Draw Point Flow', () => {
  it('ถอดแต้มบนและล่างตามกติกา', () => {
    expect(calculateFlowPoints(history[2])).toMatchObject({
      topPoint: 9,
      bottomPoint: 2,
      crossPoint: 1,
    })
    expect(calculateFlowPoints(history[0])).toMatchObject({
      topPoint: 4,
      bottomPoint: 2,
      crossPoint: 6,
    })
  })

  it('เรียง 3 งวดเก่าไปใหม่และได้ชุดแต้มตรงตัวอย่าง', () => {
    const result = analyzeFlowCore(history)
    expect(result.pointSequence).toEqual([9, 2, 3, 1, 4, 2])
  })

  it('คัดรูด 2 ตัวโดยเลขซ้ำมาก่อนและงวดล่าสุดชนะเมื่อแต้มเท่ากัน', () => {
    const result = analyzeFlowCore(history)
    expect(result.rud).toEqual([2, 4])
    expect(result.ranking.map((item) => item.digit)).toEqual([2, 4, 3, 1, 9])
  })

  it('คัด WIN6 จากแต้มชุดเดียวกันและเติมแต้มชนบนล่างเมื่อไม่ครบ', () => {
    const result = analyzeFlowCore(history)
    expect(result.win6).toEqual([2, 4, 3, 1, 9, 6])
  })

  it('คัดเจาะ 2 และเจาะ 3 จากรูดและ WIN6 ตามกติกา', () => {
    const result = analyzeFlowCore(history)
    expect(result.pin2.map((item) => item.pair)).toEqual(['24', '23', '21', '43', '41'])
    expect(result.pin3.map((item) => item.triple)).toEqual(['243', '241', '249'])
    expect(result.pin3Extra.map((item) => item.triple)).toEqual(['246', '239'])
  })
})
