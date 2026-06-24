# SicSic

SicSic is a compact iframe comment UI deployed from `embed/` as a Cloudflare
Worker-backed static app.

SicSic 是从 `embed/` 独立部署的轻量 iframe 评论前端，由 Cloudflare Worker 提供静态资源和
安全响应头。

## Configuration / 配置

Configuration has one documented order:

1. `embed/src/config.ts` presets and defaults.
2. Vite env overrides, using `embed/.env.example` as the template.
3. Optional host-page `window.COMMENT_UI_CONFIG`.
4. Worker CSP allowlists in `embed/wrangler.toml`.

配置只有一个公开顺序：`embed/src/config.ts` 默认值与 preset、基于
`embed/.env.example` 的 Vite 环境变量、可选宿主页面 `window.COMMENT_UI_CONFIG`、
以及 `embed/wrangler.toml` 中的 Worker CSP allowlist。

## Build / 构建

```sh
cd embed
npm install
npm run build
```

## Deploy / 部署

```sh
cd embed
npx wrangler deploy
```

## Provenance / 来源

SicSic includes work derived from
[BeiyanYunyi/Sodesu v0.5.2](https://github.com/BeiyanYunyi/sodesu). Upstream
copyright notices and AGPL-3.0-or-later license obligations are retained.

SicSic 基于 [BeiyanYunyi/Sodesu v0.5.2](https://github.com/BeiyanYunyi/sodesu)
修改，保留上游版权信息与 AGPL-3.0-or-later 协议义务。
