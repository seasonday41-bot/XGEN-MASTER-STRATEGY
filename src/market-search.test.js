import { describe, expect, it } from 'vitest'
import { normalizeMarketSearch, rankMarketMatches } from './market-search.js'

const markets = [
  { market_key: 'market_001', market_name: 'จีนเช้า' },
  { market_key: 'market_002', market_name: 'จีนบ่าย' },
  { market_key: 'market_003', market_name: 'ดาวโจนส์' },
  { market_key: 'market_004', market_name: 'ไต้หวัน' },
  { market_key: 'market_005', market_name: 'นิคเคอิ VIP เช้า' },
  { market_key: 'market_006', market_name: 'นิคเคอิ VIP บ่าย' },
  { market_key: 'market_007', market_name: 'หุ้นนิคเคอิเช้า' },
]

describe('market search ranking', () => {
  it('ยกตลาดที่ขึ้นต้นด้วยคำค้นไว้เหนือรายการที่เพียงมีคำค้นอยู่ข้างใน', () => {
    const results = rankMarketMatches(markets, 'น').map((market) => market.market_name)
    expect(results.slice(0, 2)).toEqual(['นิคเคอิ VIP เช้า', 'นิคเคอิ VIP บ่าย'])
    expect(results.indexOf('จีนเช้า')).toBeGreaterThan(1)
    expect(results.indexOf('ดาวโจนส์')).toBeGreaterThan(1)
  })

  it('ยกชื่อที่ตรงทั้งหมดไว้บนสุด', () => {
    const results = rankMarketMatches(markets, 'จีนบ่าย', 'market_001')
    expect(results.map((market) => market.market_name)).toEqual(['จีนบ่าย'])
  })

  it('ใช้ตลาดที่กำลังเลือกเป็นตัวตัดสินเมื่อคะแนนเท่ากัน', () => {
    const results = rankMarketMatches(markets, 'จีน', 'market_001')
    expect(results[0].market_key).toBe('market_001')
  })

  it('ไม่เปลี่ยนลำดับเดิมเมื่อยังไม่พิมพ์คำค้น', () => {
    expect(rankMarketMatches(markets, '').map((market) => market.market_key))
      .toEqual(markets.map((market) => market.market_key))
  })

  it('ตัดช่องว่างและปรับ Unicode ก่อนค้นหา', () => {
    expect(normalizeMarketSearch('  ลาว HD  ')).toBe('ลาว hd')
  })
})
