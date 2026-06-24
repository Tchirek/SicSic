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

/** Decode, downscale to a square-ish max edge, and re-encode (WebP, JPEG fallback). */
async function compressImage(file: Blob, max = 256, quality = 0.85): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  } catch {
    bitmap = await createImageBitmap(file);
  }
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('canvas_unavailable');
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const webp = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
  if (webp) return webp;
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode_failed'))), 'image/jpeg', quality)
  );
}

export function createAuth({ config, api, onChange }: AuthOptions) {
  let token = localStorage.getItem(config.sessionStorageKey) || '';
  let account: AccountUser | null = null;
  let overlay: HTMLElement | null = null;
  let googlePopup: Window | null = null;
  let googlePoll = 0;
  let authError: ((message: string) => void) | null = null;

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

  function googleIcon(): HTMLElement {
    return h('span', { class: 'auth-google-mark', 'aria-hidden': 'true', html: [
      '<svg viewBox="0 0 18 18">',
      '<path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.56 2.7-3.86 2.7-6.62Z"/>',
      '<path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.58-5.05-3.72H.96v2.33A9 9 0 0 0 9 18Z"/>',
      '<path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.66 9c0-.59.1-1.16.29-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.03l2.99-2.33Z"/>',
      '<path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A8.65 8.65 0 0 0 9 0 9 9 0 0 0 .96 4.97L3.95 7.3C4.66 5.16 6.65 3.58 9 3.58Z"/>',
      '</svg>'
    ].join('') });
  }

  function googleButton(): HTMLButtonElement {
    const btn = h('button', { class: 'auth-google', type: 'button' }, [googleIcon(), h('span', {}, ['使用 Google 登录'])]);
    btn.addEventListener('click', () => void openGoogle());
    return btn;
  }

  function stopGooglePoll(): void {
    if (googlePoll) window.clearInterval(googlePoll);
    googlePoll = 0;
  }

  function finishGoogle(data: { token?: string; user?: AccountUser; error?: string }): void {
    stopGooglePoll();
    googlePopup?.close();
    googlePopup = null;
    if (data.error) {
      authError?.(ERROR_TEXT[data.error] || 'Google 登录失败，请重试');
      return;
    }
    if (data.token && data.user) {
      applySession(data.token, data.user);
      return;
    }
    if (data.token) {
      persist(data.token);
      void refresh().then(() => {
        if (account) {
          closeOverlay();
          onChange();
        } else {
          authError?.('登录已创建，请稍后重试');
        }
      });
    }
  }

  function pollGoogle(state: string): void {
    stopGooglePoll();
    let attempts = 0;
    googlePoll = window.setInterval(() => {
      attempts += 1;
      if (attempts > 75) {
        stopGooglePoll();
        authError?.('Google 登录超时，请重试');
        return;
      }
      void api.auth.googleResult(state).then((data) => {
        if (!data.pending) finishGoogle(data);
      }).catch(() => undefined);
    }, 1200);
  }

  function openGoogle(): void {
    const width = 460;
    const height = 620;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    const state = crypto.randomUUID();
    stopGooglePoll();
    // window.open can return null (opener severed by COOP / sandbox / cross-origin)
    // even when the popup actually opens. So we never treat null as failure: the
    // /api/auth/google/result poll is the source of truth and reports a timeout if
    // nothing comes back. (Hard-failing on null here previously skipped the poll, so
    // a successful Google login was never collected.)
    googlePopup = window.open(
      api.auth.googleStartUrl(window.location.origin, state),
      'sicsic-google',
      `width=${width},height=${height},left=${left},top=${top}`
    );
    pollGoogle(state);
  }

  function onMessage(event: MessageEvent): void {
    if (event.origin !== config.apiOrigin) return;
    const data = event.data as { type?: string; token?: string; user?: AccountUser; error?: string };
    if (!data || (data.type !== 'sicsic-auth' && data.type !== 'sodesu-auth')) return;
    finishGoogle(data);
  }

  window.addEventListener('message', onMessage);

  // ---- Login / register modal ----------------------------------------------

  function showLogin(): void {
    const { root, body } = card('登录');
    root.classList.add('auth-entry-card');
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
    authError = showError;

    const renderLogin = (): void => {
      loginTab.classList.add('active');
      registerTab.classList.remove('active');
      showError('');
      const identifier = input('text', '用户名或邮箱', { autocomplete: 'username' });
      const password = input('password', '密码', { autocomplete: 'current-password' });
      const submit = h('button', { class: 'auth-submit', type: 'button' }, ['登录']);
      const reset = h('button', { class: 'auth-text auth-reset', type: 'button' }, ['忘记密码？']);
      reset.addEventListener('click', renderResetStart);
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
      pane.replaceChildren(field('账号', identifier), field('密码', password), h('div', { class: 'auth-row' }, [reset]), submit, divider(), googleButton());
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
      pane.replaceChildren(field('邮箱', email), field('用户名', username), field('密码', password), submit);
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

    const renderResetStart = (): void => {
      loginTab.classList.add('active');
      registerTab.classList.remove('active');
      showError('');
      const email = input('email', 'you@example.com', { autocomplete: 'email' });
      const submit = h('button', { class: 'auth-submit', type: 'button' }, ['发送验证码']);
      const back = h('button', { class: 'auth-text', type: 'button' }, ['返回登录']);
      back.addEventListener('click', renderLogin);
      submit.addEventListener('click', async () => {
        submit.disabled = true;
        showError('');
        try {
          await api.auth.resetStart(email.value.trim());
          renderResetVerify(email.value.trim());
        } catch (err) {
          showError(messageFor(err));
        } finally {
          submit.disabled = false;
        }
      });
      pane.replaceChildren(h('p', { class: 'auth-hint' }, ['输入注册邮箱，验证码将发送到该邮箱。']), field('邮箱', email), submit, back);
    };

    const renderResetVerify = (email: string): void => {
      showError('');
      const hint = h('p', { class: 'auth-hint' }, [`验证码已发送至 ${email}，10 分钟内有效。`]);
      const code = input('text', '6 位验证码', { inputmode: 'numeric', maxlength: '6', class: 'auth-code' });
      const password = input('password', '新密码（至少 8 位）', { autocomplete: 'new-password' });
      const submit = h('button', { class: 'auth-submit', type: 'button' }, ['重置并登录']);
      const back = h('button', { class: 'auth-text', type: 'button' }, ['返回修改']);
      back.addEventListener('click', renderResetStart);
      submit.addEventListener('click', async () => {
        submit.disabled = true;
        showError('');
        try {
          const { token: t, user } = await api.auth.resetVerify({ email, code: code.value.trim(), password: password.value });
          applySession(t, user);
        } catch (err) {
          showError(messageFor(err));
        } finally {
          submit.disabled = false;
        }
      });
      pane.replaceChildren(hint, field('验证码', code), field('新密码', password), submit, back);
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

    // Avatar — sits left of the name/email; click to upload, hover shows "编辑".
    // The image is downscaled + re-encoded in the browser, so almost any image is accepted.
    const fileInput = h('input', { type: 'file', accept: 'image/*', class: 'auth-file' }) as HTMLInputElement;
    const avatarMedia = h('span', { class: 'auth-avatar-media' });
    const renderAvatar = (): void => {
      avatarMedia.replaceChildren();
      if (account!.avatar) {
        avatarMedia.append(h('img', { src: config.apiOrigin + account!.avatar, alt: '' }));
      } else {
        avatarMedia.append(h('span', { class: 'auth-avatar-fallback' }, [Array.from(account!.displayName)[0] || '?']));
      }
    };
    renderAvatar();
    const avatarEdit = h(
      'button',
      { class: 'auth-avatar-edit', type: 'button', 'aria-label': '编辑头像', title: '编辑' },
      [avatarMedia, h('span', { class: 'auth-avatar-hint' }, ['编辑'])]
    );
    avatarEdit.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      fileInput.value = '';
      if (!file) return;
      if (file.size > 20 * 1024 * 1024) {
        showError('图片太大了');
        return;
      }
      showError('');
      void (async () => {
        try {
          const blob = await compressImage(file);
          const res = await api.auth.uploadAvatar(token, blob);
          account!.avatar = res.avatar;
          renderAvatar();
          onChange();
        } catch (err) {
          showError(messageFor(err));
        }
      })();
    });
    const identityRow = h('div', { class: 'auth-identity' }, [avatarEdit, idLine, fileInput]);

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
        option.addEventListener('click', () => {
          if (account!.badge === kind) return;
          const previous = account!.badge;
          account!.badge = kind; // optimistic: reflect immediately
          renderBadges();
          onChange();
          void api.auth.setBadge(token, kind).catch((err) => {
            account!.badge = previous; // revert on failure
            renderBadges();
            onChange();
            showError(messageFor(err));
          });
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
      identityRow,
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
