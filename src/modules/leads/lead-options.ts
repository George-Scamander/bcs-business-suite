import type { DictionaryItem } from '../shared/api/dictionary'

export interface RegionOption {
  value: string
  label: string
  cities: string[]
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[_-]/g, ' ')
}

const INDONESIA_REGION_CITY_FALLBACK: Array<{ region: string; cities: string[] }> = [
  { region: 'DKI Jakarta', cities: ['Central Jakarta', 'North Jakarta', 'South Jakarta', 'West Jakarta', 'East Jakarta'] },
  { region: 'West Java', cities: ['Bandung', 'Bogor', 'Bekasi', 'Depok', 'Cimahi'] },
  { region: 'Central Java', cities: ['Semarang', 'Surakarta', 'Magelang', 'Salatiga', 'Pekalongan'] },
  { region: 'East Java', cities: ['Surabaya', 'Malang', 'Kediri', 'Madiun', 'Pasuruan'] },
  { region: 'Banten', cities: ['Tangerang', 'South Tangerang', 'Serang', 'Cilegon'] },
  { region: 'DI Yogyakarta', cities: ['Yogyakarta'] },
  { region: 'Bali', cities: ['Denpasar'] },
  { region: 'North Sumatra', cities: ['Medan', 'Binjai', 'Pematangsiantar'] },
  { region: 'South Sumatra', cities: ['Palembang', 'Prabumulih', 'Lubuklinggau'] },
  { region: 'Riau', cities: ['Pekanbaru', 'Dumai'] },
  { region: 'South Sulawesi', cities: ['Makassar', 'Parepare', 'Palopo'] },
  { region: 'North Sulawesi', cities: ['Manado', 'Bitung', 'Tomohon'] },
  { region: 'East Kalimantan', cities: ['Samarinda', 'Balikpapan', 'Bontang'] },
  { region: 'West Kalimantan', cities: ['Pontianak', 'Singkawang'] },
  { region: 'Papua', cities: ['Jayapura'] },
]

export const LEAD_SOURCE_FALLBACK_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'Cold Visit', value: 'COLD_VISIT' },
  { label: 'Referral', value: 'REFERRAL' },
  { label: 'Event', value: 'EVENT' },
  { label: 'Social Media', value: 'SOCIAL_MEDIA' },
  { label: 'Website Inquiry', value: 'WEBSITE_INQUIRY' },
  { label: 'Partner Channel', value: 'PARTNER_CHANNEL' },
]

function parseRegionAndCityFromCode(code: string): { region: string; cityCode: string } | null {
  const delimiter = code.includes('::') ? '::' : code.includes('|') ? '|' : ''

  if (!delimiter) {
    return null
  }

  const [regionRaw, cityRaw] = code.split(delimiter)
  const region = regionRaw?.trim()
  const cityCode = cityRaw?.trim()

  if (!region || !cityCode) {
    return null
  }

  return { region, cityCode }
}

function buildFromFallback(): RegionOption[] {
  return INDONESIA_REGION_CITY_FALLBACK.map((item) => ({
    value: item.region,
    label: item.region,
    cities: item.cities,
  }))
}

export function buildRegionOptions(dictionaryItems: DictionaryItem[]): RegionOption[] {
  const regionItems = dictionaryItems.filter((item) => item.dictionary_type === 'lead_region' && item.is_active)
  const cityItems = dictionaryItems.filter(
    (item) => (item.dictionary_type === 'lead_city' || item.dictionary_type === 'lead_region_city') && item.is_active,
  )

  if (regionItems.length === 0 && cityItems.length === 0) {
    return buildFromFallback()
  }

  const cityMap = new Map<string, string[]>()

  for (const item of cityItems) {
    const parsed = parseRegionAndCityFromCode(item.code)

    if (parsed) {
      const next = cityMap.get(parsed.region) ?? []
      const cityLabel = item.label.trim()
      if (!next.includes(cityLabel)) {
        next.push(cityLabel)
      }
      cityMap.set(parsed.region, next)
      continue
    }

    // Fallback for plain city rows: use `label` as city and `code` as region key.
    const regionFromCode = item.code.trim()
    if (regionFromCode.length > 0) {
      const next = cityMap.get(regionFromCode) ?? []
      if (!next.includes(item.label)) {
        next.push(item.label)
      }
      cityMap.set(regionFromCode, next)
    }
  }

  const fallbackByRegion = new Map<string, string[]>()
  for (const item of INDONESIA_REGION_CITY_FALLBACK) {
    fallbackByRegion.set(item.region, item.cities)
  }

  const regionOptions = regionItems
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item) => ({
      value: item.label,
      label: item.label,
      cities: cityMap.get(item.code) ?? cityMap.get(item.label) ?? fallbackByRegion.get(item.label) ?? [],
    }))

  if (regionOptions.length > 0) {
    return regionOptions
  }

  return buildFromFallback()
}

export function buildLeadSourceOptions(dictionaryItems: DictionaryItem[]): Array<{ label: string; value: string }> {
  const sourceItems = dictionaryItems
    .filter((item) => item.dictionary_type === 'lead_source' && item.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)

  if (sourceItems.length === 0) {
    return LEAD_SOURCE_FALLBACK_OPTIONS
  }

  return sourceItems.map((item) => ({
    label: item.label,
    value: item.code,
  }))
}

export function findCitiesByRegion(regionOptions: RegionOption[], region?: string): string[] {
  if (!region) {
    return []
  }

  const directMatch = regionOptions.find((item) => item.value === region || item.label === region)
  if (directMatch) {
    return directMatch.cities
  }

  const normalizedRegion = normalizeKey(region)
  return (
    regionOptions.find((item) => normalizeKey(item.value) === normalizedRegion || normalizeKey(item.label) === normalizedRegion)
      ?.cities ?? []
  )
}
