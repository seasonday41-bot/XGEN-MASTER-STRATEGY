import { describe, expect, it } from 'vitest'
import { analyzeFlowCore } from './flow-core.js'
import { formatFlowCopyText } from './flow-copy.js'

const history = [
  { draw_date: '2026-08-18', top3: '968', bottom2: '93' },
  { draw_date: '2026-08-17', top3: '112', bottom2: '01' },
  { draw_date: '2026-08-16', top3: '272', bottom2: '39' },
]

describe('FLOW CORE copy', () => {
  it('จัดข้อความตามชุดรูด WIN6 เจาะ 2 เจาะ 3', () => {
    const result = {
      marketName: 'ลาว Extra',
      ...analyzeFlowCore(history),
    }

    expect(formatFlowCopyText(result)).toBe([
      '🏷️ ตลาด ลาว Extra',
      '📊 3 งวดล่าสุด',
      '272-39 → 9 • 2',
      '112-01 → 3 • 1',
      '968-93 → 4 • 2',
      '',
      '⚡ รูด 2 • 4',
      '✨ WIN6 2 • 4 • 3 • 1 • 9 • 6',
      '',
      '🎯 เจาะ 2 24 • 23 • 21 • 43 • 41',
      '🎯 เจาะ 3 243 • 241 • 249',
      '⭐ เจาะ 3 เสริม 246 • 239',
    ].join('\n'))
  })
})
