const thaiCollator = new Intl.Collator('th-TH', {
  sensitivity: 'base',
  numeric: true,
})

export function normalizeMarketSearch(value) {
  return String(value || '').trim().normalize('NFC').toLocaleLowerCase('th-TH')
}

function matchScore(name, query) {
  if (name === query) return 0
  if (name.startsWith(query)) return 1

  const wordStarts = name
    .split(/[\s/()-]+/u)
    .some((part) => part.startsWith(query))
  if (wordStarts) return 2

  const matchIndex = name.indexOf(query)
  return matchIndex >= 0 ? 3 + (matchIndex / 1000) : Number.POSITIVE_INFINITY
}

export function rankMarketMatches(markets, query, selectedMarketKey = null) {
  const normalizedQuery = normalizeMarketSearch(query)
  const source = Array.isArray(markets) ? markets : []
  if (!normalizedQuery) return [...source]

  return source
    .map((market, index) => {
      const normalizedName = normalizeMarketSearch(market?.market_name)
      return {
        market,
        index,
        normalizedName,
        score: matchScore(normalizedName, normalizedQuery),
      }
    })
    .filter((item) => Number.isFinite(item.score))
    .sort((left, right) => {
      if (left.score !== right.score) return left.score - right.score

      const leftSelected = left.market?.market_key === selectedMarketKey ? 1 : 0
      const rightSelected = right.market?.market_key === selectedMarketKey ? 1 : 0
      if (leftSelected !== rightSelected) return rightSelected - leftSelected

      const nameOrder = thaiCollator.compare(left.normalizedName, right.normalizedName)
      return nameOrder || left.index - right.index
    })
    .map((item) => item.market)
}
