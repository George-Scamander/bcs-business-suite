import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.103.0'

const TEAMS_WEBHOOK_URL = Deno.env.get('TEAMS_WEBHOOK_URL') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

// ── Types ─────────────────────────────────────────────────
interface ProfileRow {
  id: string
  email: string
  full_name: string | null
}

interface SalesOrderItemRow {
  category: string | null
  quantity: number | null
  unit_price: number | null
}

interface SalesOrderRow {
  id: string
  bd_user_id: string | null
  company_name: string | null
  lead_id: string | null
  items: SalesOrderItemRow[] | null
}

interface LeadRow {
  id: string
  assigned_bd_id: string | null
  intent_package: string | null
}

interface BdAggregate {
  bdName: string
  salesAmount: number
  tireSalesQuantity: number
  accessorySalesAmount: number
  salesRecordCount: number
  bcsSignedCount: number
  newLeadsCount: number
  newSalesLeadsCount: number
  overdueCount: number
}

// ── Category labels ───────────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  ENGINE_OIL: 'Engine Oil',
  CHEMICAL: 'Chemicals',
  TIRE: 'Tyres',
  WIPER: 'Wiper',
  THREE_FILTERS: 'Three Filters',
  BATTERY: 'Battery',
  BRAKE_PAD: 'Brake Pad',
  CAR_BEAUTY: 'Car Beauty',
  WINDOW_FILM: 'Window Film',
  BOSCH_ACCESSORY: 'Bosch Accessory',
  X_OWL: 'X-OWL',
}

// ── Format IDR ────────────────────────────────────────────
function formatIDR(value: number): string {
  if (value >= 1_000_000_000) {
    return `IDR ${(value / 1_000_000_000).toFixed(1)}B`
  }
  if (value >= 1_000_000) {
    return `IDR ${(value / 1_000_000).toFixed(1)}M`
  }
  return `IDR ${value.toLocaleString('id-ID')}`
}

// ── Date range: today 00:00 WIB → now ────────────────────
function buildDateRange() {
  const now = new Date()
  const wibMs = 7 * 60 * 60 * 1000
  const wibNow = new Date(now.getTime() + wibMs)
  const dateStr = wibNow.toISOString().slice(0, 10)
  const timeStr = wibNow.toISOString().slice(11, 16) // "HH:MM"
  return {
    label: `${dateStr}  00:00 – ${timeStr} WIB`,
    dateFrom: `${dateStr}T00:00:00+07:00`,
    dateTo: now.toISOString(), // current moment in UTC
  }
}

