import type { CommentUiConfig } from './config';
import type { AccountUser, BadgeKind, CommentItem } from './types';

export class ApiError extends Error {
  readonly retryAfterMs: number | null;

  constructor(message: string, retryAfterMs?: number) {
    super(message);
    this.name = 'ApiError';
    this.retryAfterMs = Number.isFinite(retryAfterMs) ? Number(retryAfterMs) : null;
  }
}

interface ApiContext {
  viewerId: () => string;
  adminToken: () => string;
  sessionToken: () => string;
}

interface CommentPublishPayload {
  imageId: string;
  nickname: string;
  content: string;
  parentId: string | null;
}

function joinUrl(origin: string, path: string): string {
  if (!origin) return path;
  return `${origin}${path}`;
}

async function parseJson<T>(response: Response): Promise<T & { error?: string; retryAfterMs?: number }> {
  const text = await response.text();
  if (!text) return {} as T & { error?: string; retryAfterMs?: number };
  try {
    return JSON.parse(text) as T & { error?: string; retryAfterMs?: number };
  } catch {
    return {} as T & { error?: string; retryAfterMs?: number };
  }
}

export function createCommentApi(config: CommentUiConfig, context: ApiContext) {
  /** Session bearer for signed-in actions; falls back to the admin token only when asked. */
  function headers(includeAdmin = false): HeadersInit {
    const result: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Viewer-Id': context.viewerId()
    };
    const session = context.sessionToken();
    if (session) result.Authorization = `Bearer ${session}`;
    else if (includeAdmin && context.adminToken()) result.Authorization = `Bearer ${context.adminToken()}`;
    return result;
  }

  function adminHeaders(): HeadersInit {
    const result: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Viewer-Id': context.viewerId()
    };
    if (context.adminToken()) result.Authorization = `Bearer ${context.adminToken()}`;
    return result;
  }

  function authHeaders(token: string): HeadersInit {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  }

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(joinUrl(config.apiOrigin, path), init);
    const body = await parseJson<T>(response);
    if (!response.ok) throw new ApiError(body.error || `request_${response.status}`, body.retryAfterMs);
    return body;
  }

  const auth = {
    registerStart(payload: { email: string; username: string; password: string }): Promise<unknown> {
      return request('/api/auth/register/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    },
    registerVerify(payload: { email: string; code: string }): Promise<{ token: string; user: AccountUser }> {
      return request('/api/auth/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    },
    login(payload: { identifier: string; password: string }): Promise<{ token: string; user: AccountUser }> {
      return request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    },
    resetStart(email: string): Promise<unknown> {
      return request('/api/auth/reset/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
    },
    resetVerify(payload: { email: string; code: string; password: string }): Promise<{ token: string; user: AccountUser }> {
      return request('/api/auth/reset/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    },
    me(token: string): Promise<{ user: AccountUser }> {
      return request('/api/auth/me', { headers: authHeaders(token) });
    },
    logout(token: string): Promise<unknown> {
      return request('/api/auth/logout', { method: 'POST', headers: authHeaders(token), body: '{}' });
    },
    setPassword(token: string, payload: { currentPassword?: string; newPassword: string }): Promise<unknown> {
      return request('/api/auth/password', { method: 'POST', headers: authHeaders(token), body: JSON.stringify(payload) });
    },
    emailStart(token: string, newEmail: string): Promise<unknown> {
      return request('/api/auth/email/start', { method: 'POST', headers: authHeaders(token), body: JSON.stringify({ newEmail }) });
    },
    emailVerify(token: string, code: string): Promise<{ user: AccountUser }> {
      return request('/api/auth/email/verify', { method: 'POST', headers: authHeaders(token), body: JSON.stringify({ code }) });
    },
    setBadge(token: string, badge: BadgeKind): Promise<{ badge: BadgeKind }> {
      return request('/api/auth/badge', { method: 'POST', headers: authHeaders(token), body: JSON.stringify({ badge }) });
    },
    uploadAvatar(token: string, file: Blob): Promise<{ avatar: string }> {
      return request('/api/auth/avatar', {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'image/webp', Authorization: `Bearer ${token}` },
        body: file
      });
    },
    removeAvatar(token: string): Promise<unknown> {
      return request('/api/auth/avatar', { method: 'DELETE', headers: authHeaders(token) });
    },
    googleStart(origin: string, state?: string): Promise<{ url: string; state: string }> {
      const query = `mode=json&origin=${encodeURIComponent(origin)}${state ? `&state=${encodeURIComponent(state)}` : ''}`;
      return request(`/api/auth/google/start?${query}`);
    },
    async googleResult(state: string): Promise<{ pending?: boolean; token?: string; user?: AccountUser; error?: string }> {
      const response = await fetch(joinUrl(config.apiOrigin, `/api/auth/google/result?state=${encodeURIComponent(state)}`));
      const body = await parseJson<{ pending?: boolean; token?: string; user?: AccountUser; error?: string }>(response);
      if (response.status === 202) return body;
      if (!response.ok) throw new ApiError(body.error || `request_${response.status}`, body.retryAfterMs);
      return body;
    },
    googleStartUrl(origin: string, state?: string): string {
      const query = `origin=${encodeURIComponent(origin)}${state ? `&state=${encodeURIComponent(state)}` : ''}`;
      return joinUrl(config.apiOrigin, `/api/auth/google/start?${query}`);
    }
  };

  return {
    auth,

    list(imageId: string): Promise<{ items: CommentItem[]; commentedByMe?: boolean }> {
      return request<{ items: CommentItem[]; commentedByMe?: boolean }>(
        `/api/comment?imageId=${encodeURIComponent(imageId)}`,
        { headers: headers() }
      );
    },

    publish(payload: CommentPublishPayload): Promise<unknown> {
      return request('/api/comment', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(payload)
      });
    },

    editContent(commentId: string, content: string): Promise<CommentItem> {
      return request<CommentItem>(`/api/comment/${encodeURIComponent(commentId)}/content`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ content })
      });
    },

    setLike(commentId: string, liked: boolean): Promise<{ likedByMe: boolean; likeCount: number }> {
      return request<{ likedByMe: boolean; likeCount: number }>(`/api/comment/${encodeURIComponent(commentId)}`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ liked })
      });
    },

    deleteOwn(commentId: string): Promise<unknown> {
      return request(`/api/comment/${encodeURIComponent(commentId)}`, {
        method: 'DELETE',
        headers: headers()
      });
    },

    delete(commentId: string): Promise<unknown> {
      return request(`/api/comment/${encodeURIComponent(commentId)}`, {
        method: 'DELETE',
        headers: adminHeaders()
      });
    }
  };
}
