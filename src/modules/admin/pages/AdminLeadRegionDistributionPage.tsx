import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AimOutlined, FilterOutlined, ReloadOutlined } from '@ant-design/icons'
import { Button, Card, Drawer, Empty, Grid, Input, Select, Space, Spin, Tag, Typography, message } from 'antd'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useTranslation } from 'react-i18next'

import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { listAllActiveLeadsForRegionDistribution, type LeadRegionDistributionRow } from '../../leads/api'
import {
  blankAreas,
  countBy,
  mapLeadToEstimatedPosition,
  zoneProfiles,
  type MappedLead,
} from '../lead-region-distribution'

const STATUS_COLORS: Record<string, string> = {
  NEW: '#176e5b',
  FOLLOWING: '#e8a21a',
  TO_FOLLOW: '#e8a21a',
  NEGOTIATING: '#7c3aed',
  ON_HOLD: '#3676c9',
  LOST: '#64748b',
  SIGNED: '#16a34a',
  REJECTED: '#8d9691',
}

const ZONE_TRANSLATION_KEYS: Record<string, string> = {
  'North Jakarta': 'northJakarta',
  'South Jakarta': 'southJakarta',
  'East Jakarta': 'eastJakarta',
  Bekasi: 'bekasi',
  Cikarang: 'cikarang',
  Depok: 'depok',
  'Cibubur / Bogor Corridor': 'cibuburBogorCorridor',
  'Tangerang / Banten': 'tangerangBanten',
  'West Java Corridor': 'westJavaCorridor',
  'Central Java': 'centralJava',
  'DKI Jakarta': 'dkiJakarta',
  'Unspecified Greater Jakarta': 'unspecifiedGreaterJakarta',
}

const BLANK_AREA_TRANSLATION_KEYS: Record<string, string> = {
  'West Jakarta / Cengkareng': 'westJakartaCengkareng',
  'Central Jakarta': 'centralJakarta',
  'South-East Jakarta': 'southEastJakarta',
  'BSD / Serpong': 'bsdSerpong',
}

function sortCounts(counts: Record<string, number>): Array<[string, number]> {
  return Object.entries(counts).sort((left, right) => right[1] - left[1])
}

