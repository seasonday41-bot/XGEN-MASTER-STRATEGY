import { describe, expect, it } from 'vitest'
import {
  analyzeSyntraXPattern,
  classifyTop,
  inspectSyntraXRow,
  isSequentialTop,
  isSibling,
} from './syntrax-pattern.js'

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

  it('ตรวจเลขเรียง 3 ตัวแบบเดินหน้า ถอยหลัง และวน 9→0', () => {
    expect(isSequentialTop('123')).toBe(true)
    expect(isSequentialTop('321')).toBe(true)
    expect(isSequentialTop('890')).toBe(true)
    expect(isSequentialTop('121')).toBe(false)
    expect(isSequentialTop('135')).toBe(false)
  })

  it('ตรวจพี่น้องเฉพาะ AB, BC, DE และตรวจเบิ้ลล่าง', () => {
    const row = inspectSyntraXRow({ top3: '129', bottom2: '00' })
    expect(row.siblings.map((item) => item.slot)).toEqual(['AB'])
    expect(row.bottomDouble).toBe(true)
    expect(row.bottomDoublePair).toBe('00')
  })

  it('พี่น้องต่อกันอย่างน้อย 2 รอบ เปิดสัญญาณเฝ้าดูเบิ้ลรอบถัดไป', () => {
    const result = analyzeSyntraXPattern(
      { top3: '129', bottom2: '45' },
      [
        { top3: '908', bottom2: '67' },
        { top3: '246', bottom2: '31' },
      ],
      [4, 1],
    )
    expect(result.siblingStreak).toBe(2)
    expect(result.doubleWatch).toBe('WATCH')
    expect(result.nextSignals.double).toMatchObject({
      active: true,
      status: 'WATCH',
      reason: 'SIBLING_STREAK',
      sourceStreak: 2,
    })
  })

  it('เบิ้ลต่อกันเปิดการติดตามพี่น้อง และนับรอบต่อเนื่องไม่เกิน 5 รอบ', () => {
    const firstRound = analyzeSyntraXPattern(
      { top3: '663', bottom2: '13' },
      [{ top3: '477', bottom2: '24' }],
    )
    expect(firstRound.nextSignals.sibling).toMatchObject({
      active: true,
      status: 'TRACK',
      reason: 'DOUBLE_STREAK',
      round: 1,
      total: 5,
    })

    const secondRound = analyzeSyntraXPattern(
      { top3: '248', bottom2: '35' },
      [
        { top3: '663', bottom2: '13' },
        { top3: '477', bottom2: '24' },
      ],
    )
    expect(secondRound.nextSignals.sibling).toMatchObject({ active: true, round: 2, total: 5 })
  })

  it('หยุดติดตามพี่น้องเมื่อพ้นรอบที่ 5', () => {
    const result = analyzeSyntraXPattern(
      { top3: '248', bottom2: '35' },
      [
        { top3: '507', bottom2: '24' },
        { top3: '135', bottom2: '79' },
        { top3: '680', bottom2: '24' },
        { top3: '248', bottom2: '35' },
        { top3: '663', bottom2: '13' },
        { top3: '477', bottom2: '24' },
      ],
    )
    expect(result.nextSignals.sibling).toMatchObject({ active: false, round: null, remaining: 0 })
  })

  it('เลขชุดเดิมสลับตำแหน่งหรือเลขเรียงติดกัน เปิดติดตามตอง 5 รอบ', () => {
    const rotation = analyzeSyntraXPattern(
      { top3: '231', bottom2: '58' },
      [{ top3: '123', bottom2: '46' }],
    )
    expect(rotation.nextSignals.triple).toMatchObject({
      active: true,
      status: 'WATCH',
      reason: 'ROTATION',
      round: 1,
      total: 5,
    })

    const sequence = analyzeSyntraXPattern(
      { top3: '234', bottom2: '58' },
      [{ top3: '890', bottom2: '46' }],
    )
    expect(sequence.nextSignals.triple).toMatchObject({ active: true, reason: 'SEQUENCE' })
  })

  it('Pattern เป็นชั้นแสดงสัญญาณและไม่แก้ WIN6/RUD', () => {
    const result = analyzeSyntraXPattern({ top3: '747', bottom2: '22' }, [], [4, 1])
    expect(result.current.top.type).toBe('ABA')
    expect(result.outputs.ham).toEqual(['747'])
    expect(result.outputs.doubles).toContain('22')
    expect(result.affectsCore).toBe(false)
  })
})
