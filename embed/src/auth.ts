import type { CommentUiConfig } from './config';
import { ApiError, createCommentApi } from './api';
import type { AccountUser, BadgeKind } from './types';
import { badgeSvg } from './badges';

type Api = ReturnType<typeof createCommentApi>;

interface AuthOptions {
  config: CommentUiConfig;
  api: Api;
  onChange: () => void;
}

const BADGES: BadgeKind[] = ['none', 'cockade', 'seal'];
const BADGE_LABEL: Record<BadgeKind, string> = { none: '不标注', cockade: '三色花结', seal: '认证标记' };

const ERROR_TEXT: Record<string, string> = {
  invalid_credentials: '用户名或密码错误',
  email_taken: '该邮箱已注册，请直接登录',
  username_taken: '用户名已被占用',
  invalid_email: '邮箱格式不正确',
  invalid_username: '用户名需 3–20 位，仅限字母、数字和下划线',
  invalid_password: '密码至少 8 位',
  invalid_code: '验证码不正确',
  code_expired: '验证码已过期，请重新获取',
  same_email: '与当前邮箱相同',
  email_send_failed: '验证邮件发送失败，请稍后再试',
  rate_limited: '操作过于频繁，请稍后再试',
  oauth_failed: 'Google 登录失败，请重试',
  unauthorized: '登录已失效，请重新登录'
};

function messageFor(error: unknown): string {
  if (error instanceof ApiError) return ERROR_TEXT[error.message] || '操作失败，请重试';
  return '操作失败，请重试';
}

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: Array<Node | string> = []
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key === 'html') node.innerHTML = value;
    else node.setAttribute(key, value);
  }
  for (const child of children) node.append(child);
  return node;
}

