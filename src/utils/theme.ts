/* ============================================================================
   外观（主题 + 明暗）—— 唯一的状态源与落盘逻辑

   为什么不用 React Context：
     外观必须写在 <html> 上（见 index.css 注释：CSS 变量在声明它的元素上完成替换）。
     因此「真相」在 DOM 属性 + localStorage 里，不在 React 树里。
     React 只做一件事：把 owner 状态同步过去。这样也不会出现
     "Provider 包不住某个 Portal 模态" 这类经典翻车。
   ============================================================================ */

export type ThemeId = 'quiet' | 'brass';
export type ModeId = 'light' | 'dark';
/** 用户偏好：可以是明确的明/暗，也可以交给系统 */
export type ModePref = ModeId | 'system';

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  tagline: string;
  /** 预览纸样用的类名（见 index.css 的 .swatch-*） */
  skin: (mode: ModeId) => string;
}

export const THEMES: ThemeMeta[] = [
  {
    id: 'quiet',
    name: '静室',
    tagline: '冷中性纸 · 靛蓝',
    skin: (m) => `swatch-quiet-${m}`,
  },
  {
    id: 'brass',
    name: '铜金',
    tagline: '暖纸 · 琥珀 · 原版配色',
    skin: (m) => `swatch-brass-${m}`,
  },
];

export const MODE_OPTIONS: { id: ModePref; name: string }[] = [
  { id: 'light', name: '浅色' },
  { id: 'dark', name: '深色' },
  { id: 'system', name: '跟随系统' },
];

const K_THEME = 'dyyc.appearance.theme';
const K_MODE = 'dyyc.appearance.mode';

export const DEFAULT_THEME: ThemeId = 'quiet';
export const DEFAULT_MODE_PREF: ModePref = 'system';

const isTheme = (v: unknown): v is ThemeId => v === 'quiet' || v === 'brass';
const isModePref = (v: unknown): v is ModePref =>
  v === 'light' || v === 'dark' || v === 'system';

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* 隐私模式下写不进去也不该崩 */
  }
}

export function readTheme(): ThemeId {
  const raw = safeGet(K_THEME);
  return isTheme(raw) ? raw : DEFAULT_THEME;
}

export function readModePref(): ModePref {
  const raw = safeGet(K_MODE);
  return isModePref(raw) ? raw : DEFAULT_MODE_PREF;
}

export function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

/** 把偏好解析成实际模式 */
export function resolveMode(pref: ModePref): ModeId {
  return pref === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : pref;
}

/** 只改 DOM，不落盘、不做过渡 —— 首屏同步用 */
export function paint(theme: ThemeId, mode: ModeId) {
  const el = document.documentElement;
  el.dataset.theme = theme;
  el.dataset.mode = mode;
}

let switchTimer: number | undefined;

/* ── 极小外部 store ────────────────────────────────────────────────────────
   桌面的书眉切换器与移动端导航切换器是两个实例，必须同步。
   真相已经在 DOM + localStorage 里，这里只做"变更广播"，
   用 useSyncExternalStore 订阅，避免两份 React state 各自漂移。 */
type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeAppearance(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 快照必须是字符串（原始值），否则 useSyncExternalStore 会判定为每次都变 */
export function getAppearanceSnapshot(): string {
  const el = typeof document !== 'undefined' ? document.documentElement : null;
  const mode = el?.dataset.mode === 'dark' ? 'dark' : 'light';
  return `${readTheme()}|${readModePref()}|${mode}`;
}

export function parseSnapshot(snap: string): {
  theme: ThemeId;
  pref: ModePref;
  mode: ModeId;
} {
  const [t, p, m] = snap.split('|');
  return {
    theme: isTheme(t) ? t : DEFAULT_THEME,
    pref: isModePref(p) ? p : DEFAULT_MODE_PREF,
    mode: m === 'dark' ? 'dark' : 'light',
  };
}

function emit() {
  listeners.forEach((l) => l());
}

/** 用户主动改外观的入口：落盘 + 换肤 + 通知所有实例 */
export function setAppearance(next: { theme?: ThemeId; pref?: ModePref }) {
  const theme = next.theme ?? readTheme();
  const pref = next.pref ?? readModePref();
  applyAppearance(theme, pref, true);
  emit();
}

/** 一键切换明暗：若当前是「跟随系统」，则切到系统的反面 */
export function toggleMode(): ModeId {
  const cur = resolveMode(readModePref());
  const next: ModeId = cur === 'dark' ? 'light' : 'dark';
  setAppearance({ pref: next });
  return next;
}

/**
 * 应用一套外观。
 * @param animate 是否播放 200ms 换肤过渡（首屏渲染必须传 false，否则会闪一下）
 */
export function applyAppearance(theme: ThemeId, pref: ModePref, animate = true): ModeId {
  const mode = resolveMode(pref);
  const el = document.documentElement;

  if (animate && !prefersReducedMotion()) {
    el.classList.add('theme-switching');
    if (switchTimer) window.clearTimeout(switchTimer);
    switchTimer = window.setTimeout(() => el.classList.remove('theme-switching'), 240);
  }

  paint(theme, mode);
  safeSet(K_THEME, theme);
  safeSet(K_MODE, pref);
  return mode;
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** 订阅系统明暗变化；仅当用户选的是「跟随系统」时才需要响应 */
export function watchSystemMode(onChange: (dark: boolean) => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (e: MediaQueryListEvent) => onChange(e.matches);
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}
