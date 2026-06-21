# SicSic Comment UI Integration

本文记录 `SicSic/embed` 的集成边界、配置入口和维护约束。产品修改总览见
[`MODIFICATIONS.md`](./MODIFICATIONS.md)，NormalPics 全系统交接见：

```text
C:\Users\Tchirek\Desktop\pics\DEVELOPER-HANDOFF-2026-06.md
```

## 部署边界

- 本仓库是独立项目 SicSic；它包含来自 BeiyanYunyi/Sodesu v0.5.2 的代码与设计来源，
  并按 AGPL-3.0 保留原作者署名和版权信息。
- 必须保留原源码版权注释与 `LICENSE`。
- `embed/` 是独立部署的评论产品，不打包进 NormalPics 主前端。
- 线上地址：`https://comments.sicnu.pics.tchirek.top`。
- NormalPics 可在浏览器空闲时预热 iframe，以保证首次点击评论按钮时立即展开。

## 配置入口

前端默认生产值在 `embed/src/config.ts` 的 preset 中；本地覆盖可参考
`embed/.env.example`：

```text
VITE_COMMENT_API_ORIGIN
VITE_ALLOWED_PARENT_ORIGINS
VITE_SOURCE_REPO_URL
VITE_UPSTREAM_REPO_URL
VITE_STORAGE_NAMESPACE
VITE_COMMENT_TITLE
VITE_ANONYMOUS_NICKNAME
```

也可以在宿主页面注入 `window.COMMENT_UI_CONFIG` 覆盖这些值，适合接入非 NormalPics
站点时复用同一套 embed 代码。

Worker 安全响应头通过 `embed/wrangler.toml` 的 `[vars]` 配置：

```text
COMMENT_API_ORIGIN
COMMENT_FRAME_ANCESTORS
COMMENT_IMG_SRC
```

这三项用于生成 CSP，不应散落在业务 TypeScript 中。

## 产品行为

- 无评论附件上传；匿名评论是一等公民。
- 账户为**可选的后端能力**（`features.auth`，见 `embed/src/config.ts` 的 `AUTH_BACKENDS`）：
  仅当后端实现 `/api/auth/*` 时才显示账户入口（登录/注册、邮箱或 Google、改密/改绑邮箱、
  头像徽章、本人编辑一次/删除）。后端不支持账户的宿主（如博客 i.am.tchirek.top）不会暴露登录入口。
- 保留 Markdown/GFM、预览、两级回复、点赞、管理员删除。
- 昵称保存在评论站自身 `localStorage`。
- 未填写昵称时允许发布，展示为 `Anonymous`。
- 单设备昵称三天内最多修改一次，仅触发限制时提示。
- 显示昵称首字头像与标准化操作系统名称。
- 点赞使用心形图标，不显示“喜欢”文字。
- 不提供排序控件。
- 根评论排序：有赞优先、点赞数降序，其余按时间从新到旧。
- 回复按时间从旧到新。
- 底部显示 `Powered by SicSic · derived from BeiyanYunyi/Sodesu v0.5.2`，
  SicSic 链接到当前项目，Sodesu 链接保留原作者署名。

## 与父页面通信

允许父来源由 `VITE_ALLOWED_PARENT_ORIGINS` 或 `window.COMMENT_UI_CONFIG` 定义。

父页面消息：

```text
normalpics:context
normalpics:admin-token
normalpics:drag-channel
normalpics:panel-reset
```

iframe 消息：

```text
comment-ui:ready
comment-ui:loaded
comment-ui:close
comment-ui:request-admin
comment-ui:pull
```

必须严格校验父来源。不要使用 `postMessage(..., "*")`。

父页面 iframe sandbox 必须保留：

```text
allow-scripts
allow-same-origin
allow-popups
allow-popups-to-escape-sandbox
```

后两项用于保证底部 SicSic / Sodesu 仓库链接能正常打开。

## 移动端拖拽

iframe 只识别手势，不移动自身 UI。完整底部抽屉由 NormalPics 父页面移动。

关键实现：

- 高频 `move` 通过 `MessageChannel`。
- `start/end/cancel` 通过普通 `postMessage`。
- 每帧最多发送一次 `move`。
- 使用 `Touch.screenY`，回退到 `clientY`。
- 只有评论列表已到顶部并继续向下拖，才开始拉下面板。
- `overscroll-behavior-y: none` 避免浏览器回弹与底部抽屉竞争手势。

不要把 `transform` 加到 `#app`。这会让 iframe 内容与父页面圆角外壳分离。

## 管理员入口

产品 UI 不显示管理按钮。隐藏触发器请求父页面进行删除 PIN 验证；父页面只在内存中返回管理员 token。

## 构建与部署

```powershell
cd C:\Users\Tchirek\Desktop\comment-ui\embed
npm run build
npx wrangler deploy
```

## 回归

完整集成回归由 NormalPics 执行：

```powershell
cd C:\Users\Tchirek\Desktop\pics\packages\frontend
node scripts/test-selection-print-ui.mjs
```

该测试覆盖 iframe sandbox、SicSic / Sodesu 链接、编辑/预览尺寸、评论面板打开、来源校验、桌面交互、移动拖拽与圆角裁剪。
