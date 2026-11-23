# Slice 7: hardening

## Why
The features work. This slice is about what happens around them: safe defaults, a clean shutdown, and numbers that show the app is fast enough with 10,000 employees.

## Acceptance criteria
1. Every response carries standard security headers (no MIME sniffing, no framing by other sites, a content security policy), and does not announce which framework the server runs.
2. When the server is told to stop, it closes the database before it exits, so no write is cut off halfway.
3. `npm run measure` prints how long each list and insight takes against 10,000 employees. The results are recorded in `docs/PERFORMANCE.md`.
4. `npm run coverage` prints test coverage for the server and the web app.
5. The architecture is drawn in `docs/ARCHITECTURE.md`.

## Deliberately not done here
Login, rate limiting and an audit of who made each change belong with authentication, which is out of scope (D-008). They are listed under "what I would add next" in the README.
