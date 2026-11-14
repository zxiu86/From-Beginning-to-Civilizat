'use client';

import React from 'react';
import {
  BookOpen,
  Coins,
  Info,
  Languages,
  Scale,
  ShieldAlert,
} from 'lucide-react';
import type {Translations} from '@/lib/observatory/i18n';
import type {ObservatorySnapshot} from '@/lib/observatory/types';

interface CivilizationDrawerProps {
  t: Translations;
  snapshot: ObservatorySnapshot;
}

export default function CivilizationDrawer({t, snapshot}: CivilizationDrawerProps) {
  const lang = snapshot.emergent_language;
  const crime = snapshot.crime_and_stability;
  const techs = Object.entries(snapshot.demographics.discovered_techs);
  const protoList = Object.entries(lang.stable_protowords);
  const dialectEntries = Object.entries(lang.dialect_clusters);
  const activeGroups = snapshot.groups.filter((g) => g.active);

  return (
    <div className="space-y-4 text-xs text-[#E6EDF3]">
      {/* Honest Physical Scope Note */}
      <div className="rounded border border-[#3B82A6]/40 bg-[#3B82A6]/10 p-3">
        <div className="mb-1 flex items-center gap-1.5 font-semibold text-[#57b8d8]">
          <Info className="h-3.5 w-3.5" />
          <span>{t.engineScopeNoteTitle}</span>
        </div>
        <p className="text-[11px] leading-relaxed text-[#9FB0C3]">{t.engineScopeNoteBody}</p>
      </div>

      {/* 1. Emergent Language */}
      <section className="space-y-2 rounded border border-white/10 bg-[#18212C] p-3">
        <h3 className="flex items-center gap-1.5 font-semibold text-[#57b8d8]">
          <Languages className="h-4 w-4" />
          <span>{t.civLangTitle}</span>
        </h3>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
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
          <div className="rounded bg-[#121821] p-2">
            <div className="text-[#9FB0C3]">{t.extinctTokens}</div>
            <div className="font-mono text-sm font-bold tabular-nums">
              {lang.extinct_tokens_count}
            </div>
          </div>
        </div>

        {protoList.length === 0 ? (
          <div className="text-[11px] text-[#9FB0C3]">{t.notYetInvented}</div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {protoList.map(([ctx, tokenStr]) => (
              <div
                key={ctx}
                className="rounded border border-white/10 bg-[#121821] px-2 py-1 text-[11px]"
              >
                <span className="font-mono text-[#57b8d8]">{tokenStr}</span>
                <span className="mx-1 text-white/20">→</span>
                <span className="text-[#9FB0C3]">{t.contexts[ctx] ?? ctx}</span>
              </div>
            ))}
          </div>
        )}

        {lang.top_bigrams.length > 0 && (
          <div>
            <div className="mb-1 text-[11px] text-[#9FB0C3]">{t.topBigrams}</div>
            <div className="flex flex-wrap gap-1.5">
              {lang.top_bigrams.slice(0, 6).map(([seq, cnt]) => (
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

      {/* 2. Economy & Exchange */}
      <section className="space-y-2 rounded border border-white/10 bg-[#18212C] p-3">
        <h3 className="flex items-center gap-1.5 font-semibold text-[#F2BE49]">
          <Coins className="h-4 w-4" />
          <span>{t.civEconTitle}</span>
        </h3>
        {crime.total_barters === 0 && crime.exchange_hubs.length === 0 ? (
          <div className="text-[11px] text-[#9FB0C3]">{t.notYetInvented}</div>
        ) : (
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <div className="rounded bg-[#121821] p-2">
              <div className="text-[#9FB0C3]">{t.totalBarters}</div>
              <div className="font-mono text-sm font-bold tabular-nums">{crime.total_barters}</div>
            </div>
            <div className="rounded bg-[#121821] p-2">
              <div className="text-[#9FB0C3]">{t.emergentMarkets}</div>
              <div className="font-mono text-sm font-bold tabular-nums">
                {crime.emergent_markets}
              </div>
            </div>
            <div className="rounded bg-[#121821] p-2">
              <div className="text-[#9FB0C3]">{t.exchangeHubsCount}</div>
              <div className="font-mono text-sm font-bold tabular-nums">
                {crime.exchange_hubs.length}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 3. Society & Governance */}
      <section className="space-y-2 rounded border border-white/10 bg-[#18212C] p-3">
        <h3 className="flex items-center gap-1.5 font-semibold text-emerald-400">
          <Scale className="h-4 w-4" />
          <span>{t.civSocietyTitle}</span>
        </h3>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded bg-[#121821] p-2">
            <div className="text-[#9FB0C3]">{t.activeGroups}</div>
            <div className="font-mono text-sm font-bold tabular-nums">{crime.active_groups}</div>
          </div>
          <div className="rounded bg-[#121821] p-2">
            <div className="text-[#9FB0C3]">{t.collapsedInstitutions}</div>
            <div className="font-mono text-sm font-bold tabular-nums">
              {crime.collapsed_institutions}
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
                    {g.next_election_tick !== null && (
                      <span>
                        {t.nextElectionLabel}: {t.tickUnit} {g.next_election_tick}
                      </span>
                    )}
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

      {/* 4. Knowledge & Tech */}
      <section className="space-y-2 rounded border border-white/10 bg-[#18212C] p-3">
        <h3 className="flex items-center gap-1.5 font-semibold text-[#D99B26]">
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
          <div className="flex flex-wrap gap-1.5">
            {techs.map(([tech, cnt]) => (
              <span
                key={tech}
                className="rounded border border-[#D99B26]/30 bg-[#121821] px-2 py-1 text-[11px]"
              >
                {t.techs[tech] ?? tech} <span className="font-mono text-[#F2BE49]">({cnt})</span>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* 5. Crime, Justice & Stability */}
      <section className="space-y-2 rounded border border-white/10 bg-[#18212C] p-3">
        <h3 className="flex items-center gap-1.5 font-semibold text-red-400">
          <ShieldAlert className="h-4 w-4" />
          <span>{t.civCrimeTitle}</span>
        </h3>

        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded bg-[#121821] p-2">
            <div className="text-[#9FB0C3]">{t.totalCrimes}</div>
            <div className="font-mono text-sm font-bold tabular-nums">{crime.total_crimes}</div>
          </div>
          <div className="rounded bg-[#121821] p-2">
            <div className="text-[#9FB0C3]">{t.recentCrimeRate1k}</div>
            <div className="font-mono text-sm font-bold tabular-nums">
              {crime.recent_180d_crimes_per_1000.toFixed(1)}
            </div>
          </div>
          <div className="rounded bg-[#121821] p-2">
            <div className="text-[#9FB0C3]">{t.disputeResolution}</div>
            <div className="font-mono text-sm font-bold tabular-nums">
              {(crime.dispute_resolution_rate * 100).toFixed(0)}%
            </div>
          </div>
          <div className="rounded bg-[#121821] p-2">
            <div className="text-[#9FB0C3]">{t.socialTrust}</div>
            <div className="font-mono text-sm font-bold tabular-nums">
              {crime.social_trust_index.toFixed(3)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5 text-center font-mono text-[10px] tabular-nums">
          <div className="rounded bg-[#121821] p-1.5">
            <div className="text-[#9FB0C3]">{t.murderRate}</div>
            <div>{crime.murder_rate_per_1000.toFixed(1)}</div>
          </div>
          <div className="rounded bg-[#121821] p-1.5">
            <div className="text-[#9FB0C3]">{t.assaultRate}</div>
            <div>{crime.assault_rate_per_1000.toFixed(1)}</div>
          </div>
          <div className="rounded bg-[#121821] p-1.5">
            <div className="text-[#9FB0C3]">{t.theftRate}</div>
            <div>{crime.theft_rate_per_1000.toFixed(1)}</div>
          </div>
        </div>

        <div className="rounded bg-[#121821] p-2 text-[11px]">
          <span className="text-[#9FB0C3]">{t.stabilityIndex}: </span>
          {crime.stability_index !== null ? (
            <span className="font-mono font-bold tabular-nums text-emerald-400">
              {crime.stability_index.toFixed(3)}
            </span>
          ) : (
            <span className="text-[#9FB0C3]">{t.insufficientWindow}</span>
          )}
        </div>

        <div className="flex justify-between text-[11px] text-[#9FB0C3]">
          <span>
            {t.repeatOffenders}:{' '}
            <strong className="font-mono text-[#E6EDF3]">{crime.repeat_offenders_count}</strong>
          </span>
          <span>
            {t.lastCrimeLabel}:{' '}
            <strong className="font-mono text-[#E6EDF3]">
              {crime.last_crime_tick !== null ? `${t.tickUnit} ${crime.last_crime_tick}` : '—'}
            </strong>
          </span>
        </div>
      </section>
    </div>
  );
}
