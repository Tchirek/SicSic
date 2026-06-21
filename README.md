# SicSic

SicSic is a public AGPL comment UI, derived from
[BeiyanYunyi/Sodesu v0.5.2](https://github.com/BeiyanYunyi/sodesu) and reshaped
into a focused iframe product for NormalPics, NormalDocs, this blog, and their
Cloudflare Worker/D1 comment APIs.

> **The product is `embed/`.** The repository root keeps the full Sodesu v0.5.2
> source tree (Solid source, Waline-compatible API, docs, exports) for AGPL
> provenance and attribution. This repository is no longer a GitHub fork, but
> BeiyanYunyi's Sodesu remains the named upstream.
>
> **Anonymous comments are the first-class path.** Accounts (login, profile, own
> edit/delete, avatar badge) are an opt-in *backend capability*: the account UI only
> appears when the active backend implements `/api/auth/*` (see `features.auth` /
> `AUTH_BACKENDS` in `embed/src/config.ts`). Hosts whose backend lacks accounts never
> surface a login entry, so anonymous-only deployments stay anonymous-only.

## Lineage

Sodesu had the right small, nimble feeling. SicSic keeps that spirit, the AGPL
license, and the original copyright trail, while narrowing the deployed product
to Markdown comments, replies, likes, optional accounts, and a strict
`postMessage` iframe bridge.

The original source, copyright notices, and AGPL license are kept. Product notes
live in `MODIFICATIONS.md` and `INTEGRATION.md`.
