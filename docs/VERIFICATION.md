# Hireflow verification — 17 October 2026

Application: https://hireflow-mini-ats-kappa.vercel.app
Release: v1.3.2

The frontend, Node API and private persistent storage run on Vercel.

## Issues fixed

- A successful save no longer depends on a second request to refresh the list. The API returns the confirmed candidate, including normalized fields and history.
- An interrupted save response is checked against stored records before another submission is suggested. POST requests are never automatically repeated.
- Partial sample imports preserve confirmed records and can resume without duplicate candidates. Failed initial loading offers reconnection and blocks changes until records load.
- Stage-change and deletion errors remain visible inside the profile drawer. Fields and close controls are locked while a mutation is pending.
- Table pagination survives opening and editing a profile. Deleting the last candidate in a position clears an obsolete position filter; page numbers are clamped when records disappear.
- Mobile navigation traps focus, supports Escape and returns focus on close. Closed mobile navigation is removed from the focus order. Candidate dialogs restore keyboard focus too.
- Duplicate/empty skill chips no longer produce React key warnings. Long profile values wrap without horizontal overflow. Experience uses the correct singular/plural wording.
- Secondary text contrast was corrected while preserving the brighter metric and stage colors.

## Verification results

| Check | Result |
| --- | --- |
| Unit tests | 18 passed: models, metrics, validation, CRUD/history, isolation, origin checks, capacity boundary, conditional storage writes and client response handling |
| Reliability browser audit | 10 scenarios passed with the real API handler and temporary in-memory records |
| Production browser workflow | Passed creation/editing/deletion, stage dropdown, drag-and-drop, history, search, combined filters, CSV, refresh persistence, duplicates, isolation, sorting, pagination, page sizes and mobile layout |
| Additional live UI checks | Passed delete cancellation/confirmation, dialog autofocus/Escape, mobile navigation/search/profile editing and no horizontal overflow |
| Private Vercel storage | Passed live API persistence, simultaneous and sequential additions, visitor isolation, blocked unauthenticated Blob access and deletion |
| Accessibility | axe reported no automated WCAG A/AA violations in the six tested production views: overview, candidates, profile, form, pipeline and mobile navigation |
| Production dependencies | npm audit reported zero known production dependency advisories |
| Build | Strict TypeScript and Vite production build passed; GitHub Actions passed |
| Function logs | 50 recent request log entries from the audited deployment contained zero server responses with status 500 or above |

The ten reliability scenarios cover profile/edit page preservation and focus restoration; a confirmed save during read failure; a lost save response; visible/retryable stage and delete failures; initial-load recovery; partial sample recovery; mobile navigation and long content; validation/duplicates and locked fields during saving; filtered CSV quoting, newlines and formula escaping; and obsolete position filters after deletion.

All browser checks used Chrome with isolated fictional records. Failure scenarios intercepted API calls and did not induce failures in the live backend. The real storage integration removed its own temporary document. No unresolved failure remained in these checks; testing cannot guarantee the absence of every possible bug or cover every browser/device combination.

Demo scope: anonymous browser workspaces, a 500-candidate limit, and no shared team accounts. Clearing cookies starts a new workspace.
