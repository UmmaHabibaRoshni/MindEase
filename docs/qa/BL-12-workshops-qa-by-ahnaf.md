# BL-12 Workshops — QA Report (T12.12)

**Tester:** Ahnaf Shakib
**Date:** 14 October 2026
**Tasks:** T12.10 (Thunder Client), T12.11 (Selenium), T12.12 (this note)
**Updated** after T12.5 merged (PR #38) — the seeker half is now tested for real.

---

## 1. Summary

| | |
|---|---|
| Checks written | **51** (26 Thunder Client + 25 Selenium) |
| Checks that can run today | **49** |
| **Passing** | **49** |
| **Failing** | **0** |
| Blocked, waiting on teammates | 2 |
| Bugs found | **4** |
| Bugs since fixed | **2** |

Both halves of BL-12 now work. The facilitator APIs (T12.4) and the seeker
enrollment APIs (T12.5) pass every check against the real database. Only the
two UI specs are still waiting, on T12.7 and T12.8.

---

## 2. What was tested

### Thunder Client — T12.10

`docs/thunder-client/BL-12-workshops.json` imports as **MindEase BL-12
Workshops (T12.10)**: 26 requests with assertions attached, driven by the env
vars `baseUrl`, `facilitatorToken`, `otherFacilitatorToken`, `seekerToken`,
`otherSeekerToken` and `workshopId`.

Requests 21–26 were written in advance of T12.5 and have now been corrected
against Roshni's real implementation. One of them had to change: I had guessed
the list route would be `GET /api/workshops`, and it is actually
`GET /api/workshops/available`. The four enroll and cancel routes I guessed
correctly. Request 26 is new — it is the regression test for B1.

### Selenium — T12.11

`test/sprint4.e2e.test.js`, run with `npm run test:e2e:sprint4`.

**Executed in Chrome against the real database: 23 passing, 2 pending, 0 failing.**

```
Facilitator workshop APIs (T12.4) .... 17 passing
Seeker enrollment APIs (T12.5) .......  3 passing
Enrollment edge cases (T12.5) ........  3 passing
Workshop pages (T12.7 / T12.8) .......  2 pending
```

What the facilitator specs cover:

| Area | Checks |
|---|---|
| Auth | no token → 401, seeker → 403, facilitator → 201 |
| Create validation | past date, title under 5 chars, 24-hour time, unknown mode, tags sent as a string |
| Privilege | `facilitator`, `status` and `enrolledCount` cannot be set from the request body |
| Update | own workshop succeeds; bad id → 400; unknown id → 404; no editable field → 400 |
| Cancel | succeeds; cancelling twice → 400; a cancelled workshop cannot be edited |
| UI | a facilitator can log in and land on their dashboard |

What the six seeker specs cover:

| Spec | Check |
|---|---|
| T12.E18 | a seeker lists available workshops and sees one just created |
| T12.E19 | enrolling works; enrolling twice → 409; the seat is counted once |
| T12.E20 | a second seeker cannot take a seat in a workshop of capacity 1 |
| T12.E23 | enroll → cancel → enroll again works, and still counts one seat |
| T12.E24 | cancelling without being enrolled → 404 |
| T12.E25 | no token → 401, facilitator → 403, bad id → 400, unknown id → 404 |

**The suite cleans up after itself.** Every workshop it creates is titled
`E2E TEST - ...` and cancelled in the `after` hook, because this runs against
the team's shared database. The last run reported
`cleanup: cancelled 12 workshop(s)`.

The capacity spec needs two seekers. Rather than ask for another seeded
account, the suite registers `e2e.second.seeker@test.com` once and reuses it on
every later run, so it adds one row to the database in total, not one per run.

### Supporting work

`server/seeds/seedTestSeeker.js` — a seeker with a known password
(`seeker@test.com` / `Seeker@12345`), with 5 unit tests. Needed because
`seedTestNgo.js` only creates a seeker when the database has none at all, so on
a database that already had 6 real seekers there was no account anyone knew the
password for. Two specs were stuck on that until this was added.

---

## 3. Bugs

### B1 — A seeker could never re-enroll after cancelling — **FIXED**

`WorkshopEnrollment.js` has a unique index on `{ workshop, seeker }` that covers
cancelled rows, so a plain insert for a returning seeker fails with a duplicate
key error.

The merged T12.5 handles it by reusing the row instead of inserting a new one:

```js
let enrollment = await WorkshopEnrollment.findOneAndUpdate(
  { workshop: id, seeker: req.user.id, status: "Cancelled" },
  { $set: { status: "Enrolled", enrolledAt: new Date(), ... } },
  { new: true }
);
```

**Verified fixed** by T12.E23 — enroll, cancel, enroll again all succeed and the
seat is counted once. Thunder Client request 26 is the same check. The index
itself is unchanged, so if anyone rewrites the enroll controller this breaks
again; that is what the spec is there to catch.

### B2 — Capacity could be exceeded by simultaneous enrollments — **FIXED**

`Workshop.incrementEnrollment()` read `enrolledCount`, checked it, then saved,
so two seekers could both take the last seat.

T12.5 does not use that method. It takes the seat in one atomic update, exactly
as recommended, and hands the seat back if the enrollment row then fails:

```js
const workshop = await Workshop.findOneAndUpdate(
  { _id: id, status: "Scheduled", date: { $gte: startOfToday() },
    $expr: { $lt: ["$enrolledCount", "$capacity"] } },
  { $inc: { enrolledCount: 1 } }
);
if (!workshop) { /* 404, 400, or 409 "Workshop is full" */ }
```

**Verified fixed** by T12.E20 — a capacity-1 workshop takes one seeker and
refuses the second with 409 "Workshop is full", and `enrolledCount` never passes
`capacity`.

Note that `incrementEnrollment()` is still on the model and still has the race.
Nothing calls it now, but it should be deleted so nobody uses it later.

### B3 — Date and time are stored separately *(medium, design — still open)*

`date` is a `Date` and `time` is a 12-hour string (`"02:15 PM"`). There is no
single start timestamp, so `listAvailableWorkshops` can only sort by day — two
workshops on the same day cannot be ordered, and a workshop earlier today
cannot be excluded. It is also ambiguous across timezones.

Now that T12.5 is written, changing this means migrating existing rows, so it
is a decision for the team rather than a quick fix.

**Owner:** BL-12 database (T12.1, Tanjila).

### B4 — Enum casing is inconsistent with the rest of the codebase *(low — still open)*

Workshop uses `'Online'`, `'Scheduled'`, `'Enrolled'`. Everything else in
MindEase uses lowercase: `'mental_health'`, `'pending'`, `'accepted'`. Not a
bug on its own, but the frontend must match exactly or every request 400s —
and this already caused a real failure in BL-13, where the dashboard sent
`'Accepted'` to an API expecting `'accepted'`.

**Suggestion:** leave the model alone, but have T12.7 and T12.8 import the
allowed values rather than retyping them.

---

## 4. Not bugs — checked and correct

Worth recording, because several of these looked wrong at first glance:

- **Editing a workshop into the past is blocked.** The model validator only runs
  on create, but `workshopController.checkFields()` re-checks the date on update
  as well, so the gap is covered.
- **Privileged fields are safe.** `status`, `enrolledCount` and `facilitator`
  are not in the controller's `EDITABLE` list, so a facilitator cannot set them
  from the request body. Verified: T12.E5 and T12.E12.
- **Ownership is enforced.** Update and cancel both scope the lookup to
  `facilitator: req.user.id`, so another facilitator gets a 404 rather than
  someone else's workshop.
- **Cancelling a workshop cancels its enrollments** and reports how many.
- **A failed enrollment gives the seat back.** If the row cannot be created
  after the seat is taken, the controller decrements `enrolledCount` again
  before returning 409. Verified by T12.E19 — the count stays at 1 after a
  rejected second attempt.

---

## 5. Blocked — and why

| Check | Blocked by | Owner |
|---|---|---|
| T12.E21 Create Workshop form | `CreateWorkshop.jsx` not merged | T12.7 |
| T12.E22 seeker Workshops page | `Workshops.jsx` not merged | T12.8 |

Both are written and will start running the moment the pages land; neither
needs editing first. They skip with the reason printed rather than failing, so
the suite stays honest and green.

Everything else that was blocked in the first version of this report is now
unblocked and passing, because T12.5 merged on 14 October.

---

## 6. How to reproduce

```bash
# one-time: seed the accounts the specs log in with
cd server
node seeds/seedFacilitator.js     # facilitator@test.com / Facilitator@12345
node seeds/seedTestSeeker.js      # seeker@test.com / Seeker@12345

# start both apps
cd server && npm run dev          # :5000
cd client && npm run dev          # :5173

# run the suite from the repo root
npm run test:e2e:sprint4
```

Thunder Client: import `docs/thunder-client/BL-12-workshops.json`, log in as the
facilitator and two seekers, paste the tokens into the env vars, then **Run All**.

---

## 7. Totals

| Suite | Result |
|---|---|
| Server unit tests | **230 passing** |
| Client unit tests | **31 passing** |
| Sprint 3 Selenium | **20 passing, 2 pending** |
| Sprint 4 Selenium (this story) | **23 passing, 2 pending** |
| **Failing anywhere** | **0** |

Both high-severity bugs are fixed and have a regression test each. The two
remaining bugs are a design decision (B3) and a naming inconsistency (B4),
neither of which blocks anyone.
