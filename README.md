# 💬SicSic

SicSic is a small iframe comment UI for NormalPics, NormalDocs, and other
personal sites. The deployable product lives in `embed/`: a Vite-built static UI
served by a Cloudflare Worker.

SicSic 是一个轻量 iframe 评论前端，用于 NormalPics、NormalDocs 和其它个人站点。
可部署产品位于 `embed/`：Vite 构建静态资源，Cloudflare Worker 提供站点与安全响应头。

## Repository

- `embed/` is the production comment UI.
- `src/` keeps the Sodesu-derived package code used by the project.

## Configuration

The public configuration contract is intentionally one flow:

1. Defaults and presets live in `embed/src/config.ts`.
2. Local/build overrides follow `embed/.env.example`; keep real `.env*` files
   untracked.
3. A host page may inject `window.COMMENT_UI_CONFIG` before loading the iframe
   when the same build must serve another site.
4. Worker-only security allowlists stay in `embed/wrangler.toml`, because CSP
   headers belong at the edge, not in the browser runtime.

公共配置顺序如下：

1. 默认值与 preset 在 `embed/src/config.ts`。
2. 本地或构建覆盖参考 `embed/.env.example`；真实 `.env*` 不提交。
3. 同一份 iframe build 需要服务其它站点时，宿主页面可提前注入
   `window.COMMENT_UI_CONFIG`。
4. Worker 的 CSP 与安全 allowlist 留在 `embed/wrangler.toml`，这是边缘响应头配置，
   不是前端运行时配置。

## Build And Deploy

```sh
cd embed
npm install
npm run build
npx wrangler deploy
```

## License And Credits

SicSic includes code and design work derived from
[BeiyanYunyi/Sodesu v0.5.2](https://github.com/BeiyanYunyi/sodesu). Original
copyright notices are retained where required. The project is released under
AGPL-3.0-or-later; see `LICENSE`.

SicSic 基于 [BeiyanYunyi/Sodesu v0.5.2](https://github.com/BeiyanYunyi/sodesu)
修改并保留必要的原作者版权信息。项目按 AGPL-3.0-or-later 发布，详见 `LICENSE`。
