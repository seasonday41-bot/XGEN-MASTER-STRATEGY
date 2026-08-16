const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, Math.round(value)))

const levelMeta = {
  NORMAL: { label: 'ปกติ', icon: '●' },
  WATCH: { label: 'จับตา', icon: '◐' },
  ALERT: { label: 'เตือน', icon: '▲' },
  STRONG: { label: 'แรง', icon: '◆' },
}

function levelFromScore(score) {
  if (score >= 75) return 'STRONG'
  if (score >= 55) return 'ALERT'
  if (score >= 35) return 'WATCH'
  return 'NORMAL'
}

function transitionBonus(transition, maxBonus = 16) {
  if (!transition || transition.percentage == null || transition.samples < 3) return 0
  return Math.min(maxBonus, transition.percentage * 0.16)
}

function transitionText(label, transition) {
  if (!transition || transition.samples === 0) return null
  if (transition.percentage == null) {
    return `${label} มีตัวอย่างย้อนหลัง ${transition.hits}/${transition.samples} • ตัวอย่างยังน้อย`
  }
  return `${label} ย้อนหลัง ${transition.hits}/${transition.samples} (${transition.percentage}%)`
}

function makeSignal({ key, title, score, reasons, evidence }) {
  const bounded = clamp(score)
  const level = levelFromScore(bounded)
  return {
    key,
    title,
    score: bounded,
    level,
    levelLabel: levelMeta[level].label,
    icon: levelMeta[level].icon,
    reasons: reasons.filter(Boolean).slice(0, 3),
    evidence: evidence || null,
  }
}

export function buildNextDrawSignals(analysis) {
  if (!analysis?.patterns?.current) return []

  const current = analysis.patterns.current
  const doublePattern = analysis.patterns.double
  const hamPattern = analysis.patterns.ham
  const siblingPattern = analysis.patterns.sibling
  const repeatPattern = analysis.patterns.repeat
  const hamToDouble = analysis.transitions?.hamToDouble
  const doubleToSibling = analysis.transitions?.doubleToSibling

  let doubleScore = doublePattern.pressure
  const doubleReasons = [`Pressure เบิ้ล ${doublePattern.pressure}`]
  if (current.ham) {
    doubleScore += 30
    doubleReasons.unshift('งวดล่าสุดมีหามบน → เปิด DOUBLE ALERT')
  }
  if (current.nearSibling) {
    doubleScore += 8
    doubleReasons.push('ล่างเกือบพี่น้อง ระยะ 2 → มีแรงบีบ')
  }
  doubleScore += transitionBonus(hamToDouble)
  if (current.ham) doubleScore = Math.max(doubleScore, 58)
  if (current.ham && current.bottomDouble) doubleScore = Math.max(doubleScore, 86)

  let hamScore = hamPattern.pressure
  const hamReasons = [`Pressure หาม ${hamPattern.pressure}`]
  const hamMomentum = (hamPattern.rate5 || 0) - (hamPattern.rate20 || 0)
  if (hamMomentum > 0) {
    hamScore += Math.min(18, hamMomentum * 0.7)
    hamReasons.push(`หาม 5 งวดสูงกว่าฐาน 20 งวด +${hamMomentum} จุด`)
  }
  if (hamPattern.gap === 0) hamReasons.unshift('งวดล่าสุดเกิดหามแล้ว • เฝ้าดูการต่อ Pattern')
  else if (hamPattern.gap != null) hamReasons.push(`หามล่าสุดห่าง ${hamPattern.gap} งวด`)

  let siblingScore = siblingPattern.pressure
  const siblingReasons = [`Pressure พี่น้อง ${siblingPattern.pressure}`]
  if (current.bottomDouble) {
    siblingScore += 30
    siblingReasons.unshift('งวดล่าสุดเบิ้ลล่าง → เปิด SIBLING WATCH')
  }
  if (current.nearSibling) {
    siblingScore += 22
    siblingReasons.unshift('งวดล่าสุดเกือบพี่น้อง (ห่าง 2 แต้ม) → COMPRESSION')
  }
  if (current.sibling) {
    siblingScore += 10
    siblingReasons.unshift('งวดล่าสุดเป็นพี่น้อง → ตรวจลากสายต่อ')
  }
  siblingScore += transitionBonus(doubleToSibling)
  if (current.bottomDouble) siblingScore = Math.max(siblingScore, 58)
  if (current.nearSibling) siblingScore = Math.max(siblingScore, 45)

  let repeatScore = repeatPattern.pressure
  const repeatReasons = [`Pressure Repeat ${repeatPattern.pressure}`]
  if (repeatPattern.currentExact) {
    repeatScore += 14
    repeatReasons.unshift('ล่างซ้ำตรงจากงวดก่อน')
  } else if (repeatPattern.currentOverlap > 0) {
    repeatScore += 8
    repeatReasons.unshift(`ล่างมีเลขซ้ำจากงวดก่อน ${repeatPattern.currentOverlap} หลัก`)
  } else {
    repeatReasons.push('งวดล่าสุดไม่ซ้ำตรง')
  }

  const signals = [
    makeSignal({
      key: 'double',
      title: 'สัญญาณเบิ้ล',
      score: doubleScore,
      reasons: doubleReasons,
      evidence: current.ham ? transitionText('HAM→เบิ้ล', hamToDouble) : null,
    }),
    makeSignal({
      key: 'ham',
      title: 'สัญญาณหาม',
      score: hamScore,
      reasons: hamReasons,
    }),
    makeSignal({
      key: 'sibling',
      title: 'สัญญาณพี่น้อง',
      score: siblingScore,
      reasons: siblingReasons,
      evidence: current.bottomDouble ? transitionText('เบิ้ลล่าง→พี่น้อง', doubleToSibling) : null,
    }),
    makeSignal({
      key: 'repeat',
      title: 'สัญญาณซ้ำ',
      score: repeatScore,
      reasons: repeatReasons,
    }),
  ]

  if (current.ham && current.bottomDouble) {
    signals.unshift({
      key: 'reset',
      title: 'RESET ALERT',
      score: Math.max(90, analysis.compressionScore || 0),
      level: 'STRONG',
      levelLabel: 'แรงมาก',
      icon: '◆',
      reasons: [
        'หามบน + เบิ้ลล่างเกิดพร้อมกัน',
        'ลดการเชื่อ Flow เดิมและเฝ้าการเปลี่ยนโครงสร้าง',
      ],
      evidence: null,
    })
  }

  return signals.sort((left, right) => right.score - left.score)
}
