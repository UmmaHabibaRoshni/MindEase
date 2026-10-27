# BL-6 Refer a Case to an NGO with Consent: Manual QA (C5.1)

**Tester:** Fairoz
**Date:** 21 October 2026; section 4 run on 27 October 2026 (after C5.2 was merged)
**Task:** Sprint 5 carry-over C5.1 (closes Sprint 2 T6.6 "verify NGO categories and referral rules" and T6.7 "full QA of BL-6")
**Environment:** macOS (Apple Silicon), Chrome 156, Node 22, server on `localhost:5000`, client on `localhost:5173`, shared Atlas database
**Code tested:** `main` at commit `e7b6366`
**Tools:** API checks run with the script `test/c5.1-api-qa.js` (same checks as the Thunder Client collection `docs/thunder-client/C5.1-BL-4-BL-6.json`); Chrome for the NGO side and, after C5.2, the volunteer referral UI

The referral used in these checks is for the "QA C5.1 by Fairoz" request (A09 in the BL-4 note), referred to **Test NGO Organisation** (`ngo@test.com`).

---

## 1. Summary

| | |
|---|---|
| Checks planned | 22 API + 4 NGO-side UI + 9 volunteer UI (after C5.2) + 7 rule/spec checks |
| Passed | 27 |
| Failed | 6 |
| Not run / blocked | 2 (B22 optional, N2 not valid) |
| Bugs found | 5 (3 high, 1 medium, 1 low); bug #1 fixed in C5.2 |

---

## 2. API checks (script)

