'use client';

import React from 'react';
import {
  Activity,
  Compass,
  Crosshair,
  Eye,
  EyeOff,
  History,
  Landmark,
  User,
  Users,
} from 'lucide-react';
import type {Translations} from '@/lib/observatory/i18n';
import type {ActiveDrawer} from '@/lib/observatory/types';

interface BottomDockProps {
  t: Translations;
  hasSnapshot: boolean;
  activeDrawer: ActiveDrawer;
  zenMode: boolean;
  hasSelectedAgent: boolean;
  followAgent: boolean;
  isFpv: boolean;
  onSelectDrawer: (drawer: ActiveDrawer) => void;
  onToggleZen: () => void;
  onResetCamera: () => void;
  onToggleFollow: () => void;
}

export default function BottomDock({
  t,
  hasSnapshot,
  activeDrawer,
  zenMode,
  hasSelectedAgent,
  followAgent,
  isFpv,
  onSelectDrawer,
  onToggleZen,
  onResetCamera,
  onToggleFollow,
}: BottomDockProps) {
  if (zenMode) {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-3 z-20 flex justify-center px-3">
        <button
          type="button"
          onClick={onToggleZen}
          className="pointer-events-auto flex items-center gap-1.5 rounded border border-white/15 bg-[#121821]/90 px-3 py-1.5 text-xs font-medium text-[#E6EDF3] shadow-lg transition hover:border-[#D99B26]/60"
        >
          <Eye className="h-3.5 w-3.5 text-[#D99B26]" />
          <span>{t.zenExit}</span>
        </button>
      </div>
    );
  }

  const tabs: Array<{id: Exclude<ActiveDrawer, null>; label: string; icon: React.ReactNode}> = [
    {id: 'inspector', label: t.tabInspector, icon: <User className="h-3.5 w-3.5" />},
    {id: 'population', label: t.tabPopulation, icon: <Users className="h-3.5 w-3.5" />},
    {id: 'civilization', label: t.tabCivilization, icon: <Landmark className="h-3.5 w-3.5" />},
    {id: 'history', label: t.tabHistory, icon: <History className="h-3.5 w-3.5" />},
    {id: 'telemetry', label: t.tabTelemetry, icon: <Activity className="h-3.5 w-3.5" />},
  ];

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-20 flex justify-center px-2">
      <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-1 rounded-md border border-white/15 bg-[#121821]/95 p-1.5 shadow-2xl">
        {hasSnapshot &&
          tabs.map((tab) => {
            const active = activeDrawer === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectDrawer(active ? null : tab.id)}
                className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition ${
                  active
                    ? 'bg-[#D99B26] text-[#0B0F14]'
                    : 'text-[#9FB0C3] hover:bg-white/5 hover:text-[#E6EDF3]'
                }`}
              >
                {tab.icon}
                <span className="whitespace-nowrap">{tab.label}</span>
              </button>
            );
          })}

        {hasSnapshot && <div className="mx-0.5 hidden h-5 w-px bg-white/10 sm:block" />}

        {hasSnapshot && !isFpv && (
          <button
            type="button"
            onClick={onResetCamera}
            title={t.resetCamera}
            className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs text-[#9FB0C3] transition hover:bg-white/5 hover:text-[#E6EDF3]"
          >
            <Compass className="h-3.5 w-3.5" />
            <span className="hidden md:inline">{t.resetCamera}</span>
          </button>
        )}

        {hasSnapshot && hasSelectedAgent && !isFpv && (
          <button
            type="button"
            onClick={onToggleFollow}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs transition ${
              followAgent
                ? 'bg-[#3B82A6]/25 text-[#57b8d8] border border-[#3B82A6]/50'
                : 'text-[#9FB0C3] hover:bg-white/5 hover:text-[#E6EDF3]'
            }`}
          >
            <Crosshair className="h-3.5 w-3.5" />
            <span className="hidden md:inline">
              {followAgent ? t.followingAgent : t.followAgent}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={onToggleZen}
          title={t.zenEnter}
          className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-[#9FB0C3] transition hover:bg-white/5 hover:text-[#E6EDF3]"
        >
          <EyeOff className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">{t.zenEnter}</span>
        </button>
      </div>
    </div>
  );
}
