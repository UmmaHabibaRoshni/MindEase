# BL-18 frontend and tests - T18.4 to T18.14

Author: Ahnaf
Date: 2026-11-01 (Day 2)

> **Tanjila is ill.** T18.4, T18.5, T18.6, T18.8, T18.9, T18.11, T18.12, T18.14
> and T17.2 were hers on the plan and were done by Ahnaf so the demo is not
> blocked. The backlog ownership has not changed; this note records who
> actually did the work.

## What is in this branch

| Task | Owner on the plan | What | Where |
|---|---|---|---|
| T17.2 | Tanjila | unit tests: workshop price and Payment model | `server/tests/paymentModel.test.js` |
| T18.4 | Tanjila | unit tests: video access rules | `server/tests/videoAccess.test.js` |
| T18.5 | Tanjila | Thunder Client collection for the video APIs | `docs/thunder-client/BL-18-video.json` |
| T18.6 | Tanjila | `VideoRoom` component and route | `client/src/components/video/` |
| T18.7 | **Ahnaf** | Join video session on the workshop card | `client/src/pages/seeker/Workshops.jsx` |
| T18.8 | Tanjila | Join video consultation on the psychologist case page | `client/src/pages/psychologist/CaseDetailPage.jsx` |
| T18.9 | Tanjila | Join video consultation on the seeker request card | `client/src/pages/seeker/SeekerDashboard.jsx` |
| T18.10 | **Ahnaf** | unit tests: VideoRoom and workshop join button | `client/src/test/videoRoom.test.jsx` |
| T18.11, T18.12 | Tanjila | unit tests: psychologist and seeker join buttons | `client/src/test/videoJoinButtons.test.jsx` |
| T18.13 | **Ahnaf** | Selenium: who sees the workshop join button | `test/t18-video.e2e.test.js` |
| T18.14 | Tanjila | Selenium: psychologist sees it on an accepted case | same file |
| D6.5 | **Ahnaf** | report sections | `docs/report/BL-17-BL-18-sections-by-ahnaf.md` |

## Three things I had to change beyond the tasks

### 1. A bug that made T18.7 impossible (fixed)

`GET /api/workshops/available` never returned `isEnrolled`. The seeker page
tracked enrollment only in React state, so **after a reload an enrolled seeker
was offered "Enroll" again** - and, once the video button existed, never saw it,
because it only shows to enrolled seekers.

This predates BL-18 and had passed unit testing, because the unit tests exercise
the enroll *action*, not the state of the page after a reload. Only the Selenium
spec caught it. The list now reports `isEnrolled` per workshop for the caller.
Three tests were added in `server/tests/workshop.test.js`, and two mocks there
were extended (workshop rows needed `toJSON`, the enrollment filter needed
`$in`).

### 2. A new endpoint the seeker needs (added)

`GET /api/video/request/:id`. A seeker's dashboard lists **crisis requests** and
never sees a `CaseAssignment` id, so with only `/api/video/case/:id` there was
no way for a seeker to reach a consultation at all. The new route resolves a
request to its accepted case and returns **the same room**, derived from the
assignment id. A unit test and a Selenium spec both assert the two routes
produce identical room names - if they ever diverge, the seeker and the
psychologist silently end up in two different empty Jitsi rooms.

### 3. The psychologist case page was never routed (routed)

`CaseDetailPage.jsx` existed but had no route in `App.jsx`, so T18.8 had nowhere
to put a button. It is now at `/dashboard/psychologist/cases/:caseId`.

While wiring it I found a shape mismatch that **predates this work**: the API
answers `{ case: {...} }` with lowercase statuses (`accepted`), while the page
reads a flat object with capitalised ones (`Accepted`). That means the page's
own "Mark Session Completed" button does not appear. I did **not** rewrite the
page - that is a bigger change than this task, and not mine to make while the
owner is ill. The video button normalises both shapes so it works either way,
and a test covers both. **Someone should fix the page properly before the demo**
(D6.2 should avoid demonstrating that button until then).

## Checks I ran

| Suite | Result |
|---|---|
| `server/tests/paymentModel.test.js` (T17.2) | 31 passed |
| `server/tests/videoAccess.test.js` (T18.4) | 31 passed |
| `client/src/test/videoRoom.test.jsx` (T18.10) | 21 passed |
| `client/src/test/videoJoinButtons.test.jsx` (T18.11, T18.12) | 16 passed |
| **whole server suite** | **548 passed, 30 suites** |
| **whole client suite** | **204 passed, 12 files** |
| `test/t18-video.e2e.test.js` (T18.13, T18.14) | **9 passing**, real Chrome |
| `test/t17.12-payment.e2e.test.js` (re-run after the fix) | 11 passing, 1 pending |
| `test/t17.6-payment-api-qa.js` (re-run) | 13 passed, 0 failed, 3 waiting |

The Selenium run builds its own accepted case through the API - seeker raises a
request, volunteer accepts, volunteer escalates, psychologist accepts - and
marks it completed in cleanup. Workshops it creates are cancelled. If any
account in that chain is missing it marks itself pending with the reason
printed, rather than failing.

**Both directions were confirmed against the live database:** the facilitator
and an enrolled seeker get the same `roomName`, and so do the psychologist and
the seeker, whether the seeker arrives via the case route or the request route.

## Not done, and why

- **T18.15** (two-browser call, Roshni) - needs two real browsers and a human.
  The one thing no automated test here can establish is that two people could
  actually see and hear each other. **This is still the single most important
  unchecked thing in BL-18.**
- **T17.13** (manual sandbox payment, Tanjila) - needs the SSLCommerz sandbox
  keys, which I do not have, and a human on the card form.
- **C6.5** (Selenium left from Sprint 4, Tanjila) - the plan says "Confirm which
  test". I do not know which test was meant, so I have not guessed.
- **D6.4** (clean test data in Atlas, Tanjila, Day 4) - deliberately left until
  after the last test run, as the plan says. Note there are now inert
  `Cancelled` enrollment rows and `pending` Payment rows from test runs.
- **Facilitator workshop list** - a facilitator can create a workshop and the
  API will let them into its room, but no page lists the workshops they own, so
  there is no button for them to click. They can reach a room at
  `/dashboard/video/workshop/<id>`. Building that list is a new backlog item,
  not part of T18.7, so I have not built it. **D6.2 needs to account for this:
  the facilitator is the moderator, so someone has to open the room first.**

## Open questions carried forward

1. **Hybrid workshops** are refused a room (the task said "online"). A test
   records the current behaviour so changing it is a deliberate act.
2. **Completed workshops** still get a room; only cancelled ones are refused.
3. Everyone must set the same `VIDEO_ROOM_SECRET`. This has not changed and is
   still the most likely thing to break on demo day.
