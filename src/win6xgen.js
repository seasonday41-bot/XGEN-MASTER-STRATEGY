export const HISTORY_LIMIT = 30
export const GH_SEARCH_WINDOW = 5

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

function firstTargetMatch(rows, target) {
  const rowIndex = rows.findIndex((row) => rowContainsTargets(row, [target]))
  if (rowIndex < 0) return null
  return { kind: String(target), target: [target], row: rows[rowIndex], rowIndex }
}

export function searchCandidateSources(history, g, h, pairWindow = GH_SEARCH_WINDOW) {
  const rows = (Array.isArray(history) ? history : []).map(normalizeResult).filter(Boolean)
  if (!rows.length) throw new Error('WIN6XGEN ต้องมีข้อมูลย้อนหลัง')

  const pairIndex = rows
    .slice(0, pairWindow)
    .findIndex((row) => rowContainsTargets(row, [g, h]))

  if (pairIndex >= 0) {
    return {
      mode: 'G+H',
      pairWindow,
      matches: [{ kind: 'G+H', target: [g, h], row: rows[pairIndex], rowIndex: pairIndex }],
    }
  }

  const hMatch = firstTargetMatch(rows, h)
  const gMatch = firstTargetMatch(rows, g)
  const matches = [hMatch, gMatch].filter(Boolean)

  if (!matches.length) {
    throw new Error(`ไม่พบ H=${h} หรือ G=${g} ในข้อมูลย้อนหลัง`)
  }

  return { mode: 'H→G', pairWindow, matches }
}

export function buildCandidatePool(fgh, sourceSearch) {
  return uniqueFirst([
    fgh.f,
    fgh.g,
    fgh.h,
    ...sourceSearch.matches.flatMap((match) => resultDigits(match.row)),
  ])
}

function combinations(values, size, start = 0, selected = [], output = []) {
  if (selected.length === size) {
    output.push([...selected])
    return output
  }

  const remaining = size - selected.length
  for (let index = start; index <= values.length - remaining; index += 1) {
    selected.push(values[index])
    combinations(values, size, index + 1, selected, output)
    selected.pop()
  }
  return output
}

function findPairPartition(values) {
  if (!values.length) return []
  const [first, ...rest] = values

  for (let index = 0; index < rest.length; index += 1) {
    const second = rest[index]
    if (mod10(first + second) !== 0) continue
    const remaining = rest.filter((_, restIndex) => restIndex !== index)
    const nested = findPairPartition(remaining)
    if (nested) return [[first, second], ...nested]
  }

  return null
}

function findTriplePartition(values) {
  const [first, ...rest] = values
  for (let left = 0; left < rest.length - 1; left += 1) {
    for (let right = left + 1; right < rest.length; right += 1) {
      const group = [first, rest[left], rest[right]]
      if (mod10(group.reduce((sum, digit) => sum + digit, 0)) !== 0) continue

      const remaining = rest.filter((_, index) => index !== left && index !== right)
      if (remaining.length === 3 && mod10(remaining.reduce((sum, digit) => sum + digit, 0)) === 0) {
        return [group, remaining]
      }
    }
  }
  return null
}

export function partitionWin6(values) {
  if (!Array.isArray(values) || values.length !== 6 || uniqueFirst(values).length !== 6) return null

  const pairs = findPairPartition(values)
  if (pairs?.length === 3) return { type: 'PAIR×3', groups: pairs }

  const triples = findTriplePartition(values)
  if (triples?.length === 2) return { type: 'TRIPLE×2', groups: triples }

  return null
}

export function findFirstValidWin6(candidatePool, requiredDigits = []) {
  const pool = uniqueFirst(candidatePool)
  const required = uniqueFirst(requiredDigits)
  if (pool.length < 6) return null

  for (const values of combinations(pool, 6)) {
    if (!required.every((digit) => values.includes(digit))) continue
    const partition = partitionWin6(values)
    if (partition) return { values, ...partition }
  }

  return null
}

export function findHistoryZeroPairs(history) {
  const output = []
  const seen = new Set()

  ;(Array.isArray(history) ? history : []).map(normalizeResult).filter(Boolean).forEach((row, rowIndex) => {
    const digits = resultDigits(row)
    for (let left = 0; left < digits.length - 1; left += 1) {
      for (let right = left + 1; right < digits.length; right += 1) {
        const a = digits[left]
        const b = digits[right]
        if (a === b || mod10(a + b) !== 0) continue
        const key = [a, b].sort((x, y) => x - y).join('')
        if (seen.has(key)) continue
        seen.add(key)
        output.push({ pair: `${a}${b}`, digits: [a, b], row, rowIndex })
      }
    }
  })

  return output
}

