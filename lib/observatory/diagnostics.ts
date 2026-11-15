'use client';

import type {ObservatorySnapshot} from './types';

export interface DiagnosticEntry {
  id: string;
  timestamp: string;
  source: string;
  message: string;
  stack?: string;
  detail?: string;
}

interface DiagnosticsStore {
  entries: DiagnosticEntry[];
  listeners: Set<() => void>;
}

const MAX_ENTRIES = 60;

declare global {
  interface Window {
    __OBS_DIAGNOSTICS__?: DiagnosticEntry[];
    __OBS_DIAG_STORE__?: DiagnosticsStore;
  }
}

function getStore(): DiagnosticsStore {
  if (typeof window === 'undefined') {
    return {entries: [], listeners: new Set()};
  }
  if (!window.__OBS_DIAG_STORE__) {
    const seeded = Array.isArray(window.__OBS_DIAGNOSTICS__)
      ? window.__OBS_DIAGNOSTICS__.slice(-MAX_ENTRIES)
      : [];
    window.__OBS_DIAG_STORE__ = {
      entries: seeded,
      listeners: new Set(),
    };
  }
  return window.__OBS_DIAG_STORE__;
}

export function notifyDiagnosticsListeners(): void {
  const store = getStore();
  for (const fn of store.listeners) {
    try {
      fn();
    } catch {
      // ignore subscriber failure
    }
  }
}

export function subscribeDiagnostics(listener: () => void): () => void {
  const store = getStore();
  store.listeners.add(listener);
  return () => {
    store.listeners.delete(listener);
  };
}

export function reportClientError(
  source: string,
  error: unknown,
  detail?: string,
): void {
  const message =
    error instanceof Error
      ? error.message || error.name
      : typeof error === 'string'
        ? error
        : 'Unexpected client error';
  const stack =
    error instanceof Error && typeof error.stack === 'string'
      ? error.stack.slice(0, 1500)
      : undefined;

  const entry: DiagnosticEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    source,
    message,
    stack,
    detail,
  };

  if (typeof window !== 'undefined') {
    const store = getStore();
    store.entries = [...store.entries.slice(-(MAX_ENTRIES - 1)), entry];
    window.__OBS_DIAGNOSTICS__ = store.entries;
    notifyDiagnosticsListeners();
  }
}

export function getDiagnosticEntries(): DiagnosticEntry[] {
  if (typeof window === 'undefined') return [];
  const store = getStore();
  // Merge any late arrivals written directly to window.__OBS_DIAGNOSTICS__
  if (Array.isArray(window.__OBS_DIAGNOSTICS__) && window.__OBS_DIAGNOSTICS__.length > store.entries.length) {
    const knownIds = new Set(store.entries.map((e) => e.id));
    for (const raw of window.__OBS_DIAGNOSTICS__) {
      if (raw && !knownIds.has(raw.id)) {
        store.entries.push(raw);
      }
    }
    store.entries = store.entries.slice(-MAX_ENTRIES);
  }
  return [...store.entries];
}

export function clearDiagnostics(): void {
  if (typeof window === 'undefined') return;
  const store = getStore();
  store.entries = [];
  window.__OBS_DIAGNOSTICS__ = [];
  notifyDiagnosticsListeners();
}

export function safeFixed(val: unknown, digits = 1, fallback = '0'): string {
  if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
  return val.toFixed(digits);
}

export function safeFormatDate(iso: unknown): string {
  if (typeof iso !== 'string' || !iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return d.toLocaleString();
  } catch {
    return d.toISOString();
  }
}

export function buildDiagnosticReport(
  snapshot: ObservatorySnapshot | null,
  webglStatus: {mode: 'webgl' | 'fallback_2d'; reason: string | null; softwareGl: boolean},
): Record<string, unknown> {
  return {
    generated_at_utc: new Date().toISOString(),
    location_pathname: typeof window !== 'undefined' ? window.location.pathname : '',
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    renderer: webglStatus,
    snapshot_summary: snapshot
      ? {
          export_schema_version: snapshot.export_schema_version,
          world_id: snapshot.world_id,
          timeline_id: snapshot.timeline_id,
          timeline_kind: snapshot.timeline_kind,
          tick: snapshot.clock.tick,
          sim_date: snapshot.clock.sim_date,
          living_count: snapshot.demographics.living_count,
          deceased_count: snapshot.demographics.deceased_count,
          recovery_cycle_count: snapshot.recovery_state?.recovery_cycle_count ?? 0,
          current_cycle_number: snapshot.recovery_state?.current_cycle_number ?? 1,
        }
      : null,
    client_errors: getDiagnosticEntries(),
  };
}
