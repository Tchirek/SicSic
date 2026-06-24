import type { CommentUiConfig } from './config';

export interface CommentElements {
  app: HTMLElement;
  commentTitle: HTMLElement;
  nickname: HTMLInputElement;
  textarea: HTMLTextAreaElement;
  preview: HTMLElement;
  replyTarget: HTMLElement;
  status: HTMLElement;
  list: HTMLElement;
  submit: HTMLButtonElement;
  previewToggle: HTMLButtonElement;
  closeButton: HTMLButtonElement;
  accountButton: HTMLButtonElement;
  composerIdentity: HTMLElement;
}

function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`missing_element:${selector}`);
  return element;
}

export function mountApp(app: HTMLElement, config: CommentUiConfig): CommentElements {
  app.innerHTML = `
    <header>
      <strong class="comment-title"></strong>
      <div class="header-actions">
        <button class="icon-button account" type="button" aria-label="账户">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12.8a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 1.6c-3.3 0-8 1.7-8 5v1.2h16v-1.2c0-3.3-4.7-5-8-5Z"/></svg>
        </button>
        <button class="icon-button close" type="button" aria-label="关闭">×</button>
      </div>
    </header>
    <section class="composer">
      <input class="nickname" maxlength="32" autocomplete="nickname" placeholder="昵称">
      <div class="composer-identity" hidden></div>
      <div class="reply-target" hidden></div>
      <div class="editor-surface">
        <textarea maxlength="2000" placeholder="写下评论，支持 Markdown"></textarea>
        <div class="preview markdown" hidden></div>
      </div>
      <div class="composer-actions">
        <button class="text-button preview-toggle" type="button">预览</button>
        <span class="status" role="status"></span>
        <button class="submit" type="button">发布</button>
      </div>
    </section>
    <section class="comment-list" aria-live="polite"></section>
    <footer>
      Powered by <a class="source-link" target="_blank" rel="noreferrer">SicSic v0.1.0</a>
    </footer>
  `;

  const elements: CommentElements = {
    app,
    commentTitle: requireElement(app, '.comment-title'),
    nickname: requireElement(app, '.nickname'),
    textarea: requireElement(app, 'textarea'),
    preview: requireElement(app, '.preview'),
    replyTarget: requireElement(app, '.reply-target'),
    status: requireElement(app, '.status'),
    list: requireElement(app, '.comment-list'),
    submit: requireElement(app, '.submit'),
    previewToggle: requireElement(app, '.preview-toggle'),
    closeButton: requireElement(app, '.close'),
    accountButton: requireElement(app, '.account'),
    composerIdentity: requireElement(app, '.composer-identity')
  };

  elements.commentTitle.textContent = config.title;
  elements.nickname.value = localStorage.getItem(config.nicknameStorageKey) || '';
  requireElement<HTMLAnchorElement>(app, '.source-link').href = config.sourceRepoUrl;
  return elements;
}
