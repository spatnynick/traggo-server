# Local restart runbook

## Ports

- **3031 is mandatory user-facing Traggo UI port.** Use `http://localhost:3031`
  for every local restart and UI health check.
- **3030 is internal GraphQL backend port.** The UI development server proxies
  GraphQL requests there; do not direct users to it.

## Restart

Start backend with explicitly selected production database only when a
production restart is intended:

```bash
TRAGGO_DATABASE_CONNECTION=/home/bogo/dev/traggo-dev/traggo.work.db go run .
```

Start UI on mandatory port 3031:

```bash
cd ui
PORT=3031 BROWSER=none NODE_OPTIONS=--openssl-legacy-provider yarn start
```

Verify user-facing endpoint:

```bash
curl -fsS http://localhost:3031 >/dev/null
```

Do not run database reset, migration, copy, or restore commands against
`/home/bogo/dev/traggo-dev/traggo.work.db` during ordinary restarts.
