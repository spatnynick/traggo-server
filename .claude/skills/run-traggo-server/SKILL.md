---
name: run-traggo-server
description: Build, run, and drive the traggo-server fork (Go GraphQL backend + React UI). Use when asked to start traggo, run the dev server, take a screenshot of the traggo UI, run its Go/JS tests, or interact with the running app.
---

Full-stack web app: Go backend serves GraphQL on one port, a separate
CRA dev server serves the React UI on another port and proxies API
calls to the backend. Drive it with the Playwright REPL driver at
`.claude/skills/run-traggo-server/driver.mjs` (no `chromium-cli` on
this box — this driver replaces it, same command shape).

All paths below are relative to `traggo-server/` (this skill's parent
dir), except the driver's own path.

## Canonical ports

- **`:3031` is mandatory UI service port inside container.** Start and validate
  it there on every local restart; agents use `http://localhost:3031` for
  browser automation.
- **`:3030` is internal GraphQL backend port.** The UI's proxy depends on it,
  but it is not the user-facing endpoint.
- **Developer access is SSH tunnel only.** Docker does not directly map port
  3031 to developer computer. Developer runs
  `ssh -p 2223 -L 8099:localhost:3031 bogo@nas` then opens
  `http://localhost:8099/#/timesheet/calendar`.

## Prerequisites

None beyond the base image's `go` and `node`/`yarn` — this Ubuntu 26.04
container already has what's needed for the Go build (CGO + gcc, for
`mattn/go-sqlite3`) and for CRA.

The driver needs Playwright + Chromium, installed once inside the
skill dir (already done; re-run only after a container rebuild):

```bash
cd .claude/skills/run-traggo-server
npm install                              # playwright package, from package.json here
npx playwright install --with-deps chromium
```

## Setup

Go deps: `go mod download` (usually already satisfied via module
cache). UI deps: `(cd ui && yarn)` if `ui/node_modules` is missing.

Branch note: this fork's feature work (5 issues: duration format,
per-day sum, list UI tweaks, list filter, connection status) lives on
`integration`, not `master`. Check out `integration` unless told
otherwise — see `../../STATUS.md` in the parent `traggo-dev` dir.

## Build

No separate build step for dev — both halves run via their own dev
commands (`go run .`, `yarn start`). For a real binary: `make
build-bin-local` (not exercised by this skill).

## Run (agent path)

Launch backend + UI dev server, then drive with `driver.mjs`.

```bash
# Backend — GraphQL on :3030. Point at a work/scratch DB, never the
# real traggo.db, when just testing:
TRAGGO_DATABASE_CONNECTION=/home/bogo/dev/traggo-dev/traggo.work.db \
  go run . > /tmp/traggo-backend.log 2>&1 &
disown
timeout 30 bash -c 'until curl -sf -X POST -H "Content-Type: application/json" \
  -d "{\"query\":\"{__typename}\"}" http://localhost:3030/graphql >/dev/null; do sleep 1; done'

# UI — mandatory CRA dev server inside container on :3031; proxies to internal :3030
# "proxy". Needs the OpenSSL legacy flag (see Gotchas).
cd ui
PORT=3031 BROWSER=none NODE_OPTIONS=--openssl-legacy-provider yarn start \
  > /tmp/traggo-ui.log 2>&1 &
disown
timeout 60 bash -c 'until curl -sf http://localhost:3031 >/dev/null; do sleep 1; done'
cd ..
```

Stop by port, not by a broad `pkill -f` pattern (matches the agent's
own shell):

```bash
lsof -ti:3030 -sTCP:LISTEN | xargs -r kill
lsof -ti:3031 -sTCP:LISTEN | xargs -r kill
```

Drive with the REPL driver — pipe a script to stdin, same shape as
`chromium-cli`:

