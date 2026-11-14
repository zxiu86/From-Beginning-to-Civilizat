'use client';

import React, {useState} from 'react';
import {
  Baby,
  Compass,
  Eye,
  HeartPulse,
  MessageSquare,
  Navigation,
  Search,
  Skull,
  Users,
} from 'lucide-react';
import type {Translations} from '@/lib/observatory/i18n';
import type {AnyAgentRecord, LivingAgentFull} from '@/lib/observatory/types';

interface AgentInspectorProps {
  t: Translations;
  agent: AnyAgentRecord | null;
  agentLookup: Map<number, AnyAgentRecord>;
  onSelectAgent: (agentId: number) => void;
  onFlyToAgent: (agentId: number) => void;
  onEnterFpv: (agentId: number) => void;
}

function MeterBar({label, value, dangerWhenHigh = false}: {label: string; value: number; dangerWhenHigh?: boolean}) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  const isBad = dangerWhenHigh ? value > 0.72 : value < 0.35;
  const isWarn = dangerWhenHigh ? value > 0.48 : value < 0.62;
  const barColor = isBad ? 'bg-red-500' : isWarn ? 'bg-[#D99B26]' : 'bg-emerald-500';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px]">
        <span className="text-[#9FB0C3]">{label}</span>
        <span className="font-mono tabular-nums text-[#E6EDF3]">{pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded bg-[#18212C]">
        <div className={`h-full ${barColor}`} style={{width: `${pct}%`}} />
      </div>
    </div>
  );
}

