# BL-18 / T18.2, T18.3 - video room APIs: contract and checks

Author: Ahnaf
Date: 2026-10-31 (Day 1)
Decided by: [T18.1 spike](BL-18-jitsi-spike-by-ahnaf.md) - open in a new tab, do not embed
Unblocks: T18.4, T18.5 (Tanjila), T18.6-T18.9 (frontend), T18.13, T18.14

## The two endpoints

Both are `GET`, both need a `Bearer` token, and both are read-only - nothing is
stored, the room name is derived from the record's id.

### `GET /api/video/workshop/:id` (T18.2)

Roles allowed through the route: `facilitator`, `seeker`.

| Case | Status | Message |
|---|---|---|
| no token | 401 | `No token provided. Access denied.` |
| wrong role (e.g. psychologist) | 403 | `You are not allowed to access this resource.` |
| id is not an ObjectId | 400 | `Invalid workshop id` |
| no such workshop | 404 | `Workshop not found` |
| workshop is In-Person or Hybrid | 400 | `This workshop is not held online, so it has no video room.` |
| workshop is Cancelled | 400 | `This workshop has been cancelled.` |
| facilitator who does not own it | 403 | `You are not part of this workshop.` |
| seeker not enrolled (or cancelled) | 403 | `You are not part of this workshop.` |
| **facilitator who owns it** | **200** | room, `isModerator: true` |
| **seeker enrolled (or attended)** | **200** | room, `isModerator: false` |

### `GET /api/video/case/:id` (T18.3)

Roles allowed through the route: `psychologist`, `seeker`.

| Case | Status | Message |
|---|---|---|
| no token | 401 | `No token provided. Access denied.` |
| wrong role (e.g. facilitator) | 403 | `You are not allowed to access this resource.` |
| id is not an ObjectId | 400 | `Invalid case id` |
| no such case | 404 | `Case not found` |
| case is pending / rejected / completed | 400 | `This case is not accepted, so there is no consultation room yet.` |
| a psychologist the case is not assigned to | 403 | `You are not part of this case.` |
| a seeker who is not on the case | 403 | `You are not part of this case.` |
| **the assigned psychologist** | **200** | room, `isModerator: true` |
| **the seeker on the case** | **200** | room, `isModerator: false` |

### The 200 body

```json
{
  "roomName": "mindease-workshop-6ace99e5a97b2180cfb043ef-b202d178fa",
  "domain": "meet.jit.si",
  "url": "https://meet.jit.si/mindease-workshop-6ace99e5a97b2180cfb043ef-b202d178fa",
  "displayName": "Test Facilitator",
  "subject": "Managing Exam Stress",
  "isModerator": true,
  "workshop": { "id": "6ace99e5a97b2180cfb043ef", "title": "Managing Exam Stress" }
}
```

The case endpoint returns the same shape with `subject: "MindEase consultation"`
and `"case": { "id": "..." }` in place of `workshop`.

**For the frontend (T18.6 - T18.9):** open `url` in a new tab. `domain`,
`roomName` and `displayName` are there only so an embedded version later needs
no API change. `isModerator` is for the UI wording ("Start the session" vs
"Join the session") - it is **not** a Jitsi permission; Jitsi decides moderator
by who arrives first.

## Checks I ran (Day 1)

**Unit:** `server/tests/videoRoom.test.js` - 10 tests on the name helper
(determinism, workshop vs case separation, salt sensitivity, URL safety,
ObjectId accepted, domain fallback). `npx jest` in `server/`: **483 passed, 28
suites** - the whole suite, so nothing already on main regressed.

**Against the running server and the shared Atlas database**, logged in with the
seeded accounts. Every row in both tables above was exercised and matched,
except the three marked below. Two results worth calling out:

- The facilitator and the enrolled seeker got the **same** `roomName`, and the
  psychologist and the seeker on a case got the **same** `roomName`. That is
  the thing that has to hold or two people "in the same call" sit in two empty
  rooms.
- `isModerator` came back `true` for the facilitator/psychologist and `false`
  for the seeker.

Not exercised against the live database, and why:

| Row | Why not |
|---|---|
| workshop is In-Person / Hybrid | no such workshop in the seeded data; the branch is a plain `mode !== "Online"` check |
| workshop is Cancelled | would have meant cancelling a real seeded workshop |
| a psychologist the case is not assigned to | only one psychologist account is seeded |

These three are exactly what **T18.4 (Tanjila)** covers with mocked models, so
they are not left unchecked - they are checked in the suite built for it.

**Test data:** the case checks created one crisis request and one accepted case
assignment, both marked `E2E TEST -`, and both were deleted again; a re-count
afterwards showed `0` of each. The workshop check enrolled the seeded seeker and
then cancelled that enrollment, so seats went back to where they started. That
does leave one `Cancelled` enrollment row on "Managing Exam Stress"; it is inert
(the enroll API reactivates such a row) but D6.4 may want to tidy it.

## Open questions for the team

1. **Hybrid workshops.** T18.2 says "online workshop", so `Hybrid` is refused
   right now. A hybrid workshop arguably does have an online half. Say so before
   T18.5, and it is a one-line change.
2. **Completed workshops** still return a room (only `Cancelled` is blocked),
   because the task said "online and not cancelled". Easy to tighten if we want.
3. **Room privacy.** Jitsi rooms are open to anyone who knows the name. The API
   only hands the name to the right people, and the name is salted, but a leaked
   URL means a stranger can walk in. Locking the room with a password is a
   manual step the moderator can take on the day.

## Where the code is

| File | What |
|---|---|
| `server/utils/videoRoom.js` | builds the room name and URL from an id |
| `server/utils/videoAccess.js` | the access rules, as plain functions returning `{ ok }` or `{ ok:false, status, message }` - this is what T18.4 should test |
| `server/controllers/videoController.js` | the two handlers |
| `server/routes/videoRoutes.js` | mounted at `/api/video` in `server/app.js` |
| `server/tests/videoRoom.test.js` | name-helper unit tests |
