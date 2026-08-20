export const HISTORY_LIMIT = 30
export const GH_SEARCH_WINDOW = 5
export const EXTENDED_SEARCH_WINDOWS = [5, 6, 7, 8]

export class Win6XgenError extends Error {
  constructor(code, message, details = {}) {
    super(message)
    this.name = 'Win6XgenError'
    this.code = code
    this.details = details
  }
}

const PIN2_TEMPLATES = [
  [0, 1],
  [0, 2],
  [0, 3],
  [1, 4],
  [1, 5],
]

const PIN3_TEMPLATES = [
  [0, 1, 2],
  [0, 3, 4],
  [1, 3, 5],
  [0, 2, 5],
  [1, 2, 4],
]

export function mod10(value) {
  return ((Number(value) % 10) + 10) % 10
}

export function uniqueFirst(values) {
  const output = []
  values.forEach((value) => {
    const digit = Number(value)
    if (Number.isInteger(digit) && digit >= 0 && digit <= 9 && !output.includes(digit)) {
      output.push(digit)
    }
  })
  return output
}

export function normalizeResult(row) {
  const top3 = String(row?.top3 ?? '').trim().padStart(3, '0')
  const bottom2 = String(row?.bottom2 ?? '').trim().padStart(2, '0')
  const drawDate = row?.draw_date ? String(row.draw_date).trim() : null

  if (!/^\d{3}$/.test(top3) || !/^\d{2}$/.test(bottom2)) return null
  if (drawDate && !/^\d{4}-\d{2}-\d{2}$/.test(drawDate)) return null

  return { draw_date: drawDate, top3, bottom2 }
}

export function resultDigits(row) {
  const normalized = normalizeResult(row)
  if (!normalized) return []
  return `${normalized.top3}${normalized.bottom2}`.split('').map(Number)
}

export function calculateFGH(top3, bottom2) {
  const normalized = normalizeResult({ top3, bottom2 })
  if (!normalized) throw new Error('ผลล่าสุดต้องครบ 3 ตัวบน และ 2 ตัวล่าง')

  const [a, b, c] = normalized.top3.split('').map(Number)
  const [d, e] = normalized.bottom2.split('').map(Number)
  const isTriple = a === b && b === c
  const f = isTriple ? mod10(a + b + c) : mod10(b + c)
  const g = mod10(d + e)
  const h = mod10(f + g)

  return {
    a,
    b,
    c,
    d,
    e,
    f,
    g,
    h,
    isTriple,
    rud: [f, g],
  }
}

function rowContainsTargets(row, targets) {
  const counts = new Map()
  resultDigits(row).forEach((digit) => counts.set(digit, (counts.get(digit) || 0) + 1))
  const needed = new Map()
  targets.forEach((digit) => needed.set(digit, (needed.get(digit) || 0) + 1))
  return [...needed.entries()].every(([digit, count]) => (counts.get(digit) || 0) >= count)
}

function findFirstMatch(rows, targets, window) {
  const rowIndex = rows
    .slice(0, window)
    .findIndex((row) => rowContainsTargets(row, targets))

  if (rowIndex < 0) return null
  return { row: rows[rowIndex], rowIndex }
}

export function searchCandidateSources(history, f, g, h, pairWindow = GH_SEARCH_WINDOW) {
  const rows = (Array.isArray(history) ? history : []).map(normalizeResult).filter(Boolean)
  if (!rows.length) throw new Error('WIN6XGEN ต้องมีข้อมูลย้อนหลัง')

  // Backward compatibility for older direct calls: (history, g, h)
  if (h === undefined) {
    h = g
    g = f
    f = null
  }

  const strategies = [
    { mode: 'G+H', kind: 'G+H', targets: [g, h] },
    ...(Number.isInteger(f) ? [{ mode: 'F+G', kind: 'F+G', targets: [f, g] }] : []),
    { mode: 'H', kind: 'H', targets: [h] },
    { mode: 'G', kind: 'G', targets: [g] },
    ...(Number.isInteger(f) ? [{ mode: 'F', kind: 'F', targets: [f] }] : []),
  ]

  const windows = uniqueFirst([pairWindow, 6, 7, 8]).filter((window) => window >= pairWindow && window <= 8)

  for (const window of windows) {
    for (const strategy of strategies) {
      const match = findFirstMatch(rows, strategy.targets, window)
      if (!match) continue

      return {
        mode: strategy.mode,
        pairWindow,
        searchWindowUsed: window,
        matches: [{
          kind: strategy.kind,
          target: strategy.targets,
          row: match.row,
          rowIndex: match.rowIndex,
        }],
      }
    }
  }

  throw new Error(
    Number.isInteger(f)
      ? `ไม่พบ G+H, F+G, H=${h}, G=${g} หรือ F=${f} ภายใน 8 งวดย้อนหลัง`
      : `ไม่พบ G+H, H=${h} หรือ G=${g} ภายใน 8 งวดย้อนหลัง`,
  )
}

export function buildCandidatePool(fgh, sourceSearch) {
  return uniqueFirst([
    fgh.f,
    fgh.g,
    fgh.h,
    ...sourceSearch.matches.flatMap((match) => resultDigits(match.row)),
  ])
}

// Legacy export retained for compatibility. MOD10 is no longer used to select WIN6.
export function partitionWin6(values) {
  if (!Array.isArray(values) || values.length !== 6 || uniqueFirst(values).length !== 6) return null
  return { type: 'NONE', groups: [] }
}

