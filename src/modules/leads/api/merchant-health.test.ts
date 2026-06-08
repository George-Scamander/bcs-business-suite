import { describe, expect, it } from 'vitest'

import { calculateLeadMerchantHealth } from '.'

const DAY_MS = 24 * 60 * 60 * 1000

describe('merchant health scoring', () => {
  it('scores recent complete category purchases as a star merchant', () => {
    const [merchant] = calculateLeadMerchantHealth([
      {
        id: 'order-current',
        lead_id: 'lead-star',
        sold_at: new Date().toISOString(),
        items: [
          { category: 'ENGINE_OIL', quantity: 1, unit_price: 100 },
          { category: 'THREE_FILTERS', quantity: 1, unit_price: 100 },
          { category: 'CHEMICAL', quantity: 1, unit_price: 100 },
          { category: 'CAR_BEAUTY', quantity: 1, unit_price: 100 },
          { category: 'TIRE', quantity: 1, unit_price: 100 },
        ],
      },
    ])

    expect(merchant.health_score).toBe(100)
    expect(merchant.health_tier).toBe('STAR')
    expect(merchant.category_score).toBe(25)
  })

  it('scores a merchant without recent repurchase as risk', () => {
    const [merchant] = calculateLeadMerchantHealth([
      {
        id: 'order-old',
        lead_id: 'lead-risk',
        sold_at: new Date(Date.now() - 45 * DAY_MS).toISOString(),
        items: [
          { category: 'ENGINE_OIL', quantity: 1, unit_price: 100 },
        ],
      },
    ])

    expect(merchant.health_score).toBe(30)
    expect(merchant.health_tier).toBe('RISK')
    expect(merchant.risk_reasons).toContain('NO_PURCHASE_LAST_30_DAYS')
    expect(merchant.risk_reasons).toContain('HIGH_FREQUENCY_CATEGORY_GAP')
  })
})
