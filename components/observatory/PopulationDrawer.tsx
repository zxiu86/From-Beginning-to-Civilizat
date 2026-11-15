'use client';

import React, {useMemo, useState} from 'react';
import {GitBranch, RefreshCw, Search, Skull, UserCheck} from 'lucide-react';
import {safeFixed} from '@/lib/observatory/formatters';
import type {Translations} from '@/lib/observatory/i18n';
import type {
  AnyAgentRecord,
  GenealogyNodeItem,
  ObservatorySnapshot,
} from '@/lib/observatory/types';

interface PopulationDrawerProps {
  t: Translations;
  snapshot: ObservatorySnapshot;
  selectedAgentId: number | null;
  agentLookup: Map<number, AnyAgentRecord>;
  onSelectAgent: (agentId: number) => void;
}

export default function PopulationDrawer({
  t,
  snapshot,
  selectedAgentId,
  agentLookup,
  onSelectAgent,
}: PopulationDrawerProps) {
  const [filter, setFilter] = useState<'all' | 'living' | 'deceased'>('living');
  const [query, setQuery] = useState('');

  const pop = snapshot.analytics.population;

  const genealogyMap = useMemo(() => {
    const m = new Map<number, GenealogyNodeItem>();
    for (const n of snapshot.genealogy_nodes) m.set(n.agent_id, n);
    return m;
  }, [snapshot.genealogy_nodes]);

  const filteredAgents = useMemo(() => {
    const all: AnyAgentRecord[] =
      filter === 'living'
        ? snapshot.living_agents_full
        : filter === 'deceased'
          ? snapshot.deceased_agents_archive
          : [...snapshot.living_agents_full, ...snapshot.deceased_agents_archive];

    const q = query.trim();
    const list = q ? all.filter((a) => String(a.agent_id).includes(q)) : all;
    return list.slice(0, 150);
  }, [filter, query, snapshot.living_agents_full, snapshot.deceased_agents_archive]);

  const ageTotal = Math.max(
    1,
    Object.values(snapshot.demographics.age_distribution).reduce((acc, v) => acc + v, 0),
  );

  const treeFocus = selectedAgentId !== null ? genealogyMap.get(selectedAgentId) ?? null : null;

  const renderNodePill = (id: number | null, labelPrefix = '', keyTag = 'n') => {
    if (id === null) return null;
    const node = genealogyMap.get(id);
    const ag = agentLookup.get(id);
    const alive = node ? node.is_alive : ag?.is_alive ?? false;
    return (
      <button
        key={`${keyTag}-${id}`}
        type="button"
        onClick={() => onSelectAgent(id)}
        className={`rounded border px-2 py-1 font-mono text-[11px] transition ${
          id === selectedAgentId
            ? 'border-[#D99B26] bg-[#D99B26]/20 text-[#F2BE49]'
            : alive
              ? 'border-emerald-500/30 bg-[#121821] text-emerald-300 hover:border-emerald-400'
              : 'border-white/10 bg-[#121821] text-[#9FB0C3] hover:border-white/30'
        }`}
      >
        {labelPrefix}#{id} {alive ? '●' : '†'}
      </button>
    );
  };

  return (
    <div className="space-y-4 text-xs text-[#E6EDF3]">
      {/* Demographic KPIs */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded border border-white/10 bg-[#18212C] p-2.5">
          <div className="text-[10px] text-[#9FB0C3]">{t.totalEverLived}</div>
          <div className="font-mono text-base font-bold tabular-nums">{pop.total_ever_lived}</div>
        </div>
        <div className="rounded border border-white/10 bg-[#18212C] p-2.5">
          <div className="text-[10px] text-[#9FB0C3]">
            {t.maleCount} / {t.femaleCount}
          </div>
          <div className="font-mono text-base font-bold tabular-nums">
            <span className="text-[#57b8d8]">{pop.male_count}</span> /{' '}
            <span className="text-[#F2BE49]">{pop.female_count}</span>
          </div>
        </div>
        <div className="rounded border border-white/10 bg-[#18212C] p-2.5">
          <div className="text-[10px] text-[#9FB0C3]">{t.avgAgeYears}</div>
          <div className="font-mono text-base font-bold tabular-nums">
            {safeFixed(pop.avg_age_years, 1)} {t.ageYears}
          </div>
          <div className="font-mono text-[10px] tabular-nums text-[#9FB0C3]">
            {pop.youngest_living_age_years !== null ? safeFixed(pop.youngest_living_age_years, 1) : '—'} –{' '}
            {pop.oldest_living_age_years !== null ? safeFixed(pop.oldest_living_age_years, 1) : '—'}
          </div>
        </div>
        <div className="rounded border border-white/10 bg-[#18212C] p-2.5">
          <div className="text-[10px] text-[#9FB0C3]">{t.netGrowthRate1k}</div>
          <div
            className={`font-mono text-base font-bold tabular-nums ${
              pop.net_growth_rate_per_1000 >= 0 ? 'text-emerald-300' : 'text-red-300'
            }`}
          >
            {pop.net_growth_rate_per_1000 >= 0 ? '+' : ''}
            {safeFixed(pop.net_growth_rate_per_1000, 1)}
          </div>
          <div className="font-mono text-[10px] tabular-nums text-[#9FB0C3]">
            B:{safeFixed(pop.birth_rate_per_1000, 1)} · D:{safeFixed(pop.death_rate_per_1000, 1)}
          </div>
        </div>
      </div>

      {/* Household & Generation Summary */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded border border-white/10 bg-[#18212C] p-2.5">
          <div className="text-[10px] text-[#9FB0C3]">{t.birthsTotal}</div>
          <div className="font-mono text-sm font-bold tabular-nums text-emerald-300">
            {pop.births_total}
          </div>
        </div>
        <div className="rounded border border-white/10 bg-[#18212C] p-2.5">
          <div className="text-[10px] text-[#9FB0C3]">{t.familyUnitsCount}</div>
          <div className="font-mono text-sm font-bold tabular-nums">
            {pop.family_units_count}{' '}
            <span className="text-[10px] text-[#9FB0C3]">
              (avg {safeFixed(pop.avg_family_size, 1)})
            </span>
          </div>
        </div>
        <div className="rounded border border-white/10 bg-[#18212C] p-2.5">
          <div className="text-[10px] text-[#9FB0C3]">{t.independentAdults}</div>
          <div className="font-mono text-sm font-bold tabular-nums">{pop.independent_adults_count}</div>
        </div>
        <div className="rounded border border-white/10 bg-[#18212C] p-2.5">
          <div className="text-[10px] text-[#9FB0C3]">{t.dependentsCount}</div>
          <div className="font-mono text-sm font-bold tabular-nums">{pop.dependents_count}</div>
        </div>
      </div>

      {/* Age Distribution + Generation Breakdown */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded border border-white/10 bg-[#18212C] p-3">
          <h3 className="mb-2 font-semibold">{t.ageDistTitle}</h3>
          <div className="grid grid-cols-4 gap-2">
            {(['infant', 'child', 'adult', 'elder'] as const).map((stage) => {
              const count = snapshot.demographics.age_distribution[stage] ?? 0;
              const pct = Math.round((count / ageTotal) * 100);
              return (
                <div key={stage} className="rounded bg-[#121821] p-2 text-center">
                  <div className="text-[10px] text-[#9FB0C3]">{t.lifeStages[stage] ?? stage}</div>
                  <div className="font-mono text-sm font-bold tabular-nums">{count}</div>
                  <div className="font-mono text-[10px] tabular-nums text-[#9FB0C3]">{pct}%</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded border border-white/10 bg-[#18212C] p-3">
          <h3 className="mb-2 font-semibold">{t.genBreakdownTitle}</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(pop.generations_breakdown)
              .sort((a, b) => Number(a[0]) - Number(b[0]))
              .map(([gen, cnt]) => (
                <div key={gen} className="rounded bg-[#121821] px-3 py-2 text-center">
                  <div className="text-[10px] text-[#9FB0C3]">
                    {t.genShort} {gen}
                  </div>
                  <div className="font-mono text-sm font-bold tabular-nums text-[#F2BE49]">{cnt}</div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Recovery Cycles */}
      {snapshot.recovery_state && (
        <div className="rounded border border-white/10 bg-[#18212C] p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 font-semibold text-[#57b8d8]">
              <RefreshCw className="h-3.5 w-3.5" />
              <span>{t.recoverySectionTitle}</span>
            </h3>
            <span className="font-mono text-[11px] text-[#F2BE49]">
              {t.recoveryCurrentCycle}: #{snapshot.recovery_state.current_cycle_number}
            </span>
          </div>
          {snapshot.recovery_state.population_recovery_history.length === 0 ? (
            <div className="text-[11px] text-[#9FB0C3]">{t.recoveryNoCycles}</div>
          ) : (
            <div className="max-h-48 space-y-2 overflow-y-auto">
              {[...snapshot.recovery_state.population_recovery_history].reverse().map((cyc) => (
                <div
                  key={`${cyc.cycle_number}-${cyc.recovery_tick}`}
                  className="space-y-1 rounded border border-white/5 bg-[#121821] p-2 text-[11px]"
                >
                  <div className="flex items-center justify-between font-mono">
                    <span className="font-bold text-[#F2BE49]">
                      Cycle #{cyc.cycle_number} ({cyc.recovery_date})
                    </span>
                    <span
                      className={
                        cyc.outcome === 're_extinct'
                          ? 'text-red-300'
                          : cyc.outcome === 'grew'
                            ? 'text-emerald-300'
                            : 'text-[#57b8d8]'
                      }
                    >
                      {cyc.outcome}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-[#9FB0C3]">
                    <span>
                      {t.recoveryFoundersLabel}:{' '}
                      <strong className="font-mono text-[#E6EDF3]">
                        {cyc.new_agent_ids.map((id) => `#${id}`).join(', ') || '—'}
                      </strong>
                    </span>
                    <span>
                      {t.livingLabel}:{' '}
                      <strong className="font-mono text-[#E6EDF3]">{cyc.post_recovery_population}</strong>
                    </span>
                    <span>
                      {t.recoveryBirthsLabel}:{' '}
                      <strong className="font-mono text-emerald-300">{cyc.subsequent_births}</strong>
                    </span>
                    <span>
                      {t.recoveryDurationLabel}:{' '}
                      <strong className="font-mono text-[#E6EDF3]">
                        {cyc.survival_duration_ticks} {t.tickUnit}
                      </strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Interactive Family Tree */}
      <div className="rounded border border-white/10 bg-[#18212C] p-3">
        <h3 className="mb-2 flex items-center gap-1.5 font-semibold">
          <GitBranch className="h-3.5 w-3.5 text-[#D99B26]" />
          <span>{t.familyTreeTitle}</span>
        </h3>
        {!treeFocus ? (
          <div className="text-[11px] text-[#9FB0C3]">{t.selectRootForTree}</div>
        ) : (
          <div className="space-y-2.5 text-center">
            <div className="flex flex-wrap justify-center gap-2">
              {treeFocus.parent_a_id === null && treeFocus.parent_b_id === null ? (
                <span className="text-[11px] text-[#9FB0C3]">{t.noParentsFounders}</span>
              ) : (
                <>
                  {renderNodePill(treeFocus.parent_a_id, 'P ', 'pa')}
                  {renderNodePill(treeFocus.parent_b_id, 'P ', 'pb')}
                </>
              )}
            </div>
            <div className="mx-auto h-3 w-px bg-white/15" />
            <div className="flex justify-center">{renderNodePill(treeFocus.agent_id, '', 'self')}</div>
            {treeFocus.children_ids.length > 0 && (
              <>
                <div className="mx-auto h-3 w-px bg-white/15" />
                <div className="flex flex-wrap justify-center gap-1.5">
                  {treeFocus.children_ids.map((cid, idx) => renderNodePill(cid, 'C ', `ch-${idx}`))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Searchable Registry List */}
      <div className="space-y-2 rounded border border-white/10 bg-[#18212C] p-3">
        <div className="flex gap-1">
          {(['living', 'deceased', 'all'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`flex-1 rounded border py-1.5 text-[11px] font-medium transition ${
                filter === f
                  ? 'border-[#D99B26] bg-[#D99B26]/15 text-[#F2BE49]'
                  : 'border-white/10 bg-[#121821] text-[#9FB0C3]'
              }`}
            >
              {f === 'living'
                ? `${t.popFilterLiving} (${snapshot.living_agents_full.length})`
                : f === 'deceased'
                  ? `${t.popFilterDeceased} (${snapshot.deceased_agents_archive.length})`
                  : t.popFilterAll}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute top-2.5 start-2.5 h-3.5 w-3.5 text-[#9FB0C3]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchAgentPlaceholder}
            className="w-full rounded border border-white/10 bg-[#121821] py-1.5 pe-2 ps-8 text-xs text-[#E6EDF3] placeholder:text-[#9FB0C3]/60 focus:border-[#D99B26] focus:outline-none"
          />
        </div>

        <div className="max-h-72 space-y-1 overflow-y-auto">
          {filteredAgents.map((ag) => (
            <button
              key={ag.agent_id}
              type="button"
              onClick={() => onSelectAgent(ag.agent_id)}
              className={`flex w-full items-center justify-between rounded border px-2.5 py-2 text-start transition ${
                selectedAgentId === ag.agent_id
                  ? 'border-[#D99B26] bg-[#D99B26]/10'
                  : 'border-white/5 bg-[#121821] hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-2">
                {ag.is_alive ? (
                  <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Skull className="h-3.5 w-3.5 text-red-400" />
                )}
                <span className="font-mono font-semibold">#{ag.agent_id}</span>
                <span className="text-[11px] text-[#9FB0C3]">
                  {ag.sex === 'F' ? t.sexF : t.sexM} · {t.genShort} {ag.generation}
                </span>
              </div>
              <div className="font-mono text-[11px] tabular-nums text-[#9FB0C3]">
                {safeFixed(ag.age_years, 1)} {t.ageYears}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
