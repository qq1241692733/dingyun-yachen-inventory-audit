/**
 * 数据仓 —— 后端是唯一真源。
 *
 * 设计要点
 *  1. 单文件 JSON + 原子写（tmp → rename），避免断电/崩溃写出半个文件。
 *  2. 每次变更把 `revision` +1，前端与 MCP 都用它判断"要不要重新拉"，
 *     这样手机端在别处记一笔，桌面端几秒内就会自己刷新。
 *  3. 首次启动若没有 store.json，自动用 server/data/seed.json 播种，
 *     所以 MCP 服务可以脱离前端独立跑起来（手机端不需要先打开电脑页面）。
 *  4. 变更通过内存订阅广播出去（SSE 用），不依赖轮询。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertInvariants } from './domain.mjs';

/**
 * 数据目录：默认 server/data。
 * 可用环境变量 DY_DATA_DIR 覆盖 —— 用于：
 *   · 测试实例指向临时目录，不污染真实数据仓
 *   · 部署时把数据挂到代码目录之外（Docker volume、备份盘）
 */
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.DY_DATA_DIR
  ? path.resolve(process.env.DY_DATA_DIR)
  : path.join(HERE, 'data');
export const STORE_FILE = path.join(DATA_DIR, 'store.json');
export const SEED_FILE = path.join(DATA_DIR, 'seed.json');

const OP_LOG_LIMIT = 500;

function emptyState() {
  return {
    revision: 0,
    updatedAt: new Date().toISOString(),
    source: 'empty',
    catalogs: [],
    items: [],
    partners: [],
    salesOrders: [],
    auditReports: [],
    franchisees: [],
    fittingEvents: [],
    pendingSales: [],
    opLog: [],
  };
}

let state = emptyState();
const listeners = new Set();

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** 用种子数据建立一个初始数据仓 */
export function seedFromFile() {
  const seed = readJson(SEED_FILE);
  if (!seed) {
    throw new Error(
      `缺少种子文件 ${SEED_FILE}，请先运行：npm run seed（会从 src/data/initialData.ts 抽取）`
    );
  }
  // ⚠️ revision 必须单调递增，重置不能把它打回 1。
  // 否则重置后 revision 会变小（r6 → r1），任何按 revision 缓存/判断"要不要重拉"的
  // 客户端都可能读到过期数据，而且 r6 这个号码还会在未来被复用、指向完全不同的内容。
  const prevRevision = state?.revision || 0;
  state = {
    ...emptyState(),
    revision: Math.max(1, (state?.revision || 0) + 1),
    updatedAt: new Date().toISOString(),
    source: 'seed',
    catalogs: seed.catalogs || [],
    items: seed.items || [],
    partners: seed.partners || [],
    salesOrders: seed.salesOrders || [],
    auditReports: seed.auditReports || [],
    franchisees: seed.franchisees || [],
    fittingEvents: [],
    pendingSales: [],
    opLog: [],
  };
  // ⚠️ 种子也要过一遍不变量：种子坏了等于全系统从脏数据起步，必须在启动/重置时就暴露
  assertInvariants(state, prevRevision);
  persist();
  return state;
}
export function load() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const saved = readJson(STORE_FILE);
  if (saved && Array.isArray(saved.items) && saved.items.length > 0) {
    state = { ...emptyState(), ...saved };
    state.opLog = Array.isArray(state.opLog) ? state.opLog : [];
    return state;
  }
  return seedFromFile();
}

function persist() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${STORE_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state), 'utf8');
  fs.renameSync(tmp, STORE_FILE); // 同目录 rename 在 POSIX/NTFS 上都是原子的
}

/** 只读快照（深拷贝，调用方改不坏仓） */
export function getState() {
  return structuredClone(state);
}