export function selectWin6(candidatePool, history, requiredDigits) {
  const corePool = uniqueFirst(candidatePool)
  const direct = findFirstValidWin6(corePool, requiredDigits)
  if (direct) {
    return { ...direct, candidatePool: corePool, fillPair: null, selectionMode: 'CANDIDATE_POOL' }
  }

  if (corePool.length >= 6) {
    throw new Win6XgenError(
      'NO_VALID_WIN6',
      'Candidate Pool ไม่มี WIN6 ที่ผ่าน MOD10 ตามวิธีที่บันทึกไว้',
      { candidatePool: corePool, requiredDigits: uniqueFirst(requiredDigits) },
    )
  }

  const zeroPairs = findHistoryZeroPairs(history).map((item) => ({
    ...item,
    blockedBy: item.digits.filter((digit) => corePool.includes(digit)),
  }))
  const fillPair = zeroPairs.find((item) => item.blockedBy.length === 0)
  if (!fillPair) {
    throw new Win6XgenError(
      'NO_DISJOINT_MOD10_PAIR',
      'ไม่พบคู่ MOD10 คู่แรกที่ไม่ซ้ำ Candidate Pool',
      {
        candidatePool: corePool,
        requiredDigits: uniqueFirst(requiredDigits),
        zeroPairs,
      },
    )
  }

  const expandedPool = uniqueFirst([...corePool, ...fillPair.digits])
  const selected = findFirstValidWin6(expandedPool, requiredDigits)
  if (!selected) {
    throw new Win6XgenError(
      'FIRST_PAIR_NOT_VALID',
      'คู่ MOD10 คู่แรกยังจัด WIN6 ตามวิธีที่บันทึกไว้ไม่ได้',
      {
        candidatePool: expandedPool,
        initialCandidatePool: corePool,
        requiredDigits: uniqueFirst(requiredDigits),
        fillPair,
        zeroPairs,
      },
    )
  }

  return {
    ...selected,
    candidatePool: expandedPool,
    fillPair,
    selectionMode: 'FIRST_HISTORY_MOD10_PAIR',
  }
}

export function searchWin6ByF(candidatePool, history, f, requiredDigits, excludedRowIndexes = []) {
  const corePool = uniqueFirst(candidatePool)
  const excluded = new Set(excludedRowIndexes)
  const attempts = []
  const rows = (Array.isArray(history) ? history : []).map(normalizeResult).filter(Boolean)

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    if (excluded.has(rowIndex)) continue
    const row = rows[rowIndex]
    const digits = resultDigits(row)
    if (!digits.includes(Number(f))) continue

    const expandedPool = uniqueFirst([...corePool, ...digits])
    const selected = findFirstValidWin6(expandedPool, requiredDigits)
    const attempt = { row, rowIndex, candidatePool: expandedPool, valid: Boolean(selected) }
    attempts.push(attempt)

    if (selected) {
      return {
        selected,
        candidatePool: expandedPool,
        match: attempt,
        attempts,
      }
    }
  }

  return { selected: null, candidatePool: corePool, match: null, attempts }
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
  const sourceSearch = searchCandidateSources(history, fgh.g, fgh.h)
  const initialCandidatePool = buildCandidatePool(fgh, sourceSearch)
  let selected
  let primaryError = null

  try {
    selected = selectWin6(initialCandidatePool, history, [fgh.f, fgh.g])
  } catch (error) {
    primaryError = error
  }

  if (!selected) {
    const excludedRows = sourceSearch.matches.map((match) => match.rowIndex)
    const fSearch = searchWin6ByF(
      initialCandidatePool,
      history,
      fgh.f,
      [fgh.f, fgh.g],
      excludedRows,
    )

    if (fSearch.selected) {
      selected = {
        ...fSearch.selected,
        candidatePool: fSearch.candidatePool,
        fillPair: null,
        selectionMode: 'F_HISTORY_SEARCH',
        fSearch: {
          match: fSearch.match,
          attempts: fSearch.attempts,
        },
      }
    } else {
      const error = primaryError instanceof Win6XgenError
        ? primaryError
        : new Win6XgenError('NO_VALID_WIN6', primaryError?.message || 'ยังจัด WIN6 ไม่ได้')
      error.details = {
        source,
        fgh,
        sourceSearch,
        initialCandidatePool,
        historyUsed: Math.min(history.length + 1, HISTORY_LIMIT),
        ...error.details,
        fSearch: {
          attempts: fSearch.attempts,
          excludedRowIndexes: excludedRows,
        },
      }
      throw error
    }
  }
  const reserve = selected.candidatePool.find((digit) => !selected.values.includes(digit)) ?? null

  return {
    engine: 'WIN6XGEN',
    version: '2.1.0',
    source,
    history,
    historyUsed: Math.min(history.length + 1, HISTORY_LIMIT),
    ...fgh,
    sourceSearch,
    initialCandidatePool,
    candidatePool: selected.candidatePool,
    selectionMode: selected.selectionMode,
    fillPair: selected.fillPair,
    fSearch: selected.fSearch || null,
    win6: selected.values,
    partitionType: selected.type,
    mod10Groups: selected.groups,
    reserve,
    pin2: buildPin2(selected.values),
    pin3: buildPin3(selected.values),
  }
}
