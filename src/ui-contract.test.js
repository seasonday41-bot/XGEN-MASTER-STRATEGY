import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const main = readFileSync(new URL('./main.js', import.meta.url), 'utf8')
const style = readFileSync(new URL('./style.css', import.meta.url), 'utf8')

describe('XGEN production UI contract', () => {
  it('ซ่อน F/G จากหน้าจอแต่คงรูดหลักและผลลัพธ์เดิม', () => {
    expect(main).not.toMatch(/id=["'](?:fValue|gValue)["']/)
    expect(main).not.toMatch(/>\s*[FG]\s*</)
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
    expect(style).toContain('@media (max-width: 560px)')
    expect(style).toContain('@media (max-width: 340px)')
    expect(style).toContain('env(safe-area-inset-bottom)')
  })
})
