function joinOrNone(values, noneText = 'ไม่มี') {
  return values.length ? values.join(' • ') : noneText
}

export function formatCopyText(result) {
  return [
    `🏷️ ตลาด ${result.marketName}`,
    `📊 ผลล่าสุด ${result.source.top3}-${result.source.bottom2}`,
    `🔥 ตัวแรง ${result.strong.join(' • ')}`,
    `⭐ รอง ${result.secondary.join(' • ')}`,
    `✨ WIN6 ${result.win6.join(' • ')} (${result.seventh})`,
    `🔥 คู่เด่น ${joinOrNone(result.keyPairs)}`,
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
