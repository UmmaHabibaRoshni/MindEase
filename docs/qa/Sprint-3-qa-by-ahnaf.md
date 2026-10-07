# Sprint 3 — QA Report

**By:** Ahnaf Shakib
**Date:** 7 October 2026
**Branch:** `feature/ahnaf-sprint3`

---

## 1. Summary

I finished all four of my Sprint 3 tasks and tested them. I also wrote Selenium
tests for the other three members' stories.

| | |
|---|---|
| Tests written | **125** |
| Tests run and passing | **100** (60 server, 20 client, 20 Selenium) |
| Tests skipped on purpose | 2 (teammate pages not merged yet) |
| Tests failing | **0** |
| Bugs found | **8** |
| Bugs fixed | **3** |

**The important part:** three bugs were serious enough to break the app for
everyone. All three are now fixed. See section 4.

---

## 2. What I built

### BL-10 — Availability (database)

| Task | File |
|---|---|
| T10.1 | `server/models/VolunteerAvailability.js` |
| T10.2 | `server/config/availabilityOptions.js` + `client/src/constants/availabilityOptions.js` |
| T10.3 | `server/tests/volunteerAvailability.test.js` — 16 tests |

### BL-8 — Admin verification (frontend)

| Task | File |
|---|---|
| T8.7 | `client/src/api/adminApi.js`, `client/src/pages/admin/Verifications.jsx` |
| T8.8 | `/dashboard/verifications` route (admin only) in `client/src/App.jsx` |
| T8.9 | 2 test files — 20 tests |

The admin can see every pending account, approve it, or reject it with a reason.

### BL-9 — Escalation (backend)

| Task | File |
|---|---|
| T9.4, T9.5 | `server/controllers/escalationController.js`, `server/routes/escalationRoutes.js` |
| T9.6 | `server/tests/escalation.test.js` — 31 tests |

Six new endpoints:

| Method | Route | Who can use it |
|---|---|---|
| POST | `/api/escalations` | volunteer |
| GET | `/api/escalations/psychologists` | volunteer |
| GET | `/api/escalations/assigned` | psychologist |
| PATCH | `/api/escalations/:id/accept` | psychologist |
| PATCH | `/api/escalations/:id/reject` | psychologist |
| PATCH | `/api/escalations/:id/complete` | psychologist |

How it works: a volunteer hands a case to a psychologist with a written summary.
The request becomes `escalated`. The psychologist then accepts, rejects, or
completes it. Rejecting gives the case back to the volunteer. Completing closes
the request.

### BL-11 — Resources (testing)

| Task | File |
|---|---|
| T11.10 | `docs/thunder-client/BL-11-resources.json` — 23 requests |
| T11.11 | `test/sprint3.e2e.test.js` — 22 Selenium tests |
| T11.12 | this report |

---

## 3. Test results

### 3.1 Server unit tests — `cd server && npm test`

```
Test Suites: 5 passed, 5 total
Tests:       60 passed, 60 total
```

| File | Tests | Whose story |
|---|---|---|
| `volunteerAvailability.test.js` | 16 | mine (BL-10) |
| `escalation.test.js` | 31 | mine (BL-9) |
| `CaseAssignment.test.js` | 2 | Tanjila |
| `User.test.js` | 5 | Bithi |
| `seedAdmin.test.js` | 2 | Bithi |

### 3.2 Client unit tests — `cd client && npm test`

```
Test Files  2 passed (2)
Tests      20 passed (20)
```

The client had **no test setup at all** before this sprint. I added Vitest and
React Testing Library, so anyone can now write component tests by just adding a
`.test.jsx` file.

### 3.3 Selenium tests — `npm run test:e2e`

Run in real Chrome, against the real app.

```
20 passing (26s)
2 pending
0 failing
```

| Story | Passing | Skipped |
|---|---|---|
| BL-8 Admin verification | 4 | – |
| BL-9 Escalation | 4 | 1 |
| BL-10 Availability | 3 | 1 |
| BL-11 Resources | 9 | – |

