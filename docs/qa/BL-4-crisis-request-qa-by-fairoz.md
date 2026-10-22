# BL-4 Crisis Request: Manual QA (C5.1)

**Tester:** Fairoz
**Date:** 21 October 2026
**Task:** Sprint 5 carry-over C5.1 (closes Sprint 2 T4.5 "verify category and urgency options against the spec" and T4.6 "full QA of BL-4")
**Environment:** macOS (Apple Silicon), Chrome 156, Node 22, server on `localhost:5000`, client on `localhost:5173`, shared Atlas database
**Code tested:** `main` at commit `e7b6366`
**Tools:** Chrome (UI); API checks run with the script `test/c5.1-api-qa.js` (same checks as the Thunder Client collection `docs/thunder-client/C5.1-BL-4-BL-6.json`)

Test data I created is marked "QA C5.1 by Fairoz" in its description.

---

## 1. Summary

| | |
|---|---|
| Checks planned | 31 (13 UI, 18 API) + 5 spec checks |
| Passed | 31 |
| Failed | 0 |
| Not run | 0 |
| Bugs / mismatches found | 3 (all low severity) |

---

## 2. UI checks (Chrome)

| ID | Steps | Expected | Actual | Result |
|---|---|---|---|---|
| U1 | Log in as `seeker@test.com` | Lands on `/dashboard/seeker`, shows "Seeker Dashboard" and "+ New Request" |Landed on /dashboard/seeker, saw both| ✅ |
| U2 | Click **+ New Request** | Form "Request Crisis Support" opens at `/dashboard/new-request` |Form opened at /dashboard/new-request | ✅ |
| U3 | Open the **Category** dropdown | Exactly 6 options: Mental Health, Abuse / Violence, Legal Aid, Medical, Substance Use, Other |6 options, same names |✅|
| U4 | Open the **Urgency Level** dropdown | Exactly 4 options: Low, Medium, High, Critical | 4 options, same names| ✅ |
| U5 | Leave description empty, click **Submit Request** | Browser blocks it ("Please fill out this field"), nothing is sent | Popup "Please fill out this field", stayed on form| ✅ |
| U6 | Type `help me` (7 chars), submit | Browser blocks it (asks for at least 10 characters) | blocks it (asks for at least 10 characters)| ✅ |
| U7 | Paste 2001 characters, submit | Red error message on the form, no request created | Shows red error message on the form, no request created| ✅ |
| U8 | Pick Medical + High, type a valid description, submit | Button shows "Submitting...", then goes back to dashboard. New request on top with REQ-xxxxx, "medical", status **pending**, urgency **high**, today's date | Created REQ-7F3A2, medical, pending, high, today's date| ✅ |
| U9 | On the form click **Cancel** | Back to dashboard, no new request | Goes back to dashboard, no new request| ✅ |
| U10 | Log out, log in as `volunteer@test.com` | The U8 request is under **Pending requests**. Only category, urgency, description and date are shown, **no seeker name or email** |Found it under Pending, only category/urgency/description/date, no seeker name | ✅ |
| U11 | Click **Accept** on the U8 request | Green "Request accepted..." message. The request moves from Pending to **Your accepted cases** | Green "Request accepted..." message. The request moves from Pending to **Your accepted cases**| ✅ |
| U12 | Log back in as the seeker | The U8 request now shows **accepted** and an **Open chat** button | Yes, The U8 request now shows **accepted** and an **Open chat** button| ✅ |
| U13 | While logged in as volunteer, type `localhost:5173/dashboard/new-request` in the address bar | Redirected to the volunteer dashboard (a volunteer cannot open the seeker form) |Redirected to the volunteer dashboard  | ✅ |

---

## 3. API checks (script)

