# Integration / 集成

This file describes the iframe integration contract between SicSic and a host
page.

本文记录 SicSic iframe 与宿主页面之间的接入约定。

## Runtime Shape / 运行方式

- Deploy `embed/` independently from the host app.
- Load SicSic in an iframe and pass page context with `postMessage`.
- Keep anonymous comments usable even when account APIs are unavailable.
- Show account UI only for backends that implement `/api/auth/*`.

- `embed/` 独立部署，不打包进宿主前端。
- 宿主页面通过 iframe 加载 SicSic，并用 `postMessage` 传递页面上下文。
- 后端不支持账户时，匿名评论仍是默认路径。
- 只有后端实现 `/api/auth/*` 时才显示账户入口。

## Configuration / 配置

Use the same precedence described in `README.md`:

1. `embed/src/config.ts` presets and defaults.
2. Vite env values based on `embed/.env.example`.
3. Optional `window.COMMENT_UI_CONFIG` from the host page.
4. Worker CSP values in `embed/wrangler.toml`.

配置优先级同 `README.md`：`embed/src/config.ts` 默认值和 preset、基于
`embed/.env.example` 的 Vite 环境变量、可选的宿主页面
`window.COMMENT_UI_CONFIG`、以及 `embed/wrangler.toml` 中的 Worker CSP 配置。

Add another configuration entry point only when the runtime has a concrete need
for it.

只有运行时确实需要时，才增加新的配置入口。

## Messages / 消息

Parent to iframe:

```text
normalpics:context
normalpics:admin-token
normalpics:drag-channel
normalpics:panel-reset
```

Iframe to parent:

```text
comment-ui:ready
comment-ui:loaded
comment-ui:close
comment-ui:request-admin
comment-ui:pull
```

Both sides must validate origins. Do not use `postMessage(..., "*")`.

双方都必须校验 origin，不使用 `postMessage(..., "*")`。

## Iframe Sandbox / iframe sandbox

```text
allow-scripts
allow-same-origin
allow-popups
allow-popups-to-escape-sandbox
```

The popup flags keep the SicSic and upstream Sodesu repository links usable.

后两项用于保证 SicSic 与上游 Sodesu 仓库链接可正常打开。