The 2 skipped tests need pages that are not merged yet (Roshni's
`Availability.jsx`, Bithi's `EscalateModal.jsx`). Instead of failing, they are
marked *pending* with the reason printed, and the matching API is tested instead.
When those pages land, the tests start checking them automatically.

### 3.4 Full user journey (tested by hand over HTTP)

This is the evidence behind the Thunder Client collection. Every step passed.

| Step | Result |
|---|---|
| Admin logs in | 200 |
| Volunteer registers | 201 — "awaiting admin approval" |
| Volunteer tries to log in while pending | 403 — correctly blocked |
| Admin loads pending accounts (T8.4) | 200 — 1 account |
| Admin approves the volunteer (T8.5) | 200 |
| Volunteer logs in again | 200 |
| Volunteer reads their availability | 200 ← *used to crash, see B2* |
| Volunteer saves Monday 09:00–17:00 | 200 |
| Volunteer lists psychologists (T9.4) | 200 |
| Volunteer sends a too-short summary | 400 — correctly rejected |
| Volunteer opens the psychologist queue | 403 — correctly blocked |
| Admin creates a resource | 201 |
| Anyone reads resources | 200 |

**Note on Thunder Client:** I did not click through the Thunder Client app
itself. The collection is ready to import and run, and every request in it was
run over HTTP and passed, as shown above.

---

## 4. Bugs

### Fixed

#### B1 — The whole website was blank *(critical)*

`ResourceLibrary.jsx` imported `../components/ResourceCard`. From that folder
the path pointed at `src/pages/components/`, where nothing exists. The real file
is in `src/components/`.

Because `App.jsx` loads that page immediately, one bad import broke the entire
bundle, so **every page went white** — not just the resources page. `npm run
build` failed too, so this was broken on GitHub for everyone.

Fixed by correcting the path. Tanjila's later rewrite removed the import
altogether, so it cannot come back.

#### B2 — Volunteer availability always crashed *(high)*

`GET /api/volunteer/availability` returned **500** every time a volunteer opened
it for the first time.

Why: the controller creates the record with only the volunteer's id, but my model
required `dayOfWeek`, `startTime` and `endTime`. So the record it tried to create
was invalid and threw.

Fixed in T10.1. The day and time are now optional, and the real rules moved into
one validation step:

- time must look like `HH:MM`
- `endTime` must be later than `startTime`
- a volunteer can only be marked *available* once a full window is filled in

So a volunteer can exist without a schedule, but cannot be shown as bookable
without one. No change was needed in Tanjila's controller. 4 tests cover this.

#### B3 — The resource library never showed real resources *(high)*

My Selenium test caught this one. The API returned a resource, but the page
showed nothing:

```
AssertionError: expected 'MindEase Home About Dashboard …'
  to include 'Coping with panic attacks'
```

The API answers `{ count, resources }`. The page was checking `data.success`,
which does not exist, so the list stayed empty. After Tanjila's rewrite the same
problem appeared differently: it read `res.data.length`, but `res.data` is an
object, not an array, so the page always fell back to 3 hardcoded sample
resources instead of real data.

Fixed by reading `res.data.resources`. I also made the URL relative
(`/api/resources` instead of `http://localhost:5000/...`) so it works through the
Vite proxy and after deployment.

### Open — need the owner to fix

#### B4 — Admin cannot actually save a resource *(high — Tanjila, T11.8)*

The Manage Resources page looks like it works, but nothing is saved.

Two reasons:

1. **No login token is sent.** Those routes require an admin token, so the server
   replies 401. The errors are caught by empty `catch {}` blocks and the page
   updates its own local list, so it *looks* successful until you refresh.
2. **The form sends the wrong fields.** It sends `category: "Mental Health"` and
   `link`, but the server expects `category` to be a category **id** and the
   field to be called `url`. It also needs `type` to be `helpline` or `article`,
   not `PDF`/`Audio`.

`client/src/api/adminApi.js` shows the pattern to copy — an axios instance that
attaches the token automatically.

#### B5 — The resource seed script creates no resources *(medium — Bithi, T11.2)*

In `seedResources.js` the `RESOURCES` list is empty, so the script creates the 6
categories and then zero resources. Running it leaves the library blank, which
looks like a page bug. I added one resource through the API so Selenium had
something real to check.

#### B6 — `MONGO_URI` is rejected by MongoDB *(blocker — needs Atlas access)*

The server will not start:

```
MongoDB connection failed: bad auth : authentication failed
```

This is the password, not the config. I confirmed it by passing the same
connection string straight into `mongoose.connect()` with `.env` out of the
picture — same error. (`bad auth` means the login was refused; a firewall or
IP problem would time out instead.)

So the `mindease_admin` user's password was changed or the user was deleted.
Someone with MongoDB Atlas access needs to reset it and share the new URI.

For all the testing above I used a temporary local MongoDB instead.

#### B7 — Saving availability skips two safety checks *(low — Tanjila, T10.4/T10.5)*

`findOneAndUpdate` does not run the validation step described in B2, so the
`endTime` must be after `startTime` rule and the "no availability without a
window" rule are not enforced when saving through `PATCH`. The `HH:MM` format
check still runs.

Easiest fix: load the record, change it, then call `save()`.

#### B8 — `REQUEST_STATUSES.RESOLVED` is not a real status *(low)*

`server/config/requestOptions.js` exports `RESOLVED: "resolved"`, but the allowed
statuses are `pending`, `accepted`, `escalated`, `referred`, `closed`. Using that
constant anywhere will throw. My code writes `closed` instead. Either add
`resolved` to the model or delete the constant.

### Cleanup note

`client/src/components/ResourceCard.jsx` is no longer used by any page after the
rewrite. It is also the only file still written with Tailwind classes, and
Tailwind is not installed in this project, so those styles never applied. Safe
to delete.

---

## 5. How to run everything yourself

### Unit tests — no database needed

```bash
cd server && npm test      # 60 passing
cd client && npm test      # 20 passing
```

### The app and the Selenium tests — database needed

```bash
# 1. start the backend and frontend
cd server && npm run dev     # port 5000
cd client && npm run dev     # port 5173

# 2. create the admin and the categories
cd server
node seeds/seedAdmin.js
node seeds/seedResources.js

# 3. run Selenium from the project root
set E2E_ADMIN_PASSWORD=<admin password>
npm run test:e2e
```

Open the site at **http://localhost:5173**.

Test logins used by the tests:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@mindease.com` | set by `seedAdmin.js` |
| Volunteer | `volunteer@test.com` | `Test@1234` |

Remember a volunteer must be approved by an admin before they can log in.

### Thunder Client

Import `docs/thunder-client/BL-11-resources.json`, fill in the `baseUrl`,
`adminToken` and `volunteerToken` variables, then press **Run All**.

---

## 6. Notes for the team

1. **B6 is blocking everyone.** Nobody can run the app against the real database
   until the MongoDB password is fixed.
2. **B4 should be fixed before the demo.** Right now the admin resources page
   appears to work but saves nothing.
3. **Empty `catch {}` blocks hide real errors.** That is why B4 went unnoticed —
   the page swallowed every 401. It is worth at least logging the error.
4. **I changed two files that belong to someone else** (`ResourceLibrary.jsx` and
   `ManageResources.jsx`) because the site was unusable otherwise. Both changes
   are small and only fix how the API response is read. The page layouts are
   untouched.
5. **One difference from the sprint sheet:** the sheet calls the model
   `Availability.js`. I kept the existing name `VolunteerAvailability.js`, because
   `availabilityController.js` and an already-merged test import that name, and
   renaming it would break working code for no benefit.
6. **The Selenium suite paid for itself immediately.** B3 failed on the very
   first run. Unit tests could never have found it, because it only appears when
   a real API response meets a real page in a real browser.