export function getRevision() {
  return state.revision;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function broadcast(meta) {
  // ⚠️ 不在这里预先 getState()：现有订阅者（/api/events、MCP SSE）只用 meta，
  //    提前深拷贝等于每次写入都白拷一份整仓（实测 ~1.6ms/订阅者，
  //    3 个订阅者时占单次写入耗时 59%）。需要快照的订阅者自己调第二个参数取值。
  const snapshot = () => getState();
  for (const fn of listeners) {
    try {
      fn(meta, snapshot);
    } catch {
      /* 单个订阅者出错不影响其它人 */
    }
  }
}

/**
 * 唯一写入口。
 * mutator(draftState, ctx) 直接改 draft；返回 { ok:false, code, message } 表示拒绝。
 * 返回对象会连同 bump 后的 revision 一起交给调用方。
 */
export function mutate(mutator, { channel = 'WEB', operator = '', action = '', detail = '' } = {}) {
  const draft = structuredClone(state);
  let result;
  try {
    result = mutator(draft, { channel, operator });
  } catch (err) {
    return { ok: false, code: 'INTERNAL', message: err?.message || String(err) };
  }
  if (!result || result.ok === false) {
    // ⚠️ 必须把 mutator 拒绝时带的附加信息（如 takeForFitting 的 candidates 候选清单）
    // 原样透传出去，否则调用方只能拿到一句"有多件，请指定"，却拿不到可选的条码。
    const rest = { ...(result || {}) };
    delete rest.ok;
    return {
      ...rest,
      ok: false,
      code: result?.code || 'REJECTED',
      message: result?.message || '操作未完成',
    };
  }

  draft.revision = state.revision + 1;
  draft.updatedAt = new Date().toISOString();
  if (action) {
    draft.opLog = [
      {
        id: `OP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        at: draft.updatedAt,
        channel,
        operator: operator || '未署名',
        action,
        detail,
      },
      ...(draft.opLog || []),
    ].slice(0, OP_LOG_LIMIT);
  }

  // ⚠️ 写盘前最后一道闸：任何写路径的脏数据都在这里被拦下
  //    （mutate 与 replaceState 共用；详见 domain.mjs 的 checkInvariants）
  try {
    assertInvariants(draft, state.revision);
  } catch (err) {
    return { ok: false, code: err.code || 'INVARIANT_VIOLATED', message: err.message };
  }

  state = draft;
  persist();
  broadcast({ revision: state.revision, action, channel, operator });
  return { ok: true, revision: state.revision, ...result };
}

/** 整仓替换：前端把本地数据灌进来（首次接管 / 电子表格全量同步 / 重置） */
export function replaceState(patch, { channel = 'WEB', operator = '', action = 'state.replace' } = {}) {
  const draft = structuredClone(state);
  for (const key of [
    'items',
    'partners',
    'salesOrders',
    'auditReports',
    'franchisees',
    'fittingEvents',
    'pendingSales',
  ]) {
    if (Array.isArray(patch[key])) draft[key] = patch[key];
  }
  draft.revision = state.revision + 1;
  draft.updatedAt = new Date().toISOString();
  draft.source = patch.source || 'frontend';
  draft.opLog = [
    {
      id: `OP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      at: draft.updatedAt,
      channel,
      operator: operator || '未署名',
      action,
      detail: `items=${draft.items.length} fitting=${draft.fittingEvents.length}`,
    },
    ...(draft.opLog || []),
  ].slice(0, OP_LOG_LIMIT);

  // ⚠️ 写盘前最后一道闸：任何写路径的脏数据都在这里被拦下
  //    （mutate 与 replaceState 共用；详见 domain.mjs 的 checkInvariants）
  try {
    assertInvariants(draft, state.revision);
  } catch (err) {
    return { ok: false, code: err.code || 'INVARIANT_VIOLATED', message: err.message };
  }

  state = draft;
  persist();
  broadcast({ revision: state.revision, action, channel, operator });
  return { ok: true, revision: state.revision, state: getState() };
}

export function resetToSeed() {
  seedFromFile();
  broadcast({ revision: state.revision, action: 'reset' });
  return { ok: true, revision: state.revision, state: getState() };
}
