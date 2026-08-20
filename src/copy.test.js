import { describe, expect, it } from 'vitest'
import { formatCopySection, formatCopyText } from './copy.js'
import { analyzeSyntraXPattern } from './syntrax-pattern.js'
import { analyzeWin6Xgen, buildPin2, buildPin3 } from './win6xgen.js'

function example() {
  const core = analyzeWin6Xgen({
    draw_date: '2026-08-20',
    top3: '240',
    bottom2: '56',
    history: [
      { draw_date: '2026-08-19', top3: '419', bottom2: '53' },
      { draw_date: '2026-08-18', top3: '418', bottom2: '53' },
    ],
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
    expect(text).toContain('✨ WIN6 4 • 1 • 9 • 5 • 3 • 8')
    expect(text).toContain('🧬 ปกติ')
    expect(text).toContain('👥 พี่น้อง 56')
    expect(text).toContain('🎯 เจาะ 2')
    expect(text).toContain('🎯 เจาะ 3')
    expect(text).not.toContain('SyntraX')
    expect(text).not.toContain('Candidate Pool')
  })

  it('จัด Copy แบบลูกค้าพร้อมเลขเบิ้ลและคู่พี่น้องของโครงสร้าง AAB', () => {
    const pinDigits = [9, 4, 3, 7, 5, 2]
    const result = {
      marketName: 'ฮานอยพิเศษ',
      source: { top3: '663', bottom2: '13' },
      rud: [9, 4],
      win6: [9, 4, 3, 7, 5, 2],
      reserve: 0,
      pin2: buildPin2(pinDigits),
      pin3: buildPin3(pinDigits),
      pattern: analyzeSyntraXPattern({ top3: '663', bottom2: '13' }, [], [9, 4]),
    }

    expect(formatCopyText(result)).toBe([
      '🍀 WIN6XGEN | ฮานอยพิเศษ',
      '663-13',
      '',
      '⚡ รูด 9 • 4',
      '✨ WIN6 9 • 4 • 3 • 7 • 5 • 2 (0)',
      '',
      '🧬 เบิ้ลหน้า AAB',
      '🎲 เบิ้ล 66',
      '👥 พี่น้อง 69 • 34',
      '',
      '🎯 เจาะ 2 94 • 93 • 97 • 45 • 42',
      '🎯 เจาะ 3 943 • 975 • 472 • 932 • 435',
    ].join('\n'))
  })

  it('คัดลอกแยกแต่ละส่วนได้', () => {
    const result = { ...example(), reserve: 8 }
    expect(formatCopySection(result, 'rud')).toBe('⚡ รูด 4 • 1')
    expect(formatCopySection(result, 'win6')).toBe('✨ WIN6 4 • 1 • 9 • 5 • 3 • 8 (8)')
    expect(formatCopyText(result)).toContain('✨ WIN6 4 • 1 • 9 • 5 • 3 • 8 (8)')
  })

  it('ไม่เติมวงเล็บสำรองเมื่อไม่มีเลขสำรอง', () => {
    const result = example()
    expect(formatCopySection(result, 'win6')).toBe('✨ WIN6 4 • 1 • 9 • 5 • 3 • 8')
  })
})