export default function AgentInspector({
  t,
  agent,
  agentLookup,
  onSelectAgent,
  onFlyToAgent,
  onEnterFpv,
}: AgentInspectorProps) {
  const [searchId, setSearchId] = useState('');
  const [notFound, setNotFound] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const id = Number(searchId.trim());
    if (!Number.isFinite(id) || !agentLookup.has(id)) {
      setNotFound(true);
      return;
    }
    setNotFound(false);
    onSelectAgent(id);
    onFlyToAgent(id);
  };

  const livingAgent: LivingAgentFull | null = agent && agent.is_alive ? agent : null;

  return (
    <div className="space-y-4 text-xs text-[#E6EDF3]">
      {/* Search by ID */}
      <form onSubmit={handleSearch} className="flex gap-1.5">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-2.5 start-2.5 h-3.5 w-3.5 text-[#9FB0C3]" />
          <input
            type="number"
            value={searchId}
            onChange={(e) => {
              setSearchId(e.target.value);
              setNotFound(false);
            }}
            placeholder={t.searchAgentPlaceholder}
            className="w-full rounded border border-white/10 bg-[#18212C] py-1.5 pe-2 ps-8 text-xs text-[#E6EDF3] placeholder:text-[#9FB0C3]/60 focus:border-[#D99B26] focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="rounded border border-white/10 bg-[#18212C] px-3 py-1.5 font-medium text-[#E6EDF3] transition hover:border-[#D99B26]/60"
        >
          {t.searchButton}
        </button>
      </form>
      {notFound && <div className="text-[11px] text-red-400">{t.agentNotFound}</div>}

      {!agent ? (
        <div className="rounded border border-white/10 bg-[#18212C] p-4 text-center text-[#9FB0C3]">
          {t.selectAgentPrompt}
        </div>
      ) : (
        <>
          {/* Header Card */}
          <div className="rounded border border-white/10 bg-[#18212C] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-bold text-[#F2BE49]">
                  #{agent.agent_id}
                </span>
                <span className="rounded border border-white/10 bg-[#121821] px-1.5 py-0.5 text-[11px]">
                  {agent.sex === 'F' ? t.sexF : t.sexM}
                </span>
                <span className="rounded border border-white/10 bg-[#121821] px-1.5 py-0.5 text-[11px]">
                  {t.lifeStages[agent.life_stage] ?? agent.life_stage}
                </span>
              </div>
              <span
                className={`flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium ${
                  agent.is_alive
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : 'bg-red-500/15 text-red-300'
                }`}
              >
                {agent.is_alive ? (
                  <HeartPulse className="h-3 w-3" />
                ) : (
                  <Skull className="h-3 w-3" />
                )}
                {agent.is_alive ? t.statusAlive : t.statusDeceased}
              </span>
            </div>

            <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-[11px] tabular-nums text-[#9FB0C3]">
              <div>
                {agent.age_years.toFixed(1)} {t.ageYears}
              </div>
              <div>
                {t.genShort} {agent.generation}
              </div>
              <div>
                ({Math.round(agent.x)}, {Math.round(agent.y)})
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onFlyToAgent(agent.agent_id)}
                className="flex items-center gap-1.5 rounded border border-white/15 bg-[#121821] px-2.5 py-1.5 text-[11px] font-medium text-[#E6EDF3] transition hover:border-[#D99B26]/60"
              >
                <Compass className="h-3.5 w-3.5 text-[#D99B26]" />
                <span>{t.followAgent}</span>
              </button>

              {livingAgent && (
                <button
                  type="button"
                  onClick={() => onEnterFpv(livingAgent.agent_id)}
                  className="flex items-center gap-1.5 rounded border border-[#3B82A6]/60 bg-[#3B82A6]/20 px-2.5 py-1.5 text-[11px] font-semibold text-[#57b8d8] transition hover:bg-[#3B82A6]/30"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>{t.enterFpv}</span>
                </button>
              )}
            </div>
          </div>

          {/* Vitals OR Death Record */}
          {livingAgent ? (
            <div className="space-y-2.5 rounded border border-white/10 bg-[#18212C] p-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-[#E6EDF3]">{t.vitalsSection}</h3>
                {livingAgent.is_pregnant && (
                  <span className="flex items-center gap-1 text-[11px] text-[#F2BE49]">
                    <Baby className="h-3.5 w-3.5" />
                    {t.pregnant}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                <MeterBar label={t.health} value={livingAgent.health} />
                <MeterBar label={t.energy} value={livingAgent.energy} />
                <MeterBar label={t.hunger} value={livingAgent.hunger} dangerWhenHigh />
                <MeterBar label={t.thirst} value={livingAgent.thirst} dangerWhenHigh />
                <MeterBar label={t.injury} value={livingAgent.injury} dangerWhenHigh />
                <MeterBar label={t.disease} value={livingAgent.disease_load} dangerWhenHigh />
              </div>

              <div className="grid grid-cols-2 gap-2 border-t border-white/5 pt-2 text-[11px]">
                <div>
                  <div className="text-[#9FB0C3]">{t.currentAction}</div>
                  <div className="font-medium text-[#E6EDF3]">
                    {t.actions[livingAgent.last_action] ?? livingAgent.last_action}
                  </div>
                </div>
                <div>
                  <div className="text-[#9FB0C3]">{t.lastSignal}</div>
                  <div className="font-mono text-[#57b8d8]">
                    {livingAgent.last_emitted_token !== null
                      ? `T-${livingAgent.last_emitted_token}`
                      : '—'}
                  </div>
                </div>
              </div>
            </div>
          ) : !agent.is_alive ? (
            <div className="space-y-1 rounded border border-red-500/30 bg-red-500/10 p-3 text-[11px]">
              <div>
                <span className="text-[#9FB0C3]">{t.causeOfDeath}: </span>
                <span className="font-semibold text-red-300">
                  {agent.cause_of_death ? t.causes[agent.cause_of_death] ?? agent.cause_of_death : '—'}
                </span>
              </div>
              <div className="font-mono tabular-nums text-[#9FB0C3]">
                {t.deathTick}: {agent.death_tick ?? '—'}
              </div>
            </div>
          ) : null}

          {/* Family Links */}
          <div className="space-y-2 rounded border border-white/10 bg-[#18212C] p-3">
            <h3 className="flex items-center gap-1.5 font-semibold">
              <Users className="h-3.5 w-3.5 text-[#D99B26]" />
              <span>{t.familySection}</span>
            </h3>

            <div>
              <div className="mb-1 text-[11px] text-[#9FB0C3]">{t.parentsLabel}</div>
              {agent.parent_a_id === null && agent.parent_b_id === null ? (
                <div className="text-[11px] text-[#9FB0C3]/80">{t.noParentsFounders}</div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {[agent.parent_a_id, agent.parent_b_id]
                    .filter((pid): pid is number => pid !== null)
                    .map((pid, idx) => {
                      const rel = agentLookup.get(pid);
                      return (
                        <button
                          key={`parent-${pid}-${idx}`}
                          type="button"
                          onClick={() => onSelectAgent(pid)}
                          className="rounded border border-white/10 bg-[#121821] px-2 py-1 font-mono text-[11px] hover:border-[#D99B26]/60"
                        >
                          #{pid} {rel ? (rel.is_alive ? '●' : '†') : ''}
                        </button>
                      );
                    })}
                </div>
              )}
            </div>

            <div>
              <div className="mb-1 text-[11px] text-[#9FB0C3]">
                {t.childrenLabel} ({agent.children_ids.length})
              </div>
              {agent.children_ids.length === 0 ? (
                <div className="text-[11px] text-[#9FB0C3]/80">{t.noChildrenYet}</div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {agent.children_ids.map((cid, idx) => {
                    const rel = agentLookup.get(cid);
                    return (
                      <button
                        key={`child-${cid}-${idx}`}
                        type="button"
                        onClick={() => onSelectAgent(cid)}
                        className="rounded border border-white/10 bg-[#121821] px-2 py-1 font-mono text-[11px] hover:border-[#D99B26]/60"
                      >
                        #{cid} {rel ? (rel.is_alive ? '●' : '†') : ''}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Traits & Skills */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 rounded border border-white/10 bg-[#18212C] p-3">
              <h3 className="font-semibold">{t.traitsSection}</h3>
              {Object.entries(agent.traits).map(([k, v]) => (
                <div key={k} className="flex justify-between text-[11px]">
                  <span className="text-[#9FB0C3]">{t.traits[k] ?? k}</span>
                  <span className="font-mono tabular-nums">{v.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-1.5 rounded border border-white/10 bg-[#18212C] p-3">
              <h3 className="font-semibold">{t.skillsSection}</h3>
              {Object.entries(agent.skills).map(([k, v]) => (
                <div key={k} className="flex justify-between text-[11px]">
                  <span className="text-[#9FB0C3]">{t.skills[k] ?? k}</span>
                  <span className="font-mono tabular-nums text-[#F2BE49]">{v.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Inventory */}
          {livingAgent && (
            <div className="rounded border border-white/10 bg-[#18212C] p-3">
              <h3 className="mb-1.5 font-semibold">{t.inventorySection}</h3>
              {Object.values(livingAgent.inventory).every((v) => v <= 0) ? (
                <div className="text-[11px] text-[#9FB0C3]">{t.emptyInventory}</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(livingAgent.inventory)
                    .filter(([, val]) => val > 0)
                    .map(([k, val]) => (
                      <div
                        key={k}
                        className="rounded border border-white/10 bg-[#121821] px-2 py-1 font-mono text-[11px] tabular-nums"
                      >
                        {k}: {val.toFixed(1)}
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Personal Lexicon */}
          {livingAgent && (
            <div className="rounded border border-white/10 bg-[#18212C] p-3">
              <h3 className="mb-1.5 flex items-center gap-1.5 font-semibold">
                <MessageSquare className="h-3.5 w-3.5 text-[#57b8d8]" />
                <span>
                  {t.lexiconSection} ({livingAgent.lexicon_size})
                </span>
              </h3>
              {Object.keys(livingAgent.lexicon).length === 0 ? (
                <div className="text-[11px] text-[#9FB0C3]">{t.noLexiconYet}</div>
              ) : (
                <div className="max-h-36 space-y-1 overflow-y-auto">
                  {Object.entries(livingAgent.lexicon)
                    .slice(0, 18)
                    .map(([tok, ctxMap]) => {
                      const topCtx = Object.entries(ctxMap).sort((a, b) => b[1] - a[1])[0];
                      return (
                        <div
                          key={tok}
                          className="flex items-center justify-between rounded bg-[#121821] px-2 py-1 text-[11px]"
                        >
                          <span className="font-mono text-[#57b8d8]">T-{tok}</span>
                          {topCtx && (
                            <span className="text-[#9FB0C3]">
                              {t.contexts[topCtx[0]] ?? topCtx[0]} ({topCtx[1].toFixed(2)})
                            </span>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {/* Social Ties */}
          <div className="rounded border border-white/10 bg-[#18212C] p-3">
            <h3 className="mb-1.5 font-semibold">{t.socialTiesSection}</h3>
            {agent.social_ties.length === 0 ? (
              <div className="text-[11px] text-[#9FB0C3]">{t.noTiesYet}</div>
            ) : (
              <div className="max-h-32 space-y-1 overflow-y-auto">
                {agent.social_ties.slice(0, 12).map((tie) => (
                  <button
                    key={tie.agent_id}
                    type="button"
                    onClick={() => onSelectAgent(tie.agent_id)}
                    className="flex w-full items-center justify-between rounded bg-[#121821] px-2 py-1 text-[11px] hover:border hover:border-[#D99B26]/50"
                  >
                    <span className="font-mono text-[#F2BE49]">#{tie.agent_id}</span>
                    <span className="font-mono tabular-nums text-[#9FB0C3]">
                      F:{tie.familiarity.toFixed(2)} · T:{tie.trust.toFixed(2)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Episodic & Spatial Memories */}
          <div className="rounded border border-white/10 bg-[#18212C] p-3">
            <h3 className="mb-1.5 font-semibold">{t.episodicMemorySection}</h3>
            {agent.episodic_memories.length === 0 ? (
              <div className="text-[11px] text-[#9FB0C3]">{t.noMemoriesYet}</div>
            ) : (
              <div className="max-h-40 space-y-1.5 overflow-y-auto">
                {[...agent.episodic_memories].reverse().slice(0, 12).map((mem, idx) => (
                  <div key={`${mem.tick}-${idx}`} className="rounded bg-[#121821] p-2 text-[11px]">
                    <div className="flex justify-between font-mono text-[10px] text-[#9FB0C3]">
                      <span>
                        {t.tickUnit} {mem.tick}
                      </span>
                      <span className={mem.valence >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {mem.valence >= 0 ? '+' : ''}
                        {mem.valence.toFixed(2)}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[#E6EDF3]">{mem.note || mem.event_type}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {livingAgent && livingAgent.spatial_memories.length > 0 && (
            <div className="rounded border border-white/10 bg-[#18212C] p-3">
              <h3 className="mb-1.5 flex items-center gap-1.5 font-semibold">
                <Navigation className="h-3.5 w-3.5 text-[#D99B26]" />
                <span>{t.spatialMemorySection}</span>
              </h3>
              <div className="max-h-32 space-y-1 overflow-y-auto">
                {livingAgent.spatial_memories.slice(0, 10).map((sm, idx) => (
                  <div
                    key={`${sm.resource_kind}-${idx}`}
                    className="flex justify-between rounded bg-[#121821] px-2 py-1 font-mono text-[11px] tabular-nums"
                  >
                    <span className="text-[#E6EDF3]">{sm.resource_kind}</span>
                    <span className="text-[#9FB0C3]">
                      ({Math.round(sm.x)}, {Math.round(sm.y)}) · {sm.estimated_amount.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
