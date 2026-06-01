import type { LeadRegionDistributionRow } from '../leads/api'

export interface ZoneProfile {
  match: RegExp
  zone: string
  center: [number, number]
  radius: number
}

export interface BlankArea {
  name: string
  note: string
  bounds: [[number, number], [number, number]]
}

export interface MappedLead extends LeadRegionDistributionRow {
  lat: number
  lng: number
  estimatedZone: string
  industryLabel: string
  regionLabel: string
}

export const zoneProfiles: ZoneProfile[] = [
  { match: /pluit|jakarta utara|kelapa gading|gading barat/i, zone: 'North Jakarta', center: [-6.142, 106.846], radius: 0.035 },
  { match: /jakarta selatan/i, zone: 'South Jakarta', center: [-6.2615, 106.8106], radius: 0.04 },
  { match: /pulo gadung/i, zone: 'East Jakarta', center: [-6.19, 106.899], radius: 0.03 },
  { match: /bekasi/i, zone: 'Bekasi', center: [-6.2383, 106.9756], radius: 0.045 },
  { match: /cikarang/i, zone: 'Cikarang', center: [-6.284, 107.1727], radius: 0.045 },
  { match: /depok/i, zone: 'Depok', center: [-6.4025, 106.7942], radius: 0.035 },
  { match: /cibubur|bogor/i, zone: 'Cibubur / Bogor Corridor', center: [-6.374, 106.897], radius: 0.035 },
  { match: /tangerang|banten/i, zone: 'Tangerang / Banten', center: [-6.1783, 106.6319], radius: 0.05 },
  { match: /west java|jawa barat/i, zone: 'West Java Corridor', center: [-6.25, 107.03], radius: 0.08 },
  { match: /central java/i, zone: 'Central Java', center: [-6.9667, 110.4167], radius: 0.04 },
  { match: /dki jakarta|jakarta/i, zone: 'DKI Jakarta', center: [-6.2088, 106.8456], radius: 0.065 },
  { match: /.*/, zone: 'Unspecified Greater Jakarta', center: [-6.2088, 106.8456], radius: 0.07 },
]

export const blankAreas: BlankArea[] = [
  {
    name: 'West Jakarta / Cengkareng',
    note: 'Commercial corridor to validate because current region labels show limited representation.',
    bounds: [[-6.2, 106.69], [-6.1, 106.79]],
  },
  {
    name: 'Central Jakarta',
    note: 'Dense city center to validate because few labels explicitly point here.',
    bounds: [[-6.22, 106.8], [-6.15, 106.88]],
  },
  {
    name: 'South-East Jakarta',
    note: 'Potential gap to validate between Pancoran, Pasar Minggu, and Cipayung.',
    bounds: [[-6.34, 106.83], [-6.24, 106.94]],
  },
  {
    name: 'BSD / Serpong',
    note: 'Western growth area to validate against the Jakarta core.',
    bounds: [[-6.36, 106.6], [-6.24, 106.72]],
  },
]

function hash(value: string): number {
  let result = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 16777619)
  }

  return result >>> 0
}

export function mapLeadToEstimatedPosition(lead: LeadRegionDistributionRow): MappedLead {
  const regionLabel = lead.region?.trim() || 'Unspecified'
  const industryLabel = lead.industry?.trim() || 'Unspecified'
  const profile = zoneProfiles.find((item) => item.match.test(regionLabel)) ?? zoneProfiles[zoneProfiles.length - 1]
  const angle = (hash(`${lead.lead_code}${lead.company_name}`) / 4294967295) * Math.PI * 2
  const distance = Math.sqrt(hash(`${lead.company_name}${lead.assigned_bd_id ?? ''}`) / 4294967295) * profile.radius

  return {
    ...lead,
    lat: profile.center[0] + Math.sin(angle) * distance,
    lng: profile.center[1] + Math.cos(angle) * distance,
    estimatedZone: profile.zone,
    industryLabel,
    regionLabel,
  }
}

export function countBy<T>(rows: T[], getValue: (row: T) => string): Record<string, number> {
  return rows.reduce<Record<string, number>>((counts, row) => {
    const value = getValue(row) || 'Unspecified'
    counts[value] = (counts[value] ?? 0) + 1
    return counts
  }, {})
}

