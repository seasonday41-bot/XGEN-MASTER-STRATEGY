import { describe, expect, it } from 'vitest'
import { analyzeStructuralProbabilityV2 } from './structural-probability-v2.js'
import { analyzeStructuralProbabilityV3, selectReserveFromTopBottom } from './structural-probability-v3.js'

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

describe('WIN6 reserve v3', () => {
  it('เลือก Reserve จากเลขที่ขาดใน WIN6 รวมแต่ยังอยู่ใน WIN6 บน/ล่าง โดยใช้ Structural score สูงสุด', () => {
    const analysis = {
      win6: [5, 6, 9, 1, 0, 3],
      topWin6: [1, 6, 3, 9, 2, 8],
      bottomWin6: [5, 0, 9, 4, 6, 7],
      rankings: {
        fusion: [
          { digit: 5, score: 90 }, { digit: 6, score: 88 }, { digit: 9, score: 84 },
          { digit: 1, score: 80 }, { digit: 0, score: 78 }, { digit: 3, score: 75 },
          { digit: 2, score: 73 }, { digit: 8, score: 69 }, { digit: 4, score: 66 }, { digit: 7, score: 61 },
        ],
      },
    }
    const reserve = selectReserveFromTopBottom(analysis)
    expect(reserve.digit).toBe(2)
    expect(reserve.sources).toEqual(['TOP'])
    expect(reserve.candidates.map((item) => item.digit)).toEqual([2, 8, 4, 7])
    expect(reserve.fallback).toBe(false)
  })

  it('ไม่เปลี่ยน WIN6 และชุดเจาะเดิมของ Pattern Engine v2', () => {
    const oldResult = analyzeStructuralProbabilityV2(history, { includeBacktest: false })
    const newResult = analyzeStructuralProbabilityV3(history, { includeBacktest: false })

    expect(newResult.win6).toEqual(oldResult.win6)
    expect(newResult.topWin6).toEqual(oldResult.topWin6)
    expect(newResult.bottomWin6).toEqual(oldResult.bottomWin6)
    expect(newResult.pin2Top).toEqual(oldResult.pin2Top)
    expect(newResult.pin2Bottom).toEqual(oldResult.pin2Bottom)
    expect(newResult.pin3).toEqual(oldResult.pin3)
    expect(newResult.win6).not.toContain(newResult.reserve)

    if (!newResult.reserveFallback) {
      expect([...newResult.topWin6, ...newResult.bottomWin6]).toContain(newResult.reserve)
    }
  })
})
