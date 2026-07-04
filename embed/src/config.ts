export interface CommentUiFeatures {
  /** Accounts (login, profile, own edit/delete, avatar badge). Requires an auth-capable backend. */
  auth?: boolean;
}

export interface RawCommentUiConfig {
  apiOrigin?: string;
  /** Central account service. Auth requests (/api/auth/*) and avatar URLs go
   *  here, while comments still go to the site's own apiOrigin. All sites
   *  share one authOrigin → one login works everywhere (the iframe origin is
   *  identical across sites, so the stored session is naturally shared).
   *  Defaults to apiOrigin (the classic single-backend setup). */
  authOrigin?: string;
  allowedParentOrigins?: string[] | string;
  sourceRepoUrl?: string;
  upstreamRepoUrl?: string;
  storageNamespace?: string;
  nicknameStorageKey?: string;
  title?: string;
  anonymousNickname?: string;
  features?: CommentUiFeatures;
  /** Show the built-in title text in the header. Turn off when the host page
   *  already renders its own comments heading (avoids a duplicate title). */
  showTitle?: boolean;
  /** Show the header close (×) button. Turn off for inline embeds where there
   *  is nothing to close (only meaningful for modal/panel hosts). */
  showClose?: boolean;
  /** Let scrolling chain out of the iframe to the host page (native browser
   *  scroll physics). Turn on for inline embeds; keep off for panel hosts,
   *  where the page behind the panel must not scroll. Also disables the
   *  panel pull-to-close touch gesture, which only makes sense in a panel. */
  scrollChaining?: boolean;
}

export interface CommentUiConfig {
  apiOrigin: string;
  authOrigin: string;
  allowedParentOrigins: Set<string>;
  sourceRepoUrl: string;
  upstreamRepoUrl: string;
  nicknameStorageKey: string;
  commentedImagesStorageKey: string;
  discloseOsStorageKey: string;
  /** Shared per-authOrigin so one login covers every embedding site. */
  sessionStorageKey: string;
  /** Old per-preset key; migrated from once so existing logins survive. */
  legacySessionStorageKey: string;
  title: string;
  anonymousNickname: string;
  features: { auth: boolean };
  showTitle: boolean;
  showClose: boolean;
  scrollChaining: boolean;
}

declare global {
  interface Window {
    COMMENT_UI_CONFIG?: RawCommentUiConfig;
  }
}

const DEFAULT_STORAGE_NAMESPACE = 'comment_ui';
const DEFAULT_SOURCE_REPO_URL = 'https://github.com/Tchirek/SicSic';
const DEFAULT_UPSTREAM_REPO_URL = 'https://github.com/BeiyanYunyi/sodesu';

// Backends known to implement /api/auth/*. The account UI only appears when the
// active backend is auth-capable, so hosts whose backend lacks accounts (e.g. the
// blog's blog.tchirek.top) never surface a broken login entry.
const AUTH_BACKENDS = new Set(['https://api.pics.tchirek.top']);

const PRESETS: Record<string, RawCommentUiConfig & { storageNamespace?: string }> = {
  normalpics: {
    apiOrigin: 'https://api.pics.tchirek.top',
    allowedParentOrigins: ['https://sicnu.pics.tchirek.top', 'https://photohost-frontend.pages.dev'],
    storageNamespace: 'normalpics_comment',
    title: '评论',
    features: { auth: true }
  },
  normaldocs: {
    apiOrigin: 'https://api.docs.tchirek.top',
    authOrigin: 'https://api.pics.tchirek.top',
    allowedParentOrigins: ['https://sicnu.docs.tchirek.top'],
    storageNamespace: 'normaldocs_comment_ui',
    title: '评论',
    features: { auth: true }
  },
  iamtchirek: {
    apiOrigin: 'https://blog.tchirek.top',
    authOrigin: 'https://api.pics.tchirek.top',
    allowedParentOrigins: ['https://blog.tchirek.top'],
    storageNamespace: 'iamtchirek_comment_ui',
    title: '评论',
    features: { auth: true },
    // Inline embed: keep the iframe title, but there is no panel to close, and
    // scrolling should chain out to the blog page natively.
    showTitle: true,
    showClose: false,
    scrollChaining: true
  },
  'iamtchirek-local': {
    apiOrigin: 'http://localhost:4321',
    authOrigin: 'https://api.pics.tchirek.top',
    allowedParentOrigins: ['http://localhost:4321', 'http://127.0.0.1:4321'],
    storageNamespace: 'iamtchirek_local_comment_ui',
    title: '评论',
    features: { auth: true },
    showTitle: true,
    showClose: false,
    scrollChaining: true
  },
  // Like `iamtchirek` but lets the blog's local dev server (localhost:4321) embed
  // this deployed iframe while still talking to the live API — so `npm run dev`
  // on the blog shows real comments without running comment-ui locally.
  'iamtchirek-dev': {
    apiOrigin: 'https://blog.tchirek.top',
    authOrigin: 'https://api.pics.tchirek.top',
    allowedParentOrigins: ['http://localhost:4321', 'http://127.0.0.1:4321'],
    storageNamespace: 'iamtchirek_dev_comment_ui',
    title: '评论',
    features: { auth: true },
    showTitle: true,
    showClose: false,
    scrollChaining: true
  }
};

