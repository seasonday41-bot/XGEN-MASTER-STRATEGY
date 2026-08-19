export function formatFlowCopyText(result) {
  return [
    `🏷️ ตลาด ${result.marketName}`,
    `📊 ผลล่าสุด ${result.source.top3}-${result.source.bottom2}`,
    '',
    `⚡ รูด ${result.rud.join(' • ')}`,
    `✨ WIN6 ${result.win6.join(' • ')}`,
    '',
    `🎯 เจาะ 2 ${result.pin2.map((item) => item.pair).join(' • ')}`,
    `🎯 เจาะ 3 ${result.pin3.map((item) => item.triple).join(' • ')}`,
    `⭐ เจาะ 3 เสริม ${result.pin3Extra.map((item) => item.triple).join(' • ')}`,
  ].join('\n')
}
