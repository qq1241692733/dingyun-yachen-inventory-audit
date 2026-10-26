/**
 * 后端连接层。
 *
 * 两种运行姿态：
 *   · server 模式 —— 发现了后端服务。此时**后端是唯一真源**：
 *     所有读写都走后端，手机端 AI 助手登记的东西会实时出现在电脑端。
 *   · local 模式 —— 找不到后端（比如直接打开静态文件、或后端没启动）。
 *     完全退回原有 localStorage 行为，页面功能一个不少，只是手机端的数据进不来。
 *
 * 探测顺序：VITE_API_BASE → 同源（后端同时托管前端时）→ 同主机 :3020。
 * 这样无论前端是被后端托管、还是被 vite preview 托管，都能自己找到 API。
 */
import type {
  InventoryItem,
  Partner,
  SaleOrder,
  AuditReport,
  Franchisee,
  FittingEvent,
  PendingSale,
} from '../types/inventory';

const DEFAULT_API_PORT = '3020';
const PROBE_TIMEOUT_MS = 2500;

export type ServerStatus = 'probing' | 'online' | 'offline';

/** 后端返回的增量片段，键都是"该实体的完整新数组" */
export interface StatePatch {
  items?: InventoryItem[];
  partners?: Partner[];
  salesOrders?: SaleOrder[];
  auditReports?: AuditReport[];
  franchisees?: Franchisee[];
  fittingEvents?: FittingEvent[];
  pendingSales?: PendingSale[];
}

export interface ServerSnapshot extends StatePatch {
  revision: number;
  updatedAt: string;
  source: string;
}

export interface MutationResult extends StatePatch {
  ok: boolean;
  revision?: number;
  message?: string;
  error?: string;
  code?: string;
  candidates?: { inventoryId: string; barcode: string; size: string; color?: string; owner: string }[];
  event?: FittingEvent;
  pendingSale?: PendingSale;
  created?: InventoryItem[];
}

/* ────────────────────────── 连接状态（多实例同步）────────────────────────── */

let status: ServerStatus = 'probing';
let base = '';
let revision = 0;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((fn) => fn());

export function subscribeServer(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export const getServerStatus = () => status;
export const getServerBase = () => base;
export const getServerRevision = () => revision;

/* ────────────────────────── 探测 ────────────────────────── */

function candidateBases(): string[] {
  const out: string[] = [];
  const envBase = (import.meta as any)?.env?.VITE_API_BASE;
  if (envBase) out.push(String(envBase).replace(/\/$/, ''));
  if (typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location;
    // 同源优先（后端托管 dist/ 时就是这种情况）
    if (port !== DEFAULT_API_PORT) out.push('');
    else out.push('');
    if (hostname) out.push(`${protocol}//${hostname}:${DEFAULT_API_PORT}`);
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') out.push(`${protocol}//127.0.0.1:${DEFAULT_API_PORT}`);
  }
  return [...new Set(out)];
}

async function ping(candidate: string): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(`${candidate}/health`, { signal: ctrl.signal, headers: authHeaders() });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data?.ok);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function authHeaders(): Record<string, string> {
  const token = (import.meta as any)?.env?.VITE_API_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** 启动时探一次：找到后端就切到 server 模式，否则退回 local 模式 */
export async function detectServer(): Promise<ServerStatus> {
  status = 'probing';
  emit();
  for (const cand of candidateBases()) {
    // eslint-disable-next-line no-await-in-loop
    if (await ping(cand)) {
      base = cand;
      status = 'online';
      emit();
      return status;
    }
  }
  base = '';
  status = 'offline';
  emit();
  return status;
}

/* ────────────────────────── 请求 ────────────────────────── */

async function request<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(init?.headers || {}) },
  });
  const textBody = await res.text();
  let data: any = {};
  try {
    data = textBody ? JSON.parse(textBody) : {};
  } catch {
    data = { ok: false, message: textBody.slice(0, 300) };
  }
  if (!res.ok && data.ok === undefined) data.ok = false;
  return data as T;
}

const post = (path: string, body: unknown = {}) =>
  request<MutationResult>(path, { method: 'POST', body: JSON.stringify(body) });

function rememberRevision(r: { revision?: number }) {
  if (typeof r.revision === 'number' && r.revision >= revision) {
    revision = r.revision;
  }
}

/* ────────────────────────── 读 ────────────────────────── */

export async function fetchState(): Promise<ServerSnapshot | null> {
  if (status !== 'online') return null;
  const data = await request<ServerSnapshot & { ok: boolean }>('/api/state');
  if (!data?.ok) return null;
  revision = data.revision;
  emit();
  return data;
}

/**
 * 订阅后端变更：优先用 SSE（毫秒级），不支持就退化为 3 秒轮询。
 * 这是「手机端记一笔，电脑端几秒内自己刷新」的实现。
 */