function env(): Record<string, string | undefined> {
  return ((import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {});
}

function splitList(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function normalizeApiOrigin(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '/') return '';
  if (trimmed.startsWith('/')) return trimmed.replace(/\/+$/, '');
  return trimmed.replace(/\/+$/, '');
}

function readOrigins(raw: RawCommentUiConfig, runtimeEnv: Record<string, string | undefined>): Set<string> {
  const configured = splitList(raw.allowedParentOrigins);
  const fromEnv = splitList(runtimeEnv.VITE_ALLOWED_PARENT_ORIGINS);
  const origins = configured.length > 0 ? configured : fromEnv;
  return new Set(origins.map(normalizeOrigin).filter((origin): origin is string => Boolean(origin)));
}

export function readConfig(): CommentUiConfig {
  const runtimeEnv = env();
  const presetName = new URLSearchParams(window.location.search).get('preset') || 'normalpics';
  const preset = PRESETS[presetName] || {};
  const raw = { ...preset, ...(window.COMMENT_UI_CONFIG ?? {}) };
  const storageNamespace = raw.storageNamespace || runtimeEnv.VITE_STORAGE_NAMESPACE || DEFAULT_STORAGE_NAMESPACE;
  const apiOrigin = normalizeApiOrigin(raw.apiOrigin || runtimeEnv.VITE_COMMENT_API_ORIGIN || '');
  // Accounts live on the central auth service; sites without their own account
  // backend point authOrigin at it and keep comments on their own apiOrigin.
  const authOrigin = normalizeApiOrigin(raw.authOrigin || runtimeEnv.VITE_COMMENT_AUTH_ORIGIN || '') || apiOrigin;

  // Accounts are a backend capability: an explicit override wins, else the env flag,
  // else only auth-capable backends. Never inferred from "an apiOrigin exists".
  const authOverride = raw.features?.auth;
  const envAuth = runtimeEnv.VITE_COMMENT_AUTH;
  const auth =
    authOverride !== undefined
      ? authOverride
      : envAuth !== undefined
        ? envAuth === 'true'
        : AUTH_BACKENDS.has(authOrigin);

  return {
    apiOrigin,
    authOrigin,
    allowedParentOrigins: readOrigins(raw, runtimeEnv),
    sourceRepoUrl: raw.sourceRepoUrl || runtimeEnv.VITE_SOURCE_REPO_URL || DEFAULT_SOURCE_REPO_URL,
    upstreamRepoUrl: raw.upstreamRepoUrl || runtimeEnv.VITE_UPSTREAM_REPO_URL || DEFAULT_UPSTREAM_REPO_URL,
    nicknameStorageKey: raw.nicknameStorageKey || `${storageNamespace}_nickname`,
    commentedImagesStorageKey: `${storageNamespace}_commented_images`,
    discloseOsStorageKey: `${storageNamespace}_disclose_os`,
    // One session per auth service, shared by every preset that points at it —
    // the iframe origin is the same on all sites, so this is what makes a
    // single login work across normalpics / normaldocs / the blog.
    sessionStorageKey: authOrigin ? `comment_ui_session@${authOrigin}` : `${storageNamespace}_session`,
    legacySessionStorageKey: `${storageNamespace}_session`,
    title: raw.title || runtimeEnv.VITE_COMMENT_TITLE || '评论',
    anonymousNickname: raw.anonymousNickname || runtimeEnv.VITE_ANONYMOUS_NICKNAME || 'Anonymous',
    features: { auth: Boolean(auth) },
    // Default on; a host that renders its own chrome opts out per preset.
    showTitle: raw.showTitle !== false,
    showClose: raw.showClose !== false,
    // Default off: panel hosts rely on the page behind them staying put.
    scrollChaining: raw.scrollChaining === true
  };
}
