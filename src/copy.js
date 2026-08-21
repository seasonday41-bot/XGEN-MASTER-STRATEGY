function spaced(values, empty = '—') {
  return values?.length ? values.join(' • ') : empty
}

function uniqueText(values) {
  return [...new Set(values.filter(Boolean))]
}

function detectedDoubles(pattern) {
  const current = pattern?.current
  if (!current) return []

  const topPair = {
    TRIPLE: `${current.top.a}${current.top.a}`,
    AAB: `${current.top.a}${current.top.b}`,
    ABB: `${current.top.b}${current.top.c}`,
  }[current.top.type]

  return uniqueText([topPair, current.bottomDoublePair])
}

function structuralSiblingDigits(top) {
  return {
    AAB: [top.a, top.c],
    ABB: [top.b, top.a],
    ABA: [top.a, top.b],
  }[top.type] || []
}

function siblingPicks(result) {
  const pattern = result.pattern
  const current = pattern?.current
  if (!current) return []

  const structuralDigits = structuralSiblingDigits(current.top)

  if (structuralDigits.length && result.rud?.length >= 2) {
    return uniqueText([
      `${structuralDigits[0]}${result.rud[0]}`,
      `${structuralDigits[1]}${result.rud[1]}`,
    ])
  }

  return uniqueText(
    pattern.outputs?.siblings || current.siblings.map((item) => item.pair)
  )
}

function patternLines(result) {
  const current = result.pattern?.current
  const lines = [`🧬 ${current?.top?.label || 'ปกติ'}`]

  const doubles = detectedDoubles(result.pattern)
  const siblings = siblingPicks(result)

  if (doubles.length) {
    lines.push(`🎲 เบิ้ล ${spaced(doubles)}`)
  }

  if (siblings.length) {
    lines.push(`👥 พี่น้อง ${spaced(siblings)}`)
  }

  return lines
}

function win6Text(result) {
  const reserve = Number.isInteger(result.reserve)
    ? ` (${result.reserve})`
    : ''

  return `✨ WIN6 ${spaced(result.win6)}${reserve}`
}

export function formatCopyText(result) {
  return [
    `🍀 WIN6XGEN | ${result.marketName}`,
    `${result.source.top3}-${result.source.bottom2}`,
    '',
    `⚡ รูด ${spaced(result.rud)}`,
    win6Text(result),
    '',
    ...patternLines(result),
    '',
    `🎯 เจาะ 2 ${spaced(result.pin2.map((item) => item.pair))}`,
    `🎯 เจาะ 3 ${spaced(result.pin3.map((item) => item.triple))}`,

    ...(result.prediction ? [
      '',
      `🧬 Prediction: ${result.prediction.prediction || '-'}`,
      `📊 โอกาส เบิ้ล ${result.prediction.double || '-'} • พี่น้อง ${result.prediction.sibling || '-'}`
    ] : [])

  ].join('\n')
}

export function formatCopySection(result, section) {
  const sections = {
    rud: `⚡ รูด ${spaced(result.rud)}`,
    win6: win6Text(result),
    pin2: `🎯 เจาะ 2 ${spaced(result.pin2.map((item) => item.pair))}`,
    pin3: `🎯 เจาะ 3 ${spaced(result.pin3.map((item) => item.triple))}`,
  }

  return sections[section] || formatCopyText(result)
}
