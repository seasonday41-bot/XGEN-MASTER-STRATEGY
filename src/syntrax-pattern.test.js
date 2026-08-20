import { describe, expect, it } from 'vitest'
import { analyzeSyntraXPattern, classifyTop, inspectSyntraXRow, isSibling } from './syntrax-pattern.js'

describe('SYNTRAX PATTERN MODULE', () => {
  it('พี่น้องใช้เฉพาะเลขติดกันและ 90/09 แต่เลขซ้ำไม่ใช่พี่น้อง', () => {
    expect(isSibling(1, 2)).toBe(true)
    expect(isSibling(9, 0)).toBe(true)
    expect(isSibling(0, 9)).toBe(true)
    expect(isSibling(2, 2)).toBe(false)
    expect(isSibling(2, 4)).toBe(false)
  })

  it('จำแนกตามลำดับ TRIPLE → AAB → ABB → ABA → NORMAL', () => {
    expect(classifyTop('777').type).toBe('TRIPLE')
    expect(classifyTop('774').type).toBe('AAB')
    expect(classifyTop('477').type).toBe('ABB')
    expect(classifyTop('747').type).toBe('ABA')
    expect(classifyTop('748').type).toBe('NORMAL')
  })

  it('ตรวจพี่น้องเฉพาะ AB, BC, DE และตรวจเบิ้ลล่าง', () => {
    const row = inspectSyntraXRow({ top3: '129', bottom2: '00' })
    expect(row.siblings.map((item) => item.slot)).toEqual(['AB'])
    expect(row.bottomDouble).toBe(true)
    expect(row.bottomDoublePair).toBe('00')
  })

  it('นับ Sibling Streak จากงวดล่าสุดต่อเนื่อง', () => {
    const result = analyzeSyntraXPattern(
      { top3: '129', bottom2: '45' },
      [
        { top3: '908', bottom2: '67' },
        { top3: '246', bottom2: '31' },
      ],
      [4, 1],
    )
    expect(result.siblingStreak).toBe(2)
    expect(result.siblingWatch).toBe('STREAK')
  })

  it('Pattern เป็นชั้นแสดงสัญญาณและไม่แก้ WIN6/RUD', () => {
    const result = analyzeSyntraXPattern({ top3: '747', bottom2: '22' }, [], [4, 1])
    expect(result.current.top.type).toBe('ABA')
    expect(result.outputs.ham).toEqual(['747'])
    expect(result.outputs.doubles).toContain('22')
    expect(result.affectsCore).toBe(false)
  })
})
