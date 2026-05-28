import { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { RobotOutlined, SendOutlined, UserOutlined } from '@ant-design/icons'
import { Button, Empty, Grid, Input, Select, Tag, message } from 'antd'
import { useTranslation } from 'react-i18next'

import { AdaptiveTable as Table } from '../../../components/common/AdaptiveTable'
import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { getSalesProductCategoryOptions } from '../../../lib/business-constants'
import type { SalesProductCategory } from '../../../types/business'
import {
  answerBusinessDataQuestion,
  answerBusinessDataQuestionWithAi,
  type DataQaAnswer,
  type DataQaBreakdownResult,
  type DataQaConversationMessage,
  type DataQaInsight,
  type DataQaIntent,
} from '../api/dataQa'

const { TextArea } = Input

interface ChatTurn {
  id: string
  question: string
  answer: DataQaAnswer
}

interface ChatSession {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  turns: ChatTurn[]
}

const CHAT_SESSION_STORAGE_KEY = 'admin-ai-data-assistant-chat-sessions-v1'
const MAX_SESSIONS = 20
const MAX_TURNS_PER_SESSION = 80
const MAX_CONTEXT_MESSAGES = 24
const MAX_CONTEXT_CHARS = 16000
const SESSION_AUTO_EXPIRE_DAYS = 30
const SESSION_HARD_DELETE_DAYS = 90

function createChatSession(defaultTitle: string, seedTitle?: string): ChatSession {
  const now = new Date().toISOString()
  const title = seedTitle?.trim() ? seedTitle.trim().slice(0, 32) : defaultTitle
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    title,
    createdAt: now,
    updatedAt: now,
    turns: [],
  }
}

function normalizeChatSession(payload: unknown, defaultTitle: string): ChatSession | null {
  if (!payload || typeof payload !== 'object') return null
  const item = payload as Record<string, unknown>
  const id = String(item.id ?? '').trim()
  if (!id) return null
  const createdAt = String(item.createdAt ?? new Date().toISOString())
  const updatedAt = String(item.updatedAt ?? createdAt)
  const title = String(item.title ?? '').trim().slice(0, 32) || defaultTitle
  const turns = Array.isArray(item.turns)
    ? item.turns
        .map((turn, index) => {
          if (!turn || typeof turn !== 'object') return null
          const value = turn as Record<string, unknown>
          const idValue = String(value.id ?? `${id}-${index}`)
          const questionValue = String(value.question ?? '').trim()
          const answerValue = value.answer as DataQaAnswer | undefined
          if (!questionValue || !answerValue) return null
          return {
            id: idValue,
            question: questionValue,
            answer: answerValue,
          } satisfies ChatTurn
        })
        .filter((turn): turn is ChatTurn => Boolean(turn))
        .slice(-MAX_TURNS_PER_SESSION)
    : []

  return {
    id,
    title,
    createdAt,
    updatedAt,
    turns,
  }
}

