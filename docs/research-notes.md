# Research notes (Stage 0)

Done on 23 Nov 2026 with AI-assisted web research, before the requirements one-pager. Each finding lists what it changed.

## How HR teams measure pay
- **Compa-ratio** is the standard measure of one person's pay against a reference point: salary divided by the midpoint of the pay band, or by the median for similar roles. 1.0 means paid at the reference. A common comfort zone is 0.80 to 1.20.
- **Range penetration** shows where a salary sits inside a pay band. It needs the band's minimum and maximum.
- **Pay equity:** sources warn that compa-ratio alone cannot establish whether pay is fair.
- **Median over average:** a few very high salaries pull the average up, so pay reports lead with the median.

**What this changed:** outliers use compa-ratio against the peer median with the 0.80 to 1.20 zone (D-002). Range penetration is out because ACME has no pay bands. Equity analysis is out because one metric would mislead.

Sources: [ADP on compa-ratio](https://www.adp.com/resources/articles-and-insights/articles/c/compa-ratio.aspx), [AIHR compensation metrics](https://www.aihr.com/blog/compensation-metrics/), [PayScale compensation metrics](https://payscale.com/compensation-trends/compensation-metrics-defined), [NetSuite compensation KPIs](https://www.netsuite.com/portal/resource/articles/erp/compensation-metrics-kpis.shtml)

## SQLite driver on Node 26
- Node's built-in `node:sqlite` module is marked "release candidate" in the Node 26 documentation. It runs on my machine (Node 26.11.1, SQLite 3.54.1).
- `better-sqlite3` 13.2.0 supports Node 22 and later. It is mature and widely used, and needs a native binary on the host.

**What this changed:** the driver stays an open point in D-009 and is settled by deploying the skeleton, with all SQL behind a repository layer so the driver can be swapped.

Sources: [Node.js SQLite documentation](https://nodejs.org/api/sqlite.html), npm registry (`npm view better-sqlite3`)

## Hosting an app that uses SQLite
- Render's free web services have no persistent disk, so a SQLite file is lost on restart or redeploy. Persistent disks are a paid feature.

**What this changed:** the app seeds itself when the database is empty, and the hosting choice is tested in slice 0 instead of at the end.

Sources: [Render community thread on SQLite](https://community.render.com/t/is-a-sqlite-in-the-free-account-deleted-after-some-time/6960), [Render free tier article](https://render.com/articles/platforms-with-a-real-free-tier-for-developers-in-2026)

## Package versions checked (npm registry, 23 Nov 2026)
Express 5.3, Zod 4.6, Vitest 5.1, Vite 8.3, React 19.3, MUI 9.6, TypeScript 7.0. All support Node 26. Exact versions are pinned in `package.json` when installed.
