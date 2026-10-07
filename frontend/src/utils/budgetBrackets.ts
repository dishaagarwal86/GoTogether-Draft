export type BudgetTier = 'Budget-friendly' | 'Moderate' | 'Premium' | 'Flexible'
export const BUDGET_TIERS: BudgetTier[] = ['Budget-friendly', 'Moderate', 'Premium', 'Flexible']

export type CurrencyBrackets = Record<BudgetTier, string>

const INR: CurrencyBrackets = { 'Budget-friendly': '₹1,500–₹4,000/day', 'Moderate': '₹4,000–₹10,000/day', 'Premium': '₹10,000+/day', 'Flexible': 'Flexible' }
const USD: CurrencyBrackets = { 'Budget-friendly': '$50–$150/day', 'Moderate': '$150–$350/day', 'Premium': '$350+/day', 'Flexible': 'Flexible' }
const GBP: CurrencyBrackets = { 'Budget-friendly': '£50–£130/day', 'Moderate': '£130–£300/day', 'Premium': '£300+/day', 'Flexible': 'Flexible' }
const EUR: CurrencyBrackets = { 'Budget-friendly': '€50–€130/day', 'Moderate': '€130–€300/day', 'Premium': '€300+/day', 'Flexible': 'Flexible' }
const AUD: CurrencyBrackets = { 'Budget-friendly': 'A$80–A$200/day', 'Moderate': 'A$200–A$500/day', 'Premium': 'A$500+/day', 'Flexible': 'Flexible' }
const CAD: CurrencyBrackets = { 'Budget-friendly': 'C$70–C$180/day', 'Moderate': 'C$180–C$400/day', 'Premium': 'C$400+/day', 'Flexible': 'Flexible' }
const SGD: CurrencyBrackets = { 'Budget-friendly': 'S$80–S$200/day', 'Moderate': 'S$200–S$500/day', 'Premium': 'S$500+/day', 'Flexible': 'Flexible' }
const AED: CurrencyBrackets = { 'Budget-friendly': 'AED 200–500/day', 'Moderate': 'AED 500–1,200/day', 'Premium': 'AED 1,200+/day', 'Flexible': 'Flexible' }
const JPY: CurrencyBrackets = { 'Budget-friendly': '¥5,000–¥15,000/day', 'Moderate': '¥15,000–¥40,000/day', 'Premium': '¥40,000+/day', 'Flexible': 'Flexible' }
const NZD: CurrencyBrackets = { 'Budget-friendly': 'NZ$80–NZ$200/day', 'Moderate': 'NZ$200–NZ$500/day', 'Premium': 'NZ$500+/day', 'Flexible': 'Flexible' }
const ZAR: CurrencyBrackets = { 'Budget-friendly': 'R500–R1,500/day', 'Moderate': 'R1,500–R4,000/day', 'Premium': 'R4,000+/day', 'Flexible': 'Flexible' }
const BRL: CurrencyBrackets = { 'Budget-friendly': 'R$100–R$300/day', 'Moderate': 'R$300–R$700/day', 'Premium': 'R$700+/day', 'Flexible': 'Flexible' }
const MXN: CurrencyBrackets = { 'Budget-friendly': 'MX$500–MX$1,500/day', 'Moderate': 'MX$1,500–MX$4,000/day', 'Premium': 'MX$4,000+/day', 'Flexible': 'Flexible' }

const COUNTRY_MAP: Record<string, CurrencyBrackets> = {
  'India': INR,
  'United States': USD, 'United States of America': USD,
  'United Kingdom': GBP, 'England': GBP, 'Scotland': GBP, 'Wales': GBP,
  'Australia': AUD,
  'Canada': CAD,
  'Singapore': SGD,
  'United Arab Emirates': AED,
  'Japan': JPY,
  'New Zealand': NZD,
  'South Africa': ZAR,
  'Brazil': BRL,
  'Mexico': MXN,
  'Germany': EUR, 'France': EUR, 'Spain': EUR, 'Italy': EUR, 'Netherlands': EUR,
  'Belgium': EUR, 'Austria': EUR, 'Portugal': EUR, 'Greece': EUR, 'Ireland': EUR,
  'Finland': EUR, 'Sweden': EUR, 'Denmark': EUR, 'Norway': EUR, 'Switzerland': EUR,
  'Poland': EUR, 'Czech Republic': EUR, 'Hungary': EUR, 'Slovakia': EUR,
  'Croatia': EUR, 'Luxembourg': EUR, 'Malta': EUR, 'Cyprus': EUR,
  'Estonia': EUR, 'Latvia': EUR, 'Lithuania': EUR, 'Slovenia': EUR,
}

export function getCurrencyBrackets(country: string | null | undefined): CurrencyBrackets {
  if (!country) return USD
  return COUNTRY_MAP[country] ?? USD
}
