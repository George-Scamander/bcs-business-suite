import { describe, expect, it } from 'vitest'

import {
  FOLLOWUP_TYPE_OPTIONS,
  LEAD_STATUS_OPTIONS,
  LOST_REASON_OPTIONS,
  ONBOARDING_STATUS_OPTIONS,
  PROJECT_STATUS_OPTIONS,
  getSalesProductCategoryGroup,
  getSalesProductSubcategory,
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS,
} from './business-constants'

describe('business constants', () => {
  it('contains full lead status machine options', () => {
    expect(LEAD_STATUS_OPTIONS.map((item) => item.value)).toEqual([
      'NEW',
      'TO_FOLLOW',
      'FOLLOWING',
      'NEGOTIATING',
      'ON_HOLD',
      'LOST',
      'SIGNED',
      'REJECTED',
    ])
  })

  it('contains full onboarding status machine options', () => {
    expect(ONBOARDING_STATUS_OPTIONS.map((item) => item.value)).toEqual([
      'NOT_STARTED',
      'INFO_PENDING',
      'DOCUMENT_PENDING',
      'UNDER_REVIEW',
      'REVISION_REQUIRED',
      'CONTRACT_CONFIRMED',
      'SERVICE_ACTIVATING',
      'COMPLETED',
      'REJECTED',
    ])
  })

  it('contains full project status machine options', () => {
    expect(PROJECT_STATUS_OPTIONS.map((item) => item.value)).toEqual([
      'NOT_STARTED',
      'IN_PROGRESS',
      'ON_HOLD',
      'DELAYED',
      'COMPLETED',
      'CLOSED',
    ])
  })

  it('has non-empty helper dictionaries for followup, lost reason, task status and priority', () => {
    expect(FOLLOWUP_TYPE_OPTIONS.length).toBeGreaterThan(0)
    expect(LOST_REASON_OPTIONS.length).toBeGreaterThan(0)
    expect(TASK_STATUS_OPTIONS.length).toBeGreaterThan(0)
    expect(TASK_PRIORITY_OPTIONS.length).toBeGreaterThan(0)
  })

  it('groups legacy Bosch accessory categories without rewriting historical values', () => {
    expect(getSalesProductCategoryGroup('WIPER')).toBe('BOSCH_ACCESSORY')
    expect(getSalesProductCategoryGroup('BRAKE_PAD')).toBe('BOSCH_ACCESSORY')
    expect(getSalesProductCategoryGroup('WINDOW_FILM')).toBe('WINDOW_FILM')
    expect(getSalesProductSubcategory('THREE_FILTERS')).toBe('BOSCH_THREE_FILTERS')
    expect(getSalesProductSubcategory('CHEMICAL')).toBe('CHEMICAL_OTHER')
    expect(getSalesProductCategoryGroup('X_OWL')).toBe('X_OWL')
    expect(getSalesProductSubcategory('X_OWL')).toBe('X_OWL_OTHER')
  })
})
