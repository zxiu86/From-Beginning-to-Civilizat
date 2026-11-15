import {validateAndNormalizeSnapshot} from './adapter';
import type {
  ObservatorySnapshot,
  SurfaceArtifactItem,
  TimelinePoint,
  TruthEventItem,
} from './types';

export interface ImportFileLike {
  name: string;
  webkitRelativePath?: string;
  size?: number;
  text: () => Promise<string>;
}

export interface ImportProgress {
  stage:
    | 'scan'
    | 'parse'
    | 'inspect'
    | 'branch_isolate'
    | 'sequence'
    | 'validate_merge'
    | 'complete';
  processed: number;
  total: number;
}

export interface QuarantinedFileRecord {
  fileName: string;
  relativePath: string;
  reason: string;
}

export interface UnindexedFileRecord {
  fileName: string;
  relativePath: string;
  keys: string[];
  reason: string;
}

export interface ParsedFileEnvelope {
  index: number;
  fileName: string;
  relativePath: string;
  contentChecksum: string;
  timelineId: string;
  timelineKind: string;
  parentTimelineId: string | null;
  stepId: string | null;
  stepNumber: number | null;
  sequenceNumber: number | null;
  tick: number | null;
  timestampMs: number | null;
  parentStep: string | null;
  dependencies: string[];
  hasFullSnapshot: boolean;
  isDeltaOrEvent: boolean;
  raw: Record<string, unknown>;
  snapshot: ObservatorySnapshot | null;
  filenameNumbers: number[];
}

export interface ImportedTimelineBundle {
  timelineId: string;
  timelineKind: string;
  parentTimelineId: string | null;
  worldId: string;
  orderedFiles: string[];
  orderedTicks: number[];
  snapshot: ObservatorySnapshot;
  framesByTick: Record<number, ObservatorySnapshot>;
  duplicateResolutions: string[];
  gapWarnings: string[];
  cycleErrors: string[];
  haltedDueToCycle: boolean;
}

