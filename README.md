# SicSic

SicSic is an independent AGPL iframe comment UI for NormalPics, NormalDocs,
this blog, and their Cloudflare Worker/D1 comment APIs.

> **The product is `embed/`.** SicSic is not a GitHub fork and does not present
> itself as Sodesu. It carries code and ideas derived from
> [BeiyanYunyi/Sodesu v0.5.2](https://github.com/BeiyanYunyi/sodesu), with the
> original copyright and AGPL attribution kept in place.
>
> **Anonymous comments are the first-class path.** Accounts (login, profile, own
> edit/delete, avatar badge) are an opt-in *backend capability*: the account UI only
> appears when the active backend implements `/api/auth/*` (see `features.auth` /
> `AUTH_BACKENDS` in `embed/src/config.ts`). Hosts whose backend lacks accounts never
> surface a login entry, so anonymous-only deployments stay anonymous-only.

## Lineage

SicSic is its own project. Its historical source includes BeiyanYunyi/Sodesu
v0.5.2, whose copyright notices and AGPL license remain visible and respected.
The deployed product is narrowed to Markdown comments, replies, likes, optional
accounts, and a strict `postMessage` iframe bridge.

The original source, copyright notices, and AGPL license are kept. Product notes
live in `MODIFICATIONS.md` and `INTEGRATION.md`.
