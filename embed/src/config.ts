export interface CommentUiFeatures {
  /** Accounts (login, profile, own edit/delete, avatar badge). Requires an auth-capable backend. */
  auth?: boolean;
}

export interface RawCommentUiConfig {
  apiOrigin?: string;
  allowedParentOrigins?: string[] | string;
  sourceRepoUrl?: string;
  upstreamRepoUrl?: string;
  storageNamespace?: string;
  nicknameStorageKey?: string;
  title?: string;
  anonymousNickname?: string;
  features?: CommentUiFeatures;
}

export interface CommentUiConfig {
  apiOrigin: string;
  allowedParentOrigins: Set<string>;
  sourceRepoUrl: string;
  upstreamRepoUrl: string;
  nicknameStorageKey: string;
  commentedImagesStorageKey: string;
  sessionStorageKey: string;
  title: string;
  anonymousNickname: string;
  features: { auth: boolean };
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
// blog's i.am.tchirek.top) never surface a broken login entry.
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
    allowedParentOrigins: ['https://sicnu.docs.tchirek.top'],
    storageNamespace: 'normaldocs_comment_ui',
    title: '评论',
    features: { auth: false }
  },
  iamtchirek: {
    apiOrigin: 'https://i.am.tchirek.top',
    allowedParentOrigins: ['https://i.am.tchirek.top'],
    storageNamespace: 'iamtchirek_comment_ui',
    title: '评论',
    features: { auth: false }
  },
  'iamtchirek-local': {
    apiOrigin: 'http://localhost:4321',
    allowedParentOrigins: ['http://localhost:4321', 'http://127.0.0.1:4321'],
    storageNamespace: 'iamtchirek_local_comment_ui',
    title: '评论',
    features: { auth: false }
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

  // Accounts are a backend capability: an explicit override wins, else the env flag,
  // else only auth-capable backends. Never inferred from "an apiOrigin exists".
  const authOverride = raw.features?.auth;
  const envAuth = runtimeEnv.VITE_COMMENT_AUTH;
  const auth =
    authOverride !== undefined
      ? authOverride
      : envAuth !== undefined
        ? envAuth === 'true'
        : AUTH_BACKENDS.has(apiOrigin);

  return {
    apiOrigin,
    allowedParentOrigins: readOrigins(raw, runtimeEnv),
    sourceRepoUrl: raw.sourceRepoUrl || runtimeEnv.VITE_SOURCE_REPO_URL || DEFAULT_SOURCE_REPO_URL,
    upstreamRepoUrl: raw.upstreamRepoUrl || runtimeEnv.VITE_UPSTREAM_REPO_URL || DEFAULT_UPSTREAM_REPO_URL,
    nicknameStorageKey: raw.nicknameStorageKey || `${storageNamespace}_nickname`,
    commentedImagesStorageKey: `${storageNamespace}_commented_images`,
    sessionStorageKey: `${storageNamespace}_session`,
    title: raw.title || runtimeEnv.VITE_COMMENT_TITLE || '评论',
    anonymousNickname: raw.anonymousNickname || runtimeEnv.VITE_ANONYMOUS_NICKNAME || 'Anonymous',
    features: { auth: Boolean(auth) }
  };
}
