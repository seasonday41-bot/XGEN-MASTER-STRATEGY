import { describe, expect, it } from 'vitest'
import { analyzePercentCore } from './formula.js'
import { formatCopyText } from './copy.js'

describe('FG HISTORY CORE copy', () => {
  it('จัดข้อความ Copy ตามผล FG + ความถี่ย้อนหลัง', () => {
    const result = {
      marketName: 'ตลาดทดสอบ',
      ...analyzePercentCore({
        top3: '294',
        bottom2: '73',
        history: [
          { draw_date: '2026-08-14', top3: '039', bottom2: '61' },
          { draw_date: '2026-08-05', top3: '305', bottom2: '37' },
        ],
      }),
    }

    expect(formatCopyText(result)).toBe([
      '🏷️ ตลาด ตลาดทดสอบ',
      '📊 ผลล่าสุด 294-73',
      '⚡ รูด FG 3 • 0',
      '⭐ รองสถิติ 9 • 6',
      '✨ WIN6 3 • 0 • 9 • 6 • 1 • 5 (7)',
      '📚 ชุดย้อนหลังที่มี FG ครบ 2 งวด',
      '',
      '🎯 เจาะ 2 = 30 • 03 • 39 • 36 • 31',
      '🎯 เจาะ 3 = 309 • 306 • 301',
      '⭐ เจาะ 3 เสริม 305 • 307',
      '',
      '🔄 เบิ้ล ไม่มี',
      '👑 ตอง ไม่มี',
      '👯 พี่น้อง ไม่มี',
    ].join('\n'))
  })
})
