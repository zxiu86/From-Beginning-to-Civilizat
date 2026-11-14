'use client';

import React, {useMemo, useState} from 'react';
import {AlertCircle, Layers, MapPin, Milestone, Play, X} from 'lucide-react';
import type {Translations} from '@/lib/observatory/i18n';
import type {
  ObservatorySnapshot,
  ReplayEventTarget,
} from '@/lib/observatory/types';

interface HistoryDrawerProps {
  t: Translations;
  snapshot: ObservatorySnapshot;
  replayTarget: ReplayEventTarget | null;
  onReplayEvent: (ev: ReplayEventTarget) => void;
  onClearReplay: () => void;
  onSelectAgent: (agentId: number) => void;
}

export default function HistoryDrawer({
  t,
  snapshot,
  replayTarget,
  onReplayEvent,
  onClearReplay,
  onSelectAgent,
}: HistoryDrawerProps) {
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('');
  const [agentFilter, setAgentFilter] = useState<string>('');
  const [activeLayerView, setActiveLayerView] = useState<'compare' | 'l1' | 'l2' | 'l3'>('compare');

  const truthEvents = useMemo(
    () => [...snapshot.history_layers.layer_1_ground_truth_tail].reverse(),
    [snapshot.history_layers.layer_1_ground_truth_tail],
  );

  const eventTypes = useMemo(() => {
    const s = new Set<string>();
    for (const ev of truthEvents) s.add(ev.event_type);
    return Array.from(s).sort();
  }, [truthEvents]);

  const filteredTruth = useMemo(() => {
    const yStr = yearFilter.trim();
    const aNum = agentFilter.trim() ? Number(agentFilter.trim()) : null;
    return truthEvents
      .filter((ev) => {
        if (typeFilter !== 'all' && ev.event_type !== typeFilter) return false;
        if (yStr) {
          const yearMatch = ev.sim_date.match(/Y0*(\d+)/);
          const evYear = yearMatch ? yearMatch[1] : '';
          if (!evYear.includes(yStr) && !ev.sim_date.includes(yStr)) return false;
        }
        if (aNum !== null && Number.isFinite(aNum) && !ev.agent_ids.includes(aNum)) return false;
        return true;
      })
      .slice(0, 80);
  }, [truthEvents, typeFilter, yearFilter, agentFilter]);

  const witnesses = useMemo(
    () => [...snapshot.history_layers.layer_2_witness_accounts_tail].reverse().slice(0, 60),
    [snapshot.history_layers.layer_2_witness_accounts_tail],
  );

  const interpretations = useMemo(
    () => [...snapshot.history_layers.layer_3_interpretations_tail].reverse().slice(0, 60),
    [snapshot.history_layers.layer_3_interpretations_tail],
  );

  const achievedMilestones = Object.entries(snapshot.history_layers.milestones).filter(
    ([, val]) => val !== null,
  );

  return (
    <div className="space-y-4 text-xs text-[#E6EDF3]">
      {/* Active Replay Banner */}
      {replayTarget && (
        <div className="rounded border border-red-400/50 bg-red-500/15 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-red-200">
              {t.replayingBanner}: {replayTarget.sim_date}
            </span>
            <button
              type="button"
              onClick={onClearReplay}
              className="flex items-center gap-1 rounded border border-white/15 bg-[#121821] px-2 py-1 text-[11px] text-[#E6EDF3]"
            >
              <X className="h-3 w-3" />
              {t.clearReplayBtn}
            </button>
          </div>
          <p className="mt-1 text-[11px] text-red-100/80">{replayTarget.description}</p>
          <p className="mt-1 text-[10px] text-[#9FB0C3]">{t.replayFrameHonesty}</p>
        </div>
      )}

      {/* Milestones */}
      <div className="rounded border border-white/10 bg-[#18212C] p-3">
        <h3 className="mb-2 flex items-center gap-1.5 font-semibold text-[#F2BE49]">
          <Milestone className="h-3.5 w-3.5" />
          <span>
            {t.milestonesTitle} ({achievedMilestones.length})
          </span>
        </h3>
        {achievedMilestones.length === 0 ? (
          <div className="text-[11px] text-[#9FB0C3]">{t.notYetInvented}</div>
        ) : (
          <div className="grid max-h-36 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
            {achievedMilestones.map(([k, tick]) => (
              <div
                key={k}
                className="flex items-center justify-between rounded bg-[#121821] px-2 py-1 text-[11px]"
              >
                <span className="truncate text-[#9FB0C3]">{t.milestones[k] ?? k}</span>
                <span className="font-mono font-semibold tabular-nums text-[#F2BE49]">
                  {t.tickUnit} {tick}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded border border-white/10 bg-[#18212C] px-2 py-1.5 text-xs text-[#E6EDF3] focus:border-[#D99B26] focus:outline-none"
        >
          <option value="all">{t.historyFilterAll}</option>
          {eventTypes.map((et) => (
            <option key={et} value={et}>
              {et}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          placeholder={t.historyFilterYearPlaceholder}
          className="rounded border border-white/10 bg-[#18212C] px-2 py-1.5 text-xs text-[#E6EDF3] placeholder:text-[#9FB0C3]/60 focus:border-[#D99B26] focus:outline-none"
        />
        <input
          type="number"
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          placeholder={t.historyFilterAgentPlaceholder}
          className="rounded border border-white/10 bg-[#18212C] px-2 py-1.5 text-xs text-[#E6EDF3] placeholder:text-[#9FB0C3]/60 focus:border-[#D99B26] focus:outline-none"
        />
      </div>

      {/* Layer Switcher */}
      <div className="flex gap-1">
        {(
          [
            {id: 'compare', label: 'L1 / L2 / L3'},
            {id: 'l1', label: 'L1 Truth'},
            {id: 'l2', label: 'L2 Witness'},
            {id: 'l3', label: 'L3 Myth'},
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveLayerView(tab.id)}
            className={`flex-1 rounded border py-1 text-[11px] font-medium ${
              activeLayerView === tab.id
                ? 'border-[#D99B26] bg-[#D99B26]/15 text-[#F2BE49]'
                : 'border-white/10 bg-[#18212C] text-[#9FB0C3]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Layer 1: Ground Truth */}
      {(activeLayerView === 'compare' || activeLayerView === 'l1') && (
        <section className="space-y-2 rounded border border-white/10 bg-[#18212C] p-3">
          <div>
            <h3 className="flex items-center gap-1.5 font-semibold text-emerald-300">
              <Layers className="h-3.5 w-3.5" />
              <span>{t.layer1Title}</span>
            </h3>
            <p className="text-[10px] text-[#9FB0C3]">{t.layer1Subtitle}</p>
          </div>
          {filteredTruth.length === 0 ? (
            <div className="text-[11px] text-[#9FB0C3]">{t.noEventsMatched}</div>
          ) : (
            <div className="max-h-56 space-y-1.5 overflow-y-auto">
              {filteredTruth.map((ev, evIdx) => (
                <div
                  key={`${ev.event_id}-${evIdx}`}
                  className="rounded border border-white/5 bg-[#121821] p-2 text-[11px]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] text-[#F2BE49]">
                      {ev.sim_date} · {t.tickUnit} {ev.tick} · {ev.event_type}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onReplayEvent({
                          event_id: ev.event_id,
                          tick: ev.tick,
                          sim_date: ev.sim_date,
                          event_type: ev.event_type,
                          x: ev.x,
                          y: ev.y,
                          agent_ids: ev.agent_ids,
                          description: ev.description,
                        })
                      }
                      className="flex items-center gap-1 rounded border border-[#D99B26]/40 bg-[#D99B26]/15 px-1.5 py-0.5 text-[10px] text-[#F2BE49] hover:bg-[#D99B26]/25"
                    >
                      <Play className="h-2.5 w-2.5" />
                      <span>{t.replayEventBtn}</span>
                    </button>
                  </div>
                  <p className="mt-1 text-[#E6EDF3]">{ev.description}</p>
                  {ev.agent_ids.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {ev.agent_ids.slice(0, 8).map((aid, aidIdx) => (
                        <button
                          key={`${ev.event_id}-${aid}-${aidIdx}`}
                          type="button"
                          onClick={() => onSelectAgent(aid)}
                          className="rounded bg-[#18212C] px-1.5 py-0.5 font-mono text-[10px] text-[#57b8d8] hover:underline"
                        >
                          #{aid}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Layer 2: Witnesses & Surface Artifacts */}
      {(activeLayerView === 'compare' || activeLayerView === 'l2') && (
        <section className="space-y-2 rounded border border-white/10 bg-[#18212C] p-3">
          <div>
            <h3 className="flex items-center gap-1.5 font-semibold text-[#57b8d8]">
              <MapPin className="h-3.5 w-3.5" />
              <span>{t.layer2Title}</span>
            </h3>
            <p className="text-[10px] text-[#9FB0C3]">{t.layer2Subtitle}</p>
          </div>
          {witnesses.length === 0 ? (
            <div className="text-[11px] text-[#9FB0C3]">{t.notYetInvented}</div>
          ) : (
            <div className="max-h-48 space-y-1.5 overflow-y-auto">
              {witnesses.map((w, idx) => (
                <div key={`${w.account_id}-${idx}`} className="rounded bg-[#121821] p-2 text-[11px]">
                  <div className="flex justify-between font-mono text-[10px] text-[#9FB0C3]">
                    <span>
                      Witness #{w.witness_agent_id} · {t.tickUnit} {w.tick}
                    </span>
                    <span className={w.distorted ? 'text-[#D99B26]' : 'text-emerald-400'}>
                      conf {(w.confidence * 100).toFixed(0)}% {w.distorted ? '(distorted)' : ''}
                    </span>
                  </div>
                  <p className="mt-1 text-[#E6EDF3]">{w.summary}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Layer 3: Generational Interpretations */}
      {(activeLayerView === 'compare' || activeLayerView === 'l3') && (
        <section className="space-y-2 rounded border border-white/10 bg-[#18212C] p-3">
          <div>
            <h3 className="flex items-center gap-1.5 font-semibold text-[#D99B26]">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>{t.layer3Title}</span>
            </h3>
            <p className="text-[10px] text-[#9FB0C3]">{t.layer3Subtitle}</p>
          </div>
          {interpretations.length === 0 ? (
            <div className="text-[11px] text-[#9FB0C3]">{t.notYetInvented}</div>
          ) : (
            <div className="max-h-48 space-y-1.5 overflow-y-auto">
              {interpretations.map((it, idx) => (
                <div key={`${it.interpretation_id}-${idx}`} className="rounded bg-[#121821] p-2 text-[11px]">
                  <div className="flex justify-between font-mono text-[10px] text-[#9FB0C3]">
                    <span>
                      {t.genShort} {it.generation} · #{it.interpreter_agent_id}
                    </span>
                    <span>accuracy {(it.accuracy_estimate * 100).toFixed(0)}%</span>
                  </div>
                  <p className="mt-1 text-[#E6EDF3]">{it.belief_narrative}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
