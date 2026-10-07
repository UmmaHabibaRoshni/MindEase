# Sprint 3 QA note — Ahnaf

Tester: Ahnaf Shakib
Date: 2026-10-07
Branch: `feature/ahnaf-sprint3`

Covers my own Sprint 3 rows (BL-10 database, BL-8 frontend, BL-9 backend, BL-11 testing)
plus cross-story Selenium coverage of BL-8, BL-9 and BL-10, which are the other
three members' stories.

---

## 1. What I built

| Task | Deliverable |
|---|---|
| T10.1 | `server/models/VolunteerAvailability.js` reworked (see note 5.1) |
| T10.2 | `server/config/availabilityOptions.js`, `client/src/constants/availabilityOptions.js` |
| T10.3 | `server/tests/volunteerAvailability.test.js` — 16 tests |
| T8.7 | `client/src/api/adminApi.js`, `client/src/pages/admin/Verifications.jsx` |
| T8.8 | Route `/dashboard/verifications` (admin-only) wired in `client/src/App.jsx` |
| T8.9 | `client/src/api/adminApi.test.js` + `client/src/pages/admin/Verifications.test.jsx` — 20 tests |
| T9.4 / T9.5 | `server/controllers/escalationController.js`, `server/routes/escalationRoutes.js` |
| T9.6 | `server/tests/escalation.test.js` — 31 tests |
| T11.10 | `docs/thunder-client/BL-11-resources.json` — 23-request collection |
| T11.11 | `test/sprint3.e2e.test.js` — 22 Selenium / API specs |
| T11.12 | this note |

New endpoints (BL-9):

| Method | Route | Role |
|---|---|---|
| POST | `/api/escalations` | volunteer |
| GET | `/api/escalations/psychologists` | volunteer |
| GET | `/api/escalations/assigned` | psychologist |
| PATCH | `/api/escalations/:id/accept` | psychologist |
| PATCH | `/api/escalations/:id/reject` | psychologist |
| PATCH | `/api/escalations/:id/complete` | psychologist |

---

## 2. Unit tests — executed, all passing

### Server (`cd server && npm test`)

```
Test Suites: 5 passed, 5 total
Tests:       60 passed, 60 total
```

| Suite | Tests | Story |
|---|---|---|
| `volunteerAvailability.test.js` | 16 | BL-10 (mine) |
| `escalation.test.js` | 31 | BL-9 (mine) |
| `CaseAssignment.test.js` | 2 | BL-9 (Tanjila) |
| `User.test.js` | 5 | BL-8 (Bithi) |
| `seedAdmin.test.js` | 2 | BL-8 (Bithi) |

### Client (`cd client && npm test`)

```
Test Files  2 passed (2)
Tests      20 passed (20)
```

| Suite | Tests |
|---|---|
| `src/api/adminApi.test.js` | 12 |
| `src/pages/admin/Verifications.test.jsx` | 8 |

The client had **no test runner at all** before this sprint. I added Vitest +
React Testing Library + jsdom, a `src/test/setup.js`, the `test` block in
`vite.config.js`, and `npm test` / `npm test:watch` scripts. Anyone adding
component tests from now on can just write them.

---

## 3. Thunder Client — T11.10

`docs/thunder-client/BL-11-resources.json` imports into Thunder Client as
**MindEase BL-11 Resources (T11.10)**: 23 requests with assertions attached
(status code plus JSON-query checks), driven by the env vars `baseUrl`,
`adminToken`, `volunteerToken`, `categoryId`, `resourceId`.

Coverage: public list / filter / search / single-get / categories, the four
validation 400s (missing title, bad type, helpline without phone, article
without body, non-ObjectId category), the auth matrix (401 anonymous, 403
volunteer, 200/201 admin), update, unpublish, delete, double-delete 404, and
duplicate-category 409.

**Execution status: not run by me.** I could not reach a database from my
environment — there is no local `mongod` and nothing listening on 27017, and the
Atlas URI lives in `server/.env`, which I deliberately did not open. The
collection and its assertions are ready; whoever has the DB can import it, paste
two tokens and hit *Run All*. Every expectation in it was derived by reading
`resourceController.js` and `resourceRoutes.js` line by line, and the same
expectations are asserted in the Selenium suite (T11.E4–T11.E9), so they are not
guesses — but I am not claiming a green run I did not see.

---

## 4. Selenium — T11.11 plus cross-story

`test/sprint3.e2e.test.js`, run with `npm run test:e2e` from the repo root.
22 specs across four stories. Verified to load and enumerate cleanly
(`mocha --dry-run` → `22 passing`).

| Story | Specs | What they check |
|---|---|---|
| BL-8 | T8.E1–E4 | admin opens the verification queue; non-admin redirected; API 403 for volunteer, 401 anonymous |
| BL-9 | T9.E1–E5 | escalate control present; 401 without token; 403 for volunteer on the psychologist queue; psychologist list loads; short summary 400 |
| BL-10 | T10.E1–E4 | availability on the volunteer dashboard; read own availability; save a valid window; 401 anonymous |
| BL-11 | T11.E1–E9 | public library loads; API resources actually render; admin manage page; response shape; 401/403 on create; 400 on bad type and bad id; categories public |

Three teammate frontends are not merged yet, so those specs assert the backend
contract over HTTP and mark the UI half **pending with a reason** rather than
failing or silently passing:

- `Availability.jsx` (T10.7 / T10.8, Roshni)
- `EscalateModal.jsx` / `EscalatedCases.jsx` (T9.7 / T9.8, Bithi)
- `Resources.jsx` (T11.7, Tanjila) — the public `ResourceLibrary.jsx` does exist and is covered

