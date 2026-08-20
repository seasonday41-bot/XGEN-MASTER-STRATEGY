import { createClient } from '@supabase/supabase-js'
import { HISTORY_LIMIT, normalizeResult } from './win6xgen.js'

// Publishable keys are safe in a browser client. Database access remains limited
// by the read-only RPC grants and RLS policies in six-digit-thai-lao.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wxxocsfygxlwaklncmop.supabase.co'
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_eyK3gxO_LoDEMzYriH9DCQ_PUgeiuFC'

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('ยังไม่ได้ตั้งค่า Supabase สำหรับ Xgen')
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
})

export async function loadMarkets() {
  const { data, error } = await supabase.rpc('xgen_list_markets')
  if (error) throw error

  return (data || [])
    .filter((item) => /^market_\d{3}$/.test(String(item.market_key || '')))
    .map((item) => ({
      market_key: String(item.market_key),
      market_name: String(item.market_name || item.market_key),
    }))
}

export async function loadRecentResults(marketKey, limit = HISTORY_LIMIT) {
  if (!/^market_\d{3}$/.test(String(marketKey || ''))) throw new Error('รหัสตลาดไม่ถูกต้อง')

  const safeLimit = Math.min(Math.max(Number(limit) || HISTORY_LIMIT, 1), HISTORY_LIMIT)
  const { data, error } = await supabase.rpc('xgen_recent_results', {
    p_market_key: marketKey,
    p_limit: safeLimit,
  })
  if (error) throw error

  const normalized = (data || []).map(normalizeResult)
  if (normalized.some((row) => !row)) throw new Error('พบผลย้อนหลังที่รูปแบบไม่ถูกต้อง')

  const rows = normalized.filter(Boolean)
  const dates = rows.map((row) => row.draw_date)
  if (new Set(dates).size !== dates.length) throw new Error('พบวันที่ซ้ำในข้อมูลตลาดนี้')

  rows.sort((left, right) => right.draw_date.localeCompare(left.draw_date))
  return rows
}

export async function loadMarketData(marketKey) {
  const rows = await loadRecentResults(marketKey, HISTORY_LIMIT)
  const [latest, ...history] = rows
  if (!latest) throw new Error('ยังไม่มีผลของตลาดนี้')
  if (!history.length) throw new Error('ข้อมูลย้อนหลังไม่พอสำหรับ WIN6XGEN')

  return { ...latest, history, allRows: rows }
}
