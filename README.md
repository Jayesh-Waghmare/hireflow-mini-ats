# Hireflow — Mini Applicant Tracking System

A small recruiting app for the EarlyJobs assignment: candidate management, hiring stages, search and dashboard metrics.

- [Live application](https://hireflow-mini-ats-kappa.vercel.app)
- [Repository](https://github.com/Jayesh-Waghmare/hireflow-mini-ats)
- [Demo video](https://github.com/Jayesh-Waghmare/hireflow-mini-ats/releases/download/v1.2.0/Hireflow-demo.webm)

![Overview](docs/overview.png)

## Features

- Add, view, edit and delete candidates with server-side validation and duplicate-email checks.
- Applied, Screening, Interview, Offer, Hired and Rejected stages.
- Drag-and-drop pipeline and a stage dropdown on each profile.
- Search by name, email, role, skills or location; combine role and stage filters.
- Dashboard totals, active candidates, interviews, hires and stage distribution.
- Recruiter notes, source, experience and timestamped stage history.
- Filtered CSV export with quoting and spreadsheet formula escaping.
- Desktop and mobile layouts; optional fictional sample candidates.
- Private persistent storage and isolated browser workspaces.

## Architecture

The full application runs on Vercel:

Browser → React/Vite frontend → Vercel Node function → private Vercel Blob storage.

The backend performs validation, candidate CRUD, duplicate checks, stage history and workspace isolation directly. There is no upstream API gateway or Cloudflare dependency. Candidate documents are private JSON objects, one per workspace. Reads bypass the storage cache; conditional ETag writes and bounded retries prevent concurrent requests from losing changes.

## Local setup

Requires Node.js 22 and npm.

```sh
npm ci
vercel link
vercel env pull .env.local
vercel dev
```

The linked project must have a private Vercel Blob store. The server reads BLOB_READ_WRITE_TOKEN from the environment; never expose it through a VITE_ variable or commit it. npm run dev starts only the frontend. vercel dev runs both frontend and API functions.

```sh
npm test
npm run build
vercel deploy --prod
```

## Source layout

- src/: React UI and styling.
- lib/model.ts: shared validation schema, filtering and metric calculations.
- api/candidates.ts: Vercel function entry point.
- server/candidate-service.ts: HTTP handling and candidate business logic.
- server/blob-store.ts: private persistent storage and concurrent-write handling.
- tests/: API, storage, model and browser checks.

## API

GET /api/candidates initializes an HttpOnly workspace cookie and lists that workspace's records. POST creates a record or updates an existing id. DELETE /api/candidates?id=... removes a record in the current workspace. The backend rejects foreign browser mutations, malformed input and duplicate emails. Responses are not cached.

## Verification

Fourteen unit tests cover CRUD, stage history, duplicate handling, workspace isolation, validation, origin checks, private storage, fresh reads and write conflicts. npm run build includes strict TypeScript checking. GitHub Actions runs tests and the production build.

To test the real storage connection using an isolated temporary document:

```sh
node --env-file=.env.local --experimental-strip-types tests/storage.integration.ts
```

This checks persistence, concurrent writes and blocked unauthenticated reads, then deletes its own test document. The optional tests/browser.mjs suite requires Playwright and Chrome; set BASE_URL to the running app and DEMO_OUTPUT to an artifact directory. It records a captioned demo and exercises the complete candidate workflow.

## Demo scope

Each browser has a separate workspace. Clearing its cookie starts a fresh workspace. This is an assignment demo with a 500-candidate limit per workspace, not a shared team account system. All sample data is fictional. Authentication, team roles, retention controls and a relational database for larger datasets are possible next steps.

Active means Applied through Offer. Stage percentages use all candidates as their denominator. Timestamps are stored in UTC and shown in the visitor's locale. This Vercel-only release starts with fresh data, as requested.