**Execution status: not run by me**, same reason as section 3 — the suite needs
the client on 5173, the server on 5000 with a database, and Chrome.
`E2E_ADMIN_PASSWORD` must also be exported, since the seeded admin password is
not in the repo. Specs skip with a clear reason when a credential is missing, so
a partial environment still produces a readable report instead of a wall of
failures.

---

## 5. Bugs found

### 5.1 Availability model rejected the record its own controller creates — fixed

`getMyAvailability` creates the row with only `{ volunteer, isAvailable: false }`,
but the model had `dayOfWeek`, `startTime` and `endTime` all `required: true`.
Every first call for a volunteer therefore threw a `ValidationError` and returned
**500** — the endpoint could never succeed for a new volunteer.

Fixed in T10.1 by making the window optional (`default: null`) and moving the
real rules into a `pre('validate')` hook: `HH:MM` format, `endTime` strictly
after `startTime`, and a full window required *only* when `isAvailable` is true.
So a volunteer can exist without a window but cannot be advertised as bookable
without one. Tanjila's controller needs no change. Covered by 4 regression tests.

I kept the filename `VolunteerAvailability.js` rather than renaming to
`Availability.js` as the sprint sheet says, because `availabilityController.js`
and an existing test already import that path and renaming would break merged
code for no behavioural gain.

### 5.2 Resource Library renders nothing even when the API returns data — open

`ResourceLibrary.jsx:20` and `ManageResources.jsx` both gate rendering on
`if (data.success)`, but `getResources` responds with `{ count, resources }` and
**no `success` key**. `data.success` is always `undefined`, so the list is never
populated — the public library shows empty no matter how many published
resources exist.

Owner: BL-11 frontend (T11.7 / T11.8). Fix either end — drop the `success`
check on the client, or add `success: true` on the server — but pick one and
make all four resource handlers consistent. Regression spec is already written:
**T11.E2** fetches the API, and if it returns resources, asserts the first title
appears on the rendered page. It will fail until this is fixed.

### 5.3 Admin resource writes are sent without a token — open

`ManageResources.jsx` calls `POST/PUT/DELETE /api/resources` with only
`Content-Type` and no `Authorization` header, while those routes sit behind
`auth, allowRoles('admin')`. Every create, update and delete from that page
returns **401**. The payload is wrong too: it sends `{ title, category,
description, link }`, but the model wants `type` (`helpline`|`article`), a
`category` that is a `ResourceCategory` **ObjectId** (the form sends the string
`"mental_health"`), and `url` rather than `link` — so even with a token it would
be a 400.

Owner: BL-11 frontend (T11.8). `client/src/api/adminApi.js` shows the pattern to
copy: an axios instance with a request interceptor that attaches the bearer
token from `localStorage`.

### 5.4 `REQUEST_STATUSES.RESOLVED` is not a valid request status — open, minor

`server/config/requestOptions.js` exports `RESOLVED: "resolved"`, but the
`CrisisRequest.status` enum is `["pending", "accepted", "escalated", "referred",
"closed"]`. Writing `REQUEST_STATUSES.RESOLVED` anywhere will throw a validation
error. My `completeCase` deliberately writes `'closed'` instead. Either add
`resolved` to the enum or drop the constant.

### 5.5 `updateAvailability` bypasses the cross-field rules — open, minor

`findOneAndUpdate(..., { runValidators: true })` runs field validators but not
`pre('validate')` document middleware, so the `endTime > startTime` and
"no availability without a window" rules in 5.1 are enforced on `.save()` paths
but **not** through `PATCH /api/volunteer/availability`. The format validators
do still run. Lowest-effort fix in `availabilityController.js`: load the doc,
assign, then `save()`.

Owner: BL-10 backend (T10.4 / T10.5, Tanjila).

### 5.6 Tailwind classes do nothing — open, cosmetic

`ManageResources.jsx` and `ResourceCard.jsx` are written with Tailwind utility
classes, but Tailwind is not in `client/package.json` and there is no directive
in the CSS, so those pages render unstyled. Every other page uses inline style
objects. I used inline styles in `Verifications.jsx` to match what actually
works. The team should decide: install Tailwind, or stop writing classes.

---

## 6. How to reproduce

```bash
# unit tests (no database needed)
cd server && npm test        # 60 passing
cd ../client && npm test     # 20 passing

# end-to-end (needs a database, Chrome, and both apps running)
cd server && npm run dev     # :5000
cd client && npm run dev     # :5173
cd server && node seeds/seedAdmin.js && node seeds/seedResources.js

# then, from the repo root:
export E2E_ADMIN_PASSWORD='<seeded admin password>'
npm run test:e2e
```

Test accounts used by the specs: `volunteer@test.com` / `Test@1234` and
`admin@mindease.com`. Both are overridable with `E2E_*` env vars.

---

## 7. Summary

- 111 automated checks authored this sprint: 60 server unit, 20 client unit, 23 Thunder Client, 22 Selenium.
- 80 of them (the unit tests) **executed green** in this session.
- The 45 that need a live database and browser are authored and verified to load, but **not executed** — I had no DB access. They are listed above as not run rather than reported as passing.
- 1 bug found and fixed (5.1, a hard 500 on a merged endpoint).
- 5 bugs found and left open with an owner, the clearest being 5.2 and 5.3: the Resources feature does not work end to end today — the public library renders nothing, and admin writes are unauthenticated.
