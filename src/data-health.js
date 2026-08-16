const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value))

function normalizeDate(value) {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null
  const [year, month, day] = text.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null
  return text
}

function normalizeDigits(value, width) {
  if (value === null || value === undefined) return { value: null, repaired: false }
  const raw = String(value).trim()
  if (!/^\d+$/.test(raw) || raw.length > width) return { value: null, repaired: false }
  const normalized = raw.padStart(width, '0')
  return { value: normalized, repaired: normalized !== raw }
}

function dateValue(dateText) {
  return Date.parse(`${dateText}T00:00:00Z`)
}

function gapDays(newer, older) {
  return Math.round((dateValue(newer) - dateValue(older)) / 86400000)
}

export function cleanAndValidateHistory(history, targetRows = 30) {
  const source = Array.isArray(history) ? history : []
  const issues = []
  const repairs = []
  const normalizedRows = []
  let invalidRows = 0

  source.forEach((row, index) => {
    const drawDate = normalizeDate(row?.draw_date)
    const top = normalizeDigits(row?.top3, 3)
    const bottom = normalizeDigits(row?.bottom2, 2)

    if (!drawDate || !top.value || !bottom.value) {
      invalidRows += 1
      issues.push({
        severity: 'critical',
        code: 'INVALID_ROW',
        message: `แถว ${index + 1} รูปแบบวันที่/3 บน/2 ล่างไม่ถูกต้อง`,
      })
      return
    }

    if (top.repaired) repairs.push(`เติมเลข 0 หน้า 3 บน ${String(row.top3)} → ${top.value}`)
    if (bottom.repaired) repairs.push(`เติมเลข 0 หน้า 2 ล่าง ${String(row.bottom2)} → ${bottom.value}`)

    normalizedRows.push({
      ...row,
      draw_date: drawDate,
      top3: top.value,
      bottom2: bottom.value,
    })
  })

  const dateCounts = new Map()
  normalizedRows.forEach((row) => dateCounts.set(row.draw_date, (dateCounts.get(row.draw_date) || 0) + 1))
  const duplicateDates = [...dateCounts.entries()].filter(([, count]) => count > 1)
  duplicateDates.forEach(([date, count]) => {
    issues.push({ severity: 'critical', code: 'DUPLICATE_DATE', message: `${date} ซ้ำ ${count} แถว` })
  })

  let orderViolations = 0
  for (let index = 1; index < normalizedRows.length; index += 1) {
    if (dateValue(normalizedRows[index].draw_date) > dateValue(normalizedRows[index - 1].draw_date)) {
      orderViolations += 1
    }
  }

  if (orderViolations > 0) {
    issues.push({
      severity: 'warning',
      code: 'ORDER',
      message: `ลำดับงวดไม่ใช่ใหม่→เก่า ${orderViolations} จุด • Data Guard จัดเรียงให้ก่อนคำนวณ`,
    })
  }

  const cleaned = [...normalizedRows].sort((a, b) => {
    const byDate = dateValue(b.draw_date) - dateValue(a.draw_date)
    if (byDate !== 0) return byDate
    return String(b.id || '').localeCompare(String(a.id || ''))
  })

  const gaps = []
  for (let index = 1; index < cleaned.length; index += 1) {
    const gap = gapDays(cleaned[index - 1].draw_date, cleaned[index].draw_date)
    if (gap >= 0) gaps.push(gap)
  }
  const maxGapDays = gaps.length ? Math.max(...gaps) : 0

  if (cleaned.length < 4) {
    issues.push({ severity: 'critical', code: 'TOO_FEW_ROWS', message: `มีข้อมูลใช้ได้เพียง ${cleaned.length} งวด • Radar ต้องการอย่างน้อย 4 งวด` })
  }

  const criticalCount = issues.filter((item) => item.severity === 'critical').length
  const warningCount = issues.filter((item) => item.severity === 'warning').length
  const score = Math.round(clamp(
    100
      - invalidRows * 25
      - duplicateDates.length * 30
      - Math.min(repairs.length * 3, 12)
      - Math.min(orderViolations * 5, 15),
  ))

  const status = criticalCount > 0 ? 'BLOCKED' : score < 90 || warningCount > 0 ? 'WATCH' : 'HEALTHY'
  const coverage = Math.round(clamp((cleaned.length / targetRows) * 100))

  return {
    engineVersion: 'xgen_data_guard_v1',
    cleaned,
    canAnalyze: criticalCount === 0 && cleaned.length >= 4,
    health: {
      status,
      score,
      rows: cleaned.length,
      targetRows,
      coverage,
      invalidRows,
      duplicateDates: duplicateDates.length,
      orderViolations,
      repairedValues: repairs.length,
      maxGapDays,
      issues,
      repairs: repairs.slice(0, 4),
    },
  }
}
