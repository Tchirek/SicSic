# 💬SicSic

SicSic is a small comment UI for NormalPics, NormalDocs and personal sites.
The deployable product lives in `embed/`: one source package with an inline
comment core, optional Passport identity UI, and an independent iframe panel.

SicSic 是用于 NormalPics、NormalDocs 和个人站点的轻量评论前端。
Blog 使用原生内联评论；Pics / Docs 保留原有 iframe 面板外观和交互。

## Repository

- `embed/src/core.ts` mounts anonymous-first comments in a host element.
- `embed/src/passport.ts` loads account/profile features only on identity actions.
- `embed/src/frame.ts` keeps the existing Pics/Docs panel and parent messages.
- Root `src/` retains the Sodesu-derived package code.

Custom avatars and badges remain available and follow current account settings,
including on old comments. Reading comments creates no anonymous viewer ID.
See the [integration contract](embed/INTEGRATION.md) and
[trust model](embed/THREAT_MODEL.md).

## Configuration

Frame presets live in `embed/src/frameConfig.ts`. Optional
`window.COMMENT_UI_CONFIG` belongs inside the iframe document, not on a
cross-origin parent. Explicit values override the preset; Vite environment
values fill unset fields. Inline hosts pass options directly to `core.init()`.

The public checkout includes `embed/wrangler.example.toml`, not production
deployment settings or credentials. Copy it to `embed/wrangler.toml` and set
your own API origins, frame ancestors and routes. Never put secrets in Vite
variables: those values are exposed to browsers.

公共仓库保留源码、公开 preset 和示例配置；生产部署配置与凭据不随源码发布。
头像／徽章功能不裁剪，Blog 与 Pics / Docs 的既有视觉也不重新设计。

## Build and verify

Requires Node.js 22.19 or newer.

```sh
cd embed
npm ci
npm run check
npm test
npm run build
npm run test:budget
```

After configuring your own Worker, `npm run deploy` deploys the frame only.
Every build includes an allowlisted corresponding-source archive, with example
configuration instead of local environment or production deployment files.
Publishing the frame does not deploy Blog or change any backend origin rules.

## License and credits

SicSic includes code and design work derived from
[BeiyanYunyi/Sodesu v0.5.2](https://github.com/BeiyanYunyi/sodesu).
Original copyright notices are retained. The project is released under
AGPL-3.0-or-later; see [LICENSE](LICENSE) and [modifications](embed/MODIFICATIONS.md).

SicSic 基于 BeiyanYunyi/Sodesu v0.5.2 修改并保留原作者版权信息，
继续履行 AGPL 对应源码提供义务。
