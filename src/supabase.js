import { createClient } from '@supabase/supabase-js'
import { cleanAndValidateHistory } from './data-health.js'

// Publishable keys are intentionally safe for browser clients. Access is still
// constrained by Postgres grants/RLS and the read-only Xgen RPC functions.
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

const FG_HISTORY_LIMIT = 100
const dataHealthCache = new Map()
const healthKey = (marketKey, limit) => `${marketKey}:${limit}`

export function getLastDataHealth(marketKey, limit = 30) {
  return dataHealthCache.get(healthKey(marketKey, limit)) || null
}

export async function loadMarkets() {
  const { data, error } = await supabase.rpc('xgen_list_markets')

  if (error) throw error
  return data
}

function normalizeLatestResult(row) {
  if (!row) throw new Error('ยังไม่มีผลล่าสุดของตลาดนี้')

  const top3 = String(row.top3 ?? '').trim().padStart(3, '0')
  const bottom2 = String(row.bottom2 ?? '').trim().padStart(2, '0')
  const drawDate = String(row.draw_date ?? '').trim()

  if (!/^\d{3}$/.test(top3) || !/^\d{2}$/.test(bottom2) || !/^\d{4}-\d{2}-\d{2}$/.test(drawDate)) {
    throw new Error('ผลล่าสุดมีรูปแบบวันที่/3 บน/2 ล่างไม่ถูกต้อง')
  }

  return { ...row, draw_date: drawDate, top3, bottom2 }
}

// FG HISTORY CORE ใช้ผลล่าสุดเป็นต้นทาง และอ่านประวัติย้อนหลังเพื่อหา
// เฉพาะงวดที่มี F และ G อยู่พร้อมกันใน 3 ตัวบน + 2 ตัวล่าง.
export async function loadLatestResult(marketKey) {
  const recent = await loadRecentResults(marketKey, FG_HISTORY_LIMIT)
  const [latest, ...history] = recent

  if (!latest) throw new Error('ยังไม่มีผลล่าสุดของตลาดนี้')
  return normalizeLatestResult({ ...latest, history })
}

export async function loadRecentResults(marketKey, limit = 4) {
  const { data, error } = await supabase.rpc('xgen_recent_results', {
    p_market_key: marketKey,
    p_limit: limit,
  })

  if (error) throw error

  const guarded = cleanAndValidateHistory(data, limit)
  dataHealthCache.set(healthKey(marketKey, limit), guarded.health)

  if (!guarded.canAnalyze) {
    const problem = guarded.health.issues.find((item) => item.severity === 'critical')
    const guardError = new Error(problem?.message || 'Data Guard พบข้อมูลผิดปกติและหยุดการคำนวณ')
    guardError.name = 'XgenDataGuardError'
    guardError.health = guarded.health
    throw guardError
  }

  return guarded.cleaned
}

export async function loadAllRecentResults(limit = 30) {
  const { data, error } = await supabase.rpc('xgen_recent_results_all', {
    p_limit: limit,
  })

  if (error) throw error

  const grouped = new Map()
  ;(data || []).forEach((row) => {
    const current = grouped.get(row.market_key) || {
      marketKey: row.market_key,
      marketName: row.market_name,
      history: [],
    }
    current.history.push({ draw_date: row.draw_date, top3: row.top3, bottom2: row.bottom2 })
    grouped.set(row.market_key, current)
  })

  return [...grouped.values()].map((item) => {
    const guarded = cleanAndValidateHistory(item.history, limit)
    dataHealthCache.set(healthKey(item.marketKey, limit), guarded.health)
    return {
      ...item,
      history: guarded.cleaned,
      canAnalyze: guarded.canAnalyze,
      health: guarded.health,
    }
  })
}