// Legacy export retained for compatibility. Selection is now first-six unique digits only.
export function findFirstValidWin6(candidatePool, requiredDigits = []) {
  const pool = uniqueFirst(candidatePool)
  const required = uniqueFirst(requiredDigits)
  if (pool.length < 6) return null

  const values = pool.slice(0, 6)
  if (!required.every((digit) => values.includes(digit))) {
    const merged = uniqueFirst([...required, ...pool])
    if (merged.length < 6) return null
    return { values: merged.slice(0, 6), type: 'NONE', groups: [] }
  }

  return { values, type: 'NONE', groups: [] }
}

// Legacy export retained for compatibility. No MOD10 filtering is applied anymore.
export function findHistoryZeroPairs() {
  return []
}

export function selectWin6(candidatePool, history, requiredDigits = []) {
  const selected = findFirstValidWin6(candidatePool, requiredDigits)
  if (!selected) {
    throw new Win6XgenError(
      'INSUFFICIENT_WIN6_DIGITS',
      'เลขไม่ครบ 6 ตัวสำหรับ WIN6',
      { candidatePool: uniqueFirst(candidatePool), requiredDigits: uniqueFirst(requiredDigits) },
    )
  }

  return {
    ...selected,
    candidatePool: uniqueFirst(candidatePool),
    fillPair: null,
    selectionMode: 'HISTORY_FIRST_UNIQUE',
  }
}

// Legacy export retained for compatibility. F fallback is now handled by source priority search.
export function searchWin6ByF(candidatePool) {
  const selected = findFirstValidWin6(candidatePool)
  return {
    selected,
    candidatePool: uniqueFirst(candidatePool),
    match: null,
    attempts: [],
  }
}

function collectWin6FromSource(history, fgh, sourceSearch) {
  const rows = (Array.isArray(history) ? history : []).map(normalizeResult).filter(Boolean)
  const startIndex = sourceSearch.matches[0]?.rowIndex ?? 0
  const base = uniqueFirst([fgh.f, fgh.g, fgh.h])
  let candidatePool = [...base]
  let rowsUsed = 0

  const availableFromSource = rows.slice(startIndex)
  const limits = [5, 6, 7, 8]

  for (const limit of limits) {
    const capped = availableFromSource.slice(0, limit)
    candidatePool = uniqueFirst([
      ...base,
      ...capped.flatMap((row) => resultDigits(row)),
    ])
    rowsUsed = capped.length

    if (candidatePool.length >= 6) {
      return {
        candidatePool,
        rowsUsed,
        collectionWindowUsed: limit,
        sourceStartIndex: startIndex,
      }
    }
  }

  throw new Win6XgenError(
    'INSUFFICIENT_WIN6_DIGITS',
    'ย้อนจากงวดที่พบถึง 8 งวดแล้วยังมีเลขไม่ครบ 6 ตัว',
    {
      sourceStartIndex: startIndex,
      candidatePool,
      rowsAvailable: availableFromSource.length,
    },
  )
}

export function buildPin2(win6) {
  if (!Array.isArray(win6) || win6.length !== 6) return []
  return PIN2_TEMPLATES.map((positions) => ({
    pair: positions.map((position) => win6[position]).join(''),
    positions: positions.map((position) => position + 1),
    reversible: true,
  }))
}

export function buildPin3(win6) {
  if (!Array.isArray(win6) || win6.length !== 6) return []
  return PIN3_TEMPLATES.map((positions) => ({
    triple: positions.map((position) => win6[position]).join(''),
    positions: positions.map((position) => position + 1),
    reversible: true,
  }))
}

export function analyzeWin6Xgen(input) {
  const source = normalizeResult(input)
  if (!source) throw new Error('ผลล่าสุดไม่ถูกต้อง')

  const history = (Array.isArray(input?.history) ? input.history : [])
    .map(normalizeResult)
    .filter(Boolean)
    .slice(0, HISTORY_LIMIT - 1)

  if (!history.length) throw new Error('WIN6XGEN ต้องมีผลย้อนหลังอย่างน้อย 1 งวด')

  const fgh = calculateFGH(source.top3, source.bottom2)
  const sourceSearch = searchCandidateSources(history, fgh.f, fgh.g, fgh.h)
  const collected = collectWin6FromSource(history, fgh, sourceSearch)
  const selected = selectWin6(collected.candidatePool, history, [fgh.f, fgh.g])
  const reserve = selected.candidatePool.find((digit) => !selected.values.includes(digit)) ?? null

  return {
    engine: 'WIN6XGEN',
    version: '3.0.0',
    source,
    history,
    historyUsed: Math.min(history.length + 1, HISTORY_LIMIT),
    ...fgh,
    sourceSearch,
    initialCandidatePool: buildCandidatePool(fgh, sourceSearch),
    candidatePool: selected.candidatePool,
    selectionMode: selected.selectionMode,
    collectionWindowUsed: collected.collectionWindowUsed,
    collectionRowsUsed: collected.rowsUsed,
    sourceStartIndex: collected.sourceStartIndex,
    fillPair: null,
    fSearch: null,
    win6: selected.values,
    partitionType: 'NONE',
    mod10Groups: [],
    reserve,
    pin2: buildPin2(selected.values),
    pin3: buildPin3(selected.values),
  }
}
