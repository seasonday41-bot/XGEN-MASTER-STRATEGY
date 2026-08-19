function joinOrNone(values, noneText = 'ไม่มี') {
  return values.length ? values.join(' • ') : noneText
}

export function formatCopyText(result) {
  return [
    `🏷️ ตลาด ${result.marketName}`,
    `📊 ผลล่าสุด ${result.source.top3}-${result.source.bottom2}`,
    `⚡ รูด FG ${result.fg.join(' • ')}`,
    `⭐ รองสถิติ ${result.secondary.join(' • ')}`,
    `✨ WIN6 ${result.win6.join(' • ')} (${result.seventh ?? '—'})`,
    `📚 ชุดย้อนหลังที่มี FG ครบ ${result.matchCount} งวด`,
    '',
    `🎯 เจาะ 2 = ${result.pin2.map((item) => item.pair).join(' • ')}`,
    `🎯 เจาะ 3 = ${result.pin3.map((item) => item.triple).join(' • ')}`,
    `⭐ เจาะ 3 เสริม ${result.pin3Extra.map((item) => item.triple).join(' • ')}`,
    '',
    `🔄 เบิ้ล ${joinOrNone(result.patterns.doubles)}`,
    `👑 ตอง ${joinOrNone(result.patterns.triples)}`,
    `👯 พี่น้อง ${joinOrNone(result.patterns.siblings)}`,
  ].join('\n')
}
