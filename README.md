# PromptCentral

A small personal prompt library. Save, edit, categorize, and copy the prompts you reuse. Prompts can contain
**variables**: copying one opens a popup that asks you to fill them in.

```
Review the pull request at {{pr_url}}.
The codebase is written in {{language:TypeScript}}.
```

- `{{pr_url}}` is asked for every time you copy.
- `{{language:TypeScript}}` is prefilled with `TypeScript`, which you can change.
- A variable used more than once is asked for once and filled everywhere.

Also included: one category per prompt plus free tags, favorites (pinned to the top), search (`/`), sort by most or
recently used, a copy counter, Raw/Markdown preview, and JSON import/export for backups.

## Deploy on Coolify

1. **New Resource** → your GitHub repo → pick the branch.
2. Set **Build Pack** to **Docker Compose** (the file is `/docker-compose.yml`).
3. Check **Environment Variables**. `APP_PASSWORD` defaults to `2511`; change it there if you want.
   `SESSION_SECRET` is optional.
4. Check the domain. The compose file asks Coolify to generate one that routes to port 3000. To use your own
   domain, enter it with the port, e.g. `https://prompts.example.com:3000`.
5. **Deploy.**

Data lives in SQLite at `/data/promptcentral.db`, on the named volume `promptcentral-data`. It survives redeploys
and restarts. For an extra backup, use **Import / export** in the app.

## Configuration

| Variable         | Default         | What it does                                                       |
| ---------------- | --------------- | ------------------------------------------------------------------ |
| `APP_PASSWORD`   | `2511`          | Password on the front page.                                        |
| `SESSION_SECRET` | the password    | Signs the login cookie. Changing it (or the password) logs you out. |
| `DATA_DIR`       | `/data`         | Folder for the SQLite file.                                        |
| `PORT`           | `3000`          | HTTP port.                                                         |

Login is a single shared password with a year-long cookie. After 10 wrong attempts from one IP, logins are
blocked for 15 minutes.

## Run locally

Needs Node 22.13 or newer.

```sh
npm install
npm run dev        # API on :3000, UI on http://localhost:5173
npm test
```

Or run the production container:

```sh
docker compose up --build   # then add `ports: ["3000:3000"]` to reach it from the host
```

## How it's built

- **Server:** [Hono](https://hono.dev) on Node, using Node's built-in `node:sqlite`, so there are no native
  modules to compile. Code is in `server/`.
- **UI:** React + Vite, in `src/`. The production build is served by the same Node process.
- **Image:** one small `node:22-alpine` container running as a non-root user, with a healthcheck on
  `/api/health`.
