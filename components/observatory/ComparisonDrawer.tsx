'use client';

import React, {useEffect, useMemo, useState} from 'react';
import {GitCompare, RefreshCw} from 'lucide-react';
import type {Translations} from '@/lib/observatory/i18n';
import type {
  LiveTimelineSummary,
  ObservatorySnapshot,
  TimelineComparisonReport,
} from '@/lib/observatory/types';

interface ComparisonDrawerProps {
  t: Translations;
  snapshot: ObservatorySnapshot;
  liveApiAvailable: boolean;
  liveTimelines: LiveTimelineSummary[];
  importedPairSnapshots: {original: ObservatorySnapshot; experimental: ObservatorySnapshot} | null;
  onSelectAgent: (agentId: number) => void;
}

function buildLocalComparison(
  orig: ObservatorySnapshot,
  exp: ObservatorySnapshot,
): TimelineComparisonReport {
  const origTotal = orig.living_agents_full.length + orig.deceased_agents_archive.length;
  const expTotal = exp.living_agents_full.length + exp.deceased_agents_archive.length;
  const origSurv = Number(((orig.living_agents_full.length / Math.max(1, origTotal)) * 100).toFixed(2));
  const expSurv = Number(((exp.living_agents_full.length / Math.max(1, expTotal)) * 100).toFixed(2));

  const causesOrig: Record<string, number> = {};
  for (const d of orig.deceased_agents_archive) {
    const c = d.cause_of_death || 'unknown';
    causesOrig[c] = (causesOrig[c] ?? 0) + 1;
  }
  const causesExp: Record<string, number> = {};
  for (const d of exp.deceased_agents_archive) {
    const c = d.cause_of_death || 'unknown';
    causesExp[c] = (causesExp[c] ?? 0) + 1;
  }

  const expById = new Map<number, {is_alive: boolean; last_action: string; death_tick?: number | null; cause?: string | null; fp?: string | null}>();
  for (const a of exp.living_agents_full) {
    expById.set(a.agent_id, {is_alive: true, last_action: a.last_action, fp: a.brain_fingerprint});
  }
  for (const a of exp.deceased_agents_archive) {
    expById.set(a.agent_id, {
      is_alive: false,
      last_action: a.last_action,
      death_tick: a.death_tick,
      cause: a.cause_of_death,
      fp: a.brain_fingerprint,
    });
  }

  const audit = exp.rebirth_records.map((rec) => {
    const cur = expById.get(rec.agent_id);
    return {
      agent_id: rec.agent_id,
      generation: rec.generation,
      original_death_tick: rec.original_death_tick,
      original_cause_of_death: rec.original_cause_of_death,
      rebirth_tick: rec.rebirth_tick,
      death_penalty_applied: rec.death_penalty_applied,
      death_penalty_record: rec.death_penalty_record,
      currently_alive: cur?.is_alive ?? false,
      current_last_action: cur?.last_action ?? null,
      post_rebirth_death_tick: cur && !cur.is_alive ? cur.death_tick ?? null : null,
      post_rebirth_cause_of_death: cur && !cur.is_alive ? cur.cause ?? null : null,
      brain_fingerprint: cur?.fp ?? rec.brain_fingerprint,
    };
  });

  return {
    original: {
      world_id: orig.world_id,
      timeline_id: orig.timeline_id,
      timeline_kind: orig.timeline_kind,
      tick: orig.clock.tick,
      sim_date: orig.clock.sim_date,
      living_count: orig.living_agents_full.length,
      deceased_count: orig.deceased_agents_archive.length,
      total_agents_ever: origTotal,
      survival_rate_pct: origSurv,
      births_total: orig.demographics.births_total,
      causes_of_death: causesOrig,
      total_crimes: orig.crime_and_stability.total_crimes,
      crimes_per_1000_pop: orig.crime_and_stability.crimes_per_1000_pop,
      total_barters: orig.crime_and_stability.total_barters,
      social_trust_index: orig.crime_and_stability.social_trust_index,
      stability_index: orig.crime_and_stability.stability_index,
      active_groups: orig.crime_and_stability.active_groups,
    },
    experimental: {
      world_id: exp.world_id,
      timeline_id: exp.timeline_id,
      parent_timeline_id: exp.parent_timeline_id,
      timeline_kind: exp.timeline_kind,
      branch_point_tick: exp.branch_point_tick,
      tick: exp.clock.tick,
      sim_date: exp.clock.sim_date,
      living_count: exp.living_agents_full.length,
      deceased_count: exp.deceased_agents_archive.length,
      total_agents_ever: expTotal,
      survival_rate_pct: expSurv,
      births_total: exp.demographics.births_total,
      causes_of_death: causesExp,
      total_crimes: exp.crime_and_stability.total_crimes,
      crimes_per_1000_pop: exp.crime_and_stability.crimes_per_1000_pop,
      total_barters: exp.crime_and_stability.total_barters,
      social_trust_index: exp.crime_and_stability.social_trust_index,
      stability_index: exp.crime_and_stability.stability_index,
      active_groups: exp.crime_and_stability.active_groups,
    },
    deltas: {
      living_count_delta: exp.living_agents_full.length - orig.living_agents_full.length,
      survival_rate_pct_delta: Number((expSurv - origSurv).toFixed(2)),
      births_delta: exp.demographics.births_total - orig.demographics.births_total,
      crimes_delta: exp.crime_and_stability.total_crimes - orig.crime_and_stability.total_crimes,
      barters_delta: exp.crime_and_stability.total_barters - orig.crime_and_stability.total_barters,
    },
    rebirth_agents_count: audit.length,
    rebirth_agents_still_alive: audit.filter((r) => r.currently_alive).length,
    rebirth_audit: audit,
  };
}

