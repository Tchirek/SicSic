import './style.css';
import { ApiError, createCommentApi } from './api';
import { readConfig } from './config';
import { commentNickname, renderComments } from './comments';
import { mountApp } from './dom';
import { renderSafeMarkdown } from './markdown';
import { installPanelPull } from './panelPull';
import { createParentBridge } from './parentBridge';
import { createAuth, type Auth } from './auth';
import type { CommentAppState, CommentItem, ParentMessage } from './types';

const appRoot = document.getElementById('app');
if (!appRoot) throw new Error('missing_app_root');

const config = readConfig();
const elements = mountApp(appRoot, config);
const bridge = createParentBridge(config);
let auth: Auth;
const api = createCommentApi(config, {
  viewerId: () => state.viewerId,
  adminToken: () => state.adminToken,
  sessionToken: () => (auth ? auth.token() : '')
});
const panelPull = installPanelPull(elements.app, bridge);
const pendingLikes = new Set<string>();
let editingId = '';
const authEnabled = config.features.auth;

const state: CommentAppState = {
  imageId: '',
  viewerId: '',
  adminToken: '',
  replyTo: null,
  comments: [],
  loadedImageId: '',
  loading: false,
  loadAgain: false,
  loadError: '',
  previewing: false
};

function applyTheme(theme: unknown): void {
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.dataset.theme = theme;
  }
}

function readCommentedImages(): Set<string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(config.commentedImagesStorageKey) || '[]');
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((item): item is string => typeof item === 'string' && item.length > 0));
  } catch {
    return new Set();
  }
}

function hasLocalCommentedImage(imageId: string): boolean {
  return readCommentedImages().has(imageId);
}

function markLocalCommentedImage(imageId: string): void {
  const values = readCommentedImages();
  values.add(imageId);
  const compact = Array.from(values).slice(-500);
  localStorage.setItem(config.commentedImagesStorageKey, JSON.stringify(compact));
}

function formatCooldown(value: number | null): string {
  const milliseconds = Math.max(1_000, value || 0);
  const hours = Math.ceil(milliseconds / 3_600_000);
  return hours >= 24 ? `约 ${Math.ceil(hours / 24)} 天后` : `约 ${hours} 小时后`;
}

function setPreview(visible: boolean): void {
  state.previewing = visible;
  elements.preview.hidden = !visible;
  elements.textarea.hidden = visible;
  elements.previewToggle.textContent = visible ? '编辑' : '预览';
  if (visible) elements.preview.innerHTML = renderSafeMarkdown(elements.textarea.value);
}

function setReplyTarget(item: CommentItem | null): void {
  state.replyTo = item;
  elements.replyTarget.hidden = !item;
  if (item) {
    elements.replyTarget.textContent = `回复 ${commentNickname(item.nickname, config.anonymousNickname)} · 点击取消`;
    elements.textarea.focus();
  }
}

function render(): void {
  renderComments(elements, state, {
    anonymousNickname: config.anonymousNickname,
    adminEnabled: Boolean(state.adminToken),
    accountEnabled: authEnabled,
    apiOrigin: config.apiOrigin,
    editingId,
    onReply: setReplyTarget,
    onLike: (item) => void toggleLike(item),
    onDelete: (item) => void deleteComment(item),
    onEdit: (item) => {
      editingId = item.id;
      render();
    },
    onEditCancel: () => {
      editingId = '';
      render();
    },
    onEditSave: (item, content) => void saveEdit(item, content),
    onAvatarEdit: () => {
      if (authEnabled) auth.open();
    }
  });
}

async function saveEdit(item: CommentItem, content: string): Promise<void> {
  const next = content.trim();
  if (!next) return;
  try {
    await api.editContent(item.id, next);
    editingId = '';
    await load();
  } catch (error) {
    elements.status.textContent =
      error instanceof ApiError && error.message === 'edit_limit' ? '每条评论仅可编辑一次' : '编辑失败';
  }
}

function onAccountChange(): void {
  const account = auth.account();
  if (account) {
    elements.nickname.hidden = true;
    elements.composerIdentity.hidden = false;
    elements.composerIdentity.textContent = `以 ${account.displayName} 发表`;
    elements.accountButton.classList.add('signed-in');
  } else {
    elements.nickname.hidden = false;
    elements.composerIdentity.hidden = true;
    elements.accountButton.classList.remove('signed-in');
  }
  editingId = '';
  void load();
}

async function load(): Promise<void> {
  if (!state.imageId || !state.viewerId) return;
  if (state.loading) {
    state.loadAgain = true;
    return;
  }

  state.loading = true;
  state.loadError = '';
  const requestedImageId = state.imageId;
  elements.status.textContent = '';
  render();

  try {
    const response = await api.list(requestedImageId);
    if (requestedImageId === state.imageId) {
      state.comments = response.items;
      state.loadedImageId = requestedImageId;
    }
    bridge.post({
      type: 'comment-ui:loaded',
      imageId: requestedImageId,
      commentCount: response.items.length,
      commentedByMe: Boolean(response.commentedByMe) || hasLocalCommentedImage(requestedImageId)
    });
  } catch (error) {
    if (requestedImageId === state.imageId) {
      state.loadError = error instanceof Error ? error.message : '加载失败';
      state.loadedImageId = requestedImageId;
    }
    elements.status.textContent = state.loadError || '加载失败';
  } finally {
    state.loading = false;
    render();
    if (state.loadAgain) {
      state.loadAgain = false;
      void load();
    }
  }
}

