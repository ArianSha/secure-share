# Secure Share

A local sharing workspace with public Cloudflare links and Jazz live sync. Anyone with the active link can share text and files; no email, account, or PIN is required.

## Run locally

Install [cloudflared](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) and put it on the Next.js process's `PATH`. Alternatively, set `CLOUDFLARED_PATH` before starting the app. Use Node.js 22 or later on a platform supported by Jazz's native module (macOS or Linux, arm64 or x64).

```bash
pnpm install
pnpm dev
```

Open <http://127.0.0.1:2525/share> and choose **Start tunnel**. Copy the generated sharing link. A recipient opens it directly and can immediately see items already shared. `/` redirects to `/share`.

**Stop tunnel** closes the public link. Restarting creates a new hostname. Closing a browser tab does not stop the tunnel. The app binds to loopback, and only the local browser can start/stop tunnels; recipient requests cannot use those controls.

## Jazz storage and sync

This uses **Jazz 2.0.0-alpha.61**, pinned because Jazz 2 is still in alpha. Classic Jazz's CoValue/Group APIs are not used. Follow the [current Jazz setup](https://jazz.tools/docs/setup/deployment/own-server) when upgrading.

- Jazz runs inside the local Next.js server. No Jazz Cloud account, external database, or API key is required.
- Metadata lives in SQLite and file content in Jazz blob storage under `packages/app/data/jazz` when running the provided scripts. Set `JAZZ_DATA_DIR` to change the directory. Keep one app process per directory.
- Content survives browser refreshes and server restarts. New public links expose the current workspace, including earlier items.
- Anonymous Jazz device identities are created automatically and remembered across refreshes. There is no email/PIN flow or Cloudflare bearer token to cache.
- React uses Jazz's `useAll` live query for the sharing history and `useSyncStatus` for connection feedback. The old content polling engine is removed.
- Under `next dev` and `next start`, Jazz uses its binary HTTP stream fallback. This is not SSE, which Quick Tunnels do not support. Jazz handles reconnecting and subscriptions.
- Uploads and deletes use a bounded HTTP API and commit to Jazz in serializable transactions. Jazz then pushes changes to every connected browser. Binary content is fetched only for downloads, not as part of live metadata queries.
- Jazz policies let clients subscribe to metadata but deny direct writes and binary reads, so clients cannot bypass upload limits or assign themselves a different sender role.
- “You shared” and “They shared” reflect the local host and the recipient side. Each side can remove its own items. All holders of the same public link share the recipient side.
- Failed submissions keep their text or unsent files. Sending is disabled while disconnected; Jazz's thin client does not provide offline editing.

Active workspace limits: 25 MiB per file, 100,000 characters per text item, 1,000 items, and 256 MiB total. Request bodies are bounded while reading, and capacity checks commit atomically with uploads.

Jazz keeps edit history: deleting an item removes it from the active workspace and its download route, but does not securely erase historical bytes or reclaim physical disk space. Back up the data directory as a unit; do not edit database files while the app is running. To start with an empty workspace, stop the app and select a new `JAZZ_DATA_DIR`.

## Development

Jazz's schema and permissions are in `src/lib/jazz`, alongside a generated migration bundle and initial schema snapshot. Before changing a deployed schema, follow [Jazz migrations](https://jazz.tools/docs/schemas/migrations); do not discard the existing snapshot.

```bash
pnpm --filter app jazz:validate
pnpm --filter app test
pnpm --filter app exec tsc --noEmit
pnpm --filter app build
```

Tests cover public tunnel lifecycle, local control restrictions, the actual upload/download routes, both sharing roles, Jazz guest subscriptions and permissions, and SQLite persistence across restarts. They use temporary local databases and fake cloudflared executables; they do not send email or publish a public tunnel.

Quick Tunnels have temporary hostnames and no uptime guarantee. This app requires a persistent local Node server with process-spawning permission; deploying it to a serverless host cannot share files from your computer.
