import type {Locale, StableProtowordEntry} from './types';

export interface FormattedProtoword {
  key: string;
  tokenLabel: string;
  contextKey: string;
  contextLabel: string;
  adopters: number | null;
  stabilizedTick: number | null;
  extinct: boolean;
}

export function safeFixed(val: unknown, digits = 1, fallback = '0'): string {
  if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
  return val.toFixed(digits);
}

export function safeNumber(val: unknown, fallback = 0): number {
  return typeof val === 'number' && Number.isFinite(val) ? val : fallback;
}

export function safeDisplayText(val: unknown, fallback = '—'): string {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') return val.length > 0 ? val : fallback;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  try {
    return JSON.stringify(val);
  } catch {
    return fallback;
  }
}

export function formatCoords(x: unknown, y: unknown): string {
  const nx = typeof x === 'number' && Number.isFinite(x) ? Math.round(x) : 0;
  const ny = typeof y === 'number' && Number.isFinite(y) ? Math.round(y) : 0;
  return `(${nx}, ${ny})`;
}

export function formatTimestampUtc(iso: unknown, locale: Locale = 'en'): string {
  if (typeof iso !== 'string' || !iso.trim()) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return d.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'UTC',
    }) + ' UTC';
  } catch {
    return d.toISOString();
  }
}

export function formatProtoword(
  key: string,
  entry: StableProtowordEntry | string | number | Record<string, unknown> | null | undefined,
  contextsDict: Record<string, string> = {},
): FormattedProtoword {
  if (typeof entry === 'string') {
    const isTokKey = key.startsWith('tok_');
    const tok = isTokKey ? `T-${key.slice(4)}` : entry;
    const ctxKey = isTokKey ? entry : key;
    return {
      key,
      tokenLabel: tok,
      contextKey: ctxKey,
      contextLabel: contextsDict[ctxKey] ?? ctxKey,
      adopters: null,
      stabilizedTick: null,
      extinct: false,
    };
  }

  if (typeof entry === 'number') {
    const ctxKey = key;
    return {
      key,
      tokenLabel: `T-${entry}`,
      contextKey: ctxKey,
      contextLabel: contextsDict[ctxKey] ?? ctxKey,
      adopters: null,
      stabilizedTick: null,
      extinct: false,
    };
  }

  if (entry && typeof entry === 'object') {
    const obj = entry as Record<string, unknown>;
    const rawTok = obj.token;
    const tokLabel =
      typeof rawTok === 'number'
        ? `T-${rawTok}`
        : typeof rawTok === 'string' && rawTok.trim()
          ? rawTok.startsWith('T')
            ? rawTok
            : `T-${rawTok}`
          : key.startsWith('tok_')
            ? `T-${key.slice(4)}`
            : key;

    const rawCtx = typeof obj.context === 'string' && obj.context.trim() ? obj.context : key;
    const rawTick = obj.first_stabilized_tick;
    const rawAdopters = obj.adopter_count;

    return {
      key,
      tokenLabel: tokLabel,
      contextKey: rawCtx,
      contextLabel: contextsDict[rawCtx] ?? rawCtx,
      adopters: typeof rawAdopters === 'number' && Number.isFinite(rawAdopters) ? rawAdopters : null,
      stabilizedTick: typeof rawTick === 'number' && Number.isFinite(rawTick) ? rawTick : null,
      extinct: Boolean(obj.extinct),
    };
  }

  return {
    key,
    tokenLabel: key,
    contextKey: key,
    contextLabel: contextsDict[key] ?? key,
    adopters: null,
    stabilizedTick: null,
    extinct: false,
  };
}