```bash
node .claude/skills/run-traggo-server/driver.mjs <<'EOF'
nav http://localhost:3031
wait-for text=Username
screenshot login
fill input[type="text"] admin
fill input[type="password"] some-password
click button[type="submit"]
sleep 1500
screenshot after-login
console
quit
EOF
```

Screenshots land in `.claude/skills/run-traggo-server/screenshots/`.

| command | what it does |
|---|---|
| `nav <url>` | navigate |
| `wait-for text=<substr>` | wait for text node |
| `wait-for <css>` | wait for element matching selector |
| `click <css>` | click first match |
| `fill <css> <value...>` | fill first match (React-safe, goes through Playwright's input pipeline) |
| `press <key>` | keyboard press |
| `screenshot [name]` | full-page PNG to `screenshots/<name or shot-N>.png` |
| `console` | dump collected `console`/`pageerror` messages so far |
| `html [css]` | dump `outerHTML` of first match (default `body`) — use this to find real selectors instead of guessing |
| `sleep <ms>` | fixed wait, use sparingly |
| `quit` | close browser, exit |

## Run (human path)

`go run .` (internal backend, :3030) + `cd ui && PORT=3031 BROWSER=none
NODE_OPTIONS=--openssl-legacy-provider yarn start` (UI service, :3031). Agents
use `http://localhost:3031`; developers use SSH tunnel endpoint
`http://localhost:8099/#/timesheet/calendar`.

## Test

```bash
go test ./...           # ~4s, all packages `ok`
(cd ui && CI=true yarn test)   # JS unit tests, not re-run by this pass — see STATUS.md
```

---

## Gotchas

- **Login page inputs have no `name`/`id`, and MUI v4's `label` prop
  doesn't wire a real `<label for>`** — `driver.mjs`'s `label=` and
  `getByLabel` both time out. Use `input[type="text"]` /
  `input[type="password"]` instead (only two inputs on that form; use
  the `html form` driver command to confirm on any other page).
- **`NODE_OPTIONS=--openssl-legacy-provider` is required** to start the
  UI dev server on Node 20 — this CRA/webpack version hashes with an
  algorithm OpenSSL 3 dropped. Without it: `error:0308010C:digital
  envelope routines::unsupported`.
- **Real users won't log in with `admin`/`admin`.** That default only
  auto-creates an `admin` user when the target DB has zero rows in
  `users` (see `main.go`) — it does **not** apply to
  `traggo.work.db`, which already has real seeded users. Either use
  the real password (ask the user) or point at a brand-new empty
  sqlite file to get the auto-seeded `admin`/`admin` account. Don't
  guess passwords against the work DB.
- **`ui/package.json`'s `"proxy"` field is a fixed string, not
  overridable by env var**, and is only read at CRA dev-server start.
  If you need the UI to hit a different backend port, edit that field,
  restart `yarn start`, and **revert the edit afterward** — it's a
  tracked file and the port pairing (3030/3031) is what the user
  expects running.
- **A CRA dev server can die silently ("process exited too early")**
  when a second instance starts on a distinct port while another is
  still initializing in the same container — don't launch two `yarn
  start` instances back-to-back without waiting for the first to
  report "Compiled successfully" and confirming its listening port
  with `ss -ltnp`, not just trusting its own log output.

## Troubleshooting

- **`curl` to `:3030/graphql` returns `000`**: backend still
  compiling (first `go run .` in a clean module/build cache takes
  ~15-20s for `mattn/go-sqlite3`'s cgo build). Poll, don't fixed-sleep.
- **`error:0308010C:digital envelope routines::unsupported`** on
  `yarn start`: see Gotchas — add `NODE_OPTIONS=--openssl-legacy-provider`.
- **GraphQL error `username/password combination does not exist`**
  after `fill`+`click` on the login form: wrong password for that DB,
  not a driver bug — the fill/click round-trip itself worked (compare
  `screenshots/login.png` vs `screenshots/login-error.png`, the latter
  shows the orange snackbar with this exact message).
