# Deliverator

One simple web UI for download clients (qBittorrent, SABnzbd), self-hosted in one Docker
container. Built almost entirely with AI coding, directed and reviewed by a human.

## Product rules

- Only features people use often and that make sense across all clients: add, pause/resume,
  delete, reorder, retry, category, throttle. Deep client-specific settings stay in the client.
- Every client feature goes through `ProviderAdapter` and `ProviderCapabilities`
  (`packages/server/src/providers/types.ts`). The UI must hide what a provider cannot do.
- Must work under a sub-path (`BASE_PATH`) and at phone width. Check both for UI changes.
- Themes are entries in `packages/client/src/theme/themes.ts`; never hard-code colours.
- Single admin user, secrets encrypted at rest, nothing leaves the server except via the API.

## Stack

Yarn 4 workspaces (`corepack enable`). `packages/shared` (types, formatting, link detection),
`packages/server` (Node 22, Hono, SQLite via Drizzle, SSE, CLI), `packages/client` (React 19,
Vite, Tailwind v4, TanStack Query, Radix). Docker image from the root `Dockerfile`, published
to GHCR by CI.

## Commands

- `yarn install`, then `yarn mock` (fake qBittorrent and SABnzbd) and `yarn dev`
- `yarn test`, `yarn typecheck`, `yarn build` before pushing
- `yarn cli reset-password`
- `yarn db:generate` after changing `packages/server/src/db/schema.ts`

## Git workflow

- `dev` is the default branch. Branch from it (`feat/…`, `fix/…`) and open a PR into `dev`.
- Releases: merge `dev` into `main`, bump the root `package.json` version, move the
  `Unreleased` section of `CHANGELOG.md` under the new version, tag `vX.Y.Z`, create a GitHub
  release with the changelog entry as notes. Tags publish `latest` and the version image.
- Pushes to `dev` publish the `:dev` image for testing before a release.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):
  `type(scope): subject`, types `feat` `fix` `docs` `chore` `refactor` `test` `ci`, scopes
  `server` `client` `shared` `docker` (optional). Body explains why, not what.
- Every user-visible change gets a line under `Unreleased` in `CHANGELOG.md`
  (Keep a Changelog format: Added / Changed / Fixed / Removed).

## Testing

- Adapter and API tests run against the in-memory mocks in `packages/server/src/mock`.
  Extend the mocks rather than hitting real services. Keep the mocks honest: when a real
  client behaves differently, change the mock first so the test fails, then fix the adapter.
- Real-client behaviour that has bitten us: qBittorrent 5.2 logs in with `204` and a
  `QBT_SID_<port>` cookie; its Host header validation 401s on remapped ports. SABnzbd answers
  `status:false` when deleting from the list an item is not in.
- For UI checks use agent-browser against a built server (`yarn build && yarn start`), at
  desktop and 400px widths, and confirm nothing scrolls horizontally.
