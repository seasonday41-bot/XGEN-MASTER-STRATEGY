import { describe, expect, it } from 'vitest'
import { analyzePercentCore } from './formula.js'
import { formatCopyText } from './copy.js'

describe('FG SHADOW FIRST MATCH copy', () => {
  it('แสดง FG เงา คู่ค้น ชุดแรก และชุดหลักครบ', () => {
    const result = {
      marketName: 'ดาวโจนส์สตาร์',
      ...analyzePercentCore({
        top3: '704',
        bottom2: '76',
        history: [
          { draw_date: '2026-08-17', top3: '748', bottom2: '12' },
          { draw_date: '2026-08-14', top3: '292', bottom2: '85' },
          { draw_date: '2026-08-12', top3: '863', bottom2: '89' },
        ],
      }),
    }

    const text = formatCopyText(result)
    expect(text).toContain('📊 ผลล่าสุด 704-76')
    expect(text).toContain('⚡ FG 4 • 3')
    expect(text).toContain('🌑 เงา FG 9 • 8')
    expect(text).toContain('🔎 คู่ค้น 48 • 43 • 39')
    expect(text).toContain('📚 ชุดแรก 748-12 • เจอคู่ 48')
    expect(text).toContain('✨ ชุดหลัก 4 • 3 • 9 • 8 • 7 • 1 • 2')
    expect(text).not.toContain('WIN6')
  })

  it('ระบุเมื่อใช้กฎเลขตอง', () => {
    const result = {
      marketName: 'ตลาดทดสอบ',
      ...analyzePercentCore({
        top3: '222',
        bottom2: '45',
        history: [
          { draw_date: '2026-08-17', top3: '614', bottom2: '93' },
        ],
      }),
    }

    expect(formatCopyText(result)).toContain('⚡ FG 6 • 9 • กฎตอง')
  })
})
