import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'node:url';
import { promisify } from 'node:util';
import next from 'next';

const execFileAsync = promisify(execFile);

const dev = process.argv.includes('--dev') || process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = Number.parseInt(process.env.PORT || '3000', 10);

const ROOT_DIR = process.cwd();
const RUNS_DIR = path.join(ROOT_DIR, '.sim_runs');

function sanitizeRunId(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(trimmed)) return null;
  return trimmed;
}

async function ensureRunsDir() {
  await fs.mkdir(RUNS_DIR, { recursive: true });
}

async function listFrameTicks(runDir) {
  const framesDir = path.join(runDir, 'frames');
  try {
    const entries = await fs.readdir(framesDir);
    const ticks = [];
    for (const name of entries) {
      const m = /^tick_(\d+)\.json$/.exec(name);
      if (m) ticks.push(Number.parseInt(m[1], 10));
    }
    ticks.sort((a, b) => a - b);
    return ticks;
  } catch {
    return [];
  }
}

async function readRunSummary(runId) {
  const runDir = path.join(RUNS_DIR, runId);
  const obsPath = path.join(runDir, 'observatory_export.json');
  const raw = await fs.readFile(obsPath, 'utf-8');
  const snap = JSON.parse(raw);
  const frameTicks = await listFrameTicks(runDir);
  return {
    id: runId,
    world_id: snap.world_id,
    timeline_id: snap.timeline_id,
    parent_timeline_id: snap.parent_timeline_id ?? null,
    timeline_kind: snap.timeline_kind || 'original',
    branch_point_tick: snap.branch_point_tick ?? null,
    tick: Number(snap.clock?.tick ?? 0),
    sim_date: snap.clock?.sim_date ?? '',
    living_count: Number(snap.demographics?.living_count ?? 0),
    deceased_count: Number(snap.demographics?.deceased_count ?? 0),
    frame_ticks: frameTicks,
  };
}

async function readJsonBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > 2 * 1024 * 1024) {
      throw new Error('Request payload too large');
    }
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf-8'));
}

