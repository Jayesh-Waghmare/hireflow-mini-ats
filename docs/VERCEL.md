# Vercel deployment

Frontend, backend logic and persistent storage are all hosted on Vercel.

## Components

- React/Vite frontend: src/ → dist/.
- Node function: api/candidates.ts.
- Business logic: server/candidate-service.ts.
- Private Vercel Blob storage: server/blob-store.ts.

Candidate records are private JSON documents scoped by an HttpOnly workspace cookie. The storage adapter uses uncached reads and conditional ETag writes with retries, so concurrent updates do not silently overwrite one another.

## Provision and deploy

```sh
npm ci
vercel link
vercel blob create-store hireflow-candidates --access private --region iad1 --yes --environment production --environment preview --environment development
vercel env pull .env.local
npm test
npm run build
vercel deploy --prod
```

Create a store only once. The CLI connects it to the project and adds BLOB_READ_WRITE_TOKEN to the selected server environments. On this project the private store is already provisioned and connected. Do not commit .env.local or place storage credentials in frontend environment variables.

The vercel.json configuration selects Vite, builds the frontend into dist/ and deploys the TypeScript candidate API as a Vercel Node function.

## Checks

npm test runs model, API and storage-concurrency tests. npm run build runs TypeScript checking and builds the frontend. tests/storage.integration.ts verifies the real private store using a random temporary document; tests/browser.mjs covers the full app in a real browser.

Production URL: https://hireflow-mini-ats-kappa.vercel.app

The previous API proxy and Cloudflare starter code have been removed from the active project. No runtime call to the previous deployment is required.
