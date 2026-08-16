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
