import { describe, expect, it } from 'vitest'
import { analyzeFlowCore } from './flow-core.js'
import { formatFlowCopyText } from './flow-copy.js'

const history = [
  { draw_date: '2026-08-14', top3: '118', bottom2: '01' },
  { draw_date: '2026-08-13', top3: '843', bottom2: '51' },
  { draw_date: '2026-08-12', top3: '734', bottom2: '27' },
]

describe('FLOW × PERCENT copy', () => {
  it('คัดลอกเฉพาะผลล่าสุด รูด WIN6 เจาะ 2 และเจาะ 3', () => {
    const result = {
      marketName: 'ลาว Extra',
      ...analyzeFlowCore(history),
    }

    expect(formatFlowCopyText(result)).toBe([
      '🏷️ ตลาด ลาว Extra',
      '📊 ผลล่าสุด 118-01',
      '',
      '⚡ รูด 9 • 7',
      '✨ WIN6 0 • 3 • 4 • 6 • 2 • 8',
      '',
      '🎯 เจาะ 2 97 • 90 • 93 • 70 • 73',
      '🎯 เจาะ 3 970 • 973 • 974',
      '⭐ เจาะ 3 เสริม 976 • 904',
    ].join('\n'))
  })
})
