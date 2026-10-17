# Vercel deployment

The Vercel target uses Vite to build the same React candidate-management UI from `app/page.tsx`. The original Vinext/Cloudflare build remains available.

## Architecture

Browser → Vercel static frontend → Vercel Node function `/api/candidates` → existing Cloudflare API → D1 database.

The Vercel function forwards only the workspace cookie to the fixed candidate API endpoint. It preserves HTTP status codes, sets no-store caching, rejects cross-origin browser writes and limits request size. Candidate validation, ownership checks, duplicate prevention and stage-history updates continue to run in the existing database API.

Each domain has a separate browser cookie, so the Vercel demo and original demo open independent workspaces. The Vercel deployment depends on the original API remaining online. This avoids introducing an unrelated database service or moving the existing data.

## Build and publish

```sh
npm run install:ci
npm run build:vercel
vercel deploy --prod
```

`vercel.json` specifies the Vite build command and output folder. Vercel serves `dist-vercel/` and deploys `api/candidates.mjs` as a Node function. The configured backend endpoint is public and contains no secret credential. There are no additional required environment variables.

## Checks

```sh
node --experimental-strip-types --test tests/model.test.ts tests/vercel-proxy.test.mjs
npx tsc --noEmit
```

For browser workflow verification, run `tests/browser.mjs` with `BASE_URL` set to the Vercel production URL. See the main README for the optional Playwright setup.

Production URL: https://hireflow-mini-ats-kappa.vercel.app

