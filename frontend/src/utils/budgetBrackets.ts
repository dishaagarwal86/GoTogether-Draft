export type BudgetTier = 'Budget-friendly' | 'Moderate' | 'Premium' | 'Flexible'
export const BUDGET_TIERS: BudgetTier[] = ['Budget-friendly', 'Moderate', 'Premium', 'Flexible']

export type CurrencyBrackets = Record<BudgetTier, string>

const INR: CurrencyBrackets = { 'Budget-friendly': '₹10,000–₹30,000', 'Moderate': '₹30,000–₹80,000', 'Premium': '₹80,000+', 'Flexible': 'Flexible' }
const USD: CurrencyBrackets = { 'Budget-friendly': '$300–$900', 'Moderate': '$900–$2,500', 'Premium': '$2,500+', 'Flexible': 'Flexible' }
const GBP: CurrencyBrackets = { 'Budget-friendly': '£250–£750', 'Moderate': '£750–£2,000', 'Premium': '£2,000+', 'Flexible': 'Flexible' }
const EUR: CurrencyBrackets = { 'Budget-friendly': '€280–€800', 'Moderate': '€800–€2,200', 'Premium': '€2,200+', 'Flexible': 'Flexible' }
const AUD: CurrencyBrackets = { 'Budget-friendly': 'A$450–A$1,200', 'Moderate': 'A$1,200–A$3,200', 'Premium': 'A$3,200+', 'Flexible': 'Flexible' }
const CAD: CurrencyBrackets = { 'Budget-friendly': 'C$400–C$1,100', 'Moderate': 'C$1,100–C$3,000', 'Premium': 'C$3,000+', 'Flexible': 'Flexible' }
const SGD: CurrencyBrackets = { 'Budget-friendly': 'S$400–S$1,100', 'Moderate': 'S$1,100–S$3,000', 'Premium': 'S$3,000+', 'Flexible': 'Flexible' }
const AED: CurrencyBrackets = { 'Budget-friendly': 'AED 1,100–3,200', 'Moderate': 'AED 3,200–9,000', 'Premium': 'AED 9,000+', 'Flexible': 'Flexible' }
const JPY: CurrencyBrackets = { 'Budget-friendly': '¥45,000–¥130,000', 'Moderate': '¥130,000–¥380,000', 'Premium': '¥380,000+', 'Flexible': 'Flexible' }
const NZD: CurrencyBrackets = { 'Budget-friendly': 'NZ$450–NZ$1,300', 'Moderate': 'NZ$1,300–NZ$3,500', 'Premium': 'NZ$3,500+', 'Flexible': 'Flexible' }
const ZAR: CurrencyBrackets = { 'Budget-friendly': 'R4,000–R12,000', 'Moderate': 'R12,000–R35,000', 'Premium': 'R35,000+', 'Flexible': 'Flexible' }
const BRL: CurrencyBrackets = { 'Budget-friendly': 'R$1,500–R$4,500', 'Moderate': 'R$4,500–R$12,000', 'Premium': 'R$12,000+', 'Flexible': 'Flexible' }
const MXN: CurrencyBrackets = { 'Budget-friendly': 'MX$5,000–MX$15,000', 'Moderate': 'MX$15,000–MX$42,000', 'Premium': 'MX$42,000+', 'Flexible': 'Flexible' }

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

const CODES = new Map<CurrencyBrackets, string>([[INR, 'INR'], [USD, 'USD'], [GBP, 'GBP'], [EUR, 'EUR'], [AUD, 'AUD'], [CAD, 'CAD'], [SGD, 'SGD'], [AED, 'AED'], [JPY, 'JPY'], [NZD, 'NZD'], [ZAR, 'ZAR'], [BRL, 'BRL'], [MXN, 'MXN']])
export function getCurrencyCode(country: string | null | undefined): string {
  return CODES.get(getCurrencyBrackets(country)) ?? 'USD'
}
