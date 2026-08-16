import { describe, expect, it } from 'vitest'
import { cleanAndValidateHistory } from './data-health.js'

describe('Xgen Data Guard', () => {
  it('accepts clean newest-first history', () => {
    const result = cleanAndValidateHistory([
      { draw_date: '2026-08-16', top3: '928', bottom2: '13' },
      { draw_date: '2026-08-15', top3: '988', bottom2: '42' },
      { draw_date: '2026-08-14', top3: '240', bottom2: '56' },
      { draw_date: '2026-08-13', top3: '118', bottom2: '90' },
    ], 30)

    expect(result.canAnalyze).toBe(true)
    expect(result.health.status).toBe('HEALTHY')
    expect(result.health.score).toBe(100)
    expect(result.health.duplicateDates).toBe(0)
  })

  it('repairs leading zero values without losing position', () => {
    const result = cleanAndValidateHistory([
      { draw_date: '2026-08-16', top3: 7, bottom2: 3 },
      { draw_date: '2026-08-15', top3: '988', bottom2: '42' },
      { draw_date: '2026-08-14', top3: '240', bottom2: '56' },
      { draw_date: '2026-08-13', top3: '118', bottom2: '90' },
    ], 30)

    expect(result.canAnalyze).toBe(true)
    expect(result.cleaned[0].top3).toBe('007')
    expect(result.cleaned[0].bottom2).toBe('03')
    expect(result.health.repairedValues).toBe(2)
  })

  it('sorts recoverable order problems before analysis', () => {
    const result = cleanAndValidateHistory([
      { draw_date: '2026-08-14', top3: '240', bottom2: '56' },
      { draw_date: '2026-08-16', top3: '928', bottom2: '13' },
      { draw_date: '2026-08-15', top3: '988', bottom2: '42' },
      { draw_date: '2026-08-13', top3: '118', bottom2: '90' },
    ], 30)

    expect(result.canAnalyze).toBe(true)
    expect(result.health.status).toBe('WATCH')
    expect(result.health.orderViolations).toBeGreaterThan(0)
    expect(result.cleaned.map((row) => row.draw_date)).toEqual([
      '2026-08-16', '2026-08-15', '2026-08-14', '2026-08-13',
    ])
  })

  it('blocks duplicate market-date rows', () => {
    const result = cleanAndValidateHistory([
      { draw_date: '2026-08-16', top3: '928', bottom2: '13' },
      { draw_date: '2026-08-16', top3: '988', bottom2: '42' },
      { draw_date: '2026-08-15', top3: '240', bottom2: '56' },
      { draw_date: '2026-08-14', top3: '118', bottom2: '90' },
    ], 30)

    expect(result.canAnalyze).toBe(false)
    expect(result.health.status).toBe('BLOCKED')
    expect(result.health.duplicateDates).toBe(1)
  })

  it('blocks malformed rows instead of silently feeding Radar', () => {
    const result = cleanAndValidateHistory([
      { draw_date: '2026-08-16', top3: '92X', bottom2: '13' },
      { draw_date: '2026-08-15', top3: '988', bottom2: '42' },
      { draw_date: '2026-08-14', top3: '240', bottom2: '56' },
      { draw_date: '2026-08-13', top3: '118', bottom2: '90' },
    ], 30)

    expect(result.canAnalyze).toBe(false)
    expect(result.health.invalidRows).toBe(1)
  })
})