// ── Main query ────────────────────────────────────────────
async function queryReport(
  supabase: ReturnType<typeof createClient>,
  dateFrom: string,
  dateTo: string,
  rangeLabel: string,
) {
  // 1. Fetch all active BD users
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('full_name', { ascending: true })
  if (profileError) throw profileError

  const bdProfiles: ProfileRow[] = []
  for (const profile of (profiles ?? []) as ProfileRow[]) {
    const { data: hasRole } = await supabase.rpc('has_role_code', {
      p_role_code: 'bd_user',
      target_user_id: profile.id,
    })
    if (hasRole === true) bdProfiles.push(profile)
  }

  const aggregateMap = new Map<string, BdAggregate>(
    bdProfiles.map((p) => [
      p.id,
      {
        bdName: p.full_name ?? p.email,
        salesAmount: 0,
        tireSalesQuantity: 0,
        accessorySalesAmount: 0,
        salesRecordCount: 0,
        bcsSignedCount: 0,
        newLeadsCount: 0,
        newSalesLeadsCount: 0,
        overdueCount: 0,
      },
    ]),
  )

  // 2. Sales orders
  const { data: salesOrders, error: salesError } = await supabase
    .from('sales_orders')
    .select('id, bd_user_id, company_name, lead_id, items:sales_order_items(category, quantity, unit_price)')
    .is('deleted_at', null)
    .gte('sold_at', dateFrom)
    .lte('sold_at', dateTo)
  if (salesError) throw salesError

  const categoryAmountMap = new Map<string, number>()
  const storeAmountMap = new Map<string, { amount: number; leadId: string | null }>()

  for (const row of (salesOrders ?? []) as SalesOrderRow[]) {
    const agg = row.bd_user_id ? aggregateMap.get(row.bd_user_id) : undefined
    if (agg) agg.salesRecordCount += 1

    let orderAmount = 0
    for (const item of row.items ?? []) {
      const qty = Math.max(0, Number(item.quantity ?? 0))
      const price = Math.max(0, Number(item.unit_price ?? 0))
      const amount = qty > 0 && price > 0 ? qty * price : 0

      if (agg) {
        if (item.category === 'TIRE') {
          agg.tireSalesQuantity += qty
        } else if (amount > 0) {
          agg.accessorySalesAmount += amount
        }
        if (amount > 0) agg.salesAmount += amount
      }

      if (item.category && amount > 0) {
        categoryAmountMap.set(item.category, (categoryAmountMap.get(item.category) ?? 0) + amount)
      }
      orderAmount += amount
    }

    const storeName = row.company_name ?? 'Unknown'
    if (orderAmount > 0) {
      const existing = storeAmountMap.get(storeName)
      storeAmountMap.set(storeName, {
        amount: (existing?.amount ?? 0) + orderAmount,
        leadId: existing?.leadId ?? row.lead_id ?? null,
      })
    }
  }

  // 3. BCS sign-ups
  const { data: merchants, error: merchantError } = await supabase
    .from('onboard_merchants')
    .select('bd_owner_id')
    .is('deleted_at', null)
    .eq('onboarding_type', 'BCS_FRANCHISE')
    .gte('onboarded_at', dateFrom)
    .lte('onboarded_at', dateTo)
  if (merchantError) throw merchantError

  for (const row of (merchants ?? []) as { bd_owner_id: string | null }[]) {
    if (!row.bd_owner_id) continue
    const agg = aggregateMap.get(row.bd_owner_id)
    if (agg) agg.bcsSignedCount += 1
  }

  // 4. New leads
  const { data: newLeads, error: leadsError } = await supabase
    .from('leads')
    .select('id, assigned_bd_id, intent_package')
    .is('deleted_at', null)
    .gte('created_at', dateFrom)
    .lte('created_at', dateTo)
  if (leadsError) throw leadsError

  let totalNewLeads = 0
  let totalNewSalesLeads = 0

  for (const row of (newLeads ?? []) as LeadRow[]) {
    totalNewLeads += 1
    const isSalesLead = row.intent_package === 'PRODUCTS_SALES' || row.intent_package === 'BOTH'
    if (isSalesLead) totalNewSalesLeads += 1

    if (row.assigned_bd_id) {
      const agg = aggregateMap.get(row.assigned_bd_id)
      if (agg) {
        agg.newLeadsCount += 1
        if (isSalesLead) agg.newSalesLeadsCount += 1
      }
    }
  }

  // 5. Overdue leads (status active + no followup in 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const { data: overdueLeads, error: overdueError } = await supabase
    .from('leads')
    .select('id, assigned_bd_id')
    .is('deleted_at', null)
    .in('status', ['NEW', 'TO_FOLLOW', 'FOLLOWING', 'NEGOTIATING'])
    .or(`last_followup_at.is.null,last_followup_at.lt.${sevenDaysAgo.toISOString()}`)
  if (overdueError) throw overdueError

  for (const row of (overdueLeads ?? []) as { id: string; assigned_bd_id: string | null }[]) {
    if (!row.assigned_bd_id) continue
    const agg = aggregateMap.get(row.assigned_bd_id)
    if (agg) agg.overdueCount += 1
  }

  // 6. Top store
  const topStore = [...storeAmountMap.entries()].sort((a, b) => b[1].amount - a[1].amount)[0]
  const topStoreName = topStore ? topStore[0] : '—'
  const topStoreAmount = topStore ? topStore[1].amount : 0
  const topStoreIsReturning = topStore ? topStore[1].leadId !== null : false

  // 6. Top category
  const topCategory = [...categoryAmountMap.entries()].sort((a, b) => b[1] - a[1])[0]
  const topCategoryName = topCategory ? (CATEGORY_LABELS[topCategory[0]] ?? topCategory[0]) : '—'
  const topCategoryAmount = topCategory ? topCategory[1] : 0

  // 7. Totals
  const bdRows = [...aggregateMap.values()].sort((a, b) => b.salesAmount - a.salesAmount)
  const team = {
    salesAmount: bdRows.reduce((s, r) => s + r.salesAmount, 0),
    tireSalesQuantity: bdRows.reduce((s, r) => s + r.tireSalesQuantity, 0),
    accessorySalesAmount: bdRows.reduce((s, r) => s + r.accessorySalesAmount, 0),
    bcsSignedCount: bdRows.reduce((s, r) => s + r.bcsSignedCount, 0),
    newLeads: totalNewLeads,
    newSalesLeads: totalNewSalesLeads,
  }

  return { rangeLabel, bdRows, team, topCategoryName, topCategoryAmount, topStoreName, topStoreAmount, topStoreIsReturning }
}