export default function ComparisonDrawer({
  t,
  snapshot,
  liveApiAvailable,
  liveTimelines,
  importedPairSnapshots,
  onSelectAgent,
}: ComparisonDrawerProps) {
  const originals = useMemo(
    () => liveTimelines.filter((x) => x.timeline_kind !== 'experimental_rebirth'),
    [liveTimelines],
  );
  const experimentals = useMemo(
    () => liveTimelines.filter((x) => x.timeline_kind === 'experimental_rebirth'),
    [liveTimelines],
  );

  const [selectedOrigId, setSelectedOrigId] = useState<string>(originals[0]?.id ?? '');
  const [selectedExpId, setSelectedExpId] = useState<string>(experimentals[0]?.id ?? '');
  const [apiReport, setApiReport] = useState<TimelineComparisonReport | null>(null);
  const [loading, setLoading] = useState(false);

  const effectiveOrigId =
    selectedOrigId && originals.some((o) => o.id === selectedOrigId)
      ? selectedOrigId
      : (originals[0]?.id ?? '');
  const effectiveExpId =
    selectedExpId && experimentals.some((e) => e.id === selectedExpId)
      ? selectedExpId
      : (experimentals[0]?.id ?? '');

  const fetchComparison = async (origId: string, expId: string) => {
    if (!liveApiAvailable || !origId || !expId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/sim/compare?a=${encodeURIComponent(origId)}&b=${encodeURIComponent(expId)}`,
        {cache: 'no-store'},
      );
      if (!res.ok) return;
      const json = await res.json();
      if (json?.report) setApiReport(json.report as TimelineComparisonReport);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!liveApiAvailable || !effectiveOrigId || !effectiveExpId) return;
    let cancelled = false;
    fetch(
      `/api/sim/compare?a=${encodeURIComponent(effectiveOrigId)}&b=${encodeURIComponent(effectiveExpId)}`,
      {cache: 'no-store'},
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled && json?.report) {
          setApiReport(json.report as TimelineComparisonReport);
        }
      })
      .catch(() => {
        // Ignore transient network errors when server restarts
      });
    return () => {
      cancelled = true;
    };
  }, [liveApiAvailable, effectiveOrigId, effectiveExpId, snapshot.clock.tick]);

  const localReport = useMemo(() => {
    if (!importedPairSnapshots) return null;
    return buildLocalComparison(importedPairSnapshots.original, importedPairSnapshots.experimental);
  }, [importedPairSnapshots]);

  const report = apiReport ?? localReport;

  return (
    <div className="space-y-4 text-xs text-[#E6EDF3]">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 font-semibold text-[#57b8d8]">
          <GitCompare className="h-4 w-4" />
          <span>{t.cmpTitle}</span>
        </h3>
        {liveApiAvailable && effectiveOrigId && effectiveExpId && (
          <button
            type="button"
            disabled={loading}
            onClick={() => void fetchComparison(effectiveOrigId, effectiveExpId)}
            className="rounded border border-white/10 bg-[#18212C] p-1.5 text-[#9FB0C3] hover:text-[#E6EDF3]"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {liveApiAvailable && (originals.length > 0 || experimentals.length > 0) && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <div className="mb-1 text-[10px] text-[#9FB0C3]">{t.cmpOriginalLabel}</div>
            <select
              value={effectiveOrigId}
              onChange={(e) => setSelectedOrigId(e.target.value)}
              className="w-full rounded border border-white/10 bg-[#18212C] px-2 py-1.5 text-[11px]"
            >
              {originals.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.id} (T{o.tick})
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="mb-1 text-[10px] text-[#9FB0C3]">{t.cmpExperimentalLabel}</div>
            <select
              value={effectiveExpId}
              onChange={(e) => setSelectedExpId(e.target.value)}
              className="w-full rounded border border-white/10 bg-[#18212C] px-2 py-1.5 text-[11px]"
            >
              {experimentals.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.id} (T{ex.tick})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {!report ? (
        <div className="rounded border border-white/10 bg-[#18212C] p-4 text-center text-[11px] text-[#9FB0C3]">
          {t.cmpNoPairs}
        </div>
      ) : (
        <>
          {/* Side-by-side Metrics */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5 rounded border border-white/10 bg-[#18212C] p-3">
              <div className="text-[10px] font-semibold text-[#9FB0C3]">{t.cmpOriginalLabel}</div>
              <div className="font-mono text-sm font-bold tabular-nums">
                {t.tickUnit} {report.original.tick}
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-[#9FB0C3]">{t.livingLabel}</span>
                <span className="font-mono">{report.original.living_count}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-[#9FB0C3]">{t.cmpSurvivalRate}</span>
                <span className="font-mono">{report.original.survival_rate_pct}%</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-[#9FB0C3]">{t.totalCrimes}</span>
                <span className="font-mono">{report.original.total_crimes}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-[#9FB0C3]">{t.totalBarters}</span>
                <span className="font-mono">{report.original.total_barters}</span>
              </div>
            </div>

            <div className="space-y-1.5 rounded border border-[#3B82A6]/50 bg-[#3B82A6]/10 p-3">
              <div className="text-[10px] font-semibold text-[#57b8d8]">{t.cmpExperimentalLabel}</div>
              <div className="font-mono text-sm font-bold tabular-nums">
                {t.tickUnit} {report.experimental.tick}
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-[#9FB0C3]">{t.livingLabel}</span>
                <span className="font-mono text-emerald-300">
                  {report.experimental.living_count} ({report.deltas.living_count_delta >= 0 ? '+' : ''}
                  {report.deltas.living_count_delta})
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-[#9FB0C3]">{t.cmpSurvivalRate}</span>
                <span className="font-mono">
                  {report.experimental.survival_rate_pct}% (
                  {report.deltas.survival_rate_pct_delta >= 0 ? '+' : ''}
                  {report.deltas.survival_rate_pct_delta}%)
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-[#9FB0C3]">{t.totalCrimes}</span>
                <span className="font-mono">
                  {report.experimental.total_crimes} ({report.deltas.crimes_delta >= 0 ? '+' : ''}
                  {report.deltas.crimes_delta})
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-[#9FB0C3]">{t.totalBarters}</span>
                <span className="font-mono">
                  {report.experimental.total_barters} ({report.deltas.barters_delta >= 0 ? '+' : ''}
                  {report.deltas.barters_delta})
                </span>
              </div>
            </div>
          </div>

          {/* Rebirth Audit List */}
          <div className="space-y-2 rounded border border-white/10 bg-[#18212C] p-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-[#F2BE49]">{t.cmpRebirthAuditTitle}</h4>
              <span className="font-mono text-[11px] text-emerald-300">
                {report.rebirth_agents_still_alive} / {report.rebirth_agents_count} {t.statusAlive}
              </span>
            </div>
            <div className="max-h-56 space-y-1.5 overflow-y-auto">
              {report.rebirth_audit.slice(0, 80).map((item) => (
                <button
                  key={item.agent_id}
                  type="button"
                  onClick={() => onSelectAgent(item.agent_id)}
                  className="flex w-full items-center justify-between rounded bg-[#121821] px-2.5 py-1.5 text-start text-[11px] hover:border hover:border-[#D99B26]/50"
                >
                  <div>
                    <span className="font-mono font-semibold text-[#F2BE49]">#{item.agent_id}</span>{' '}
                    <span className="text-[#9FB0C3]">
                      ({item.original_cause_of_death ?? '—'} @ {t.tickUnit}{' '}
                      {item.original_death_tick ?? '—'})
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[10px]">
                    {item.death_penalty_applied && (
                      <span className="text-[#57b8d8]">DP</span>
                    )}
                    <span className={item.currently_alive ? 'text-emerald-300' : 'text-red-300'}>
                      {item.currently_alive ? t.statusAlive : t.statusDeceased}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
