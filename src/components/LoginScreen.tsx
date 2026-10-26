import React, { useState } from 'react';
import { LogIn, LockKeyhole, User, ShieldAlert } from 'lucide-react';

/**
 * 账册安全门 —— 登录页。
 *
 * 设计语言与主站一致：左侧「书脊式」品牌面（dark），右侧纸面登录卡片。
 * 账号密码为内部固定管理账号（见下方 CREDENTIALS）。
 * 成功登录后由 App 记录会话并进入主界面；本组件只负责校验与回调。
 */

/** 内部管理账号 —— 需要修改时只改这里 */
const CREDENTIALS = {
  username: 'dyycadmin',
  password: 'furong0210',
};

interface LoginScreenProps {
  /** 校验通过后回调，参数为已登录账号名 */
  onLogin: (username: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const u = username.trim();
    if (u === CREDENTIALS.username && password === CREDENTIALS.password) {
      setError('');
      onLogin(u);
    } else {
      setError('账号或密码不正确，请重新输入');
    }
  };

  return (
    <div className="min-h-screen bg-bg text-text flex">
      {/* ── 左：书脊式品牌面（lg 及以上显示） ── */}
      <aside className="hidden lg:flex w-[22rem] shrink-0 bg-nav text-on-nav flex-col justify-between px-8 py-10 no-print">
        <div>
          <div
            aria-hidden="true"
            className="w-10 h-10 grid place-items-center border border-accent bg-accent-soft"
          >
            <span className="font-display text-lg leading-none text-accent-strong">鼎</span>
          </div>
          <h1 className="font-display text-2xl leading-tight mt-8 text-text">
            鼎运雅辰
            <br />
            品质体验中心
          </h1>
          <p className="text-xs mt-3 text-text-3">运营与合伙人库存审计系统</p>
        </div>

        <ul className="text-xs text-text-3 space-y-2">
          <li>· 17 位合伙人独立货权，货由店长统一保管清点</li>
          <li>· 缺码借调、补货冲销，借贷关系闭环可溯</li>
          <li>· 关键业务双人手写签字存证，不可单方篡改</li>
        </ul>

        <p className="text-2xs text-text-3">内部系统 · 登录后使用</p>
      </aside>

      {/* ── 右：登录卡片 ── */}
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <form
          onSubmit={submit}
          className="w-full max-w-sm bg-surface border border-border-2 rounded-sm shadow-pop p-7 sm:p-8"
        >
          {/* 移动端品牌（lg 以下） */}
          <div className="lg:hidden flex items-center gap-2.5 mb-7">
            <div
              aria-hidden="true"
              className="w-8 h-8 grid place-items-center border border-accent bg-accent-soft shrink-0"
            >
              <span className="font-display text-sm leading-none text-accent-strong">鼎</span>
            </div>
            <div className="min-w-0">
              <div className="font-display text-sm text-text truncate">鼎运雅辰品质体验中心</div>
              <div className="text-2xs text-text-3">运营与合伙人库存审计系统</div>
            </div>
          </div>

          <div className="kicker">账册安全门</div>
          <h2 className="page-title mt-1.5">登录系统</h2>
          <p className="meta mt-1.5">请输入管理账号与密码进入账本。</p>

          <div className="mt-7 space-y-4">
            <div>
              <label className="label" htmlFor="login-username">
                账号
              </label>
              <div className="relative">
                <User
                  strokeWidth={1.7}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-3 pointer-events-none"
                />
                <input
                  id="login-username"
                  className="field pl-9"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="管理账号"
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="login-password">
                密码
              </label>
              <div className="relative">
                <LockKeyhole
                  strokeWidth={1.7}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-3 pointer-events-none"
                />
                <input
                  id="login-password"
                  type="password"
                  className="field pl-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="登录密码"
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error && (
              <p role="alert" className="text-xs text-danger flex items-center gap-1.5">
                <ShieldAlert strokeWidth={1.7} className="w-3.5 h-3.5 shrink-0" />
                {error}
              </p>
            )}

            <button type="submit" className="btn btn-seal w-full">
              <LogIn strokeWidth={1.75} className="w-4 h-4" />
              登录
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};