// ── Build Adaptive Card ───────────────────────────────────
function buildTeamsCard(data: Awaited<ReturnType<typeof queryReport>>) {
  const { rangeLabel, bdRows, team, topCategoryName, topCategoryAmount, topStoreName, topStoreAmount, topStoreIsReturning } = data
  const hasActivity = team.salesAmount > 0 || team.bcsSignedCount > 0

  const bdFacts = bdRows
    .filter((r) => r.salesAmount > 0 || r.bcsSignedCount > 0 || r.newLeadsCount > 0 || r.overdueCount > 0)
    .map((r) => ({
      type: 'FactSet',
      facts: [
        {
          title: r.bdName,
          value: [
            `Sales ${formatIDR(r.salesAmount)}`,
            `Tyres ${r.tireSalesQuantity} pcs`,
            `BCS ${r.bcsSignedCount}`,
            `New Leads ${r.newLeadsCount}`,
            `Overdue ${r.overdueCount > 0 ? r.overdueCount + ' ⚠️' : '0 ✅'}`,
          ].join('  |  '),
        },
      ],
    }))

  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        text: '📊 BD Performance Report',
        weight: 'Bolder',
        size: 'Large',
      },
      {
        type: 'TextBlock',
        text: rangeLabel,
        isSubtle: true,
        spacing: 'None',
      },

      // Leads
      {
        type: 'TextBlock',
        text: '📋 Leads',
        weight: 'Bolder',
        spacing: 'Medium',
        separator: true,
      },
      {
        type: 'FactSet',
        facts: [
          { title: 'New Leads', value: `${team.newLeads}` },
          { title: 'Sales Leads', value: `${team.newSalesLeads}` },
        ],
      },

      // Team performance
      {
        type: 'TextBlock',
        text: '💰 Team Performance',
        weight: 'Bolder',
        spacing: 'Medium',
        separator: true,
      },
      {
        type: 'FactSet',
        facts: [
          { title: 'Total Sales', value: formatIDR(team.salesAmount) },
          { title: 'Tyres Sold', value: `${team.tireSalesQuantity} pcs` },
          { title: 'Accessories Sales', value: formatIDR(team.accessorySalesAmount) },
          { title: 'BCS Signed', value: `${team.bcsSignedCount}` },
        ],
      },

      // Highlights
      {
        type: 'TextBlock',
        text: '🏆 Highlights',
        weight: 'Bolder',
        spacing: 'Medium',
        separator: true,
      },
      {
        type: 'FactSet',
        facts: [
          {
            title: 'Top Category',
            value: topCategoryAmount > 0 ? `${topCategoryName} (${formatIDR(topCategoryAmount)})` : '—',
          },
          {
            title: 'Top Purchaser',
            value: topStoreAmount > 0
              ? `${topStoreName} (${formatIDR(topStoreAmount)}) ${topStoreIsReturning ? '✅ Returning Customer' : '🆕 New Customer'}`
              : '—',
          },
        ],
      },

      // Individual BD summary
      ...(hasActivity && bdFacts.length > 0
        ? [
            {
              type: 'TextBlock',
              text: '👤 Individual BD Summary',
              weight: 'Bolder',
              spacing: 'Medium',
              separator: true,
            },
            ...bdFacts,
          ]
        : []),

      ...(!hasActivity
        ? [
            {
              type: 'TextBlock',
              text: 'No sales activity recorded for this period.',
              isSubtle: true,
              spacing: 'Medium',
              separator: true,
            },
          ]
        : []),
    ],
  }
}

// ── Entry point ───────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { label, dateFrom: from, dateTo: to } = buildDateRange()

    const reportData = await queryReport(supabase, from, to, label)
    const card = buildTeamsCard(reportData)

    const teamsRes = await fetch(TEAMS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
    })

    if (!teamsRes.ok) {
      const errText = await teamsRes.text()
      throw new Error(`Teams webhook error: ${teamsRes.status} ${errText}`)
    }

    return new Response(
      JSON.stringify({ success: true, range: label, team: reportData.team }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('daily-kpi-report error:', err)
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})
