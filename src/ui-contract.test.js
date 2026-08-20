import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const main = readFileSync(new URL('./main.js', import.meta.url), 'utf8')
const style = readFileSync(new URL('./style.css', import.meta.url), 'utf8')
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const copy = readFileSync(new URL('./copy.js', import.meta.url), 'utf8')

describe('XGEN production UI contract', () => {
  it('ซ่อน F/G จาก User-facing UI ทั้งหมด แต่คงรูดหลักและ Internal Engine', () => {
    expect(main).not.toMatch(/id=["'](?:fValue|gValue)["']/)
    expect(main).not.toMatch(/>\s*[FG]\s*</)
    expect(main).not.toMatch(/F\s*\/\s*G/i)
    expect(main).not.toMatch(/mod\s*10/i)
    expect(copy).not.toMatch(/F\s*\/\s*G/i)
    expect(copy).not.toMatch(/mod\s*10/i)
    expect(main).toContain('รูดหลัก')
    expect(main).toContain("analysis.rud[0]")
    expect(main).toContain("analysis.rud[1]")
  })

  it('มีลำดับ reveal แบบพรีเมียมและรองรับ Reduce Motion', () => {
    expect(main).toContain('page-ready')
    expect(main).toContain('number-reveal')
    expect(main).toContain('rud-reveal')
    expect(main).toContain('win-reveal')
    expect(style).toContain('@media (prefers-reduced-motion: reduce)')
    expect(style).toContain('winDigitReveal')
  })

  it('รองรับการเลือกประวัติ skeleton และ feedback หลังคัดลอก', () => {
    expect(main).toContain('data-history-index')
    expect(main).toContain('selectHistoryAt')
    expect(main).toContain('aria-busy')
    expect(main).toContain('คัดลอกแล้ว')
    expect(style).toContain('.result.is-loading')
    expect(style).toContain('.history-item.selected')
    expect(style).toContain('.copy-actions button.copied')
  })

  it('คงโครงสร้างมือถือและเพิ่ม active navigation indicator', () => {
    expect(main).toContain('nav-indicator')
    expect(main).toContain('--nav-index')
    expect(html).toContain('viewport-fit=cover')
    expect(style).toContain('@media (max-width: 560px)')
    expect(style).toContain('@media (max-width: 340px)')
    expect(style).toContain('env(safe-area-inset-bottom)')
  })

  it('รักษา responsive hierarchy ที่ 320/375/390/393/430 โดยไม่บังคับความกว้างเกิน viewport', () => {
    expect(style).toContain('width: min(100%, 760px)')
    expect(style).toContain('overflow-x: hidden')
    expect(style).toContain('@media (max-width: 359px)')
    expect(style).toMatch(/@media \(max-width: 359px\)[\s\S]*?\.output-grid \{ grid-template-columns: 1fr; \}/)
    expect(style).toMatch(/@media \(max-width: 359px\)[\s\S]*?\.win-digits \{ grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/)
    expect(style).toMatch(/@media \(max-width: 359px\)[\s\S]*?\.copy-actions \{ grid-template-columns: repeat\(2, 1fr\)/)
    expect(style).toContain('@media (max-width: 390px)')
    expect(style).toContain('@media (max-width: 560px)')
    expect(style).toContain('grid-template-columns: repeat(5, minmax(0, 1fr))')
  })

  it('ผูก interaction หลักโดยไม่ reload ทั้งหน้า', () => {
    expect(main).toContain("elements.marketList.addEventListener('click'")
    expect(main).toContain("elements.historyList.addEventListener('click'")
    expect(main).toContain("elements.copyActions.addEventListener('click'")
    expect(main).toContain('selectHistoryAt')
    expect(main).toContain('setLoading')
    expect(main).toContain('setActiveNav')
    expect(main).not.toContain('window.location.reload')
  })
})
