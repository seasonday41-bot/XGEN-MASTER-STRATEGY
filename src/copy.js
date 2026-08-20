function spaced(values, empty = '—') {
  return values?.length ? values.join(' • ') : empty
}

function patternText(pattern) {
  const current = pattern?.current
  if (!current) return 'ปกติ'
  const parts = [current.top.label]
  if (current.bottomDouble) parts.push(`ล่างเบิ้ล ${current.bottomDoublePair}`)
  if (current.siblings.length) parts.push(`พี่น้อง ${current.siblings.map((item) => item.pair).join(' • ')}`)
  return parts.join(' • ')
}

function win6Text(result) {
  const reserve = Number.isInteger(result.reserve) ? ` (${result.reserve})` : ''
  return `✨ WIN6 ${spaced(result.win6)}${reserve}`
}

export function formatCopyText(result) {
  return [
    `🍀 WIN6XGEN | ${result.marketName}`,
    `${result.source.top3}-${result.source.bottom2}`,
    '',
    `⚡ รูด ${spaced(result.rud)}`,
    win6Text(result),
    `🎯 เจาะ 2 ${spaced(result.pin2.map((item) => item.pair))}`,
    `🎯 เจาะ 3 ${spaced(result.pin3.map((item) => item.triple))}`,
    '',
    `🧬 SyntraX ${patternText(result.pattern)}`,
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
