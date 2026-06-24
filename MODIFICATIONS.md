# Changes / 修改摘要

SicSic is derived from BeiyanYunyi/Sodesu v0.5.2 and keeps the upstream AGPL
license obligations. This file summarizes the product-level changes.

SicSic 基于 BeiyanYunyi/Sodesu v0.5.2 修改，并继续遵守上游 AGPL 协议要求。本文只保留
产品级修改摘要。

## Current Product / 当前产品

- `embed/` is the deployed iframe comment product.
- Markdown/GFM preview, replies, likes, and admin deletion are kept.
- Attachment upload is removed.
- Anonymous commenting remains the default path.
- Accounts are optional and only appear for auth-capable backends.
- Root comments are ranked by liked status, like count, then recency.
- Runtime integration uses strict `postMessage` origin checks.
- Footer attribution is `Powered by SicSic`, while upstream Sodesu attribution is
  retained in source and license material.

- `embed/` 是实际部署的 iframe 评论产品。
- 保留 Markdown/GFM 预览、回复、点赞和管理员删除。
- 移除评论附件上传。
- 匿名评论仍是默认路径。
- 账户能力可选，只有支持认证的后端才显示账户入口。
- 根评论按是否被赞、点赞数、时间排序。
- 运行时集成严格校验 `postMessage` 来源。
- 页脚显示 `Powered by SicSic`；上游 Sodesu 署名保留在源码与协议材料中。