function buildSessionTitleFromQuestion(text: string, defaultTitle: string): string {
  const compact = text.replace(/\s+/g, ' ').trim()
  return compact.slice(0, 32) || defaultTitle
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatDate(value: string | null): string {
  return value ? dayjs(value).format('YYYY-MM-DD') : '-'
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function renderLiteMarkdown(text: string): string {
  const lines = text.split('\n')
  const html: string[] = []
  let inList = false
  let inCode = false

  for (const source of lines) {
    const line = source.trimEnd()
    const trimmed = line.trim()

    if (trimmed.startsWith('```')) {
      if (!inCode) {
        if (inList) {
          html.push('</ul>')
          inList = false
        }
        html.push('<pre class="overflow-x-auto rounded bg-slate-900 p-3 text-xs text-slate-100"><code>')
      } else {
        html.push('</code></pre>')
      }
      inCode = !inCode
      continue
    }

    if (inCode) {
      html.push(`${escapeHtml(line)}\n`)
      continue
    }

    if (!trimmed) {
      if (inList) {
        html.push('</ul>')
        inList = false
      }
      continue
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/)
    if (heading) {
      if (inList) {
        html.push('</ul>')
        inList = false
      }
      const level = Math.min(4, heading[1].length)
      html.push(`<h${level} class="m-0 mt-2 font-semibold text-slate-950 dark:text-slate-100">${escapeHtml(heading[2])}</h${level}>`)
      continue
    }

    const bullet = trimmed.match(/^([-*]|\d+[.)])\s+(.+)$/)
    if (bullet) {
      if (!inList) {
        html.push('<ul class="m-0 list-disc space-y-1 pl-5">')
        inList = true
      }
      const item = escapeHtml(bullet[2]).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      html.push(`<li>${item}</li>`)
      continue
    }

    if (inList) {
      html.push('</ul>')
      inList = false
    }
    const paragraph = escapeHtml(trimmed).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    html.push(`<p class="m-0">${paragraph}</p>`)
  }

  if (inList) html.push('</ul>')
  if (inCode) html.push('</code></pre>')
  return html.join('\n')
}

export function AdminAiDataAssistantPage() {
  const { t } = useTranslation()
  const screens = Grid.useBreakpoint()
  const isMobile = screens.md === false
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string>('')
  const [isSessionReady, setIsSessionReady] = useState(false)
  const categoryOptions = useMemo(() => getSalesProductCategoryOptions(t), [t])
  const categoryLabelByValue = useMemo(() => new Map(categoryOptions.map((item) => [item.value, item.label])), [categoryOptions])

  const examples = useMemo(
    () => [
      t('pages.adminAiDataAssistant.examples.tireBuyerCount', { defaultValue: '当前有多少客户进行了轮胎的采购？' }),
      t('pages.adminAiDataAssistant.examples.topTireCustomer', { defaultValue: '当前轮胎采购数量最多的客户是哪个？' }),
      t('pages.adminAiDataAssistant.examples.batteryThisMonth', { defaultValue: '本月电池采购数量是多少？' }),
      t('pages.adminAiDataAssistant.examples.bcsAccessory', { defaultValue: 'BCS客户里面谁买配件最多？' }),
      t('pages.adminAiDataAssistant.examples.topFiveCustomers', { defaultValue: '轮胎采购数量前5名客户是谁？' }),
      t('pages.adminAiDataAssistant.examples.categoryRanking', { defaultValue: '本月哪个品类销售数量最多？' }),
      t('pages.adminAiDataAssistant.examples.businessBreakdown', { defaultValue: '轮胎采购按BCS和非BCS怎么分布？' }),
      t('pages.adminAiDataAssistant.examples.amountThisMonth', { defaultValue: '本月销售金额是多少？' }),
      t('pages.adminAiDataAssistant.examples.salesTrend', { defaultValue: '最近90天销售成果趋势分析' }),
      t('pages.adminAiDataAssistant.examples.deepReview', { defaultValue: '帮我做当前销售成果的深度分析和建议' }),
    ],
    [t],
  )

  const activeSession = useMemo(() => sessions.find((session) => session.id === activeSessionId) ?? null, [activeSessionId, sessions])
  const chatTurns = activeSession?.turns ?? []
  const answer = chatTurns.length > 0 ? chatTurns[chatTurns.length - 1]?.answer ?? null : null
  const sessionOptions = useMemo(
    () =>
      sessions.map((session) => ({
        value: session.id,
        label: `${session.title} · ${dayjs(session.updatedAt).format('MM-DD HH:mm')}`,
      })),
    [sessions],
  )
  const defaultSessionTitle = t('pages.adminAiDataAssistant.newSession', { defaultValue: 'New chat' })

  function buildConversationContext(turns: ChatTurn[]): DataQaConversationMessage[] {
    const messages = turns
      .slice(-Math.floor(MAX_CONTEXT_MESSAGES / 2))
      .flatMap((turn) => {
        const assistantContent = (turn.answer.aiAnswer?.trim() || buildConclusion(turn.answer)).slice(0, 2400)
        return [
          { role: 'user', content: turn.question.slice(0, 1600) },
          { role: 'assistant', content: assistantContent },
        ] satisfies DataQaConversationMessage[]
      })
      .slice(-MAX_CONTEXT_MESSAGES)

    // Keep continuity without sending unlimited history on every request.
    let totalChars = 0
    const compact: DataQaConversationMessage[] = []
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const item = messages[index]
      const nextContent = item.content.slice(0, 2400)
      if (!nextContent) continue
      if (totalChars + nextContent.length > MAX_CONTEXT_CHARS) {
        continue
      }
      totalChars += nextContent.length
      compact.unshift({ role: item.role, content: nextContent })
    }
    return compact
  }

  function persistSessions(nextSessions: ChatSession[], nextActiveSessionId: string) {
    localStorage.setItem(
      CHAT_SESSION_STORAGE_KEY,
      JSON.stringify({
        activeSessionId: nextActiveSessionId,
        sessions: nextSessions.slice(0, MAX_SESSIONS),
      }),
    )
  }

  useEffect(() => {
    const fallback = createChatSession(defaultSessionTitle)
    try {
      const raw = localStorage.getItem(CHAT_SESSION_STORAGE_KEY)
      if (!raw) {
        setSessions([fallback])
        setActiveSessionId(fallback.id)
        setIsSessionReady(true)
        return
      }
      const parsed = JSON.parse(raw) as { activeSessionId?: string; sessions?: unknown[] }
      const normalizedSessions = Array.isArray(parsed.sessions)
        ? parsed.sessions.map((item) => normalizeChatSession(item, defaultSessionTitle)).filter((item): item is ChatSession => Boolean(item)).slice(0, MAX_SESSIONS)
        : []
      const now = Date.now()
      const softExpireMs = SESSION_AUTO_EXPIRE_DAYS * 24 * 60 * 60 * 1000
      const hardDeleteMs = SESSION_HARD_DELETE_DAYS * 24 * 60 * 60 * 1000
      const cleanedSessions = normalizedSessions
        .map((session) => {
          const updatedAtTs = new Date(session.updatedAt).getTime()
          if (!Number.isFinite(updatedAtTs)) return session
          if (now - updatedAtTs > hardDeleteMs) return null
          if (now - updatedAtTs > softExpireMs) {
            return {
              ...session,
              title: defaultSessionTitle,
              turns: [],
            }
          }
          return session
        })
        .filter((session): session is ChatSession => Boolean(session))
      if (cleanedSessions.length === 0) {
        setSessions([fallback])
        setActiveSessionId(fallback.id)
        setIsSessionReady(true)
        return
      }
      const activeId = cleanedSessions.some((item) => item.id === parsed.activeSessionId) ? String(parsed.activeSessionId) : cleanedSessions[0].id
      setSessions(cleanedSessions)
      setActiveSessionId(activeId)
      setIsSessionReady(true)
    } catch {
      setSessions([fallback])
      setActiveSessionId(fallback.id)
      setIsSessionReady(true)
    }
  }, [defaultSessionTitle])

  useEffect(() => {
    if (!isSessionReady || sessions.length === 0 || !activeSessionId) {
      return
    }
    persistSessions(sessions, activeSessionId)
  }, [activeSessionId, isSessionReady, sessions])

  function getCategoryLabel(category?: SalesProductCategory): string {
    return category ? categoryLabelByValue.get(category) ?? category : t('pages.adminAiDataAssistant.allCategories', { defaultValue: 'All categories' })
  }

  function getFilterCategoryLabel(result: DataQaAnswer): string {
    if (result.filters.categoryGroup === 'ACCESSORY') {
      return t('pages.adminAiDataAssistant.accessoryGroup', { defaultValue: 'Accessories' })
    }
    return getCategoryLabel(result.filters.category)
  }

  function getBreakdownLabel(row: DataQaBreakdownResult): string {
    if (row.key === 'BCS' || row.key === 'BOTH' || row.key === 'NON_BCS') {
      return getBusinessScopeLabel(row.key)
    }
    return categoryLabelByValue.get(row.key as SalesProductCategory) ?? row.label
  }

  function getBusinessScopeLabel(scope?: string): string {
    if (!scope) {
      return t('pages.adminAiDataAssistant.allBusinessScopes', { defaultValue: 'All business types' })
    }
    if (scope === 'NON_BCS') {
      return t('pages.adminAiDataAssistant.nonBcs', { defaultValue: 'Non-BCS' })
    }
    return scope
  }

  function getIntentLabel(intent: DataQaIntent): string {
    return t(`pages.adminAiDataAssistant.intent.${intent}`, { defaultValue: intent })
  }

  function buildConclusion(result: DataQaAnswer): string {
    if (result.aiAnswer?.trim()) {
      return result.aiAnswer.trim()
    }

    if (result.intent === 'unsupported') {
      return t('pages.adminAiDataAssistant.unsupportedAnswer', {
        defaultValue: 'I can currently answer purchase and sales product questions, such as buyer counts, total quantity, and top purchasing customers.',
      })
    }

    const category = getFilterCategoryLabel(result)
    const scope = getBusinessScopeLabel(result.filters.businessScope)
    const topName = result.topCustomer?.companyName ?? '-'
    const topQuantity = result.topCustomer ? formatNumber(result.topCustomer.quantity) : '0'
    const topRows = result.rows.slice(0, result.filters.limit)
    const topList = topRows.map((row, index) => `${index + 1}. ${row.companyName} (${formatNumber(row.quantity)})`).join('；')
    const breakdownList = result.breakdownRows
      .slice(0, result.filters.limit)
      .map((row, index) => `${index + 1}. ${getBreakdownLabel(row)} (${formatNumber(row.quantity)})`)
      .join('；')

    if (result.intent === 'buyer_count') {
      return t('pages.adminAiDataAssistant.answer.buyerCount', {
        defaultValue: '{{scope}} customers purchasing {{category}}: {{buyerCount}} customers. Total quantity: {{totalQuantity}}.',
        scope,
        category,
        buyerCount: formatNumber(result.buyerCount),
        totalQuantity: formatNumber(result.totalQuantity),
      })
    }

    if (result.intent === 'top_customer') {
      return t('pages.adminAiDataAssistant.answer.topCustomer', {
        defaultValue: 'The customer with the highest {{category}} purchase quantity under {{scope}} is {{customer}}, with {{quantity}} units.',
        scope,
        category,
        customer: topName,
        quantity: topQuantity,
      })
    }

    if (result.intent === 'top_customers') {
      return t('pages.adminAiDataAssistant.answer.topCustomers', {
        defaultValue: '{{scope}} {{category}} purchase quantity top {{limit}} customers: {{list}}.',
        scope,
        category,
        limit: result.filters.limit,
        list: topList || '-',
      })
    }

    if (result.intent === 'quantity_total') {
      return t('pages.adminAiDataAssistant.answer.quantityTotal', {
        defaultValue: 'Total {{category}} purchase quantity under {{scope}} is {{totalQuantity}} units, across {{buyerCount}} customers.',
        scope,
        category,
        totalQuantity: formatNumber(result.totalQuantity),
        buyerCount: formatNumber(result.buyerCount),
      })
    }

    if (result.intent === 'amount_total') {
      return t('pages.adminAiDataAssistant.answer.amountTotal', {
        defaultValue: 'Total {{category}} sales amount under {{scope}} is {{totalAmount}}, across {{buyerCount}} customers.',
        scope,
        category,
        totalAmount: formatNumber(result.totalAmount),
        buyerCount: formatNumber(result.buyerCount),
      })
    }

    if (result.intent === 'order_count') {
      return t('pages.adminAiDataAssistant.answer.orderCount', {
        defaultValue: '{{scope}} {{category}} matched {{orderCount}} sales orders, across {{buyerCount}} customers.',
        scope,
        category,
        orderCount: formatNumber(result.totalOrderCount),
        buyerCount: formatNumber(result.buyerCount),
      })
    }

    if (result.intent === 'category_ranking') {
      return t('pages.adminAiDataAssistant.answer.categoryRanking', {
        defaultValue: 'Category ranking by quantity: {{list}}.',
        list: breakdownList || '-',
      })
    }

    if (result.intent === 'business_scope_breakdown') {
      return t('pages.adminAiDataAssistant.answer.businessScopeBreakdown', {
        defaultValue: '{{category}} business type breakdown: {{list}}.',
        category,
        list: breakdownList || '-',
      })
    }

    if (result.intent === 'trend_analysis' || result.intent === 'deep_analysis') {
      const trendRows = result.trendRows ?? []
      const insights = result.insights ?? []
      const latestTrend = trendRows[trendRows.length - 1]
      const insightText = insights.map((item) => `${item.title}: ${item.detail}`).join(' ')
      return t('pages.adminAiDataAssistant.answer.analysis', {
        defaultValue:
          '{{scope}} {{category}} analysis: {{buyerCount}} customers, {{totalQuantity}} units, {{totalAmount}} total amount. Latest period: {{latestPeriod}}. {{insights}}',
        scope,
        category,
        buyerCount: formatNumber(result.buyerCount),
        totalQuantity: formatNumber(result.totalQuantity),
        totalAmount: formatNumber(result.totalAmount),
        latestPeriod: latestTrend ? `${latestTrend.period} / ${formatNumber(latestTrend.quantity)} units` : '-',
        insights: insightText || '-',
      })
    }

    return t('pages.adminAiDataAssistant.answer.summary', {
      defaultValue:
        '{{scope}} {{category}} summary: {{buyerCount}} purchasing customers, {{totalQuantity}} units total. Top customer: {{customer}} ({{quantity}} units).',
      scope,
      category,
      buyerCount: formatNumber(result.buyerCount),
      totalQuantity: formatNumber(result.totalQuantity),
      customer: topName,
      quantity: topQuantity,
    })
  }

  function renderFormattedAnswer(text: string) {
    const normalized = text.trim()
    if (!normalized) {
      return <span>-</span>
    }
    return <div className="space-y-2" dangerouslySetInnerHTML={{ __html: renderLiteMarkdown(normalized) }} />
  }

  function appendTurn(result: DataQaAnswer) {
    setSessions((prevSessions) => {
      const now = new Date().toISOString()
      const targetSessionId = activeSessionId || prevSessions[0]?.id
      if (!targetSessionId) {
        const firstSession = createChatSession(defaultSessionTitle, buildSessionTitleFromQuestion(result.question, defaultSessionTitle))
        const nextSession: ChatSession = {
          ...firstSession,
          turns: [
            {
              id: `${Date.now()}-0`,
              question: result.question,
              answer: result,
            },
          ],
          updatedAt: now,
        }
        setActiveSessionId(nextSession.id)
        return [nextSession]
      }

      const nextSessions = prevSessions.map((session) => {
        if (session.id !== targetSessionId) {
          return session
        }
        const nextTurns = [
          ...session.turns,
          {
            id: `${Date.now()}-${session.turns.length}`,
            question: result.question,
            answer: result,
          },
        ].slice(-MAX_TURNS_PER_SESSION)
        return {
          ...session,
          title: session.turns.length === 0 ? buildSessionTitleFromQuestion(result.question, defaultSessionTitle) : session.title,
          turns: nextTurns,
          updatedAt: now,
        }
      })
      return [...nextSessions].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()).slice(0, MAX_SESSIONS)
    })
  }

  function startNewSession() {
    const nextSession = createChatSession(defaultSessionTitle)
    setSessions((prev) => [nextSession, ...prev].slice(0, MAX_SESSIONS))
    setActiveSessionId(nextSession.id)
    setQuestion('')
  }

  function switchSession(sessionId: string) {
    setActiveSessionId(sessionId)
    setQuestion('')
  }

  function clearCurrentSession() {
    if (!activeSessionId) return
    setSessions((prev) =>
      prev.map((session) =>
        session.id === activeSessionId
          ? {
              ...session,
              turns: [],
              title: defaultSessionTitle,
              updatedAt: new Date().toISOString(),
            }
          : session,
      ),
    )
    setQuestion('')
  }

  function clearAllHistory() {
    const confirmed = window.confirm(
      t('pages.adminAiDataAssistant.clearAllConfirm', {
        defaultValue: 'Clear all historical conversations? This cannot be undone.',
      }),
    )
    if (!confirmed) return

    const nextSession = createChatSession(defaultSessionTitle)
    setSessions([nextSession])
    setActiveSessionId(nextSession.id)
    setQuestion('')
    localStorage.removeItem(CHAT_SESSION_STORAGE_KEY)
    message.success(
      t('pages.adminAiDataAssistant.clearAllSuccess', {
        defaultValue: 'All conversation history has been cleared.',
      }),
    )
  }

  async function handleAsk(nextQuestion = question) {
    const text = nextQuestion.trim()
    if (!text) {
      message.warning(t('pages.adminAiDataAssistant.emptyQuestion', { defaultValue: 'Enter a question first.' }))
      return
    }

    let requestSessionId = activeSessionId
    let conversation = buildConversationContext(chatTurns)
    if (!requestSessionId) {
      const nextSession = createChatSession(defaultSessionTitle)
      setSessions((prev) => [nextSession, ...prev].slice(0, MAX_SESSIONS))
      setActiveSessionId(nextSession.id)
      requestSessionId = nextSession.id
      conversation = []
    }
    setQuestion('')
    setLoading(true)
    try {
      try {
        const result = await answerBusinessDataQuestionWithAi(text, {
          sessionId: requestSessionId,
          conversation,
        })
        appendTurn(result)
      } catch (aiError) {
        const fallbackResult = await answerBusinessDataQuestion(text)
        appendTurn(fallbackResult)
        const aiErrorMessage = aiError instanceof Error ? aiError.message : ''
        message.warning(
          `${t('pages.adminAiDataAssistant.aiFallback', {
            defaultValue: 'AI service is unavailable; answered with local read-only rules.',
          })}${aiErrorMessage ? ` ${aiErrorMessage}` : ''}`,
        )
      }
    } catch (error) {
      const textMessage =
        error instanceof Error
          ? error.message
          : t('pages.adminAiDataAssistant.askFail', { defaultValue: 'Failed to answer the data question.' })
      message.error(textMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <PageTitleBar
        title={t('pages.adminAiDataAssistant.title', { defaultValue: 'AI Data Assistant' })}
        description={t('pages.adminAiDataAssistant.description', {
          defaultValue: 'Ask natural-language questions about customers, sales categories, and purchase quantities.',
        })}
      />

      <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 p-3 text-white md:p-4 dark:border-slate-700">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold md:text-base">
                <RobotOutlined />
                {t('pages.adminAiDataAssistant.chatTitle', { defaultValue: 'AI Data Chat' })}
              </div>
              <div className="mt-1 text-xs text-slate-300 md:text-sm">
                {t('pages.adminAiDataAssistant.chatDesc', {
                  defaultValue: 'Ask sales, customer, category, and trend questions. The assistant can only use read-only system data.',
                })}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 md:gap-2">
              <Tag color="green">
                {t('pages.adminAiDataAssistant.readOnlyBadge', { defaultValue: 'Read-only data access' })}
              </Tag>
              <Select
                size="small"
                className="min-w-[140px] md:min-w-[210px]"
                value={activeSessionId || undefined}
                options={sessionOptions}
                placeholder={t('pages.adminAiDataAssistant.sessionPlaceholder', { defaultValue: 'Select a session' })}
                onChange={(value) => switchSession(value)}
              />
              <Button size="small" onClick={startNewSession}>
                {t('pages.adminAiDataAssistant.newSession', { defaultValue: 'New chat' })}
              </Button>
            </div>
          </div>
        </div>

        <div className="border-b border-slate-100 bg-white px-3 py-3 md:px-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-xs text-slate-600 md:text-sm dark:text-slate-300">
              <span className="font-semibold text-slate-900 dark:text-slate-100">{t('pages.adminAiDataAssistant.currentSession', { defaultValue: 'Current session' })}:</span>{' '}
              <span>{activeSession?.title ?? defaultSessionTitle}</span>
              <span className="mx-2 text-slate-300 dark:text-slate-600">|</span>
              <span>
                {t('pages.adminAiDataAssistant.turnCount', { defaultValue: 'Turns' })}: {chatTurns.length}
              </span>
              <span className="mx-2 text-slate-300 dark:text-slate-600">|</span>
              <span>
                {t('pages.adminAiDataAssistant.memoryStatus', { defaultValue: 'Memory' })}:{' '}
                {chatTurns.length > 0
                  ? t('pages.adminAiDataAssistant.memoryEnabled', { defaultValue: 'Enabled' })
                  : t('pages.adminAiDataAssistant.memoryEmpty', { defaultValue: 'Empty' })}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="small" onClick={clearCurrentSession} disabled={chatTurns.length === 0}>
                {t('pages.adminAiDataAssistant.clearSession', { defaultValue: 'Clear current session' })}
              </Button>
              <Button size="small" danger onClick={clearAllHistory} disabled={sessions.length === 0}>
                {t('pages.adminAiDataAssistant.clearAll', { defaultValue: 'Clear all history' })}
              </Button>
              <Button size="small" type="primary" onClick={startNewSession}>
                {t('pages.adminAiDataAssistant.newSession', { defaultValue: 'New chat' })}
              </Button>
            </div>
          </div>
        </div>

        <div className="max-h-[62vh] min-h-[52vh] overflow-y-auto bg-slate-100/70 px-3 py-4 md:max-h-[520px] md:min-h-[340px] md:p-4 dark:bg-slate-950/60">
          {chatTurns.length === 0 ? (
            <div className="flex min-h-[44vh] flex-col items-center justify-center text-center md:min-h-[300px]">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-2xl text-white">
                <RobotOutlined />
              </div>
              <div className="text-lg font-semibold text-slate-950 dark:text-slate-100">
                {t('pages.adminAiDataAssistant.emptyChatTitle', { defaultValue: 'Ask a business data question' })}
              </div>
              <div className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                {t('pages.adminAiDataAssistant.emptyChatDesc', {
                  defaultValue:
                    'Examples: sales trend analysis, top purchasing customers, category contribution, BCS vs non-BCS distribution, and monthly purchase quantity.',
                })}
              </div>
              <div className="mt-5 flex w-full gap-2 overflow-x-auto pb-1 md:flex-wrap md:justify-center md:overflow-visible">
                {examples.slice(0, 6).map((item) => (
                  <Button key={item} size="small" className="shrink-0" onClick={() => void handleAsk(item)}>
                    {item}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4 md:space-y-5">
              {chatTurns.map((turn) => (
                <div key={turn.id} className="space-y-3">
                  <div className="flex justify-end">
                    <div className="flex w-full max-w-[92%] items-start justify-end gap-2 md:max-w-[72%]">
                      <div className="rounded-2xl rounded-br-md bg-slate-900 px-4 py-3 text-sm leading-6 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900">
                        {turn.question}
                      </div>
                      <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white md:h-8 md:w-8 dark:bg-slate-100 dark:text-slate-900">
                        <UserOutlined />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-start">
                    <div className="flex w-full max-w-[98%] items-start gap-2 md:max-w-[82%]">
                      <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white md:h-8 md:w-8">
                        <RobotOutlined />
                      </div>
                      <div className="w-full rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <Tag color={turn.answer.aiEnabled ? 'green' : 'default'}>
                            {turn.answer.aiEnabled
                              ? t('pages.adminAiDataAssistant.aiMode', { defaultValue: 'AI mode' })
                              : t('pages.adminAiDataAssistant.localMode', { defaultValue: 'Local rules' })}
                          </Tag>
                          <Tag color={turn.answer.intent === 'unsupported' ? 'default' : 'blue'}>{getIntentLabel(turn.answer.intent)}</Tag>
                        </div>
                        {renderFormattedAnswer(buildConclusion(turn.answer))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 bg-white p-3 md:p-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100 dark:border-slate-700 dark:bg-slate-900">
            <TextArea
              autoSize={{ minRows: 1, maxRows: 5 }}
              bordered={false}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={t('pages.adminAiDataAssistant.placeholder', {
                defaultValue: 'Example: 当前轮胎采购数量最多的客户是哪个？',
              })}
              onPressEnter={(event) => {
                if (!event.shiftKey) {
                  event.preventDefault()
                  void handleAsk()
                }
              }}
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {isMobile
                  ? t('pages.adminAiDataAssistant.enterHint', { defaultValue: 'Enter to send, Shift + Enter for a new line' })
                  : t('pages.adminAiDataAssistant.enterHint', { defaultValue: 'Enter to send, Shift + Enter for a new line' })}
              </span>
              <Button type="primary" shape={isMobile ? 'round' : 'default'} icon={<SendOutlined />} loading={loading} onClick={() => void handleAsk()}>
                {t('pages.adminAiDataAssistant.ask', { defaultValue: 'Ask' })}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {answer ? (
        <>
          <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                  {t('pages.adminAiDataAssistant.dataSectionEyebrow', { defaultValue: 'Data Result' })}
                </div>
                <div className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-100">
                  {t('pages.adminAiDataAssistant.dataSectionTitle', { defaultValue: '具体数据与统计口径' })}
                </div>
              </div>
              <Tag color={answer.intent === 'unsupported' ? 'default' : 'blue'}>{getIntentLabel(answer.intent)}</Tag>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <div className="text-xs text-slate-500 dark:text-slate-400">{t('pages.adminAiDataAssistant.metrics.buyerCount', { defaultValue: 'Buyer Count' })}</div>
                <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{formatNumber(answer.buyerCount)}</div>
              </div>
              <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <div className="text-xs text-slate-500 dark:text-slate-400">{t('pages.adminAiDataAssistant.metrics.totalQuantity', { defaultValue: 'Total Quantity' })}</div>
                <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{formatNumber(answer.totalQuantity)}</div>
              </div>
              <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <div className="text-xs text-slate-500 dark:text-slate-400">{t('pages.adminAiDataAssistant.metrics.totalAmount', { defaultValue: 'Total Amount' })}</div>
                <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{formatNumber(answer.totalAmount)}</div>
              </div>
              <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <div className="text-xs text-slate-500 dark:text-slate-400">{t('pages.adminAiDataAssistant.metrics.topCustomer', { defaultValue: 'Top Customer' })}</div>
                <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{answer.topCustomer?.companyName ?? '-'}</div>
              </div>
            </div>

            {(answer.insights ?? []).length > 0 && (
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                {(answer.insights ?? []).map((item: DataQaInsight) => (
                  <div key={`${item.title}-${item.detail}`} className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                    <div className="mb-1 flex items-center gap-2">
                      <Tag color={item.type === 'warning' ? 'orange' : item.type === 'positive' ? 'green' : 'blue'}>
                        {item.type}
                      </Tag>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{item.title}</span>
                    </div>
                    <div className="text-sm leading-6 text-slate-600 dark:text-slate-300">{item.detail}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
              {t('pages.adminAiDataAssistant.dataQuality', {
                defaultValue:
                  'Data source: {{sources}}. Matched {{items}} items, {{orders}} orders, {{customers}} customers. Calculations are produced by system read-only logic.',
                sources: answer.dataQuality?.sourceTables?.join(', ') ?? 'sales_orders, sales_order_items',
                items: formatNumber(answer.dataQuality?.matchedItemCount ?? answer.totalQuantity),
                orders: formatNumber(answer.dataQuality?.matchedOrderCount ?? answer.totalOrderCount),
                customers: formatNumber(answer.dataQuality?.matchedCustomerCount ?? answer.buyerCount),
              })}
            </div>
          </div>

          {isMobile && (
            <div className="mt-4 grid grid-cols-1 gap-3">
              {(answer.trendRows ?? []).length > 0 && (
                <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                  <div className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {t('pages.adminAiDataAssistant.trendTitle', { defaultValue: 'Sales Trend' })}
                  </div>
                  <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                    {answer.trendRows.slice(-5).map((row) => (
                      <div key={row.period} className="rounded-md bg-slate-50 p-2 dark:bg-slate-800/60">
                        <div className="font-medium text-slate-900 dark:text-slate-100">{row.period}</div>
                        <div>
                          {t('pages.adminAiDataAssistant.columns.quantity', { defaultValue: 'Quantity' })}: {formatNumber(row.quantity)} ·{' '}
                          {t('pages.adminAiDataAssistant.columns.amount', { defaultValue: 'Amount' })}: {formatNumber(row.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {answer.breakdownRows.length > 0 && (
                <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                  <div className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {t('pages.adminAiDataAssistant.breakdownTitle', { defaultValue: 'Breakdown' })}
                  </div>
                  <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                    {answer.breakdownRows.slice(0, 8).map((row) => (
                      <div key={row.key} className="flex items-center justify-between gap-3 rounded-md bg-slate-50 p-2 dark:bg-slate-800/60">
                        <span className="font-medium text-slate-900 dark:text-slate-100">{getBreakdownLabel(row)}</span>
                        <span>{formatNumber(row.quantity)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                <div className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {t('pages.adminAiDataAssistant.detailTitle', { defaultValue: 'Matched Customer Details' })}
                </div>
                <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                  {answer.rows.slice(0, 8).map((row) => (
                    <div key={row.customerKey} className="rounded-md bg-slate-50 p-2 dark:bg-slate-800/60">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{row.companyName}</div>
                      <div>
                        {t('pages.adminAiDataAssistant.columns.quantity', { defaultValue: 'Quantity' })}: {formatNumber(row.quantity)} ·{' '}
                        {t('pages.adminAiDataAssistant.columns.amount', { defaultValue: 'Amount' })}: {formatNumber(row.amount)}
                      </div>
                      <div>
                        {t('pages.adminAiDataAssistant.columns.orderCount', { defaultValue: 'Orders' })}: {formatNumber(row.orderCount)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!isMobile && (answer.trendRows ?? []).length > 0 && (
            <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-3 text-base font-semibold text-slate-900 dark:text-slate-100">
                {t('pages.adminAiDataAssistant.trendTitle', { defaultValue: 'Sales Trend' })}
              </div>
              <Table
                rowKey="period"
                bordered
                dataSource={answer.trendRows ?? []}
                pagination={false}
                scroll={{ x: 760 }}
                columns={[
                  {
                    title: t('pages.adminAiDataAssistant.columns.period', { defaultValue: 'Period' }),
                    dataIndex: 'period',
                    width: 160,
                  },
                  {
                    title: t('pages.adminAiDataAssistant.metrics.buyerCount', { defaultValue: 'Buyer Count' }),
                    dataIndex: 'buyerCount',
                    width: 130,
                    render: (value: number) => formatNumber(value),
                  },
                  {
                    title: t('pages.adminAiDataAssistant.columns.quantity', { defaultValue: 'Quantity' }),
                    dataIndex: 'quantity',
                    width: 130,
                    render: (value: number) => formatNumber(value),
                  },
                  {
                    title: t('pages.adminAiDataAssistant.columns.amount', { defaultValue: 'Amount' }),
                    dataIndex: 'amount',
                    width: 140,
                    render: (value: number) => formatNumber(value),
                  },
                  {
                    title: t('pages.adminAiDataAssistant.columns.orderCount', { defaultValue: 'Orders' }),
                    dataIndex: 'orderCount',
                    width: 120,
                    render: (value: number) => formatNumber(value),
                  },
                ]}
              />
            </div>
          )}

          {!isMobile && answer.breakdownRows.length > 0 && (
            <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-3 text-base font-semibold text-slate-900 dark:text-slate-100">
                {t('pages.adminAiDataAssistant.breakdownTitle', { defaultValue: 'Breakdown' })}
              </div>
              <Table
                rowKey="key"
                bordered
                dataSource={answer.breakdownRows}
                pagination={false}
                scroll={{ x: 760 }}
                columns={[
                  {
                    title: t('pages.adminAiDataAssistant.columns.dimension', { defaultValue: 'Dimension' }),
                    dataIndex: 'label',
                    width: 220,
                    render: (_value: string, row: DataQaBreakdownResult) => getBreakdownLabel(row),
                  },
                  {
                    title: t('pages.adminAiDataAssistant.metrics.buyerCount', { defaultValue: 'Buyer Count' }),
                    dataIndex: 'buyerCount',
                    width: 130,
                    render: (value: number) => formatNumber(value),
                  },
                  {
                    title: t('pages.adminAiDataAssistant.columns.quantity', { defaultValue: 'Quantity' }),
                    dataIndex: 'quantity',
                    width: 130,
                    render: (value: number) => formatNumber(value),
                  },
                  {
                    title: t('pages.adminAiDataAssistant.columns.amount', { defaultValue: 'Amount' }),
                    dataIndex: 'amount',
                    width: 140,
                    render: (value: number) => formatNumber(value),
                  },
                  {
                    title: t('pages.adminAiDataAssistant.columns.orderCount', { defaultValue: 'Orders' }),
                    dataIndex: 'orderCount',
                    width: 120,
                    render: (value: number) => formatNumber(value),
                  },
                ]}
              />
            </div>
          )}

          {!isMobile && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-3 text-base font-semibold text-slate-900 dark:text-slate-100">
              {t('pages.adminAiDataAssistant.detailTitle', { defaultValue: 'Matched Customer Details' })}
            </div>
            <Table
              rowKey="customerKey"
              bordered
              dataSource={answer.rows}
              pagination={{ pageSize: 10 }}
              scroll={{ x: 900 }}
              columns={[
                {
                  title: t('pages.adminAiDataAssistant.columns.company', { defaultValue: 'Customer' }),
                  dataIndex: 'companyName',
                  width: 260,
                },
                {
                  title: t('pages.adminAiDataAssistant.columns.businessScope', { defaultValue: 'Business' }),
                  dataIndex: 'businessScope',
                  width: 120,
                  render: (value: string) => <Tag color={value === 'NON_BCS' ? 'default' : 'blue'}>{getBusinessScopeLabel(value)}</Tag>,
                },
                {
                  title: t('pages.adminAiDataAssistant.columns.quantity', { defaultValue: 'Quantity' }),
                  dataIndex: 'quantity',
                  width: 140,
                  render: (value: number) => formatNumber(value),
                },
                {
                  title: t('pages.adminAiDataAssistant.columns.amount', { defaultValue: 'Amount' }),
                  dataIndex: 'amount',
                  width: 140,
                  render: (value: number) => formatNumber(value),
                },
                {
                  title: t('pages.adminAiDataAssistant.columns.orderCount', { defaultValue: 'Orders' }),
                  dataIndex: 'orderCount',
                  width: 120,
                },
                {
                  title: t('pages.adminAiDataAssistant.columns.lastSoldAt', { defaultValue: 'Last Sold' }),
                  dataIndex: 'lastSoldAt',
                  width: 140,
                  render: (value: string | null) => formatDate(value),
                },
              ]}
            />
          </div>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-8 dark:border-slate-700 dark:bg-slate-900">
          <Empty description={t('pages.adminAiDataAssistant.emptyState', { defaultValue: 'Ask a question to see the answer.' })} />
        </div>
      )}
    </>
  )
}