| ID | Request | Expected | Actual | Result |
|---|---|---|---|---|
| B01 | GET `/api/ngos?category=mental_health` as volunteer | 200. Only approved NGOs that handle mental_health. Each item has only `_id, organizationName, categories, address` (**no phone or email**) | 200; 2 NGOs (Demo Mind Care Foundation, Test NGO Organisation); Test NGO found; no phone/email | ✅ |
| B02 | GET `/api/ngos?category=legal_aid` | 200, includes Demo Safe Home | 200; Demo Safe Home | ✅ |
| B03 | GET `/api/ngos` as seeker | 403 | 403 "You are not allowed to access this resource." | ✅ |
| B04 | Refer the request while it is still **pending** | 403 "Request is not accepted by you or already referred" | 403 "Request is not accepted by you or already referred" | ✅ |
| B05 | Referral, no token | 401 | 401 "No token provided. Access denied." | ✅ |
| B06 | Referral as seeker | 403 | 403 "You are not allowed to access this resource." | ✅ |
| B07 | `consent` missing | 400 "Seeker consent is required" | 400 "Seeker consent is required" | ✅ |
| B08 | `consent: false` | 400 | 400 "Seeker consent is required" | ✅ |
| B09 | `consent: "true"` (text, not a real true) | 400 | 400 "Seeker consent is required" | ✅ |
| B10 | Invalid ids | 400 "Invalid requestId or ngoId" | 400 "Invalid requestId or ngoId" | ✅ |
| B11 | NGO id that does not exist | 404 "NGO not found" | 404 "NGO not found" | ✅ |
| B12 | NGO that doesn't handle the request's category (Demo Safe Home for a mental_health request) | 400 "NGO does not handle this category" | 400 "NGO does not handle this category" | ✅ |
| B13 | Valid referral (after the volunteer accepted, A17) | 201. `consentGiven: true`, `consentAt` set, `status: "pending"` | 201 "Referral created"; consentGiven true, consentAt set, status pending | ✅ |
| B14 | Same referral again | 403 (one referral per request) | 403 "Request is not accepted by you or already referred" | ✅ |
| B15 | Seeker GET `/api/requests/mine` | The QA request now has status **referred** | 200; QA request status referred | ✅ |
| B16 | Volunteer GET `/api/requests/accepted` | The referred case is still listed (status referred) | 200; listed, status referred | ✅ |
| B17 | NGO GET `/api/referrals/mine` | 200. The QA referral is listed. `request` has only `category, description, urgency`, **no seeker name, email or id** | 200; 2 referrals, QA referral listed, no seeker data | ✅ |
| B18 | NGO GET `/api/referrals/:id` | 200, same data-minimised shape | 200; request fields: _id, category, description, urgency; no seeker data | ✅ |
| B19 | A **different** NGO (`ngo1@example.org`) GET the same id | 404 (cannot see another NGO's referral) | 404 "Referral not found" | ✅ |
| B20 | Volunteer GET `/api/referrals/mine` | 403 | 403 "You are not allowed to access this resource." | ✅ |
| B21 | NGO `?status=bogus` | 400 "status must be one of: pending, in_progress, resolved, closed" | 400 "status must be one of: pending, in_progress, resolved, closed" | ✅ |
| B22 | *(optional)* A second approved volunteer tries to refer a request accepted by someone else | 403 | Not run: needs a second approved volunteer (optional) | Not run |

---

## 3. NGO-side UI checks (Chrome)

| ID | Steps | Expected | Actual | Result |
|---|---|---|---|---|
| N1 | Log in as `ngo@test.com` | NGO dashboard lists the QA referral (category, urgency, description, status pending) | QA referral NOT shown. Page shows 3 fake cards (Mental health / Legal aid / Shelter) because `USE_MOCK = true` in ngoApi.js (bug #0) | ❌ |
| N2 | Look at the referral in the list and its detail page | **No seeker name, email or phone anywhere** | Not valid: page shows mock data only. API side confirmed no seeker data (B17, B18) | Not valid |
| N3 | Open it, set status **in progress**, add a note, **Save** | "Referral updated." The status changes in the list | "Referral updated." shown, but the change is lost after reload (Cmd+R). Nothing is saved to the database (bug #0) | ❌ |
| N4 | Log in as `ngo1@example.org` | The QA referral is **not** in its list | This NGO sees the same 3 fake cards as ngo@test.com (bug #0). API correctly returns 404 (B19) | ❌ |

---

## 4. Volunteer referral UI (run 27 October 2026, after C5.2 / PR #61 was merged)

Run as `volunteer@test.com` on the accepted medical request from the U tests. R8 was run on a second new medical request, so the first case could still be referred in R7.

| ID | Steps | Expected | Actual | Result |
|---|---|---|---|---|
| R1 | Volunteer opens an accepted case | A "Refer to an NGO" panel is shown | "Refer to NGO" button on the accepted medical case; clicking it opens the "Refer to an NGO" panel | ✅ |
| R2 | Pick a category | Only approved NGOs for that category are listed | Medical selected: 1 NGO card listed (Demo Health Aid, the only approved medical NGO) | ✅ |
| R3 | Look at each NGO card | The **organisation name** is shown (not blank) | NGO name is blank on the card (bug #2: panel reads ngo.name, API sends organizationName) | ❌ |
| R4 | Click **Select** | Consent dialog opens with the NGO's real name in the title | Consent box opens but the title has no NGO name ("Share your request with ?") (bug #2) | ❌ |
| R5 | Look at **Confirm** before ticking the box | Confirm is disabled | Confirm is disabled until the box is ticked | ✅ |
| R6 | Click **Cancel** | Dialog closes, nothing referred | Cancel closes the box; nothing referred | ✅ |
| R7 | Tick the box, click **Confirm** | Referral created, the case shows as referred | Green "Referral sent. The seeker and the NGO have been notified."; case shows the Referred badge | ✅ |
| R8 | Pick an NGO whose category doesn't match the request | Clear error "NGO does not handle this category" | Legal Aid NGO (Demo Safe Home) for a medical request: red message "NGO does not handle this category"; case not referred | ✅ |
| R9 | Log in as that NGO | The new referral is on its dashboard | ngo3@example.org (Demo Health Aid) sees only the 3 mock cards, not the new referral (bug #0). The bell shows 1 new notification: "You have a new referral from a volunteer", so the referral did reach this NGO | ❌ |

---

## 5. Referral rules and spec checks (T6.6, T7.5)

Compared: SRS v1.0 (section 3.1.5: FR 5.1-5.3; section 6.1 Data and Privacy), `server/controllers/referralController.js`, `server/models/Referral.js`, `server/models/Ngo.js`, `client/src/components/referral/ReferNgoPanel.jsx`, `client/src/components/common/ConsentConfirm.jsx`.

| ID | Check | Found | Result |
|---|---|---|---|
| S6 | NGO categories match request categories | `Ngo.js` uses the same 6 categories as `CrisisRequest.js` and the client. SRS: FR 5.1 names domestic violence and abuse cases, which matches abuse_violence; no full category list is defined, so no conflict | ✅ |
| S7 | Referral rules in the backend | All enforced: consent must be `true`, NGO must exist and be approved, NGO must handle the category, only the volunteer who accepted can refer, the request must be `accepted`, one referral per request (unique index + atomic update), and the request is rolled back to `accepted` if saving the referral fails | ✅ |
| S8 | Data minimisation | Pending list, NGO list and NGO referral APIs never return seeker identity or NGO contact details (confirmed by A12, B01, B17, B18) | ✅ |
| S9 | Referral status values (T7.5) | **Mismatch.** `Referral.js` and `ReferralDetail.jsx`: `pending, in_progress, resolved, closed`. Client `REFERRAL_STATUSES` in `requestOptions.js`: `Pending, Accepted, Rejected, Completed` (not used anywhere, but wrong). `StatusBadge` has no labels for `in_progress` or `resolved` | ❌ |
| S10 | `ReferNgoPanel` import path | **Blocker for C5.2.** It imports `../../constants/requestOptions`, which does not exist (the file is in `components/`). The build will fail once the panel is put on a page | ✅ Fixed in C5.2 (PR #61) |
| S11 | `ReferNgoPanel` NGO fields | **Blocker for C5.2.** It shows `ngo.name` and `ngo.description`, but `GET /api/ngos` returns `organizationName` and `address`. NGO names will be blank and the consent dialog will say "Share your request with undefined?" | ❌ Confirmed by R3 and R4 on 27 Oct |
| S12 | Consent wording | `ConsentConfirm` speaks to the **seeker** ("Share your request…", "I agree…"), but the **volunteer** clicks it. Check with the SRS whether the volunteer is confirming the seeker agreed (e.g. in chat) and reword it. SRS 6.1: the system shall obtain appropriate user consent before sharing sensitive information, so consent must come from the seeker and the wording must say the seeker agreed (bug #3 confirmed) | ❌ |

---

## 6. Bugs / issues found

| # | Severity | Where | Problem | Suggested fix |
|---|---|---|---|---|
| 0 | **High** | `client/src/api/ngoApi.js` line 7 | `USE_MOCK = true` is still on `main`, so the NGO dashboard and referral page show fake data and never call the real API. NGOs cannot see real referrals, status updates are not saved, and every NGO sees the same cards | Change to `const USE_MOCK = false;` (the backend API T14.4/T14.5 is merged and passes B17–B21) |
| 1 | **High**, **fixed in C5.2 (PR #61)** | `ReferNgoPanel.jsx` line 3 | Imports a file that doesn't exist (S10) | `import { CATEGORIES } from "../requestOptions";` |
| 2 | **High**, still open (confirmed by R3, R4) | `ReferNgoPanel.jsx` | Uses `ngo.name` / `ngo.description`, but the API returns `organizationName` / `address` (S11) | Use `ngo.organizationName` and `ngo.address` (also for `ngoName` in `ConsentConfirm`) |
| 3 | Medium | `ConsentConfirm.jsx` | Wording is addressed to the seeker, but the volunteer gives consent (S12) | Reword, e.g. "The seeker has agreed to share their request with {ngoName}" |
| 4 | Low | `client/src/components/requestOptions.js`, `StatusBadge.jsx` | Referral status values don't match the server (S9) | Change to `pending, in_progress, resolved, closed` and add badge labels |

## 7. Conclusion

The BL-6 backend works as specified: 21 of 21 API checks passed, every referral rule is enforced (consent must be true, NGO must be approved and handle the category, only the accepting volunteer can refer, one referral per request) and no seeker identity reaches the NGO. The frontend is not usable yet: (1) the NGO dashboard still runs on mock data (`USE_MOCK = true`), so NGOs never see real referrals and status updates are not saved (bug #0, reported to Roshni); (2) ReferNgoPanel has two bugs that will break C5.2 (bugs #1 and #2, reported to Roshni). Against SRS v1.0: the API meets FR 5.1-5.3, but the NGO page currently fails FR 5.2 and FR 5.3 because of bug #0. Update 27 October: after C5.2, the volunteer referral flow works end to end (6 of 9 section 4 checks passed): the referral is created, the case shows as referred, and the NGO gets a notification. Two problems remain: NGO names are blank in the panel and the consent box (bug #2, R3/R4), and the NGO dashboard still shows mock data (bug #0, R9). N1–N4 and R9 must be re-run after the USE_MOCK fix.