export function createAuth({ config, api, onChange }: AuthOptions) {
  let token = localStorage.getItem(config.sessionStorageKey) || '';
  let account: AccountUser | null = null;
  let overlay: HTMLElement | null = null;
  let googlePopup: Window | null = null;

  function persist(next: string): void {
    token = next;
    if (next) localStorage.setItem(config.sessionStorageKey, next);
    else localStorage.removeItem(config.sessionStorageKey);
  }

  function applySession(nextToken: string, user: AccountUser): void {
    persist(nextToken);
    account = user;
    closeOverlay();
    onChange();
  }

  async function refresh(): Promise<void> {
    if (!token) {
      account = null;
      return;
    }
    try {
      const { user } = await api.auth.me(token);
      account = user;
    } catch (error) {
      if (error instanceof ApiError && error.message === 'unauthorized') persist('');
      account = null;
    }
  }

  function closeOverlay(): void {
    overlay?.remove();
    overlay = null;
    document.removeEventListener('keydown', onEsc);
  }

  function openOverlay(card: HTMLElement): void {
    closeOverlay();
    overlay = h('div', { class: 'auth-overlay' }, [card]);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeOverlay();
    });
    document.addEventListener('keydown', onEsc);
    document.body.append(overlay);
  }

  function onEsc(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      closeOverlay();
    }
  }

  function card(titleText: string): { root: HTMLElement; body: HTMLElement } {
    const body = h('div', { class: 'auth-body' });
    const close = h('button', { class: 'auth-close', type: 'button', 'aria-label': '关闭' }, ['×']);
    close.addEventListener('click', closeOverlay);
    const root = h('div', { class: 'auth-card', role: 'dialog', 'aria-modal': 'true' }, [
      h('div', { class: 'auth-head' }, [h('strong', {}, [titleText]), close]),
      body
    ]);
    return { root, body };
  }

  function field(label: string, input: HTMLInputElement): HTMLElement {
    return h('label', { class: 'auth-field' }, [h('span', {}, [label]), input]);
  }

  function input(type: string, placeholder: string, attrs: Record<string, string> = {}): HTMLInputElement {
    return h('input', { type, placeholder, ...attrs });
  }

  function googleButton(): HTMLButtonElement {
    const btn = h('button', { class: 'auth-google', type: 'button' }, ['使用 Google 登录']);
    btn.addEventListener('click', openGoogle);
    return btn;
  }

  function openGoogle(): void {
    const width = 460;
    const height = 620;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    googlePopup = window.open(
      api.auth.googleStartUrl(window.location.origin),
      'sicsic-google',
      `width=${width},height=${height},left=${left},top=${top}`
    );
  }

  function onMessage(event: MessageEvent): void {
    if (event.origin !== config.apiOrigin) return;
    const data = event.data as { type?: string; token?: string; error?: string };
    if (!data || (data.type !== 'sicsic-auth' && data.type !== 'sodesu-auth')) return;
    googlePopup?.close();
    googlePopup = null;
    if (data.token) {
      persist(data.token);
      void refresh().then(() => {
        closeOverlay();
        onChange();
      });
    }
  }

  window.addEventListener('message', onMessage);

  // ---- Login / register modal ----------------------------------------------

  function showLogin(): void {
    const { root, body } = card('登录');
    const error = h('p', { class: 'auth-error', role: 'alert' });
    const tabs = h('div', { class: 'auth-tabs' });
    const loginTab = h('button', { class: 'auth-tab active', type: 'button' }, ['登录']);
    const registerTab = h('button', { class: 'auth-tab', type: 'button' }, ['注册']);
    tabs.append(loginTab, registerTab);

    const pane = h('div', { class: 'auth-pane' });
    body.append(tabs, error, pane);

    const showError = (message: string): void => {
      error.textContent = message;
    };

    const renderLogin = (): void => {
      loginTab.classList.add('active');
      registerTab.classList.remove('active');
      showError('');
      const identifier = input('text', '用户名或邮箱', { autocomplete: 'username' });
      const password = input('password', '密码', { autocomplete: 'current-password' });
      const submit = h('button', { class: 'auth-submit', type: 'button' }, ['登录']);
      submit.addEventListener('click', async () => {
        submit.disabled = true;
        showError('');
        try {
          const { token: t, user } = await api.auth.login({ identifier: identifier.value.trim(), password: password.value });
          applySession(t, user);
        } catch (err) {
          showError(messageFor(err));
        } finally {
          submit.disabled = false;
        }
      });
      pane.replaceChildren(field('账号', identifier), field('密码', password), submit, divider(), googleButton());
    };

    const renderRegister = (): void => {
      registerTab.classList.add('active');
      loginTab.classList.remove('active');
      showError('');
      const email = input('email', 'you@example.com', { autocomplete: 'email' });
      const username = input('text', '3–20 位字母 / 数字 / _', { autocomplete: 'username' });
      const password = input('password', '至少 8 位', { autocomplete: 'new-password' });
      const submit = h('button', { class: 'auth-submit', type: 'button' }, ['发送验证码']);
      submit.addEventListener('click', async () => {
        submit.disabled = true;
        showError('');
        try {
          await api.auth.registerStart({
            email: email.value.trim(),
            username: username.value.trim(),
            password: password.value
          });
          renderVerify(email.value.trim());
        } catch (err) {
          showError(messageFor(err));
        } finally {
          submit.disabled = false;
        }
      });
      pane.replaceChildren(field('邮箱', email), field('用户名', username), field('密码', password), submit, divider(), googleButton());
    };

    const renderVerify = (email: string): void => {
      showError('');
      const hint = h('p', { class: 'auth-hint' }, [`验证码已发送至 ${email}，10 分钟内有效。`]);
      const code = input('text', '6 位验证码', { inputmode: 'numeric', maxlength: '6', class: 'auth-code' });
      const submit = h('button', { class: 'auth-submit', type: 'button' }, ['验证并登录']);
      const back = h('button', { class: 'auth-text', type: 'button' }, ['返回修改']);
      back.addEventListener('click', renderRegister);
      submit.addEventListener('click', async () => {
        submit.disabled = true;
        showError('');
        try {
          const { token: t, user } = await api.auth.registerVerify({ email, code: code.value.trim() });
          applySession(t, user);
        } catch (err) {
          showError(messageFor(err));
        } finally {
          submit.disabled = false;
        }
      });
      pane.replaceChildren(hint, field('验证码', code), submit, back);
      code.focus();
    };

    loginTab.addEventListener('click', renderLogin);
    registerTab.addEventListener('click', renderRegister);
    renderLogin();
    openOverlay(root);
  }

  function divider(): HTMLElement {
    return h('div', { class: 'auth-divider' }, [h('span', {}, ['或'])]);
  }

  // ---- Profile -------------------------------------------------------------

  function showProfile(): void {
    if (!account) return;
    const { root, body } = card('我的账户');
    const error = h('p', { class: 'auth-error', role: 'alert' });
    const showError = (m: string): void => {
      error.textContent = m;
    };

    const idLine = h('div', { class: 'auth-id' }, [
      h('strong', {}, [account.displayName]),
      account.email ? h('span', {}, [account.email]) : h('span', { class: 'auth-muted' }, ['未绑定邮箱'])
    ]);

    // Badge picker
    const badgeRow = h('div', { class: 'auth-badges' });
    const renderBadges = (): void => {
      badgeRow.replaceChildren();
      for (const kind of BADGES) {
        const selected = account!.badge === kind;
        const swatch = h('div', { class: 'auth-badge-mark' });
        swatch.innerHTML = kind === 'none' ? '<span class="auth-badge-none">—</span>' : badgeSvg(kind, 26);
        const option = h('button', { class: `auth-badge${selected ? ' selected' : ''}`, type: 'button' }, [
          swatch,
          h('span', {}, [BADGE_LABEL[kind]])
        ]);
        option.addEventListener('click', async () => {
          if (account!.badge === kind) return;
          try {
            await api.auth.setBadge(token, kind);
            account!.badge = kind;
            renderBadges();
            onChange();
          } catch (err) {
            showError(messageFor(err));
          }
        });
        badgeRow.append(option);
      }
    };
    renderBadges();

    // Password
    const passwordSection = h('details', { class: 'auth-section' });
    const newPassword = input('password', account.hasPassword ? '新密码（至少 8 位）' : '设置密码（至少 8 位）', {
      autocomplete: 'new-password'
    });
    const currentPassword = input('password', '当前密码', { autocomplete: 'current-password' });
    const pwSubmit = h('button', { class: 'auth-submit small', type: 'button' }, [account.hasPassword ? '修改密码' : '设置密码']);
    pwSubmit.addEventListener('click', async () => {
      pwSubmit.disabled = true;
      showError('');
      try {
        await api.auth.setPassword(token, {
          currentPassword: account!.hasPassword ? currentPassword.value : undefined,
          newPassword: newPassword.value
        });
        account!.hasPassword = true;
        newPassword.value = '';
        currentPassword.value = '';
        showError('密码已更新');
      } catch (err) {
        showError(messageFor(err));
      } finally {
        pwSubmit.disabled = false;
      }
    });
    passwordSection.append(
      h('summary', {}, [account.hasPassword ? '修改密码' : '设置密码']),
      ...(account.hasPassword ? [field('当前密码', currentPassword)] : []),
      field('新密码', newPassword),
      pwSubmit
    );

    // Email rebind
    const emailSection = h('details', { class: 'auth-section' });
    const newEmail = input('email', '新邮箱', { autocomplete: 'email' });
    const emailCode = input('text', '6 位验证码', { inputmode: 'numeric', maxlength: '6', class: 'auth-code' });
    const codeField = field('验证码', emailCode);
    codeField.hidden = true;
    const emailSend = h('button', { class: 'auth-submit small', type: 'button' }, ['发送验证码']);
    const emailVerify = h('button', { class: 'auth-submit small', type: 'button' }, ['验证并更换']);
    emailVerify.hidden = true;
    emailSend.addEventListener('click', async () => {
      emailSend.disabled = true;
      showError('');
      try {
        await api.auth.emailStart(token, newEmail.value.trim());
        codeField.hidden = false;
        emailVerify.hidden = false;
        showError('验证码已发送至新邮箱');
      } catch (err) {
        showError(messageFor(err));
      } finally {
        emailSend.disabled = false;
      }
    });
    emailVerify.addEventListener('click', async () => {
      emailVerify.disabled = true;
      showError('');
      try {
        const { user } = await api.auth.emailVerify(token, emailCode.value.trim());
        account = user;
        idLine.replaceChildren(
          h('strong', {}, [user.displayName]),
          user.email ? h('span', {}, [user.email]) : h('span', { class: 'auth-muted' }, ['未绑定邮箱'])
        );
        codeField.hidden = true;
        emailVerify.hidden = true;
        newEmail.value = '';
        emailCode.value = '';
        showError('邮箱已更换');
      } catch (err) {
        showError(messageFor(err));
      } finally {
        emailVerify.disabled = false;
      }
    });
    emailSection.append(h('summary', {}, ['更换邮箱']), field('新邮箱', newEmail), emailSend, codeField, emailVerify);

    const logout = h('button', { class: 'auth-text danger', type: 'button' }, ['退出登录']);
    logout.addEventListener('click', async () => {
      try {
        await api.auth.logout(token);
      } catch {
        /* ignore */
      }
      persist('');
      account = null;
      closeOverlay();
      onChange();
    });

    body.append(
      idLine,
      error,
      h('div', { class: 'auth-label' }, ['评论头像标记']),
      badgeRow,
      passwordSection,
      emailSection,
      h('div', { class: 'auth-foot' }, [logout])
    );
    openOverlay(root);
  }

  return {
    account: () => account,
    token: () => token,
    refresh,
    open: () => (account ? showProfile() : showLogin()),
    destroy: () => window.removeEventListener('message', onMessage)
  };
}

export type Auth = ReturnType<typeof createAuth>;
