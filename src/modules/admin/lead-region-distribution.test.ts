import { describe, expect, it } from 'vitest'

import type { LeadRegionDistributionRow } from '../leads/api'
import { countBy, mapLeadToEstimatedPosition } from './lead-region-distribution'

const lead: LeadRegionDistributionRow = {
  id: 'lead-1',
  lead_code: 'LD-001',
  company_name: 'Example Store',
  industry: 'Workshop',
  region: 'Bekasi',
  status: 'NEW',
  assigned_bd_id: 'bd-1',
  created_at: '2026-05-01T00:00:00.000Z',
}

describe('lead region distribution', () => {
  it('maps matching region labels to a deterministic estimated zone position', () => {
    const first = mapLeadToEstimatedPosition(lead)
    const second = mapLeadToEstimatedPosition(lead)

    expect(first.estimatedZone).toBe('Bekasi')
    expect(second).toEqual(first)
  })

  it('falls back to the unspecified Greater Jakarta zone', () => {
    const mapped = mapLeadToEstimatedPosition({ ...lead, region: null, industry: null })

    expect(mapped.estimatedZone).toBe('Unspecified Greater Jakarta')
    expect(mapped.regionLabel).toBe('Unspecified')
    expect(mapped.industryLabel).toBe('Unspecified')
  })

  it('counts mapped values', () => {
    expect(countBy([lead, { ...lead, id: 'lead-2' }], (item) => item.status)).toEqual({ NEW: 2 })
  })
})
