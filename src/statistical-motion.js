const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value))
const round2 = (value) => Math.round(value * 100) / 100

function validHistory(history) {
  return Array.isArray(history) && history.length >= 4 && history.every((draw) => /^\d{3}$/.test(draw?.top3 || '') && /^\d{2}$/.test(draw?.bottom2 || ''))
}

function extractDigits(history, size) {
  return history.slice(0, size).flatMap((draw) => `${draw.top3}${draw.bottom2}`.split('').map(Number))
}

function quantile(sorted, q) {
  if (!sorted.length) return 0
  const position = (sorted.length - 1) * q
  const base = Math.floor(position)
  const rest = position - base
  if (sorted[base + 1] !== undefined) return sorted[base] + rest * (sorted[base + 1] - sorted[base])
  return sorted[base]
}

function describe(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const count = sorted.length
  if (!count) return { count: 0, mean: 0, std: 0, min: 0, q1: 0, median: 0, q3: 0, max: 0, iqr: 0 }
  const mean = sorted.reduce((sum, value) => sum + value, 0) / count
  const variance = count > 1
    ? sorted.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / (count - 1)
    : 0
  const q1 = quantile(sorted, 0.25)
  const median = quantile(sorted, 0.5)
  const q3 = quantile(sorted, 0.75)
  return {
    count,
    mean: round2(mean),
    std: round2(Math.sqrt(variance)),
    min: sorted[0],
    q1: round2(q1),
    median: round2(median),
    q3: round2(q3),
    max: sorted[sorted.length - 1],
    iqr: round2(q3 - q1),
  }
}

function distribution(values) {
  const counts = Array(10).fill(0)
  values.forEach((digit) => { counts[digit] += 1 })
  const total = values.length || 1
  return counts.map((count) => count / total)
}

function addScore(bucket, digit, points, reason) {
  bucket[digit].score += points
  if (reason) bucket[digit].reasons.add(reason)
}

export function buildStatisticalMotion(history) {
  if (!validHistory(history)) return null

  const windows = {}
  ;[3, 5, 10, 20, 30].forEach((size) => {
    const values = extractDigits(history, size)
    windows[size] = describe(values)
  })

  const recentValues = extractDigits(history, 5)
  const baselineValues = extractDigits(history, 20)
  const recentDist = distribution(recentValues)
  const baselineDist = distribution(baselineValues)
  const recent = windows[5]
  const baseline = windows[20]

  const meanShift = round2(recent.mean - baseline.mean)
  const medianShift = round2(recent.median - baseline.median)
  const volatilityShift = round2(recent.std - baseline.std)
  const iqrShift = round2(recent.iqr - baseline.iqr)
  const stdRatio = baseline.std > 0 ? recent.std / baseline.std : 1
  const iqrRatio = baseline.iqr > 0 ? recent.iqr / baseline.iqr : 1

  let state = 'STABLE'
  if (meanShift >= 0.7 && medianShift >= 0.5) state = 'UP_SHIFT'
  else if (meanShift <= -0.7 && medianShift <= -0.5) state = 'DOWN_SHIFT'
  else if (stdRatio <= 0.72 && iqrRatio <= 0.72) state = 'COMPRESSION'
  else if (stdRatio >= 1.28 || iqrRatio >= 1.28) state = 'EXPANSION'

  const center = (recent.mean + recent.median) / 2
  const buckets = Array.from({ length: 10 }, (_, digit) => ({ digit, score: 0, reasons: new Set() }))

  for (let digit = 0; digit <= 9; digit += 1) {
    const share5 = recentDist[digit]
    const share20 = baselineDist[digit]
    const momentum = share5 - share20

    addScore(buckets, digit, share5 * 38, share5 > 0 ? `Recent ${Math.round(share5 * 100)}%` : null)
    if (momentum > 0) addScore(buckets, digit, momentum * 78, `Dist +${round2(momentum * 100)}`)

    const closeness = Math.max(0, 1 - Math.abs(digit - center) / 5)
    addScore(buckets, digit, closeness * 10, `ใกล้ศูนย์กลาง ${round2(center)}`)

    if (state === 'UP_SHIFT') addScore(buckets, digit, (digit / 9) * 10, 'Mean/Median ขยับขึ้น')
    if (state === 'DOWN_SHIFT') addScore(buckets, digit, ((9 - digit) / 9) * 10, 'Mean/Median ขยับลง')

    if (state === 'COMPRESSION' && digit >= Math.floor(recent.q1) && digit <= Math.ceil(recent.q3)) {
      addScore(buckets, digit, 9, 'Quartile บีบตัว')
    }

    if (state === 'EXPANSION' && (digit <= recent.q1 || digit >= recent.q3)) {
      addScore(buckets, digit, 4, 'Volatility ขยาย')
    }
  }

  const rankedDigits = buckets
    .map((item) => ({
      digit: item.digit,
      score: Math.round(clamp(item.score)),
      reasons: [...item.reasons].slice(0, 4),
    }))
    .sort((a, b) => b.score - a.score || recentDist[b.digit] - recentDist[a.digit] || a.digit - b.digit)

  const compression = Math.round(clamp((1 - Math.min(1, (stdRatio + iqrRatio) / 2)) * 100))
  const expansion = Math.round(clamp((Math.max(1, (stdRatio + iqrRatio) / 2) - 1) * 100))

  return {
    version: 'statistical_motion_v1',
    state,
    windows,
    shifts: { mean: meanShift, median: medianShift, volatility: volatilityShift, iqr: iqrShift },
    compression,
    expansion,
    rankedDigits,
    summary: state === 'UP_SHIFT'
      ? `ศูนย์กลางเลขกำลังขยับขึ้น • Mean ${meanShift > 0 ? '+' : ''}${meanShift} • Median ${medianShift > 0 ? '+' : ''}${medianShift}`
      : state === 'DOWN_SHIFT'
        ? `ศูนย์กลางเลขกำลังขยับลง • Mean ${meanShift} • Median ${medianShift}`
        : state === 'COMPRESSION'
          ? `เลขกำลังกระจุก • STD ${recent.std} จากฐาน ${baseline.std} • IQR ${recent.iqr}`
          : state === 'EXPANSION'
            ? `เลขกำลังกระจาย • STD ${recent.std} จากฐาน ${baseline.std} • IQR ${recent.iqr}`
            : `สถิติทรงตัว • Mean ${recent.mean} • Median ${recent.median} • STD ${recent.std}`,
  }
}
