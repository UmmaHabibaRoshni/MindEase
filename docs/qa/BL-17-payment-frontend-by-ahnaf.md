# BL-17 / T17.6 - T17.12 - payment frontend and API checks

Author: Ahnaf
Date: 2026-11-01 (Day 2)
Builds on: T17.1, T17.3, T17.4 (Roshni and Tanjila, merged in PR #68)

## What is in this branch

| Task | What | Where |
|---|---|---|
| T17.7 | price field on the Create Workshop form | `client/src/pages/facilitator/CreateWorkshop.jsx` |
| T17.8 | `paymentApi.js`, price on the workshop cards, Pay & Enroll | `client/src/api/paymentApi.js`, `client/src/pages/seeker/Workshops.jsx` |
| T17.9 | success / failed / cancelled result pages and routes | `client/src/pages/payment/`, `client/src/App.jsx` |
| T17.10 | unit tests for the price field, the cards and Pay & Enroll | `client/src/test/workshopPayment.test.jsx` |
| T17.11 | unit tests for the result pages | `client/src/test/paymentPages.test.jsx` |
| T17.6 | Thunder Client collection, plus the same checks as a runnable script | `docs/thunder-client/BL-17-payments.json`, `test/t17.6-payment-api-qa.js` |
| T17.12 | Selenium E2E of the paid workshop flow | `test/t17.12-payment.e2e.test.js` |

## How the frontend follows the backend

- **Free stays free.** A workshop with no price, or price 0, keeps the old
  `Enroll` button and the old `POST /api/workshops/:id/enroll` call. The backend
  now refuses that call for a paid workshop, and the UI never makes it.
- **Paid never enrolls directly.** `Pay 500 BDT & Enroll` calls
  `POST /api/workshops/:id/pay` and sends the browser to the `gatewayUrl` that
  comes back. No seat is held while the seeker is on the gateway - the backend
  takes the seat only after it has verified the payment, so the card may say
  "Full" when they come back. That is deliberate, and
  `/payment/fail?reason=unavailable` is the page that explains it.
- **The result routes sit outside `/dashboard` and outside `RequireRole`.** The
  gateway sends a plain browser navigation back to
  `FRONTEND_URL/payment/success|fail|cancel`, and a seeker who lands there must
  always be told what happened to their money rather than be bounced to the
  login page.
- **Every `reason` code the backend can send has a message.** `gateway`,
  `verify`, `unavailable`, `invalid`, `error`, plus a safe fallback for anything
  new. Each one says plainly whether money may have left the seeker's account,
  because that decides whether they should try again or contact us. A test
  asserts the code list matches `paymentController.js`, so if someone adds a
  reason and forgets the page, the suite fails.

## Checks I ran

### Unit tests

| Suite | Result |
|---|---|
| `client/src/test/workshopPayment.test.jsx` (T17.10) | 18 passed |
| `client/src/test/paymentPages.test.jsx` (T17.11) | 20 passed |
| whole client suite | **167 passed, 10 files** |
| whole server suite | **483 passed, 28 suites** |

### API checks (T17.6)

`node test/t17.6-payment-api-qa.js` against the running backend and the shared
database: **13 passed, 0 failed, 3 waiting.**

| | |
|---|---|
| P-01 … P-03 | price stored, `isPaid` virtual correct, negative price refused |
| P-04 … P-06 | pay needs a token, is seeker-only, rejects a malformed id |
| P-10, P-11 | plain enroll refused on a paid workshop, still works on a free one |
| P-12 … P-16 | all four callback cases redirect 303 to the right page, including a **forged `tran_id`**, which is refused |

The three waiting checks (P-07 unknown workshop, P-08 pay a free workshop, P-09
the happy path) need `SSLC_STORE_ID`, `SSLC_STORE_PASSWD` and `BACKEND_URL` in
`server/.env`. I do not have the sandbox keys, so the script reports them as
waiting rather than passing or failing.

### Selenium E2E (T17.12)

`npx mocha test/t17.12-payment.e2e.test.js --timeout 120000`:
**11 passing, 1 pending**, in a real Chrome against the running app.

Covered: the price field is blank by default; a priced workshop is created
through the form and comes back `isPaid`; the seeker's card shows `500 BDT` and
a `Pay 500 BDT & Enroll` button; a free workshop still shows `Free` and `Enroll`;
a failed start keeps the seeker on the page with the server's message; all four
result pages render the right wording; and the result pages work with an empty
`localStorage`.

The one pending spec is E17.6, clicking through to the gateway - same missing
keys. It runs automatically once they are in `.env`.

**Test data:** each run creates two workshops titled `E2E T17.12 -` and cancels
them in the `after` hook. The API script creates two titled `QA T17.6` and
cancels those too. Nothing was left active.

## Worth knowing before T17.13

1. **`startPayment` checks the gateway configuration before it looks the
   workshop up.** On a machine without the sandbox keys *every* call to
   `/pay` answers `500 Payment gateway is not configured`, including ones that
   should be 404 or 400. Not wrong, but it means input validation cannot be
   tested without the keys, which is why P-07 and P-08 are marked waiting. If
   we want those reachable, move the config check below the workshop lookup.
2. **A pending `Payment` row is written before the gateway call.** Every click
   on Pay & Enroll leaves a row behind, whether or not the seeker pays. After
   the sandbox testing in T17.13 there will be a pile of `pending` rows -
   something for **D6.4** to tidy before the demo.
3. **Cancelling a paid enrollment does not refund anything.** The seeker page
   now says so under the Cancel button, but the backend has no refund path at
   all. If a demo question goes there, that is the honest answer.
4. **Turn off "Follow redirects"** in Thunder Client before running requests
   12-16, or it follows the 303 into the React app and reports 200.

## Still blocked

T18.7, T18.10 and T18.13 (the Join video session button and its tests) wait on
**T18.6**, Tanjila's `VideoRoom` component. The BL-18 APIs they need are merged
(PR #67); see [BL-18-video-api-by-ahnaf.md](BL-18-video-api-by-ahnaf.md).