function RankList({ counts, emptyText, formatLabel }: { counts: Record<string, number>; emptyText: string; formatLabel?: (label: string) => string }) {
  const entries = sortCounts(counts).slice(0, 6)
  const max = Math.max(...entries.map(([, value]) => value), 1)

  if (entries.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />
  }

  return (
    <div className="space-y-3">
      {entries.map(([label, value]) => (
        <div key={label}>
          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
            <span className="truncate font-medium app-text">{formatLabel ? formatLabel(label) : label}</span>
            <span className="font-semibold app-text">{value}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full app-surface-muted">
            <div className="h-full rounded-full bg-emerald-700" style={{ width: `${Math.max(4, (value / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function formatDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[character] ?? character)
}

export function AdminLeadRegionDistributionPage() {
  const { t, i18n } = useTranslation()
  const screens = Grid.useBreakpoint()
  const isCompact = screens.lg === false
  const mapElementRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerLayerRef = useRef<L.LayerGroup | null>(null)
  const coverageLayerRef = useRef<L.LayerGroup | null>(null)
  const blankLayerRef = useRef<L.LayerGroup | null>(null)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<LeadRegionDistributionRow[]>([])
  const [keyword, setKeyword] = useState('')
  const [zone, setZone] = useState<string>()
  const [industry, setIndustry] = useState<string>()
  const [status, setStatus] = useState<string>()
  const [showMarkers, setShowMarkers] = useState(true)
  const [showCoverage, setShowCoverage] = useState(true)
  const [showBlankAreas, setShowBlankAreas] = useState(true)
  const [selectedLead, setSelectedLead] = useState<MappedLead | null>(null)
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false)
  const formatZoneLabel = useCallback((value: string) => {
    const key = ZONE_TRANSLATION_KEYS[value]
    return key ? t(`pages.adminLeadRegionDistribution.zoneLabels.${key}`) : value
  }, [t])
  const formatBlankAreaLabel = useCallback((value: string) => {
    const key = BLANK_AREA_TRANSLATION_KEYS[value]
    return key ? t(`pages.adminLeadRegionDistribution.blankAreaLabels.${key}`) : value
  }, [t])

  const loadData = useCallback(async () => {
    setLoading(true)

    try {
      setRows(await listAllActiveLeadsForRegionDistribution())
    } catch (error) {
      const text = error instanceof Error ? error.message : t('pages.adminLeadRegionDistribution.loadFail')
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const mappedRows = useMemo(() => rows.map(mapLeadToEstimatedPosition), [rows])
  const filteredRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()

    return mappedRows.filter((row) => {
      const searchText = `${row.company_name} ${row.lead_code} ${row.assigned_bd_id ?? ''} ${row.regionLabel} ${row.industryLabel}`.toLowerCase()
      return (
        (!normalizedKeyword || searchText.includes(normalizedKeyword))
        && (!zone || row.estimatedZone === zone)
        && (!industry || row.industryLabel === industry)
        && (!status || row.status === status)
      )
    })
  }, [industry, keyword, mappedRows, status, zone])

  const zoneCounts = useMemo(() => countBy(filteredRows, (row) => row.estimatedZone), [filteredRows])
  const industryCounts = useMemo(() => countBy(filteredRows, (row) => row.industryLabel), [filteredRows])
  const zoneOptions = useMemo(
    () => [...new Set(mappedRows.map((row) => row.estimatedZone))].sort().map((value) => ({ value, label: formatZoneLabel(value) })),
    [formatZoneLabel, mappedRows],
  )
  const industryOptions = useMemo(
    () => [...new Set(mappedRows.map((row) => row.industryLabel))].sort().map((value) => ({ value, label: value })),
    [mappedRows],
  )
  const statusOptions = useMemo(
    () => [...new Set(mappedRows.map((row) => row.status))].sort().map((value) => ({ value, label: value })),
    [mappedRows],
  )
  const stats = useMemo(() => {
    return {
      visible: filteredRows.length,
      zones: Object.keys(zoneCounts).length,
      bdOwners: new Set(filteredRows.map((row) => row.assigned_bd_id).filter(Boolean)).size,
      followups: filteredRows.filter((row) => row.status === 'FOLLOWING' || row.status === 'TO_FOLLOW').length,
    }
  }, [filteredRows, zoneCounts])
  const insights = useMemo(() => {
    const sortedZones = sortCounts(zoneCounts)
    const [topZone = t('pages.adminLeadRegionDistribution.noZone'), topCount = 0] = sortedZones[0] ?? []
    const total = filteredRows.length || 1
    const jakartaCore = filteredRows.filter((row) => /jakarta/i.test(row.estimatedZone)).length

    return [
      t('pages.adminLeadRegionDistribution.insights.densest', {
        zone: formatZoneLabel(topZone),
        count: topCount,
        percent: Math.round((topCount / total) * 100),
      }),
      t('pages.adminLeadRegionDistribution.insights.jakartaCore', { count: jakartaCore }),
      t('pages.adminLeadRegionDistribution.insights.followups', { count: stats.followups }),
      t('pages.adminLeadRegionDistribution.insights.validationTargets', { areas: blankAreas.map((area) => formatBlankAreaLabel(area.name)).join(', ') }),
    ]
  }, [filteredRows, formatBlankAreaLabel, formatZoneLabel, stats.followups, t, zoneCounts])

  useEffect(() => {
    if (!mapElementRef.current || mapRef.current) {
      return
    }

    const map = L.map(mapElementRef.current, { zoomControl: false }).setView([-6.225, 106.855], 10)
    L.control.zoom({ position: 'bottomleft' }).addTo(map)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map)

    mapRef.current = map
    markerLayerRef.current = L.layerGroup().addTo(map)
    coverageLayerRef.current = L.layerGroup().addTo(map)
    blankLayerRef.current = L.layerGroup().addTo(map)

    return () => {
      map.remove()
      mapRef.current = null
      markerLayerRef.current = null
      coverageLayerRef.current = null
      blankLayerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const markerLayer = markerLayerRef.current
    const coverageLayer = coverageLayerRef.current
    const blankLayer = blankLayerRef.current

    if (!map || !markerLayer || !coverageLayer || !blankLayer) {
      return
    }

    markerLayer.clearLayers()
    coverageLayer.clearLayers()
    blankLayer.clearLayers()

    const bounds: L.LatLngExpression[] = []
    filteredRows.forEach((row) => {
      const color = STATUS_COLORS[row.status] ?? '#176e5b'
      const marker = L.circleMarker([row.lat, row.lng], {
        radius: 7,
        color: '#ffffff',
        weight: 2,
        fillColor: color,
        fillOpacity: 1,
      })
        .bindPopup(
          `<strong>${escapeHtml(row.company_name)}</strong><br>${escapeHtml(row.industryLabel)}<br>${escapeHtml(row.regionLabel)} &middot; ${escapeHtml(row.status)}`,
        )
        .on('click', () => setSelectedLead(row))

      if (showMarkers) {
        marker.addTo(markerLayer)
      }

      if (row.estimatedZone !== 'Central Java' || filteredRows.length < 5) {
        bounds.push([row.lat, row.lng])
      }
    })

    Object.entries(zoneCounts).forEach(([estimatedZone, count]) => {
      const profile = zoneProfiles.find((item) => item.zone === estimatedZone)
      if (!profile || estimatedZone === 'Central Java' || !showCoverage) {
        return
      }

      L.circle(profile.center, {
        radius: Math.max(1800, Math.min(11000, count * 120)),
        color: '#176e5b',
        weight: 1,
        fillColor: '#176e5b',
        fillOpacity: 0.13,
      }).bindTooltip(t('pages.adminLeadRegionDistribution.zoneLeadCount', { zone: formatZoneLabel(estimatedZone), count })).addTo(coverageLayer)
    })

    if (showBlankAreas) {
      blankAreas.forEach((area) => {
        L.rectangle(area.bounds, {
          color: '#d95835',
          weight: 1,
          dashArray: '6 5',
          fillColor: '#d95835',
          fillOpacity: 0.12,
        }).bindTooltip(`<strong>${formatBlankAreaLabel(area.name)}</strong>`).addTo(blankLayer)
      })
    }

    if (bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds).pad(0.16), { maxZoom: 11 })
    }
  }, [filteredRows, formatBlankAreaLabel, formatZoneLabel, showBlankAreas, showCoverage, showMarkers, t, zoneCounts])

  useEffect(() => {
    const timer = window.setTimeout(() => mapRef.current?.invalidateSize(), 0)
    return () => window.clearTimeout(timer)
  }, [isCompact])

  const analysisPanel = (
    <>
      <div className="space-y-3 border-b app-border p-4">
        <Input.Search
          allowClear
          placeholder={t('pages.adminLeadRegionDistribution.searchPlaceholder')}
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
        <Select
          allowClear
          className="w-full"
          placeholder={t('pages.adminLeadRegionDistribution.allZones')}
          options={zoneOptions}
          value={zone}
          onChange={setZone}
        />
        <Select
          allowClear
          showSearch
          className="w-full"
          placeholder={t('pages.adminLeadRegionDistribution.allIndustries')}
          options={industryOptions}
          value={industry}
          onChange={setIndustry}
        />
        <Select
          allowClear
          className="w-full"
          placeholder={t('pages.adminLeadRegionDistribution.allStatuses')}
          options={statusOptions}
          value={status}
          onChange={setStatus}
        />
        <Space wrap>
          <Button type={showMarkers ? 'primary' : 'default'} onClick={() => setShowMarkers((value) => !value)}>
            {t('pages.adminLeadRegionDistribution.layers.stores')}
          </Button>
          <Button type={showCoverage ? 'primary' : 'default'} onClick={() => setShowCoverage((value) => !value)}>
            {t('pages.adminLeadRegionDistribution.layers.coverage')}
          </Button>
          <Button type={showBlankAreas ? 'primary' : 'default'} onClick={() => setShowBlankAreas((value) => !value)}>
            {t('pages.adminLeadRegionDistribution.layers.blankAreas')}
          </Button>
        </Space>
      </div>

      <div className="grid grid-cols-2 gap-2 border-b app-border p-4">
        {[
          [t('pages.adminLeadRegionDistribution.stats.visibleLeads'), stats.visible],
          [t('pages.adminLeadRegionDistribution.stats.mapZones'), stats.zones],
          [t('pages.adminLeadRegionDistribution.stats.bdOwners'), stats.bdOwners],
          [t('pages.adminLeadRegionDistribution.stats.followups'), stats.followups],
        ].map(([label, value]) => (
          <Card key={label} size="small">
            <Typography.Text type="secondary" className="block text-xs uppercase">{label}</Typography.Text>
            <Typography.Text className="text-2xl font-bold">{value}</Typography.Text>
          </Card>
        ))}
      </div>

      <div className="space-y-6 p-4">
        <section>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">
            {t('pages.adminLeadRegionDistribution.sections.regionDistribution')}
          </h2>
          <RankList counts={zoneCounts} emptyText={t('pages.adminLeadRegionDistribution.noMatchingLeads')} formatLabel={formatZoneLabel} />
        </section>
        <section>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">
            {t('pages.adminLeadRegionDistribution.sections.industryMix')}
          </h2>
          <RankList counts={industryCounts} emptyText={t('pages.adminLeadRegionDistribution.noMatchingLeads')} />
        </section>
        <section>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">
            {t('pages.adminLeadRegionDistribution.sections.analysis')}
          </h2>
          <ul className="space-y-2">
            {insights.map((insight) => (
              <li key={insight} className="rounded-r-md border-l-4 border-emerald-700 bg-emerald-50 px-3 py-2 text-sm text-slate-700">
                {insight}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  )

  return (
    <>
      <PageTitleBar
        title={t('pages.adminLeadRegionDistribution.title')}
        description={t('pages.adminLeadRegionDistribution.description')}
        extra={<Button icon={<ReloadOutlined />} onClick={() => void loadData()}>{t('labels.refresh')}</Button>}
      />

      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {t('pages.adminLeadRegionDistribution.estimateNotice')}
      </div>

      <Spin spinning={loading}>
        <div className="grid min-h-[68dvh] overflow-hidden rounded-xl border app-border app-surface shadow-sm lg:min-h-[760px] lg:grid-cols-[360px_minmax(0,1fr)]">
          {isCompact ? null : <aside className="overflow-auto border-r app-border app-surface">{analysisPanel}</aside>}

          <main className="relative min-h-[68dvh] lg:min-h-[760px]">
            <div ref={mapElementRef} className="absolute inset-0" aria-label={t('pages.adminLeadRegionDistribution.mapAriaLabel')} />
            {isCompact ? (
              <Button
                type="primary"
                icon={<FilterOutlined />}
                className="absolute right-3 top-3 z-[500] shadow-lg"
                onClick={() => setMobilePanelOpen(true)}
              >
                {t('pages.adminLeadRegionDistribution.filtersAndAnalysis')}
              </Button>
            ) : null}
            <div className="absolute bottom-4 right-4 z-[500] hidden w-64 rounded-lg border app-border bg-white/95 dark:bg-slate-900/95 p-3 text-xs app-text-soft shadow-lg sm:block">
              <div className="mb-2 font-semibold app-text">{t('pages.adminLeadRegionDistribution.legend.title')}</div>
              <div className="space-y-2">
                <div><span className="mr-2 inline-block h-3 w-3 rounded-full bg-emerald-700" />{t('pages.adminLeadRegionDistribution.legend.locationEstimate')}</div>
                <div><span className="mr-2 inline-block h-3 w-3 rounded-sm border border-emerald-700 bg-emerald-100" />{t('pages.adminLeadRegionDistribution.legend.coverageZone')}</div>
                <div><span className="mr-2 inline-block h-3 w-3 rounded-sm border border-orange-700 bg-orange-100" />{t('pages.adminLeadRegionDistribution.legend.areaToValidate')}</div>
              </div>
            </div>
            {selectedLead ? (
              <div className="absolute right-4 top-4 z-[500] w-[min(360px,calc(100%_-_32px))] rounded-lg border app-border bg-white/95 dark:bg-slate-900/95 p-4 shadow-lg">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="m-0 text-lg font-bold app-text">{selectedLead.company_name}</h2>
                    <Tag color="green" className="mt-2">{selectedLead.status}</Tag>
                  </div>
                  <Button type="text" onClick={() => setSelectedLead(null)}>{t('common.close', { defaultValue: 'Close' })}</Button>
                </div>
                <dl className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
                  <dt className="font-semibold app-text-soft">{t('pages.adminLeadRegionDistribution.detail.leadCode')}</dt><dd className="m-0 break-words">{selectedLead.lead_code}</dd>
                  <dt className="font-semibold app-text-soft">{t('pages.adminLeadRegionDistribution.detail.industry')}</dt><dd className="m-0 break-words">{selectedLead.industryLabel}</dd>
                  <dt className="font-semibold app-text-soft">{t('pages.adminLeadRegionDistribution.detail.rawRegion')}</dt><dd className="m-0 break-words">{selectedLead.regionLabel}</dd>
                  <dt className="font-semibold app-text-soft">{t('pages.adminLeadRegionDistribution.detail.mapZone')}</dt><dd className="m-0 break-words">{formatZoneLabel(selectedLead.estimatedZone)}</dd>
                  <dt className="font-semibold app-text-soft">{t('pages.adminLeadRegionDistribution.detail.bdId')}</dt><dd className="m-0 break-words">{selectedLead.assigned_bd_id || '-'}</dd>
                  <dt className="font-semibold app-text-soft">{t('pages.adminLeadRegionDistribution.detail.created')}</dt><dd className="m-0 break-words">{formatDate(selectedLead.created_at, i18n.language)}</dd>
                  <dt className="font-semibold app-text-soft">{t('pages.adminLeadRegionDistribution.detail.location')}</dt><dd className="m-0 break-words">{t('pages.adminLeadRegionDistribution.detail.estimatedLocation')}</dd>
                </dl>
              </div>
            ) : null}
            <div className={`absolute left-3 z-[500] rounded-md bg-white/95 dark:bg-slate-900/95 px-3 py-2 text-xs app-text-soft shadow ${isCompact ? 'top-16' : 'top-4'}`}>
              <AimOutlined className="mr-1" /> {t('pages.adminLeadRegionDistribution.mappedLeads', { count: filteredRows.length })}
            </div>
          </main>
        </div>
      </Spin>

      <Drawer
        title={t('pages.adminLeadRegionDistribution.filtersAndAnalysis')}
        placement="bottom"
        height="82dvh"
        open={mobilePanelOpen}
        onClose={() => setMobilePanelOpen(false)}
        styles={{ body: { padding: 0, overflow: 'auto' } }}
      >
        {analysisPanel}
      </Drawer>
    </>
  )
}
