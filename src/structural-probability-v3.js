import { analyzeStructuralProbabilityV2 } from './structural-probability-v2.js'

export function selectReserveFromTopBottom(analysis) {
  const main = new Set(analysis.win6)
  const top = new Set(analysis.topWin6)
  const bottom = new Set(analysis.bottomWin6)
  const fusionScore = new Map(analysis.rankings.fusion.map((item) => [item.digit, item.score]))
  const candidates = [...new Set([...analysis.topWin6, ...analysis.bottomWin6])]
    .filter((digit) => !main.has(digit))
    .map((digit) => ({
      digit,
      score: fusionScore.get(digit) ?? 0,
      sources: [top.has(digit) ? 'TOP' : null, bottom.has(digit) ? 'BOTTOM' : null].filter(Boolean),
    }))
    .sort((a, b) => b.score - a.score || b.sources.length - a.sources.length || a.digit - b.digit)

  if (candidates.length) {
    return {
      digit: candidates[0].digit,
      score: candidates[0].score,
      sources: candidates[0].sources,
      candidates,
      fallback: false,
    }
  }

  const fallback = analysis.rankings.fusion.find((item) => !main.has(item.digit)) || null
  return {
    digit: fallback?.digit ?? null,
    score: fallback?.score ?? null,
    sources: fallback ? ['FUSION_7TH'] : [],
    candidates: [],
    fallback: Boolean(fallback),
  }
}

export function analyzeStructuralProbabilityV3(history, options = {}) {
  const analysis = analyzeStructuralProbabilityV2(history, options)
  const reserve = selectReserveFromTopBottom(analysis)
  return {
    ...analysis,
    version: 'v3.0-win6-reserve',
    reserve: reserve.digit,
    reserveScore: reserve.score,
    reserveSources: reserve.sources,
    reserveCandidates: reserve.candidates,
    reserveFallback: reserve.fallback,
  }
}
