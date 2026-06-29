const API_URL = 'https://open.er-api.com/v6/latest/USD'
const CACHE_TTL = 5 * 60 * 1000 // 5 min

interface RateCache {
  rates: Record<string, number>
  timestamp: number
}

let cache: RateCache | null = null

async function fetchRates(): Promise<Record<string, number>> {
  const res = await fetch(API_URL)
  if (!res.ok) throw new Error(`Exchange rate API error: ${res.status}`)
  const data = await res.json()
  if (!data.rates) throw new Error('Invalid exchange rate response')
  return data.rates as Record<string, number>
}

export async function getExchangeRate(from: string, to: string): Promise<number> {
  const now = Date.now()
  if (!cache || now - cache.timestamp > CACHE_TTL) {
    const rates = await fetchRates()
    cache = { rates, timestamp: now }
  }

  if (from === 'USD' && cache.rates[to]) return cache.rates[to]
  if (to === 'USD' && cache.rates[from]) return 1 / cache.rates[from]
  if (cache.rates[from] && cache.rates[to]) return cache.rates[to] / cache.rates[from]
  throw new Error(`Unsupported currency pair: ${from} → ${to}`)
}
