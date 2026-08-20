import { describe, expect, it } from 'vitest'
import { formatCopySection, formatCopyText } from './copy.js'
import { analyzeSyntraXPattern } from './syntrax-pattern.js'
import { analyzeWin6Xgen } from './win6xgen.js'

function example() {
  const core = analyzeWin6Xgen({
    draw_date: '2026-08-20',
    top3: '240',
    bottom2: '56',
    history: [{ draw_date: '2026-08-19', top3: '195', bottom2: '38' }],
  })
  return {
    marketName: 'ตลาดทดสอบ',
    ...core,
    pattern: analyzeSyntraXPattern(core.source, core.history, core.rud),
  }
}

describe('WIN6XGEN copy', () => {
  it('คัดลอกเฉพาะผลลูกค้าแบบกระชับ', () => {
    const text = formatCopyText(example())
    expect(text).toContain('🍀 WIN6XGEN | ตลาดทดสอบ')
    expect(text).toContain('240-56')
    expect(text).toContain('⚡ รูด 4 • 1')
    expect(text).toContain('✨ WIN6 4 • 1 • 5 • 9 • 3 • 8')
    expect(text).toContain('🎯 เจาะ 2')
    expect(text).toContain('🎯 เจาะ 3')
    expect(text).toContain('🧬 SyntraX')
    expect(text).not.toContain('Candidate Pool')
  })

  it('คัดลอกแยกแต่ละส่วนได้', () => {
    const result = example()
    expect(formatCopySection(result, 'rud')).toBe('⚡ รูด 4 • 1')
    expect(formatCopySection(result, 'win6')).toBe('✨ WIN6 4 • 1 • 5 • 9 • 3 • 8')
  })
})
