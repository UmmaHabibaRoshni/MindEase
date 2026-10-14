# BL-12 Workshops — QA Report (T12.12)

**Tester:** Ahnaf Shakib
**Date:** 14 October 2026
**Tasks:** T12.10 (Thunder Client), T12.11 (Selenium), T12.12 (this note)
**Updated** after T12.5 (PR #38) and T12.7/T12.8 (PR #41) merged — the whole
story is now tested end to end.

---

## 1. Summary

| | |
|---|---|
| Checks written | **53** (26 Thunder Client + 27 Selenium) |
| Checks that can run today | **52** |
| **Passing** | **52** |
| **Failing** | **0** |
| Held back by an open bug | 1 |
| Bugs found | **5** |
| Bugs since fixed | **2** |

**All of BL-12 is now covered.** The facilitator APIs (T12.4), the seeker
enrollment APIs (T12.5) and both pages (T12.7, T12.8) pass every check against
the real database. The one spec that does not run is waiting on bug B5, not on
a teammate.

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

**Executed in Chrome against the real database: 26 passing, 1 pending, 0 failing.**

```
Facilitator workshop APIs (T12.4) .... 17 passing
Seeker enrollment APIs (T12.5) .......  3 passing
Enrollment edge cases (T12.5) ........  3 passing
Workshop pages (T12.7 / T12.8) .......  3 passing, 1 pending
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

What the four UI specs cover:

| Spec | Check |
|---|---|
| T12.E21 | a facilitator fills the create form and the workshop reaches the database, with the time converted to the 12-hour value the API expects |
| T12.E22 | a seeker cannot reach the facilitator create form |
| T12.E26 | a seeker sees a newly created workshop listed, with an Enroll button |
| T12.E27 | an enrolled seeker still sees "Cancel enrollment" after a reload — **pending on B5** |

The form is driven through the native value setter rather than `sendKeys`,
because React controlled inputs ignore a plain assignment and the date and time
inputs only accept `sendKeys` in the browser's own locale format.

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

### B5 — The seeker page forgets an enrollment on reload *(medium, open)*

`Workshops.jsx` decides which button to show from a flag the server never sends:

```js
list.forEach((w) => {
  if (w.isEnrolled) next.add(w._id);
});
```

`listAvailableWorkshops` returns the raw workshop documents — there is no
`isEnrolled` anywhere in `server/`. So the set is only ever filled by the
seeker's own clicks in that page session. After a refresh, a workshop the
seeker has already joined shows **Enroll** again.

It is not destructive: clicking it returns 409 and the page catches that and
marks the workshop enrolled. But the seeker sees the wrong state until they
click, and they cannot cancel an enrollment made in an earlier visit, because
the Cancel button never appears.

**Fix:** have `listAvailableWorkshops` look up the caller's enrollments and
attach the flag — one extra query:

```js
const mine = await WorkshopEnrollment.find({
  seeker: req.user.id, status: "Enrolled",
}).distinct("workshop");
const ids = new Set(mine.map(String));
res.json(workshops.map((w) => ({ ...w.toObject(), isEnrolled: ids.has(String(w._id)) })));
```

T12.E27 is written against this and currently reports itself pending with the
reason. It will pass the moment the flag is sent, with no edit needed.

**Owner:** BL-12 backend (T12.5) or frontend (T12.8) — whoever gets there first.

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
| T12.E27 enrollment survives a reload | bug B5 — the API does not send `isEnrolled` | T12.5 or T12.8 |

That is the only one left, and it is waiting on a bug rather than on unwritten
code. It skips with the reason printed rather than failing, so the suite stays
honest and green.

Everything else that was blocked in the earlier versions of this report now
runs and passes: the seeker checks unblocked when T12.5 merged (PR #38), and
the page checks when T12.7 and T12.8 merged (PR #41), both on 14 October.
Neither needed a line changed to start working.

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
| Server unit tests | **249 passing** |
| Client unit tests | **31 passing** |
| Sprint 3 Selenium | **20 passing, 2 pending** |
| Sprint 4 Selenium (this story) | **26 passing, 1 pending** |
| **Failing anywhere** | **0** |

Both high-severity bugs are fixed and have a regression test each. Of the three
still open, only B5 affects what a user sees, and it is a one-query fix with a
spec already waiting for it.
