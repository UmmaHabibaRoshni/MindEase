# BL-12 Workshops — QA Report (T12.12)

**Tester:** Ahnaf Shakib
**Date:** 14 October 2026
**Branch:** `feature/ahnaf-sprint4-bl12-testing`
**Tasks:** T12.10 (Thunder Client), T12.11 (Selenium), T12.12 (this note)

---

## 1. Summary

| | |
|---|---|
| Checks written | **47** (25 Thunder Client + 22 Selenium) |
| Checks that can run today | **37** |
| **Passing** | **37** |
| **Failing** | **0** |
| Blocked, waiting on teammates | 10 |
| Bugs found | **4** |

The facilitator half of BL-12 (T12.4) works correctly — all 17 of its checks
pass against the real database. The seeker half cannot be tested at all,
because T12.5 has not been written yet.

---

## 2. What was tested

### Thunder Client — T12.10

`docs/thunder-client/BL-12-workshops.json` imports as **MindEase BL-12
Workshops (T12.10)**: 25 requests with assertions attached, driven by the env
vars `baseUrl`, `facilitatorToken`, `otherFacilitatorToken`, `seekerToken` and
`workshopId`.

Requests 1–20 run today. Requests 21–25 are written in advance for T12.5 and are
clearly labelled `PENDING T12.5` with a note on each, including the route names
I assumed from the sprint sheet — those must be checked against Roshni's actual
implementation before anyone trusts them.

### Selenium — T12.11

`test/sprint4.e2e.test.js`, run with `npm run test:e2e:sprint4`.

**Executed in Chrome against the real database: 17 passing, 5 pending, 0 failing.**

```
Facilitator workshop APIs (T12.4) .... 17 passing
Seeker enrollment APIs (T12.5) ....... 3 pending
Workshop pages (T12.7 / T12.8) ....... 2 pending
```

What the 17 cover:

| Area | Checks |
|---|---|
| Auth | no token → 401, seeker → 403, facilitator → 201 |
| Create validation | past date, title under 5 chars, 24-hour time, unknown mode, tags sent as a string |
| Privilege | `facilitator`, `status` and `enrolledCount` cannot be set from the request body |
| Update | own workshop succeeds; bad id → 400; unknown id → 404; no editable field → 400 |
| Cancel | succeeds; cancelling twice → 400; a cancelled workshop cannot be edited |
| UI | a facilitator can log in and land on their dashboard |

**The suite cleans up after itself.** Every workshop it creates is titled
`E2E TEST - ...` and cancelled in the `after` hook, because this runs against the
team's shared database. The last run reported `cleanup: cancelled 7 workshop(s)`.

### Supporting work

`server/seeds/seedTestSeeker.js` — a seeker with a known password
(`seeker@test.com` / `Seeker@12345`), with 5 unit tests. Needed because
`seedTestNgo.js` only creates a seeker when the database has none at all, so on
a database that already had 6 real seekers there was no account anyone knew the
password for. Two specs were stuck on that until this was added.

---

## 3. Bugs

### B1 — A seeker can never re-enroll after cancelling *(high, blocks T12.5)*

`WorkshopEnrollment.js`:

```js
workshopEnrollmentSchema.index({ workshop: 1, seeker: 1 }, { unique: true });
```

The unique index covers cancelled rows too. So a seeker who enrols, cancels,
then changes their mind gets a duplicate-key error instead of an enrollment.
T12.5 explicitly requires enroll *and* cancel, so the main flow breaks.

**Fix:** either a partial index —

```js
{ unique: true, partialFilterExpression: { status: { $ne: 'Cancelled' } } }
```

— or have the enroll API reuse the existing row and set its status back to
`Enrolled`.

**Owner:** BL-12 database (T12.2, Tanjila) or BL-12 backend (T12.5, Roshni),
whichever is easier to change now.

### B2 — Capacity can be exceeded by simultaneous enrollments *(high, blocks T12.5)*

`Workshop.incrementEnrollment()` reads, checks, then saves:

```js
if (this.isFull) throw ...
this.enrolledCount += 1;
await this.save();
```

Two seekers enrolling at the same moment both read `enrolledCount = 9` against
`capacity = 10`, both pass the check, and both enrollment rows are created —
11 people enrolled while the counter says 10. T12.5's requirement is literally
"capacity limit", so this is the rule that fails.

**Fix:** one atomic update, no read-then-write:

```js
Workshop.findOneAndUpdate(
  { _id, $expr: { $lt: ['$enrolledCount', '$capacity'] } },
  { $inc: { enrolledCount: 1 } },
  { new: true }
);
```

`null` means it was full. Thunder Client request 24 is written for this.

**Owner:** BL-12 backend (T12.5, Roshni).

### B3 — Date and time are stored separately *(medium, design)*

`date` is a `Date` and `time` is a 12-hour string (`"02:15 PM"`). There is no
single start timestamp, so "list upcoming workshops" can only sort by day — two
workshops on the same day cannot be ordered, and a workshop earlier today cannot
be excluded. It is also ambiguous across timezones.

Worth settling before T12.5 is written, because changing it afterwards means
migrating existing rows.

**Owner:** BL-12 database (T12.1, Tanjila).

### B4 — Enum casing is inconsistent with the rest of the codebase *(low)*

Workshop uses `'Online'`, `'Scheduled'`, `'Enrolled'`. Everything else in
MindEase uses lowercase: `'mental_health'`, `'pending'`, `'accepted'`. Not a
bug on its own, but the frontend must match exactly or every request 400s —
and this already caused a real failure in BL-13, where the dashboard sent
`'Accepted'` to an API expecting `'accepted'`.

**Suggestion:** leave the model alone now, but have T12.7/T12.8 import the
allowed values rather than retyping them.

---

## 4. Not bugs — checked and correct

Worth recording, because two of these looked wrong at first glance:

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

---

## 5. Blocked — and why

| Check | Blocked by | Owner |
|---|---|---|
| T12.E18 seeker lists upcoming workshops | no `GET /api/workshops` exists | Roshni, T12.5 |
| T12.E19 enroll, and no double-enroll | no enrollment endpoint | Roshni, T12.5 |
| T12.E20 capacity limit | no enrollment endpoint | Roshni, T12.5 |
| T12.E21 Create Workshop form | `CreateWorkshop.jsx` not merged | Bithi, T12.7 |
| T12.E22 seeker Workshops page | `Workshops.jsx` not merged | Bithi, T12.8 |
| Thunder Client 21–25 | same as above | Roshni, T12.5 |

**T12.4 is merged but T12.5 is not.** There is no `GET` route on
`/api/workshops` at all — a facilitator cannot even list their own workshops.

These 10 checks are written and will start running the moment the code lands;
none of them needs editing first. They skip with the reason printed rather than
failing, so the suite stays honest and green.

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
facilitator and a seeker, paste the two tokens into the env vars, then **Run All**.

---

## 7. Totals

| Suite | Result |
|---|---|
| Server unit tests | **207 passing** |
| Client unit tests | **31 passing** |
| Sprint 3 Selenium | **20 passing, 2 pending** |
| Sprint 4 Selenium (this story) | **17 passing, 5 pending** |
| **Failing anywhere** | **0** |

Two bugs (B1 and B2) will break T12.5 as soon as it is written, so they are
worth fixing before that code, not after.
