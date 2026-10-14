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
| Checks written | **137** (84 unit, 26 Thunder Client, 27 Selenium) |
| Checks that can run today | **136** |
| **Passing** | **136** |
| **Failing** | **0** |
| Held back by an open bug | 1 |
| Bugs found | **5** |
| Bugs since fixed | **2** |

Nothing is waiting on a teammate any more. The seeker checks unblocked when
T12.5 merged (PR #38) and the page checks when T12.7 and T12.8 merged (PR #41),
both on 14 October — and neither needed a line changed to start working, which
is what writing them in advance was for.

The one check that still does not run is held up by bug B5, not by missing
code. It prints the reason and skips rather than failing.

Running the seeker checks for the first time also confirmed that **both
high-severity bugs I reported before T12.5 was written are fixed** in the
merged implementation.

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
Short version: a 26-request Thunder Client collection, a 27-spec Selenium suite,
and 5 bugs found. The Selenium suite cleans up after itself — every workshop it
creates is cancelled in the `after` hook, because it runs against the team's
shared database.

Six of those specs cover the seeker APIs, written against T12.5 the day it
merged. Two of them exist specifically to hold the fixes for B1 and B2 in
place, so the bugs cannot quietly return if the enrollment controller is
rewritten later.

Four more cover the pages from T12.7 and T12.8. The strongest is T12.E21: it
fills in the facilitator's create form in the browser, submits it, and then
checks through the API that the workshop really reached the database with its
time converted correctly — so the form, the conversion and the API are proven
to work together, not just separately.

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

### End-to-end — 27 Selenium specs

`test/sprint4.e2e.test.js`, run with `npm run test:e2e:sprint4` from the repo
root. **26 passing, 1 pending, 0 failing** in Chrome against the real database.

### Everything together, on `main`

| Suite | Result |
|---|---|
| Server unit tests (mine + teammates') | **335 passing, 21 suites** |
| Client unit tests | **49 passing** |
| Sprint 3 Selenium | 20 passing, 2 pending |
| Sprint 4 Selenium | 26 passing, 1 pending |
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
| **B5** | The seeker page forgets an enrollment on reload — it reads an `isEnrolled` flag the API never sends | medium | open, spec waiting |

B5 was found while testing the new T12.8 page. A seeker who enrols, then comes
back later, sees **Enroll** again instead of **Cancel enrollment**, and so
cannot cancel an enrollment from an earlier visit. The fix is one extra query
in `listAvailableWorkshops`; T12.E27 is already written against it and will
start passing the day the flag is sent.

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

Nothing of mine, and nothing is waiting on a teammate's unwritten code any
more. One check is held back by an open bug:

| Check | Waiting on | Owner |
|---|---|---|
| T12.E27 enrollment survives a reload | bug B5 — the API does not send `isEnrolled` | T12.5 or T12.8 |

Writing the checks before the code existed paid off twice in one day. The three
seeker checks went from pending to passing the moment T12.5 merged, and the
page checks the moment T12.7 and T12.8 merged — in both cases without a single
line being edited.

---

## 6. How to check this yourself

```bash
# seed the accounts the tests log in with
cd server
node seeds/seedTestNgo.js         # ngo@test.com        / Ngo@12345
node seeds/seedFacilitator.js     # facilitator@test.com / Facilitator@12345
node seeds/seedTestSeeker.js      # seeker@test.com      / Seeker@12345

# unit tests
cd server && npm test             # 335 passing
cd client && npm test             #  49 passing

# end-to-end (both apps must be running)
cd server && npm run dev          # :5000
cd client && npm run dev          # :5173
npm run test:e2e:sprint4          # from the repo root
```