export function watchServerChanges(onChange: (revision: number, action?: string) => void): () => void {
  if (status !== 'online') {
    // 后端是稍后才探测到的，这里给一个轮询兜底
    const timer = setInterval(async () => {
      if (status !== 'online') return;
      const r = await request<{ revision: number }>('/api/revision');
      if (r?.revision && r.revision !== revision) {
        revision = r.revision;
        onChange(r.revision);
      }
    }, 4000);
    return () => clearInterval(timer);
  }

  let es: EventSource | null = null;
  let poll: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const stopPolling = () => {
    if (poll) clearInterval(poll);
    poll = null;
  };
  const startPolling = () => {
    if (poll || closed) return;
    poll = setInterval(async () => {
      const r = await request<{ revision: number }>('/api/revision');
      if (r?.revision && r.revision !== revision) {
        revision = r.revision;
        onChange(r.revision);
      }
    }, 3000);
  };

  try {
    es = new EventSource(`${base}/api/events`);
    es.addEventListener('revision', (ev) => {
      try {
        const d = JSON.parse((ev as MessageEvent).data);
        if (typeof d.revision === 'number' && d.revision !== revision) {
          revision = d.revision;
          emit();
          onChange(d.revision, d.action);
        }
      } catch {
        /* 忽略坏帧 */
      }
    });
    es.onerror = () => {
      // EventSource 自己会重连；期间用轮询保证不漏
      startPolling();
    };
  } catch {
    startPolling();
  }

  return () => {
    closed = true;
    stopPolling();
    es?.close();
  };
}

/* ────────────────────────── 写 ────────────────────────── */

export const serverApi = {
  /** 整仓推送：电子表格全量同步、重置后回写 */
  async pushState(payload: Partial<StatePatch> & { source?: string }): Promise<MutationResult> {
    if (status !== 'online') return { ok: false, message: '未连接后端' };
    const r = await request<MutationResult>('/api/state', { method: 'PUT', body: JSON.stringify(payload) });
    rememberRevision(r);
    return r;
  },

  async reset(): Promise<MutationResult> {
    if (status !== 'online') return { ok: false, message: '未连接后端' };
    const r = await request<MutationResult>('/api/reset', { method: 'POST', body: '{}' });
    rememberRevision(r);
    return r;
  },

  async inbound(payload: {
    productName: string;
    ownerPartnerName: string;
    quantity: number;
    size?: string;
    color?: string;
    entryDate?: string;
    operator?: string;
  }): Promise<MutationResult> {
    const r = await post('/api/inbound', payload);
    rememberRevision(r);
    return r;
  },

  async sale(payload: Record<string, unknown>): Promise<MutationResult> {
    const r = await post('/api/sale', payload);
    rememberRevision(r);
    return r;
  },

  async returnOrder(payload: Record<string, unknown>): Promise<MutationResult> {
    const r = await post('/api/return-order', payload);
    rememberRevision(r);
    return r;
  },

  async audit(report: AuditReport): Promise<MutationResult> {
    const r = await post('/api/audit', { report });
    rememberRevision(r);
    return r;
  },

  async addPartner(payload: { name: string; phone?: string; role?: string }): Promise<MutationResult> {
    const r = await post('/api/partner', payload);
    rememberRevision(r);
    return r;
  },

  async addFranchisee(payload: Record<string, unknown>): Promise<MutationResult> {
    const r = await post('/api/franchisee', payload);
    rememberRevision(r);
    return r;
  },

  async renewFranchisee(id: string, renewal: Record<string, unknown>): Promise<MutationResult> {
    const r = await post('/api/franchisee/renew', { id, renewal });
    rememberRevision(r);
    return r;
  },

  /* —— 试衣（手机端 AI 也会调用的同一条链路）—— */

  async fittingTake(payload: {
    item: string;
    customerName?: string;
    customerPhone?: string;
    note?: string;
    operator?: string;
  }): Promise<MutationResult> {
    const r = await post('/api/fitting/take', payload);
    rememberRevision(r);
    return r;
  },

  async fittingReturn(payload: { fittingId?: string; item?: string; note?: string; operator?: string }): Promise<MutationResult> {
    const r = await post('/api/fitting/return', payload);
    rememberRevision(r);
    return r;
  },

  async fittingPurchase(payload: {
    fittingId?: string;
    item?: string;
    customerName?: string;
    sellerPartnerName?: string;
    dealPrice?: number;
    note?: string;
    operator?: string;
  }): Promise<MutationResult> {
    const r = await post('/api/fitting/purchase', payload);
    rememberRevision(r);
    return r;
  },
};

/** 把后端返回的片段并回本地 React state（只覆盖返回了的键） */
export function applyPatch<T extends Record<string, any>>(current: T, patch: StatePatch | undefined): T {
  if (!patch) return current;
  const next: Record<string, any> = { ...current };
  let changed = false;
  for (const key of Object.keys(patch) as (keyof StatePatch)[]) {
    if (patch[key] !== undefined) {
      next[key as string] = patch[key];
      changed = true;
    }
  }
  return changed ? (next as T) : current;
}
