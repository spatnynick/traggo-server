# Local restart runbook

## Ports

- **3031 is mandatory UI service port inside development environment.** Agents
  use `http://localhost:3031` for health checks and browser automation.
- **3030 is internal GraphQL backend port.** The UI development server proxies
  GraphQL requests there; do not direct users to it.
- **External developer access uses SSH tunnel.** On developer computer run
  `ssh -p 2223 -L 8099:localhost:3031 bogo@nas`, then open
  `http://localhost:8099/#/timesheet/calendar`. Port 3031 is not directly
  mapped from Docker to developer computer.

## Restart

Start backend with explicitly selected production database only when a
production restart is intended:

```bash
TRAGGO_DATABASE_CONNECTION=/mnt/dev/traggo-dev/traggo.work.db go run .
```

Start UI on mandatory port 3031:

```bash
cd ui
PORT=3031 BROWSER=none NODE_OPTIONS=--openssl-legacy-provider yarn start
```

Verify UI service from inside container:

```bash
curl -fsS http://localhost:3031 >/dev/null
```

Do not run database reset, migration, copy, or restore commands against
`/mnt/dev/traggo-dev/traggo.work.db` during ordinary restarts.

## Container recreate: restore the UI toolchain

The UI uses Yarn 1.x (`yarn.lock`). Node 20 includes Corepack, but a recreated
container may not have a `yarn` shim yet. Restore the user-local shim before
running manual UI commands:

```bash
mkdir -p "$HOME/.local/bin"
corepack enable --install-directory "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"
yarn --version  # expected: 1.22.22
```

`/mnt/dev/traggo-dev/start-traggo.sh` also falls back to `corepack yarn` when
the shim is absent, so the normal development start command remains usable
before this optional convenience setup is repeated.