async function publish(): Promise<void> {
  const account = authEnabled ? auth.account() : null;
  const rawName = account ? '' : elements.nickname.value.replace(/\s+/g, ' ').trim();
  const name = account ? account.displayName : rawName || config.anonymousNickname;
  const content = elements.textarea.value.trim();
  if (!content || !state.imageId || !state.viewerId) return;

  elements.submit.disabled = true;
  elements.status.textContent = '';

  try {
    await api.publish({
      imageId: state.imageId,
      nickname: name,
      content,
      parentId: state.replyTo?.id || null
    });
    markLocalCommentedImage(state.imageId);

    if (!account) {
      if (rawName) localStorage.setItem(config.nicknameStorageKey, rawName);
      else localStorage.removeItem(config.nicknameStorageKey);
    }
    elements.textarea.value = '';
    setReplyTarget(null);
    setPreview(false);
    await load();
  } catch (error) {
    if (error instanceof ApiError && error.message === 'nickname_change_cooldown') {
      elements.status.textContent = `您的昵称近期已修改过，${formatCooldown(error.retryAfterMs)}可再次修改`;
    } else {
      elements.status.textContent =
        error instanceof Error && error.message === 'rate_limited' ? '发送太快，请稍后再试' : '发布失败';
    }
  } finally {
    elements.submit.disabled = false;
  }
}

async function toggleLike(item: CommentItem): Promise<void> {
  if (pendingLikes.has(item.id)) return;
  const previous = { likedByMe: item.likedByMe, likeCount: item.likeCount };
  const nextLiked = !item.likedByMe;
  item.likedByMe = nextLiked;
  item.likeCount = Math.max(0, item.likeCount + (nextLiked ? 1 : -1));
  pendingLikes.add(item.id);
  render();
  try {
    const result = await api.setLike(item.id, nextLiked);
    item.likedByMe = result.likedByMe;
    item.likeCount = result.likeCount;
    render();
  } catch {
    item.likedByMe = previous.likedByMe;
    item.likeCount = previous.likeCount;
    render();
    elements.status.textContent = '操作失败';
  } finally {
    pendingLikes.delete(item.id);
  }
}

async function deleteComment(item: CommentItem): Promise<void> {
  const owner = authEnabled && Boolean(item.ownedByMe);
  if (!owner && !state.adminToken) return;
  if (!window.confirm('删除这条评论？')) return;
  try {
    if (owner) await api.deleteOwn(item.id);
    else await api.delete(item.id);
    await load();
  } catch {
    if (owner) {
      elements.status.textContent = '删除失败';
    } else {
      state.adminToken = '';
      render();
      elements.status.textContent = '验证已失效';
    }
  }
}

function resetForImage(imageId: string): void {
  state.imageId = imageId;
  state.replyTo = null;
  state.comments = [];
  state.loadedImageId = '';
  state.loadError = '';
  elements.replyTarget.hidden = true;
  render();
}

window.addEventListener('message', (event) => {
  if (!bridge.acceptMessage(event)) return;
  const data = event.data as ParentMessage;

  if (data.type === 'normalpics:context' && data.imageId && data.viewerId) {
    const changed = state.imageId !== data.imageId;
    state.viewerId = data.viewerId;
    if (changed) {
      resetForImage(data.imageId);
      void load();
    }
    return;
  }

  if (data.type === 'normalpics:theme') {
    applyTheme(data.theme);
    return;
  }

  if (data.type === 'normalpics:admin-token' && data.token) {
    state.adminToken = data.token;
    render();
    return;
  }

  if (data.type === 'normalpics:drag-channel' && event.ports[0]) {
    bridge.setDragPort(event.ports[0]);
    return;
  }

  if (data.type === 'normalpics:panel-reset') {
    panelPull.reset();
  }
});

elements.closeButton.addEventListener('click', () => bridge.post({ type: 'comment-ui:close' }));

let adminTapCount = 0;
let adminTapTimer = 0;
elements.commentTitle.addEventListener('click', () => {
  adminTapCount += 1;
  window.clearTimeout(adminTapTimer);
  if (adminTapCount >= 5) {
    adminTapCount = 0;
    bridge.post({ type: 'comment-ui:request-admin' });
    return;
  }
  adminTapTimer = window.setTimeout(() => {
    adminTapCount = 0;
  }, 1_500);
});

window.addEventListener('keydown', (event) => {
  if (event.ctrlKey && event.altKey && event.key.toLowerCase() === 'm') {
    event.preventDefault();
    bridge.post({ type: 'comment-ui:request-admin' });
  }
});

elements.replyTarget.addEventListener('click', () => setReplyTarget(null));
elements.previewToggle.addEventListener('click', () => setPreview(!state.previewing));
elements.submit.addEventListener('click', () => void publish());
elements.textarea.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') void publish();
});

if (authEnabled) {
  auth = createAuth({ config, api, onChange: onAccountChange });
  elements.accountButton.addEventListener('click', () => auth.open());
  void auth.refresh().then(() => {
    const account = auth.account();
    if (account) {
      elements.nickname.hidden = true;
      elements.composerIdentity.hidden = false;
      elements.composerIdentity.textContent = `以 ${account.displayName} 发表`;
      elements.accountButton.classList.add('signed-in');
      if (state.imageId) void load();
    }
  });
} else {
  elements.accountButton.hidden = true;
}

bridge.post({ type: 'comment-ui:ready' });
