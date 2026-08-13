export function formatCopyText(result) {
  return [
    `🍀 Xgen | ${result.marketName}`,
    `${result.source.top3}-${result.source.bottom2}`,
    '',
    `🔥 ตัวแรง ${result.strongDigit.digit}`,
    `⚡ รูดหลัก ${result.rud[0]} | รูดรอง ${result.rud[1]}`,
    `✨ WIN6 ${result.win6.join(' • ')}`,
    '',
    `🔄 วิเคราะห์เบิ้ล/หาม: ${result.doubleAnalysis.pattern}`,
    result.doubleAnalysis.message,
    `🎲 เลขเบิ้ลจากสูตร ${result.doubleAnalysis.doubles.join(' • ')}`,
    '',
    '🎯 เจาะ 2 (กลับได้)',
    result.pin2.map((item) => item.pair).join(' • '),
  ].join('\n')
}
