import { supabase } from './supabase.js'

function normalizeDigits(value, width) {
  const text = String(value ?? '').trim().padStart(width, '0')
  if (!new RegExp(`^\\d{${width}}$`).test(text)) return null
  return text
}

function normalizeRow(row) {
  const top3 = normalizeDigits(row?.top3, 3)
  const bottom2 = normalizeDigits(row?.bottom2, 2)
  const drawDate = String(row?.draw_date ?? '').trim()

  if (!top3 || !bottom2 || !/^\d{4}-\d{2}-\d{2}$/.test(drawDate)) {
    throw new Error('ข้อมูล 3 งวดล่าสุดมีรูปแบบไม่ถูกต้อง')
  }

  return {
    ...row,
    draw_date: drawDate,
    top3,
    bottom2,
  }
}

export async function loadLatestThreeResults(marketKey) {
  const { data, error } = await supabase.rpc('xgen_recent_results', {
    p_market_key: marketKey,
    p_limit: 3,
  })

  if (error) throw error

  const rows = (data || [])
    .map(normalizeRow)
    .sort((left, right) => right.draw_date.localeCompare(left.draw_date))

  if (rows.length < 3) {
    throw new Error(`ตลาดนี้มีข้อมูลเพียง ${rows.length} งวด • FLOW CORE ต้องการ 3 งวด`)
  }

  return rows.slice(0, 3)
}
