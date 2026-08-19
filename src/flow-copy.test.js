import { describe, expect, it } from 'vitest'
import { analyzeFlowCore } from './flow-core.js'
import { formatFlowCopyText } from './flow-copy.js'

const history = [
  { draw_date: '2026-08-18', top3: '968', bottom2: '93' },
  { draw_date: '2026-08-17', top3: '112', bottom2: '01' },
  { draw_date: '2026-08-16', top3: '272', bottom2: '39' },
]

describe('FLOW CORE copy', () => {
  it('คัดลอกเฉพาะผลล่าสุด รูด WIN6 เจาะ 2 และเจาะ 3', () => {
    const result = {
      marketName: 'ลาว Extra',
      ...analyzeFlowCore(history),
    }

    expect(formatFlowCopyText(result)).toBe([
      '🏷️ ตลาด ลาว Extra',
      '📊 ผลล่าสุด 968-93',
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
