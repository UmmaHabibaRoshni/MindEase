# Sprint 4 — QA Report

**By:** Ahnaf Shakib
**Date:** 14 October 2026
**Stories:** BL-14 (database), BL-13 (backend), BL-12 (testing)
**Merged into `main` as:** PR #26, #31, #34, #35

---

## 1. Summary

I finished all nine of my Sprint 4 tasks. Everything is written, tested, pushed
and merged.

| | |
|---|---|
| Tasks assigned | **9** |
| Tasks finished | **9** |
| Checks written | **135** (84 unit, 26 Thunder Client, 25 Selenium) |
| Checks that can run today | **133** |
| **Passing** | **133** |
| **Failing** | **0** |
| Waiting on teammates' code | 2 |
| Bugs found | **4** |
| Bugs since fixed | **2** |

The two that cannot run are the workshop-page checks. They are written and
merged — they just have no page to test yet, because T12.7 and T12.8 are not
finished. They print the reason and skip rather than failing, so the suite
stays honest.

The seeker-enrollment checks were in this list too until T12.5 merged on
14 October (PR #38). They now run and pass, and they confirmed that both
high-severity bugs I had reported are fixed in the merged implementation.

---

## 2. What I built

### BL-14 — NGO dashboard, database (T14.1–T14.3)

`Referral` can now record what the NGO actually answered, not just that a
referral exists:

| Field | Purpose |
|---|---|
| `note` | the NGO's written response, max 1000 characters |
| `respondedAt` | when they answered |
| `respondedBy` | which user answered |

`respondedAt` and `respondedBy` are filled in automatically by a `pre('validate')`
hook whenever the status moves off `pending`, and cleared if it moves back. No
controller has to remember to set them, so they cannot drift out of step.

Also added `seedTestNgo.js` — an NGO login with a linked NGO profile, a crisis
request and a referral, so the dashboard has something to display. Safe to run
more than once.

### BL-13 — Psychologist dashboard, backend (T13.4–T13.6)

Six endpoints, all behind `auth` + `allowRoles('psychologist')`:

| Method | Route | What it does |
|---|---|---|
| GET | `/api/psychologist/summary` | counts per status + total, for the dashboard cards |
| GET | `/api/psychologist/cases` | paginated case list, sortable, filterable |
| PATCH | `/api/psychologist/cases/:id/status` | accept / reject / complete |
| GET | `/api/psychologist/cases/:id` | one case with full detail |
| POST | `/api/psychologist/cases/:id/notes` | add a private note |
| GET | `/api/psychologist/cases/:id/notes` | list the notes |

Every route goes through one shared `loadOwnCase()` helper, so the three failure
cases are answered the same way everywhere: **400** for a malformed id, **404**
for a case that does not exist, **403** for someone else's case. A psychologist
cannot read another psychologist's notes.

Status changes are not free-form. Only three moves are allowed, and each one
also updates the linked crisis request:

| Change | Allowed from | Request becomes |
|---|---|---|
| accepted | pending | — |
| rejected | pending | accepted (returns to the pool) |
| completed | accepted | closed |

Anything else is rejected with the reason. The last two routes (`/cases` and
`/cases/:id/status`) were added mid-sprint at Tanjila's request, because her
T13.7 dashboard needed them and they were not in the original sheet.

### BL-12 — Workshops, testing (T12.10–T12.12)

Covered in its own report: **[BL-12-workshops-qa-by-ahnaf.md](BL-12-workshops-qa-by-ahnaf.md)**.
Short version: a 26-request Thunder Client collection, a 25-spec Selenium suite,
and 4 bugs found. The Selenium suite cleans up after itself — every workshop it
creates is cancelled in the `after` hook, because it runs against the team's
shared database.

Six of those specs cover the seeker side, written against T12.5 the day it
merged. Two of them exist specifically to hold the fixes for B1 and B2 in
place, so the bugs cannot quietly return if the enrollment controller is
rewritten later.

---

## 3. Testing

### Unit tests — 84, all passing

```
referralModel.test.js         T14.3  — referral fields and the response hook
psychologistSummary.test.js   T13.6  — summary counts
psychologistCases.test.js     T13.6  — case detail, notes, ownership
psychologistCaseList.test.js  T13.6  — list, pagination, status changes
seedTestNgo.test.js           T14.2  — NGO seed
seedFacilitator.test.js              — facilitator seed
seedTestSeeker.test.js               — seeker seed
```

Run with `cd server && npm test`.

### API tests — 26 Thunder Client requests

`docs/thunder-client/BL-12-workshops.json`. All 26 run today. Requests 21–26
were written in advance for T12.5 and corrected against Roshni's real routes
once it merged — one URL had to change, from `/api/workshops` to
`/api/workshops/available`.

### End-to-end — 25 Selenium specs

`test/sprint4.e2e.test.js`, run with `npm run test:e2e:sprint4` from the repo
root. **23 passing, 2 pending, 0 failing** in Chrome against the real database.

### Everything together, on `main`

| Suite | Result |
|---|---|
| Server unit tests (mine + teammates') | **230 passing, 17 suites** |
| Client unit tests | **31 passing** |
| Sprint 3 Selenium | 20 passing, 2 pending |
| Sprint 4 Selenium | 23 passing, 2 pending |
| **Failing anywhere** | **0** |

---

## 4. Bugs found

Four, all written up with suggested fixes in the BL-12 report. I reported the
first two before T12.5 was written, and the merged implementation handles both
correctly — each now has a regression test holding it in place:

| | Bug | Severity | Status |
|---|---|---|---|
| **B1** | A seeker could never re-enroll after cancelling — the unique index covers cancelled rows | high | **fixed**, held by T12.E23 |
| **B2** | Capacity could be exceeded — `incrementEnrollment()` read, checked, then wrote | high | **fixed**, held by T12.E20 |
| **B3** | Date and time stored separately, so "upcoming workshops" cannot be ordered within a day | medium | open |
| **B4** | Workshop enums are capitalised while the rest of the codebase is lowercase | low | open |

One leftover: `incrementEnrollment()` is still on the `Workshop` model and
still has the race. Nothing calls it any more, so it should be deleted before
someone picks it up by mistake.

### Two things I also fixed along the way

- **`npm test` was broken for everyone in `server/`.** A test file there needed
  `axios`, which was only installed in `client/`. Added it as a server
  devDependency — the whole suite was failing to start before this.
- **Selenium logins were failing silently.** Chrome's "password found in a data
  breach" dialog was covering the login form, and my own error message blamed a
  missing password instead. Disabled Chrome's password manager in the driver
  options and corrected the message, so a wrong password now says so plainly.

---

## 5. What is not finished, and why

Nothing of mine. These two checks are written and merged but have no page to
run against:

| Check | Waiting on | Owner |
|---|---|---|
| Create Workshop form | `CreateWorkshop.jsx` not written | T12.7 |
| Seeker Workshops page | `Workshops.jsx` not written | T12.8 |

They need no editing. The day that code is merged, they start running — which
is exactly what happened with the three seeker checks when T12.5 landed: they
went from pending to passing without a line being changed.

---

## 6. How to check this yourself

```bash
# seed the accounts the tests log in with
cd server
node seeds/seedTestNgo.js         # ngo@test.com        / Ngo@12345
node seeds/seedFacilitator.js     # facilitator@test.com / Facilitator@12345
node seeds/seedTestSeeker.js      # seeker@test.com      / Seeker@12345

# unit tests
cd server && npm test             # 230 passing
cd client && npm test             #  31 passing

# end-to-end (both apps must be running)
cd server && npm run dev          # :5000
cd client && npm run dev          # :5173
npm run test:e2e:sprint4          # from the repo root
```