function sendJson(res, status, data) {
  const payload = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

async function runPythonCli(args) {
  const { stdout, stderr } = await execFileAsync('python3', ['-m', 'sim.cli', ...args], {
    cwd: ROOT_DIR,
    timeout: 120_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  // sim.cli writes structured JSON to stdout after any logging lines
  const trimmed = stdout.trim();
  const braceIdx = trimmed.indexOf('{');
  if (braceIdx >= 0) {
    try {
      return JSON.parse(trimmed.slice(braceIdx));
    } catch {
      return { raw: trimmed, stderr };
    }
  }
  return { raw: trimmed, stderr };
}

async function handleApiRequest(req, res, parsedUrl) {
  const pathname = parsedUrl.pathname || '';
  await ensureRunsDir();

  try {
    if (req.method === 'GET' && pathname === '/api/sim/status') {
      const entries = await fs.readdir(RUNS_DIR, { withFileTypes: true });
      const timelines = [];
      for (const ent of entries) {
        if (!ent.isDirectory()) continue;
        const safeId = sanitizeRunId(ent.name);
        if (!safeId) continue;
        try {
          timelines.push(await readRunSummary(safeId));
        } catch {
          // Ignore incomplete directories
        }
      }
      timelines.sort((a, b) => a.id.localeCompare(b.id));
      return sendJson(res, 200, { available: true, timelines });
    }

    if (req.method === 'POST' && pathname === '/api/sim/new') {
      const body = await readJsonBody(req);
      const seed = Number.isFinite(Number(body.seed)) ? Math.floor(Number(body.seed)) : 42;
      const initialPop = Math.max(4, Math.min(200, Math.floor(Number(body.initial_population ?? 40))));
      const maxTicks = Math.max(0, Math.min(300, Math.floor(Number(body.max_ticks ?? 10))));
      const runId = sanitizeRunId(body.id) || `orig_s${seed}_${Date.now()}`;
      const runDir = path.join(RUNS_DIR, runId);
      const framesDir = path.join(runDir, 'frames');

      await fs.mkdir(framesDir, { recursive: true });
      const cliRes = await runPythonCli([
        'new-world',
        '--checkpoint-dir',
        runDir,
        '--frames-dir',
        framesDir,
        '--seed',
        String(seed),
        '--initial-population',
        String(initialPop),
        '--max-ticks',
        String(maxTicks),
      ]);

      const snapshotRaw = await fs.readFile(path.join(runDir, 'observatory_export.json'), 'utf-8');
      const snapshot = JSON.parse(snapshotRaw);
      const frameTicks = await listFrameTicks(runDir);
      return sendJson(res, 200, {
        ok: true,
        id: runId,
        cli: cliRes,
        snapshot,
        frame_ticks: frameTicks,
      });
    }

    if (req.method === 'POST' && pathname === '/api/sim/step') {
      const body = await readJsonBody(req);
      const runId = sanitizeRunId(body.id);
      if (!runId) return sendJson(res, 400, { error: 'Invalid timeline id' });
      const runDir = path.join(RUNS_DIR, runId);
      const framesDir = path.join(runDir, 'frames');

      try {
        await fs.access(path.join(runDir, 'manifest.json'));
      } catch {
        return sendJson(res, 404, { error: `Timeline '${runId}' not found` });
      }

      const ticks = Math.max(1, Math.min(200, Math.floor(Number(body.ticks ?? 1))));
      const stride = Math.max(1, Math.min(25, Math.floor(Number(body.frame_stride ?? (ticks > 20 ? 5 : 1)))));

      const stepRes = await runPythonCli([
        'step-checkpoint',
        '--checkpoint-dir',
        runDir,
        '--ticks',
        String(ticks),
        '--frames-dir',
        framesDir,
        '--frame-stride',
        String(stride),
      ]);

      const snapshotRaw = await fs.readFile(path.join(runDir, 'observatory_export.json'), 'utf-8');
      const snapshot = JSON.parse(snapshotRaw);
      const frameTicks = await listFrameTicks(runDir);
      return sendJson(res, 200, {
        ok: true,
        id: runId,
        step_result: stepRes,
        snapshot,
        frame_ticks: frameTicks,
      });
    }

    if (req.method === 'POST' && pathname === '/api/sim/branch-rebirth') {
      const body = await readJsonBody(req);
      const sourceId = sanitizeRunId(body.source_id);
      if (!sourceId) return sendJson(res, 400, { error: 'Invalid source_id' });
      const sourceDir = path.join(RUNS_DIR, sourceId);

      try {
        await fs.access(path.join(sourceDir, 'manifest.json'));
      } catch {
        return sendJson(res, 404, { error: `Source timeline '${sourceId}' not found` });
      }

      const targetId = sanitizeRunId(body.target_id) || `exp_rebirth_${Date.now()}`;
      if (targetId === sourceId) {
        return sendJson(res, 400, { error: 'Experimental branch ID must differ from source_id' });
      }
      const targetDir = path.join(RUNS_DIR, targetId);
      const targetFramesDir = path.join(targetDir, 'frames');

      const args = [
        'create-experimental-branch',
        '--source-dir',
        sourceDir,
        '--target-dir',
        targetDir,
      ];
      if (Array.isArray(body.agent_ids) && body.agent_ids.length > 0) {
        const cleanIds = body.agent_ids
          .map((x) => Number(x))
          .filter((x) => Number.isInteger(x) && x > 0);
        if (cleanIds.length > 0) {
          args.push('--agent-ids', cleanIds.join(','));
        }
      }

      const report = await runPythonCli(args);
      const obsPath = path.join(targetDir, 'observatory_export.json');
      const snapshotRaw = await fs.readFile(obsPath, 'utf-8');
      const snapshot = JSON.parse(snapshotRaw);

      await fs.mkdir(targetFramesDir, { recursive: true });
      const tickPad = String(Number(snapshot.clock?.tick ?? 0)).padStart(6, '0');
      await fs.writeFile(path.join(targetFramesDir, `tick_${tickPad}.json`), snapshotRaw, 'utf-8');

      const frameTicks = await listFrameTicks(targetDir);
      return sendJson(res, 200, {
        ok: true,
        id: targetId,
        branch_report: report,
        snapshot,
        frame_ticks: frameTicks,
      });
    }

    if (req.method === 'GET' && pathname === '/api/sim/snapshot') {
      const query = parsedUrl.query || {};
      const runId = sanitizeRunId(typeof query.id === 'string' ? query.id : '');
      if (!runId) return sendJson(res, 400, { error: 'Missing or invalid id parameter' });
      const runDir = path.join(RUNS_DIR, runId);

      const frameTicks = await listFrameTicks(runDir);
      if (query.tick !== undefined && query.tick !== '') {
        const tickNum = Number.parseInt(String(query.tick), 10);
        if (!Number.isFinite(tickNum) || tickNum < 0) {
          return sendJson(res, 400, { error: 'Invalid tick parameter' });
        }
        const pad = String(tickNum).padStart(6, '0');
        const framePath = path.join(runDir, 'frames', `tick_${pad}.json`);
        try {
          const raw = await fs.readFile(framePath, 'utf-8');
          return sendJson(res, 200, {
            ok: true,
            id: runId,
            is_historical: true,
            snapshot: JSON.parse(raw),
            frame_ticks: frameTicks,
          });
        } catch {
          return sendJson(res, 404, {
            error: `Historical frame for tick ${tickNum} not found (cannot fabricate unsimulated ticks)`,
            frame_ticks: frameTicks,
          });
        }
      }

      try {
        const raw = await fs.readFile(path.join(runDir, 'observatory_export.json'), 'utf-8');
        return sendJson(res, 200, {
          ok: true,
          id: runId,
          is_historical: false,
          snapshot: JSON.parse(raw),
          frame_ticks: frameTicks,
        });
      } catch {
        return sendJson(res, 404, { error: `Snapshot for '${runId}' not found` });
      }
    }

    if (req.method === 'GET' && pathname === '/api/sim/compare') {
      const query = parsedUrl.query || {};
      const idA = sanitizeRunId(typeof query.a === 'string' ? query.a : '');
      const idB = sanitizeRunId(typeof query.b === 'string' ? query.b : '');
      if (!idA || !idB) return sendJson(res, 400, { error: 'Missing or invalid timeline IDs a & b' });

      const dirA = path.join(RUNS_DIR, idA);
      const dirB = path.join(RUNS_DIR, idB);
      const report = await runPythonCli([
        'compare-timelines',
        '--original-dir',
        dirA,
        '--experimental-dir',
        dirB,
      ]);
      return sendJson(res, 200, { ok: true, report });
    }

    return sendJson(res, 404, { error: `Unknown simulation endpoint: ${pathname}` });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Simulation API error';
    return sendJson(res, 500, { error: msg });
  }
}

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url || '/', true);
    if (parsedUrl.pathname && parsedUrl.pathname.startsWith('/api/sim/')) {
      handleApiRequest(req, res, parsedUrl);
      return;
    }
    handle(req, res, parsedUrl);
  }).listen(port, hostname, () => {
    console.log(`> Civilization Observatory server ready on http://${hostname}:${port} (${dev ? 'dev' : 'prod'})`);
  });
});
