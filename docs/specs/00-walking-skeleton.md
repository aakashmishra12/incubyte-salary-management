# Slice 0: walking skeleton

## Why
Before any feature, prove the whole path works: a browser page calls the API, tests run, lint runs, CI runs. Every later slice then adds to an app that already builds and runs.

## Acceptance criteria
1. `GET /api/health` returns status 200 and `{ "status": "ok" }`.
2. An unknown path under `/api` returns status 404 with a JSON error body, never an HTML page.
3. The web page shows the app name. *(The skeleton also showed whether the API was reachable. That banner was removed once real pages had their own loading and error states, so criteria about it no longer apply.)*
4. A page that cannot reach the API says so instead of staying blank. *(Every screen now does this itself.)*
5. In production the server also serves the built web app, so one process on one port serves both.
6. `npm test`, `npm run lint` and `npm run typecheck` pass from the repository root.
7. GitHub Actions runs those three commands on every push.

## Out of this slice
The database, the seed and all features. Deployment to the server follows once there is something worth showing.
