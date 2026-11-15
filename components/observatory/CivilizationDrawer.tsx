'use client';

import React from 'react';
import {
  BookOpen,
  Coins,
  Info,
  Languages,
  Package,
  Scale,
  ShieldAlert,
} from 'lucide-react';
import {formatProtoword, safeFixed} from '@/lib/observatory/formatters';
import type {Translations} from '@/lib/observatory/i18n';
import type {ObservatorySnapshot} from '@/lib/observatory/types';

interface CivilizationDrawerProps {
  t: Translations;
  snapshot: ObservatorySnapshot;
}

export default function CivilizationDrawer({t, snapshot}: CivilizationDrawerProps) {
  const lang = snapshot.emergent_language;
  const crime = snapshot.crime_and_stability;
  const social = snapshot.analytics.social_civilization;
  const econ = snapshot.analytics.economy;
  const techs = Object.entries(snapshot.demographics.discovered_techs);
  const protoEntries = Object.entries(lang.stable_protowords).map(([key, val]) =>
    formatProtoword(key, val, t.contexts),
  );
  const dialectEntries = Object.entries(lang.dialect_clusters);
  const activeGroups = snapshot.groups.filter((g) => g.active);

  return (
    <div className="space-y-4 text-xs text-[#E6EDF3]">
      {/* Observatory Scope Note */}
      <div className="rounded border border-[#3B82A6]/40 bg-[#3B82A6]/10 p-3">
        <div className="mb-1 flex items-center gap-1.5 font-semibold text-[#57b8d8]">
          <Info className="h-3.5 w-3.5" />
          <span>{t.engineScopeNoteTitle}</span>
        </div>
        <p className="text-[11px] leading-relaxed text-[#9FB0C3]">{t.engineScopeNoteBody}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* 1. Emergent Language (FIXED: uses formatProtoword — zero raw object JSX rendering) */}
        <section className="space-y-3 rounded border border-white/10 bg-[#18212C] p-4">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[#57b8d8]">
            <Languages className="h-4 w-4" />
            <span>{t.civLangTitle}</span>
          </h3>
          <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
            <div className="rounded bg-[#121821] p-2">
              <div className="text-[#9FB0C3]">{t.activeTokens}</div>
              <div className="font-mono text-sm font-bold tabular-nums">
                {social.active_language_tokens}
              </div>
            </div>
            <div className="rounded bg-[#121821] p-2">
              <div className="text-[#9FB0C3]">{t.stableProtowords}</div>
              <div className="font-mono text-sm font-bold tabular-nums">
                {lang.stable_protowords_count}
              </div>
            </div>
            <div className="rounded bg-[#121821] p-2">
              <div className="text-[#9FB0C3]">{t.intergenTransmission}</div>
              <div className="font-mono text-sm font-bold tabular-nums">
                {lang.intergenerational_transmissions}
              </div>
            </div>
            <div className="rounded bg-[#121821] p-2">
              <div className="text-[#9FB0C3]">{t.semanticDrift}</div>
              <div className="font-mono text-sm font-bold tabular-nums">
                {lang.semantic_drift_events}
              </div>
            </div>
          </div>

          {protoEntries.length === 0 ? (
            <div className="text-[11px] text-[#9FB0C3]">{t.notYetInvented}</div>
          ) : (
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {protoEntries.map((pw) => (
                <div
                  key={pw.key}
                  className="flex items-center justify-between gap-2 rounded border border-white/10 bg-[#121821] px-2.5 py-1.5 text-[11px]"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-semibold text-[#57b8d8]">{pw.tokenLabel}</span>
                    {pw.extinct && (
                      <span className="font-mono text-[10px] text-red-300">
                        ({t.extinctWordLabel})
                      </span>
                    )}
                  </div>
                  <div className="truncate text-end text-[#9FB0C3]">
                    <span>{pw.contextLabel}</span>
                    {pw.adopters !== null && (
                      <span className="ms-1.5 font-mono text-[10px] text-[#F2BE49]">
                        · {pw.adopters} {t.adoptersLabel}
                      </span>
                    )}
                    {pw.stabilizedTick !== null && (
                      <span className="ms-1 font-mono text-[10px] text-[#9FB0C3]/75">
                        @T{pw.stabilizedTick}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {lang.top_bigrams.length > 0 && (
            <div>
              <div className="mb-1 text-[11px] text-[#9FB0C3]">{t.topBigrams}</div>
              <div className="flex flex-wrap gap-1.5">
                {lang.top_bigrams.slice(0, 8).map(([seq, cnt]) => (
                  <span
                    key={seq}
                    className="rounded bg-[#121821] px-2 py-0.5 font-mono text-[11px] tabular-nums"
                  >
                    {seq} ({cnt})
                  </span>
                ))}
              </div>
            </div>
          )}

          {dialectEntries.length > 0 && (
            <div>
              <div className="mb-1 text-[11px] text-[#9FB0C3]">{t.dialects}</div>
              <div className="grid grid-cols-2 gap-1.5">
                {dialectEntries.map(([quad, map]) => (
                  <div key={quad} className="rounded bg-[#121821] px-2 py-1 font-mono text-[10px]">
                    <span className="font-bold text-[#D99B26]">{quad}:</span>{' '}
                    {Object.entries(map)
                      .slice(0, 3)
                      .map(([c, tok]) => `${c.split('_')[0]}=T${tok}`)
                      .join(', ')}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* 2. Social Interactions & Governance */}
        <section className="space-y-3 rounded border border-white/10 bg-[#18212C] p-4">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-emerald-400">
            <Scale className="h-4 w-4" />
            <span>{t.civSocietyTitle}</span>
          </h3>
          <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-3">
            <div className="rounded bg-[#121821] p-2">
              <div className="text-[#9FB0C3]">{t.socialTiesSection}</div>
              <div className="font-mono text-sm font-bold tabular-nums">
                {social.social_ties_count}
              </div>
            </div>
            <div className="rounded bg-[#121821] p-2">
              <div className="text-[#9FB0C3]">{t.activeGroups}</div>
              <div className="font-mono text-sm font-bold tabular-nums">{crime.active_groups}</div>
            </div>
            <div className="rounded bg-[#121821] p-2">
              <div className="text-[#9FB0C3]">{t.normsLabel}</div>
              <div className="font-mono text-sm font-bold tabular-nums">{social.norms_count}</div>
            </div>
            <div className="rounded bg-[#121821] p-2">
              <div className="text-[#9FB0C3]">{t.cooperationLabel}</div>
              <div className="font-mono text-sm font-bold tabular-nums text-emerald-300">
                {social.cooperation_events}
              </div>
            </div>
            <div className="rounded bg-[#121821] p-2">
              <div className="text-[#9FB0C3]">{t.mutualAidLabel}</div>
              <div className="font-mono text-sm font-bold tabular-nums text-[#57b8d8]">
                {social.mutual_aid_events}
              </div>
            </div>
            <div className="rounded bg-[#121821] p-2">
              <div className="text-[#9FB0C3]">{t.teachingLabel}</div>
              <div className="font-mono text-sm font-bold tabular-nums text-[#F2BE49]">
                {social.teaching_events}
              </div>
            </div>
          </div>

          {activeGroups.length === 0 ? (
            <div className="text-[11px] text-[#9FB0C3]">{t.notYetInvented}</div>
          ) : (
            <div className="max-h-48 space-y-2 overflow-y-auto">
              {activeGroups.map((g, idx) => {
                const members = g.member_ids ?? [];
                const norms = g.norm_rules ?? [];
                return (
                  <div
                    key={`${g.group_id}-${idx}`}
                    className="rounded border border-white/5 bg-[#121821] p-2 text-[11px]"
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span className="font-mono text-[#F2BE49]">Group #{g.group_id}</span>
                      <span className="text-[#9FB0C3]">
                        {t.membersLabel}: {members.length}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-[#9FB0C3]">
                      <span>
                        {t.governanceType}: {t.governance[g.governance_type] ?? g.governance_type}
                      </span>
                      <span>
                        {t.leaderLabel}: {g.leader_id !== null ? `#${g.leader_id}` : '—'}
                      </span>
                      {g.has_currency_token && <span className="text-[#F2BE49]">{t.currencyTokens}</span>}
                    </div>
                    {norms.length > 0 && (
                      <div className="mt-1 text-[10px] text-emerald-300">
                        {t.normsLabel}: {norms.join(', ')}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 3. Economy, Production, Scarcity & Gini Wealth Distribution */}
        <section className="space-y-3 rounded border border-white/10 bg-[#18212C] p-4">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[#F2BE49]">
            <Coins className="h-4 w-4" />
            <span>{t.civEconTitle}</span>
          </h3>

          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <div className="rounded bg-[#121821] p-2">
              <div className="text-[#9FB0C3]">{t.totalBarters}</div>
              <div className="font-mono text-sm font-bold tabular-nums">{crime.total_barters}</div>
            </div>
            <div className="rounded bg-[#121821] p-2">
              <div className="text-[#9FB0C3]">{t.emergentMarkets}</div>
              <div className="font-mono text-sm font-bold tabular-nums">{crime.emergent_markets}</div>
            </div>
            <div className="rounded bg-[#121821] p-2">
              <div className="text-[#9FB0C3]">{t.cultivationLabel}</div>
              <div className="font-mono text-sm font-bold tabular-nums">
                {social.cultivation_events}
              </div>
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-[#E6EDF3]">
              <Package className="h-3.5 w-3.5 text-[#57b8d8]" />
              <span>{t.econProdConsTitle} & {t.storedInventoriesTitle}</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px] tabular-nums sm:grid-cols-3">
              <div className="rounded bg-[#121821] p-2">
                <div className="font-sans text-[10px] text-[#9FB0C3]">{t.foodCultivated}</div>
                <div>{safeFixed(econ.resource_produced.food_cultivated, 1)}</div>
              </div>
              <div className="rounded bg-[#121821] p-2">
                <div className="font-sans text-[10px] text-[#9FB0C3]">{t.woodGathered}</div>
                <div>
                  {safeFixed(econ.resource_produced.wood_gathered, 1)} (stored:{' '}
                  {safeFixed(econ.resource_stored_inventories.wood, 1)})
                </div>
              </div>
              <div className="rounded bg-[#121821] p-2">
                <div className="font-sans text-[10px] text-[#9FB0C3]">{t.stoneGathered}</div>
                <div>
                  {safeFixed(econ.resource_produced.stone_gathered, 1)} (stored:{' '}
                  {safeFixed(econ.resource_stored_inventories.stone, 1)})
                </div>
              </div>
              <div className="rounded bg-[#121821] p-2">
                <div className="font-sans text-[10px] text-[#9FB0C3]">{t.herbGathered}</div>
                <div>
                  {safeFixed(econ.resource_produced.herb_gathered, 1)} (stored:{' '}
                  {safeFixed(econ.resource_stored_inventories.herb, 1)})
                </div>
              </div>
              <div className="rounded bg-[#121821] p-2">
                <div className="font-sans text-[10px] text-[#9FB0C3]">{t.toolsCrafted}</div>
                <div>
                  {econ.resource_produced.tools_crafted} (stored:{' '}
                  {safeFixed(econ.resource_stored_inventories.tool, 0)})
                </div>
              </div>
              <div className="rounded bg-[#121821] p-2">
                <div className="font-sans text-[10px] text-[#9FB0C3]">{t.scarceResourcesTitle}</div>
                <div className="text-[#F2BE49]">
                  {econ.scarce_resources.length > 0
                    ? econ.scarce_resources.join(', ')
                    : t.noScarceResources}
                </div>
              </div>
            </div>
          </div>

          {/* Wealth Distribution */}
          <div className="rounded bg-[#121821] p-2.5">
            <div className="mb-1.5 text-[11px] font-semibold text-[#9FB0C3]">{t.wealthDistTitle}</div>
            <div className="grid grid-cols-2 gap-2 font-mono text-[11px] tabular-nums sm:grid-cols-4">
              <div>
                <div className="font-sans text-[10px] text-[#9FB0C3]">{t.giniIndex}</div>
                <div className="font-bold text-[#57b8d8]">
                  {safeFixed(econ.wealth_distribution.gini_inventory, 3)}
                </div>
              </div>
              <div>
                <div className="font-sans text-[10px] text-[#9FB0C3]">{t.medianInventory}</div>
                <div>{safeFixed(econ.wealth_distribution.median_inventory, 2)}</div>
              </div>
              <div>
                <div className="font-sans text-[10px] text-[#9FB0C3]">{t.maxInventory}</div>
                <div>{safeFixed(econ.wealth_distribution.max_inventory, 2)}</div>
              </div>
              <div>
                <div className="font-sans text-[10px] text-[#9FB0C3]">{t.top10Share}</div>
                <div className="text-[#F2BE49]">{safeFixed(econ.wealth_distribution.top10_share_pct, 1)}%</div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Knowledge, Artifacts & Crime/Justice */}
        <section className="space-y-3 rounded border border-white/10 bg-[#18212C] p-4">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[#D99B26]">
            <BookOpen className="h-4 w-4" />
            <span>{t.civKnowledgeTitle}</span>
          </h3>
          <div className="flex justify-between rounded bg-[#121821] px-2.5 py-1.5 text-[11px]">
            <span className="text-[#9FB0C3]">{t.surfaceArtifacts}</span>
            <span className="font-mono font-bold tabular-nums">
              {snapshot.history_layers.layer_2_surface_artifacts_count}
            </span>
          </div>
          {techs.length === 0 ? (
            <div className="text-[11px] text-[#9FB0C3]">{t.notYetInvented}</div>
          ) : (
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {techs.map(([tech, discoveredTick]) => (
                <div
                  key={tech}
                  className="flex items-center justify-between rounded border border-white/10 bg-[#121821] px-2.5 py-1.5 text-[11px]"
                >
                  <span className="text-[#E6EDF3]">{t.techs[tech] ?? tech}</span>
                  <span className="font-mono text-[#F2BE49] tabular-nums">
                    {t.tickUnit} {discoveredTick}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-white/10 pt-3">
            <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-red-400">
              <ShieldAlert className="h-4 w-4" />
              <span>{t.civCrimeTitle}</span>
            </h4>
            <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
              <div className="rounded bg-[#121821] p-2">
                <div className="text-[#9FB0C3]">{t.totalCrimes}</div>
                <div className="font-mono text-sm font-bold tabular-nums">{crime.total_crimes}</div>
              </div>
              <div className="rounded bg-[#121821] p-2">
                <div className="text-[#9FB0C3]">{t.recentCrimeRate1k}</div>
                <div className="font-mono text-sm font-bold tabular-nums">
                  {safeFixed(crime.recent_180d_crimes_per_1000, 1)}
                </div>
              </div>
              <div className="rounded bg-[#121821] p-2">
                <div className="text-[#9FB0C3]">{t.disputeResolution}</div>
                <div className="font-mono text-sm font-bold tabular-nums">
                  {safeFixed(crime.dispute_resolution_rate * 100, 0)}%
                </div>
              </div>
              <div className="rounded bg-[#121821] p-2">
                <div className="text-[#9FB0C3]">{t.socialTrust}</div>
                <div className="font-mono text-sm font-bold tabular-nums">
                  {safeFixed(crime.social_trust_index, 3)}
                </div>
              </div>
            </div>

            <div className="mt-2 grid grid-cols-4 gap-1.5 text-center font-mono text-[10px] tabular-nums">
              <div className="rounded bg-[#121821] p-1.5">
                <div className="text-[#9FB0C3]">{t.murderRate}</div>
                <div>{safeFixed(crime.murder_rate_per_1000, 1)}</div>
              </div>
              <div className="rounded bg-[#121821] p-1.5">
                <div className="text-[#9FB0C3]">{t.assaultRate}</div>
                <div>{safeFixed(crime.assault_rate_per_1000, 1)}</div>
              </div>
              <div className="rounded bg-[#121821] p-1.5">
                <div className="text-[#9FB0C3]">{t.theftRate}</div>
                <div>{safeFixed(crime.theft_rate_per_1000, 1)}</div>
              </div>
              <div className="rounded bg-[#121821] p-1.5">
                <div className="text-[#9FB0C3]">{t.deceptionRate}</div>
                <div>{crime.crimes_by_type.deception ?? 0}</div>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded bg-[#121821] px-2.5 py-2 text-[11px]">
              <div>
                <span className="text-[#9FB0C3]">{t.stabilityIndex}: </span>
                {crime.stability_index !== null ? (
                  <span className="font-mono font-bold tabular-nums text-emerald-400">
                    {safeFixed(crime.stability_index, 3)}
                  </span>
                ) : (
                  <span className="text-[#9FB0C3]">{t.insufficientWindow}</span>
                )}
              </div>
              <div className="text-[#9FB0C3]">
                {t.repeatOffenders}:{' '}
                <strong className="font-mono text-[#E6EDF3]">{crime.repeat_offenders_count}</strong>
                <span className="mx-2 text-white/20">·</span>
                {t.lastCrimeLabel}:{' '}
                <strong className="font-mono text-[#E6EDF3]">
                  {crime.last_crime_tick !== null ? `${t.tickUnit} ${crime.last_crime_tick}` : '—'}
                </strong>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
