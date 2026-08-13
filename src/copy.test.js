import { describe, expect, it } from 'vitest'
import { formatCopyText } from './copy.js'

describe('Xgen copy text', () => {
  it('จัดผลให้อ่านง่ายและไม่มีคำอธิบายย้อนหลัง 4 งวด', () => {
    const text = formatCopyText({
      marketName: 'หุ้นไต้หวัน VIP',
      source: { top3: '713', bottom2: '34' },
      strongDigit: { digit: 8 },
      rud: [7, 0],
      win6: [7, 0, 2, 5, 6, 8],
      doubleAnalysis: {
        pattern: 'ปกติ',
        message: 'โอกาสเบิ้ล 22% • เน้นรูดสลับ',
        doubles: ['77', '88'],
      },
      pin2: ['28', '68', '78', '08', '26'].map((pair) => ({ pair })),
    })

    expect(text).toBe([
      '🍀 Xgen | หุ้นไต้หวัน VIP',
      '713-34',
      '',
      '🔥 ตัวแรง 8',
      '⚡ รูดหลัก 7 | รูดรอง 0',
      '✨ WIN6 7 • 0 • 2 • 5 • 6 • 8',
      '',
      '🔄 วิเคราะห์เบิ้ล/หาม: ปกติ',
      'โอกาสเบิ้ล 22% • เน้นรูดสลับ',
      '🎲 เลขเบิ้ลจากสูตร 77 • 88',
      '',
      '🎯 เจาะ 2 (กลับได้)',
      '28 • 68 • 78 • 08 • 26',
    ].join('\n'))
    expect(text).not.toContain('ย้อนหลัง 4 งวด')
    expect(text).not.toContain('ผลล่าสุด')
  })
})
