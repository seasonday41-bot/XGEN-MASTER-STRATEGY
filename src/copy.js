function joinOrNone(values, noneText = 'ไม่มี') {
  return values?.length ? values.join(' • ') : noneText
}

export function formatCopyText(result) {
  const coreSet = result.coreSet || result.win6 || []
  const firstMatch = result.firstMatch
    ? `${result.firstMatch.top3}-${result.firstMatch.bottom2}`
    : '—'

  return [
    `🏷️ ตลาด ${result.marketName}`,
    `📊 ผลล่าสุด ${result.source.top3}-${result.source.bottom2}`,
    `⚡ FG ${joinOrNone(result.fg || [], '—')}${result.isTriple ? ' • กฎตอง' : ''}`,
    `🌑 เงา FG ${joinOrNone(result.shadow || [], '—')}`,
    `🔎 คู่ค้น ${joinOrNone(result.searchPairs || [], '—')}`,
    `📚 ชุดแรก ${firstMatch} • เจอคู่ ${joinOrNone(result.matchedPairs || [], '—')}`,
    `✨ ชุดหลัก ${joinOrNone(coreSet, '—')}`,
    '',
    `🎯 เจาะ 2 = ${(result.pin2 || []).map((item) => item.pair).join(' • ')}`,
    `🎯 เจาะ 3 = ${(result.pin3 || []).map((item) => item.triple).join(' • ')}`,
    `⭐ เจาะ 3 เสริม ${(result.pin3Extra || []).map((item) => item.triple).join(' • ')}`,
    '',
    `🔄 เบิ้ล ${joinOrNone(result.patterns?.doubles || [])}`,
    `👑 ตอง ${joinOrNone(result.patterns?.triples || [])}`,
    `👯 พี่น้อง ${joinOrNone(result.patterns?.siblings || [])}`,
  ].join('\n')
}
