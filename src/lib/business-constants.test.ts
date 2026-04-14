import { describe, expect, it } from 'vitest'

import {
  FOLLOWUP_TYPE_OPTIONS,
  LEAD_STATUS_OPTIONS,
  LOST_REASON_OPTIONS,
  ONBOARDING_STATUS_OPTIONS,
  PROJECT_STATUS_OPTIONS,
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
})
