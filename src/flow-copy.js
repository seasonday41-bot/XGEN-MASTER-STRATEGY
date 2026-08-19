function rowText(draw) {
  return `${draw.top3}-${draw.bottom2} → ${draw.topPoint} • ${draw.bottomPoint}`
}

export function formatFlowCopyText(result) {
  return [
    `🏷️ ตลาด ${result.marketName}`,
    '📊 3 งวดล่าสุด',
    ...result.draws.map(rowText),
    '',
    `⚡ รูด ${result.rud.join(' • ')}`,
    `✨ WIN6 ${result.win6.join(' • ')}`,
    '',
    `🎯 เจาะ 2 ${result.pin2.map((item) => item.pair).join(' • ')}`,
    `🎯 เจาะ 3 ${result.pin3.map((item) => item.triple).join(' • ')}`,
    `⭐ เจาะ 3 เสริม ${result.pin3Extra.map((item) => item.triple).join(' • ')}`,
  ].join('\n')
}
