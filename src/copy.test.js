import { describe, expect, it } from 'vitest'
import { analyzePercentCore } from './formula.js'
import { formatCopyText } from './copy.js'

describe('PERCENT CORE copy', () => {
  it('จัดข้อความ Copy ตามรูปแบบ FULL SYSTEM', () => {
    const result = {
      marketName: 'ตลาดทดสอบ',
      ...analyzePercentCore({ top3: '978', bottom2: '63' }),
    }

    expect(formatCopyText(result)).toBe([
      '🏷️ ตลาด ตลาดทดสอบ',
      '📊 ผลล่าสุด 978-63',
      '🔥 ตัวแรง 5 • 8',
      '⭐ รอง 2 • 9',
      '✨ WIN6 5 • 8 • 2 • 3 • 7 • 9 (0)',
      '🔥 คู่เด่น 28 • 37',
      '',
      '🎯 เจาะ 2 = 28 • 58 • 59 • 35 • 08',
      '🎯 เจาะ 3 = 258 • 058 • 358',
      '⭐ เจาะ 3 เสริม 589 • 028',
      '',
      '🔄 เบิ้ล 88 • 00',
      '👑 ตอง ไม่มี',
      '👯 พี่น้อง 56 • 78 • 01 • 89 • 34',
    ].join('\n'))
  })
})
