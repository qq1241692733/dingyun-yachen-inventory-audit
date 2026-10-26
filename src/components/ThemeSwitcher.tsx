import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Palette, Sun, Moon, Check, MonitorSmartphone } from 'lucide-react';
import {
  THEMES,
  MODE_OPTIONS,
  subscribeAppearance,
  getAppearanceSnapshot,
  parseSnapshot,
  setAppearance,
  toggleMode,
  type ThemeId,
  type ModePref,
  type ModeId,
} from '../utils/theme';

/* Hallmark · component: appearance-switcher (N7 外观控件) · genre: editorial
 * 结构角色：书眉右侧的「外观」控件 —— 决定整册用什么纸、什么墨。
 * 质感来源（都是"账本"语汇，不是装饰）：
 *   · 主题预览做成**纸样**：一平方厘米的纸色 + 两条规则线 + 一枚强调色印泥
 *   · 明暗用**分段控件**：轨道内阴影做"压凹"，选中的滑块浮起 1px
 *   · 切换时全站颜色 200ms 渐变（尊重 prefers-reduced-motion）
 * states: default · hover · focus-visible · active · aria-pressed · aria-expanded
 */

const MODE_ICON: Record<ModeId, React.ReactNode> = {
  light: <Sun strokeWidth={1.6} className="w-3.5 h-3.5" />,
  dark: <Moon strokeWidth={1.6} className="w-3.5 h-3.5" />,
};

interface ThemeSwitcherProps {
  /** compact = 只留一个图标按钮（窄屏/移动端导航用） */
  compact?: boolean;
}

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ compact = false }) => {
  const snap = useSyncExternalStore(subscribeAppearance, getAppearanceSnapshot, () =>
    getAppearanceSnapshot()
  );
  const { theme, pref, mode } = parseSnapshot(snap);

  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  /* 点外部 / Esc 关闭；关闭后焦点还给触发按钮 */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const currentTheme = THEMES.find((t) => t.id === theme) ?? THEMES[0];
  const modeLabel = MODE_OPTIONS.find((m) => m.id === pref)?.name ?? '跟随系统';

  const skinClass = (id: ThemeId) => {
    const meta = THEMES.find((t) => t.id === id) ?? THEMES[0];
    return meta.skin(mode);
  };

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      {/* ── 一键明暗：一次点击就切换，不必先开面板 ── */}
      <div className="inline-flex items-center gap-1">
        <button
          type="button"
          onClick={() => toggleMode()}
          title={mode === 'dark' ? '切回浅色' : '切换到深色'}
          aria-label={mode === 'dark' ? '切回浅色模式' : '切换到深色模式'}
          className="w-7 h-7 grid place-items-center rounded-xs text-text-4
                     hover:text-text hover:bg-surface-2 transition-colors duration-150
                     cursor-pointer"
        >
          {MODE_ICON[mode]}
        </button>

        {/* ── 外观面板触发按钮 ── */}
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="dialog"
          aria-expanded={open}
          title="外观：主题与明暗"
          className={[
            'inline-flex items-center gap-1.5 h-7 rounded-xs px-1.5 cursor-pointer',
            'text-2xs transition-colors duration-150',
            open ? 'text-accent bg-accent-faint' : 'text-text-4 hover:text-text hover:bg-surface-2',
          ].join(' ')}
        >
          <Palette strokeWidth={1.6} className="w-3.5 h-3.5" />
          {!compact && <span className="hidden xl:inline">{currentTheme.name}</span>}
          {/* 当前主题的小印泥点：不开面板也能看出现在是哪套 */}
          <span
            aria-hidden="true"
            className={`w-1.5 h-1.5 rounded-full skin-accent ${skinClass(theme)}`}
          />
        </button>
      </div>

      {/* ── 面板 ── */}
      {open && (
        <div
          role="dialog"
          aria-label="外观设置"
          className="absolute right-0 top-full mt-2 w-[286px] rounded-md border border-border-2
                     bg-surface shadow-pop overflow-hidden z-[var(--z-pop)] rise"
        >
          <div className="px-4 pt-3.5 pb-2.5 border-b border-border flex items-baseline justify-between">
            <span className="font-medium text-text text-sm">外观</span>
            <span className="text-2xs text-text-4">
              {currentTheme.name} · {modeLabel}
              {pref === 'system' && <span className="ml-1">（当前{mode === 'dark' ? '深' : '浅'}）</span>}
            </span>
          </div>

          {/* 主题：纸样卡 */}
          <div className="px-4 py-3.5">
            <div className="text-2xs tracking-wider text-text-4 mb-2.5">主题</div>
            <div className="grid grid-cols-2 gap-2.5">
              {THEMES.map((t) => {
                const on = t.id === theme;
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setAppearance({ theme: t.id })}
                    className={[
                      'group text-left rounded-sm p-2 transition-all duration-150 cursor-pointer',
                      'border',
                      on
                        ? 'border-accent bg-accent-faint'
                        : 'border-border hover:border-border-2 hover:bg-surface-2',
                    ].join(' ')}
                  >
                    {/* 纸样：纸底 + 两道规则线 + 一枚强调色印泥 */}
                    <span
                      className={`block h-[46px] rounded-xs relative overflow-hidden skin-paper ${t.skin(mode)}`}
                      aria-hidden="true"
                    >
                      <span className="absolute left-2 right-2 top-[13px] h-px skin-rule" />
                      <span className="absolute left-2 right-6 top-[24px] h-px skin-rule" />
                      <span className="absolute left-2 right-10 top-[35px] h-px skin-rule" />
                      <span className="absolute right-1.5 bottom-1.5 w-3 h-3 rounded-[1px] skin-accent" />
                      <span
                        className={[
                          'absolute right-1.5 top-1.5 w-3.5 h-3.5 rounded-full grid place-items-center',
                          'transition-opacity duration-150',
                          on ? 'opacity-100 bg-accent' : 'opacity-0',
                        ].join(' ')}
                      >
                        <Check strokeWidth={3} className="w-2.5 h-2.5 text-on-accent" />
                      </span>
                    </span>
                    <span className="mt-2 flex items-baseline justify-between gap-1">
                      <span
                        className={[
                          'text-xs font-medium',
                          on ? 'text-accent-strong' : 'text-text',
                        ].join(' ')}
                      >
                        {t.name}
                      </span>
                    </span>
                    <span className="block mt-0.5 text-2xs text-text-4 leading-snug">
                      {t.tagline}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 明暗：分段控件 */}
          <div className="px-4 pb-3.5">
            <div className="text-2xs tracking-wider text-text-4 mb-2.5">明暗</div>
            <div className="segment w-full" role="group" aria-label="明暗模式">
              {MODE_OPTIONS.map((m) => {
                const on = m.id === pref;
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setAppearance({ pref: m.id as ModePref })}
                    className="segment-item flex-1"
                  >
                    {m.id === 'light' && MODE_ICON.light}
                    {m.id === 'dark' && MODE_ICON.dark}
                    {m.id === 'system' && <MonitorSmartphone strokeWidth={1.6} className="w-3.5 h-3.5" />}
                    {m.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="px-4 py-2.5 border-t border-border bg-surface-2/60">
            <p className="text-2xs text-text-4 leading-relaxed">
              选择会被记住；打印时一律按浅色出纸。
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