| ID | Request | Expected | Actual | Result |
|---|---|---|---|---|
| A01 | Create request, no token | 401 | 401 "No token provided. Access denied." | ✅ |
| A02 | Create request, fake token | 401 | 401 "Invalid or expired token." | ✅ |
| A03 | Create request as volunteer | 403 | 403 "You are not allowed to access this resource." | ✅ |
| A04 | Urgency missing | 400 "category, description and urgency are required" | 400 "category, description and urgency are required" | ✅ |
| A05 | Category `food` | 400 (not a valid enum value) | 400 "`food` is not a valid enum value for path `category`." | ✅ |
| A06 | Urgency `extreme` | 400 | 400 "`extreme` is not a valid enum value for path `urgency`." | ✅ |
| A07 | Description `help` (under 10 chars) | 400 | 400 "Path `description` (`help`, length 4) is shorter than the minimum all…" | ✅ |
| A08 | Description only spaces | 400 (spaces are trimmed, so it counts as empty) | 400 "Path `description` is required." | ✅ |
| A09 | Valid request, also sending `"status":"accepted"` and a fake `acceptedBy` | 201, saved with status **pending** and `acceptedBy: null` (extra fields ignored) | 201 "Request submitted"; saved as status pending, acceptedBy null (id 6ad8ce2994da64ed772fd069) | ✅ |
| A10 | GET `/api/requests/mine` as seeker | 200, only this seeker's requests, newest first | 200; 2 requests, new A09 request is listed | ✅ |
| A11 | GET `/mine` as volunteer | 403 | 403 "You are not allowed to access this resource." | ✅ |
| A12 | GET `/api/requests/pending` as volunteer | 200, items contain **no `seeker` field** | 200; 5 pending, no seeker field | ✅ |
| A13 | GET `/pending` as seeker | 403 | 403 "You are not allowed to access this resource." | ✅ |
| A14 | Accept with id `123` | 400 "Invalid request id" | 400 "Invalid request id" | ✅ |
| A15 | Accept an id that does not exist | 404 | 404 "Request not found" | ✅ |
| A16 | Accept as seeker | 403 | 403 "You are not allowed to access this resource." | ✅ |
| A17 | Volunteer accepts the A09 request | 200, status **accepted** | 200 "Request accepted"; status accepted | ✅ |
| A18 | Accept the same request again | 409 "Request already accepted" | 409 "Request already accepted" | ✅ |

---

## 4. Spec checks (T4.5)

Compared: SRS v1.0 (section 3.1.2: FR 2.1-2.3; section 6.1), `server/models/CrisisRequest.js`, `server/models/Ngo.js`, `server/config/requestOptions.js`, `client/src/components/requestOptions.js`.

| ID | Check | Found | Result |
|---|---|---|---|
| S1 | Categories are the same everywhere | Server model, Ngo model and client all use the same 6: `mental_health, abuse_violence, legal_aid, medical, substance_use, other`. SRS: FR 2.1 does not list categories, so no conflict | ✅ |
| S2 | Urgency levels are the same everywhere | Server and client both use `low, medium, high, critical`. SRS: no urgency levels are defined, so no conflict | ✅ |
| S3 | Request statuses are the same everywhere | **Mismatch.** Model: `pending, accepted, escalated, referred, closed`. `server/config/requestOptions.js`: has `resolved` (not in the model) and no `closed`. Client `REQUEST_STATUSES`: no `escalated`, so `StatusBadge` shows the raw word | ❌ |
| S4 | Constants file path in comments | The comments in `CrisisRequest.js`, `Ngo.js` and `Referral.js` point to `client/src/constants/requestOptions.js`, which does not exist. The real file is `client/src/components/requestOptions.js` | ❌ |
| S5 | Description length limits shown to the user | Server allows 10–2000 characters. The form enforces the minimum (10) but has no `maxLength`, so an over-long text is only rejected after Submit | ❌ |

---

## 5. Bugs / issues found

| # | Severity | Where | Problem | Suggested fix |
|---|---|---|---|---|
| 1 | Low | `server/config/requestOptions.js`, `client/src/components/requestOptions.js` | Status lists don't match the model (S3) | Make both lists match the model: `pending, accepted, escalated, referred, closed` |
| 2 | Low | model comments | Wrong path to the client constants file (S4) | Update the comments |
| 3 | Low | `CrisisRequestForm.jsx` | No `maxLength={2000}` on the description (S5) | Add `maxLength={2000}` |

## 6. Conclusion

BL-4 works as specified. All 31 checks passed (13 UI, 18 API): validation, role checks, data minimisation (volunteers never see seeker identity) and double-accept protection all behave correctly. 3 low-severity consistency issues were found (status lists, a wrong path in comments, no maxLength on the description field); none of them block users. Checked against SRS v1.0 FR 2.1-2.3: all met.