export interface MultiImportReport {
  totalFiles: number;
  acceptedCount: number;
  quarantinedFiles: QuarantinedFileRecord[];
  unindexedQueue: UnindexedFileRecord[];
  warnings: string[];
  cycleErrors: string[];
  timelines: ImportedTimelineBundle[];
}

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function parseFiniteInt(val: unknown): number | null {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string' && /^-?\d+(\.\d+)?$/.test(val.trim())) {
    const n = Number(val.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function extractFilenameNumbers(name: string): number[] {
  const matches = name.match(/\d+/g);
  if (!matches) return [];
  return matches.map((m) => Number.parseInt(m, 10)).filter((n) => Number.isFinite(n));
}

function computeFastHash(text: string): string {
  let h1 = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h1 ^= text.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + '_' + text.length;
}

function parseDependencies(raw: Record<string, unknown>): string[] {
  const deps: string[] = [];
  const rawDeps = raw.dependencies ?? raw.depends_on;
  if (Array.isArray(rawDeps)) {
    for (const d of rawDeps) {
      if (typeof d === 'string' && d.trim()) deps.push(d.trim());
      else if (typeof d === 'number' && Number.isFinite(d)) deps.push(String(d));
    }
  }
  if (typeof raw.parent_step === 'string' && raw.parent_step.trim()) {
    deps.push(raw.parent_step.trim());
  } else if (typeof raw.parent_step === 'number' && Number.isFinite(raw.parent_step)) {
    deps.push(String(raw.parent_step));
  }
  return Array.from(new Set(deps));
}

function inspectMetadata(
  raw: Record<string, unknown>,
  fileName: string,
  relativePath: string,
  index: number,
  checksum: string,
): {envelope: ParsedFileEnvelope | null; unindexed: UnindexedFileRecord | null; error: string | null} {
  const clockObj = isObject(raw.clock) ? raw.clock : null;
  const tick =
    parseFiniteInt(raw.tick) ??
    (clockObj ? parseFiniteInt(clockObj.tick) : null);
  const stepNumber = parseFiniteInt(raw.step_number ?? raw.stepNumber);
  const sequenceNumber = parseFiniteInt(raw.sequence_number ?? raw.sequenceNumber);
  const rawStepId = raw.step_id ?? raw.stepId ?? raw.id;
  const stepId =
    typeof rawStepId === 'string' && rawStepId.trim()
      ? rawStepId.trim()
      : typeof rawStepId === 'number' && Number.isFinite(rawStepId)
        ? String(rawStepId)
        : null;

  const tsStr =
    typeof raw.timestamp === 'string'
      ? raw.timestamp
      : typeof raw.exported_at_utc === 'string'
        ? raw.exported_at_utc
        : null;
  const parsedTs = tsStr ? Date.parse(tsStr) : Number.NaN;
  const timestampMs = Number.isFinite(parsedTs)
    ? parsedTs
    : parseFiniteInt(raw.timestamp);

  const hasSnapshotStructure =
    typeof raw.world_id === 'string' &&
    isObject(raw.clock) &&
    isObject(raw.demographics) &&
    isObject(raw.history_layers);

  const hasDeltaOrEventStructure =
    Array.isArray(raw.events) ||
    Array.isArray(raw.layer_1_ground_truth_tail) ||
    Array.isArray(raw.timeline_series) ||
    typeof raw.event_id === 'number' ||
    typeof raw.event_type === 'string';

  const hasExplicitSequence =
    tick !== null ||
    stepNumber !== null ||
    sequenceNumber !== null ||
    stepId !== null ||
    timestampMs !== null;

  if (!hasSnapshotStructure && !hasDeltaOrEventStructure && !hasExplicitSequence) {
    return {
      envelope: null,
      unindexed: {
        fileName,
        relativePath,
        keys: Object.keys(raw).slice(0, 12),
        reason: 'Missing world snapshot, event payload, and ordering metadata (tick/step_number/sequence_number/step_id).',
      },
      error: null,
    };
  }

  let normalizedSnapshot: ObservatorySnapshot | null = null;
  if (hasSnapshotStructure) {
    try {
      normalizedSnapshot = validateAndNormalizeSnapshot(raw);
    } catch (err) {
      return {
        envelope: null,
        unindexed: null,
        error: err instanceof Error ? err.message : 'Snapshot schema validation failed',
      };
    }
  } else if (!hasExplicitSequence) {
    return {
      envelope: null,
      unindexed: {
        fileName,
        relativePath,
        keys: Object.keys(raw).slice(0, 12),
        reason: 'Fragment lacks explicit tick/step_number/sequence_number/step_id for safe ordering.',
      },
      error: null,
    };
  }

  const timelineKind =
    typeof raw.timeline_kind === 'string' && raw.timeline_kind
      ? raw.timeline_kind
      : normalizedSnapshot?.timeline_kind ?? 'original';

  const timelineId =
    typeof raw.timeline_id === 'string' && raw.timeline_id
      ? raw.timeline_id
      : normalizedSnapshot?.timeline_id ??
        (typeof raw.world_id === 'string' && raw.world_id
          ? `${raw.world_id}:${timelineKind}`
          : `unassigned:${timelineKind}`);

  const parentTimelineId =
    typeof raw.parent_timeline_id === 'string'
      ? raw.parent_timeline_id
      : normalizedSnapshot?.parent_timeline_id ?? null;

  const parentStep =
    typeof raw.parent_step === 'string' && raw.parent_step.trim()
      ? raw.parent_step.trim()
      : typeof raw.parent_step === 'number' && Number.isFinite(raw.parent_step)
        ? String(raw.parent_step)
        : null;

  return {
    envelope: {
      index,
      fileName,
      relativePath,
      contentChecksum: checksum,
      timelineId,
      timelineKind,
      parentTimelineId,
      stepId,
      stepNumber,
      sequenceNumber,
      tick,
      timestampMs,
      parentStep,
      dependencies: parseDependencies(raw),
      hasFullSnapshot: normalizedSnapshot !== null,
      isDeltaOrEvent: hasDeltaOrEventStructure,
      raw,
      snapshot: normalizedSnapshot,
      filenameNumbers: extractFilenameNumbers(fileName),
    },
    unindexed: null,
    error: null,
  };
}

function compareEnvelopesNumerically(a: ParsedFileEnvelope, b: ParsedFileEnvelope): number {
  // 1. Primary internal numeric order: stepNumber -> sequenceNumber -> tick
  const primaryA = a.stepNumber ?? a.sequenceNumber ?? a.tick;
  const primaryB = b.stepNumber ?? b.sequenceNumber ?? b.tick;
  if (primaryA !== null && primaryB !== null && primaryA !== primaryB) {
    return primaryA - primaryB;
  }
  if (primaryA !== null && primaryB === null) return -1;
  if (primaryA === null && primaryB !== null) return 1;

  // 2. Secondary tick tie-breaker (e.g. same step_number or when mixed)
  if (a.tick !== null && b.tick !== null && a.tick !== b.tick) {
    return a.tick - b.tick;
  }

  // 3. Timestamp
  if (a.timestampMs !== null && b.timestampMs !== null && a.timestampMs !== b.timestampMs) {
    return a.timestampMs - b.timestampMs;
  }

  // 4. Numeric tokens embedded in filename (strict numeric comparison, NOT lexicographic)
  const len = Math.min(a.filenameNumbers.length, b.filenameNumbers.length);
  for (let i = 0; i < len; i++) {
    if (a.filenameNumbers[i] !== b.filenameNumbers[i]) {
      return a.filenameNumbers[i] - b.filenameNumbers[i];
    }
  }
  if (a.filenameNumbers.length !== b.filenameNumbers.length) {
    return a.filenameNumbers.length - b.filenameNumbers.length;
  }

  return a.fileName.localeCompare(b.fileName, undefined, {numeric: true});
}

function resolveDuplicatesAndSequence(items: ParsedFileEnvelope[]): {
  deduped: ParsedFileEnvelope[];
  duplicateResolutions: string[];
  gapWarnings: string[];
  cycleErrors: string[];
  ordered: ParsedFileEnvelope[];
  haltedDueToCycle: boolean;
} {
  const duplicateResolutions: string[] = [];
  const seenKeyMap = new Map<string, ParsedFileEnvelope>();
  const kept: ParsedFileEnvelope[] = [];

  // Sort deterministically first so duplicate winner is latest timestamp / later snapshot
  const preSorted = [...items].sort(compareEnvelopesNumerically);

  for (const item of preSorted) {
    const logicalSeq = item.stepNumber ?? item.sequenceNumber;
    const dedupeKey = item.stepId
      ? `step_id:${item.stepId}`
      : logicalSeq !== null
        ? `seq:${logicalSeq}:full=${item.hasFullSnapshot}`
        : item.tick !== null && item.hasFullSnapshot
          ? `tick:${item.tick}:full`
          : `checksum:${item.contentChecksum}`;

    const existing = seenKeyMap.get(dedupeKey);
    if (!existing) {
      seenKeyMap.set(dedupeKey, item);
      kept.push(item);
    } else if (existing.contentChecksum === item.contentChecksum) {
      duplicateResolutions.push(
        `Deduplicated identical file '${item.fileName}' matching '${existing.fileName}' (${dedupeKey}).`,
      );
    } else {
      // Keep newer timestamp or full snapshot over partial when conflicting duplicate key occurs
      const itemTs = item.timestampMs ?? 0;
      const existTs = existing.timestampMs ?? 0;
      const preferNew =
        (item.hasFullSnapshot && !existing.hasFullSnapshot) ||
        (item.hasFullSnapshot === existing.hasFullSnapshot && itemTs >= existTs);
      if (preferNew) {
        const idx = kept.indexOf(existing);
        if (idx >= 0) kept[idx] = item;
        seenKeyMap.set(dedupeKey, item);
        duplicateResolutions.push(
          `Resolved duplicate key '${dedupeKey}': retained '${item.fileName}', superseded '${existing.fileName}'.`,
        );
      } else {
        duplicateResolutions.push(
          `Resolved duplicate key '${dedupeKey}': retained '${existing.fileName}', skipped older '${item.fileName}'.`,
        );
      }
    }
  }

  // Build Kahn topological graph when stepId / dependencies / parentStep exist
  const idToNodeIdx = new Map<string, number>();
  for (let i = 0; i < kept.length; i++) {
    const env = kept[i];
    if (env.stepId) idToNodeIdx.set(env.stepId, i);
    if (env.stepNumber !== null && !idToNodeIdx.has(String(env.stepNumber))) {
      idToNodeIdx.set(String(env.stepNumber), i);
    }
  }

  const adj: number[][] = Array.from({length: kept.length}, () => []);
  const inDegree = new Int32Array(kept.length);
  const gapWarnings: string[] = [];

  for (let i = 0; i < kept.length; i++) {
    const env = kept[i];
    for (const dep of env.dependencies) {
      const parentIdx = idToNodeIdx.get(dep);
      if (parentIdx === undefined) {
        gapWarnings.push(
          `Missing parent/dependency '${dep}' referenced by '${env.fileName}'.`,
        );
      } else if (parentIdx !== i) {
        adj[parentIdx].push(i);
        inDegree[i]++;
      } else {
        // Self-cycle!
        adj[parentIdx].push(i);
        inDegree[i]++;
      }
    }
  }

  // Kahn's topological sort breaking ties strictly by numeric order
  const ready: number[] = [];
  for (let i = 0; i < kept.length; i++) {
    if (inDegree[i] === 0) ready.push(i);
  }
  ready.sort((a, b) => compareEnvelopesNumerically(kept[a], kept[b]));

  const topoOrder: ParsedFileEnvelope[] = [];
  while (ready.length > 0) {
    const u = ready.shift()!;
    topoOrder.push(kept[u]);
    let added = false;
    for (const v of adj[u]) {
      inDegree[v]--;
      if (inDegree[v] === 0) {
        ready.push(v);
        added = true;
      }
    }
    if (added) {
      ready.sort((a, b) => compareEnvelopesNumerically(kept[a], kept[b]));
    }
  }

  const cycleErrors: string[] = [];
  let haltedDueToCycle = false;
  if (topoOrder.length < kept.length) {
    haltedDueToCycle = true;
    const cycleNodes: string[] = [];
    for (let i = 0; i < kept.length; i++) {
      if (inDegree[i] > 0) {
        cycleNodes.push(kept[i].stepId || kept[i].fileName);
      }
    }
    cycleErrors.push(
      `Dependency cycle detected in timeline branch (${cycleNodes.join(' <-> ')}); conflicting branch halted without partial merge.`,
    );
  }

  // Check consecutive numeric sequence gaps on stepNumber / sequenceNumber
  const seqNums = topoOrder
    .map((x) => x.stepNumber ?? x.sequenceNumber)
    .filter((n): n is number => n !== null);
  for (let i = 1; i < seqNums.length; i++) {
    const diff = seqNums[i] - seqNums[i - 1];
    if (diff > 1) {
      gapWarnings.push(
        `Sequence gap detected between step ${seqNums[i - 1]} and step ${seqNums[i]} (missing ${diff - 1} step(s)).`,
      );
    }
  }

  return {
    deduped: kept,
    duplicateResolutions,
    gapWarnings,
    cycleErrors,
    ordered: topoOrder,
    haltedDueToCycle,
  };
}

function mergeOrderedEnvelopes(
  timelineId: string,
  timelineKind: string,
  parentTimelineId: string | null,
  ordered: ParsedFileEnvelope[],
): {
  snapshot: ObservatorySnapshot;
  framesByTick: Record<number, ObservatorySnapshot>;
  orderedTicks: number[];
  mergeWarnings: string[];
} {
  const framesByTick: Record<number, ObservatorySnapshot> = {};
  const orderedTicks: number[] = [];
  const mergeWarnings: string[] = [];

  let latestSnapshot: ObservatorySnapshot | null = null;
  const mergedSeriesByTick = new Map<number, TimelinePoint>();
  const mergedTruthById = new Map<string, TruthEventItem>();
  const mergedArtifactsById = new Map<number, SurfaceArtifactItem>();

  for (const env of ordered) {
    if (env.snapshot) {
      latestSnapshot = structuredClone(env.snapshot);
      const t = latestSnapshot.clock.tick;
      framesByTick[t] = latestSnapshot;
      if (!orderedTicks.includes(t)) orderedTicks.push(t);

      for (const pt of latestSnapshot.timeline_series) {
        mergedSeriesByTick.set(pt.tick, pt);
      }
      for (const ev of latestSnapshot.history_layers.layer_1_ground_truth_tail) {
        mergedTruthById.set(`${ev.tick}:${ev.event_id}:${ev.event_type}`, ev);
      }
      for (const art of latestSnapshot.history_layers.layer_2_surface_artifacts) {
        mergedArtifactsById.set(art.artifact_id, art);
      }
    } else {
      // Delta / event-only file
      const rawEvents = Array.isArray(env.raw.events)
        ? env.raw.events
        : Array.isArray(env.raw.layer_1_ground_truth_tail)
          ? env.raw.layer_1_ground_truth_tail
          : typeof env.raw.event_type === 'string'
            ? [env.raw]
            : [];
      for (const item of rawEvents) {
        if (!isObject(item)) continue;
        const evTick = parseFiniteInt(item.tick) ?? env.tick ?? 0;
        const evId = parseFiniteInt(item.event_id) ?? env.stepNumber ?? env.index;
        const evType = typeof item.event_type === 'string' ? item.event_type : 'imported_event';
        mergedTruthById.set(`${evTick}:${evId}:${evType}`, {
          event_id: evId,
          tick: evTick,
          sim_date: typeof item.sim_date === 'string' ? item.sim_date : `T${evTick}`,
          event_type: evType,
          agent_ids: Array.isArray(item.agent_ids)
            ? item.agent_ids.filter((n): n is number => typeof n === 'number')
            : [],
          x: typeof item.x === 'number' ? item.x : 1250,
          y: typeof item.y === 'number' ? item.y : 1000,
          description:
            typeof item.description === 'string'
              ? item.description
              : `${evType} (${env.fileName})`,
          metadata: isObject(item.metadata) ? item.metadata : undefined,
        });
      }
    }
  }

  orderedTicks.sort((a, b) => a - b);

  if (!latestSnapshot) {
    // Event-only bundle: synthesize a minimal valid read-only ObservatorySnapshot WITHOUT inventing agents or world state
    const sortedTruth = Array.from(mergedTruthById.values()).sort(
      (a, b) => a.tick - b.tick || a.event_id - b.event_id,
    );
    const maxTick = sortedTruth.length > 0 ? sortedTruth[sortedTruth.length - 1].tick : 0;
    mergeWarnings.push(
      `Timeline '${timelineId}' contains event/delta files only without a full world terrain snapshot.`,
    );
    latestSnapshot = validateAndNormalizeSnapshot({
      export_schema_version: '2.0.0',
      world_id: `imported_${timelineId.slice(0, 12)}`,
      timeline_id: timelineId,
      parent_timeline_id: parentTimelineId,
      timeline_kind: timelineKind,
      clock: {
        tick: maxTick,
        year: Math.floor(maxTick / 360) + 1,
        month: (Math.floor(maxTick / 30) % 12) + 1,
        day: (maxTick % 30) + 1,
        season: 'spring',
        is_night: false,
        sim_date: `Y${String(Math.floor(maxTick / 360) + 1).padStart(4, '0')}-M${String((Math.floor(maxTick / 30) % 12) + 1).padStart(2, '0')}-D${String((maxTick % 30) + 1).padStart(2, '0')}`,
        real_elapsed_seconds: 0,
        real_seconds_per_sim_month: 60,
      },
      demographics: {
        living_count: 0,
        deceased_count: 0,
        total_ever_born: 0,
      },
      history_layers: {
        milestones: {},
        layer_1_ground_truth_tail: sortedTruth.slice(-600),
      },
    });
    framesByTick[maxTick] = latestSnapshot;
    orderedTicks.push(maxTick);
  } else {
    latestSnapshot = structuredClone(latestSnapshot);
    latestSnapshot.timeline_series = Array.from(mergedSeriesByTick.values()).sort(
      (a, b) => a.tick - b.tick,
    );
    latestSnapshot.history_layers.layer_1_ground_truth_tail = Array.from(
      mergedTruthById.values(),
    )
      .sort((a, b) => a.tick - b.tick || a.event_id - b.event_id)
      .slice(-600);
    if (mergedArtifactsById.size > 0) {
      latestSnapshot.history_layers.layer_2_surface_artifacts = Array.from(
        mergedArtifactsById.values(),
      ).sort((a, b) => a.created_tick - b.created_tick || a.artifact_id - b.artifact_id);
      latestSnapshot.history_layers.layer_2_surface_artifacts_count = Math.max(
        latestSnapshot.history_layers.layer_2_surface_artifacts_count,
        mergedArtifactsById.size,
      );
    }
    framesByTick[latestSnapshot.clock.tick] = latestSnapshot;
  }

  return {
    snapshot: latestSnapshot,
    framesByTick,
    orderedTicks,
    mergeWarnings,
  };
}

async function yieldToEventLoop(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

export async function processJsonImportBatch(
  files: ImportFileLike[],
  onProgress?: (progress: ImportProgress) => void,
): Promise<MultiImportReport> {
  const total = files.length;
  onProgress?.({stage: 'scan', processed: 0, total});

  const quarantinedFiles: QuarantinedFileRecord[] = [];
  const unindexedQueue: UnindexedFileRecord[] = [];
  const warnings: string[] = [];
  const allCycleErrors: string[] = [];
  const parsedEnvelopes: ParsedFileEnvelope[] = [];

  const CHUNK_SIZE = 25;

  // Stage 2 & 3: Chunked Parse + Internal Metadata Inspection
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const rel = f.webkitRelativePath || f.name;
    if (!f.name.toLowerCase().endsWith('.json')) {
      quarantinedFiles.push({
        fileName: f.name,
        relativePath: rel,
        reason: 'Non-JSON file skipped',
      });
    } else {
      try {
        const text = await f.text();
        const checksum = computeFastHash(text);
        const parsed: unknown = JSON.parse(text);
        if (!isObject(parsed)) {
          quarantinedFiles.push({
            fileName: f.name,
            relativePath: rel,
            reason: 'Top-level JSON value must be an object',
          });
        } else {
          const inspected = inspectMetadata(parsed, f.name, rel, i, checksum);
          if (inspected.error) {
            quarantinedFiles.push({
              fileName: f.name,
              relativePath: rel,
              reason: inspected.error,
            });
          } else if (inspected.unindexed) {
            unindexedQueue.push(inspected.unindexed);
          } else if (inspected.envelope) {
            parsedEnvelopes.push(inspected.envelope);
          }
        }
      } catch (err) {
        quarantinedFiles.push({
          fileName: f.name,
          relativePath: rel,
          reason: err instanceof Error ? `Corrupt JSON: ${err.message}` : 'Corrupt JSON syntax',
        });
      }
    }

    if ((i + 1) % CHUNK_SIZE === 0 || i + 1 === files.length) {
      onProgress?.({
        stage: i + 1 < files.length ? 'parse' : 'inspect',
        processed: i + 1,
        total,
      });
      await yieldToEventLoop();
    }
  }

  // Stage 4: Strict Timeline Branch Isolation (NEVER mix original & experimental or different timeline_ids)
  onProgress?.({stage: 'branch_isolate', processed: total, total});
  const byTimeline = new Map<string, ParsedFileEnvelope[]>();
  for (const env of parsedEnvelopes) {
    const key = `${env.timelineId}::${env.timelineKind}`;
    const bucket = byTimeline.get(key) ?? [];
    bucket.push(env);
    byTimeline.set(key, bucket);
  }
  if (byTimeline.size > 1) {
    warnings.push(
      `Isolated ${byTimeline.size} distinct timeline branches automatically (no cross-branch mixing).`,
    );
  }

  // Stage 5 & 6: Numeric + Kahn Topological Sequencing & Atomic Bundle Merge per Timeline
  onProgress?.({stage: 'sequence', processed: total, total});
  const timelines: ImportedTimelineBundle[] = [];
  let acceptedCount = 0;

  for (const [, bucket] of byTimeline.entries()) {
    const sample = bucket[0];
    const seq = resolveDuplicatesAndSequence(bucket);
    warnings.push(...seq.duplicateResolutions, ...seq.gapWarnings);
    allCycleErrors.push(...seq.cycleErrors);

    if (seq.haltedDueToCycle) {
      // Preserve explicit error without merging corrupt cyclic branch
      timelines.push({
        timelineId: sample.timelineId,
        timelineKind: sample.timelineKind,
        parentTimelineId: sample.parentTimelineId,
        worldId:
          typeof sample.raw.world_id === 'string' ? sample.raw.world_id : sample.timelineId,
        orderedFiles: seq.deduped.map((d) => d.fileName),
        orderedTicks: [],
        snapshot: validateAndNormalizeSnapshot({
          world_id: 'cycle_halted',
          timeline_id: sample.timelineId,
          timeline_kind: sample.timelineKind,
          clock: {
            tick: 0,
            year: 1,
            month: 1,
            day: 1,
            season: 'spring',
            is_night: false,
            sim_date: 'HALTED',
            real_elapsed_seconds: 0,
          },
          demographics: {living_count: 0, deceased_count: 0, total_ever_born: 0},
          history_layers: {milestones: {}},
        }),
        framesByTick: {},
        duplicateResolutions: seq.duplicateResolutions,
        gapWarnings: seq.gapWarnings,
        cycleErrors: seq.cycleErrors,
        haltedDueToCycle: true,
      });
      continue;
    }

    onProgress?.({stage: 'validate_merge', processed: total, total});
    const merged = mergeOrderedEnvelopes(
      sample.timelineId,
      sample.timelineKind,
      sample.parentTimelineId,
      seq.ordered,
    );
    warnings.push(...merged.mergeWarnings);
    acceptedCount += seq.ordered.length;

    timelines.push({
      timelineId: sample.timelineId,
      timelineKind: sample.timelineKind,
      parentTimelineId: sample.parentTimelineId,
      worldId: merged.snapshot.world_id,
      orderedFiles: seq.ordered.map((o) => o.fileName),
      orderedTicks: merged.orderedTicks,
      snapshot: merged.snapshot,
      framesByTick: merged.framesByTick,
      duplicateResolutions: seq.duplicateResolutions,
      gapWarnings: seq.gapWarnings,
      cycleErrors: seq.cycleErrors,
      haltedDueToCycle: false,
    });
  }

  onProgress?.({stage: 'complete', processed: total, total});
  return {
    totalFiles: total,
    acceptedCount,
    quarantinedFiles,
    unindexedQueue,
    warnings,
    cycleErrors: allCycleErrors,
    timelines,
  };
}
