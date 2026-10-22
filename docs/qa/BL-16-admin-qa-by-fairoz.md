# BL-16 Admin Reports and User Management: QA (T16.11, T16.15)

**Tester:** Fairoz
**Date:** 22 October 2026 (first run). Section 3 to be re-run when T16.1 / T16.5 are merged
**Tasks:** T16.11 (API tests of the admin APIs), T16.15 (this QA note); also records the browser check of T16.7 (Admin Dashboard)
**Environment:** macOS (Apple Silicon), Chrome, Node 22, server on `localhost:5000`, client on `localhost:5173`, shared Atlas database
**Code tested:** `main` at commit `3f72e8e`
**Tools:** API checks run with the script `test/t16.11-admin-api-qa.js` (Thunder Client could not be used: it now requires a paid login). Chrome for the dashboard.

Test data: the script registers two volunteers named "QA T16.11 Approve" / "QA T16.11 Reject" (emails `qa.t1611.*@test.com`). One is approved, one rejected.

---

## 1. Summary

| | |
|---|---|
| Checks planned | 28 API + 9 dashboard UI + 4 spec checks |
| Passed | 33 (21 API, 9 UI, 3 spec) |
| Failed | 0 |
| Waiting for teammates | 8 (D22–D28 and S1 wait for T16.5 / T16.1) |
| Bugs found | 0 |

---

## 2. Admin Dashboard in Chrome (T16.7)

Logged in as `admin.test@mindease.com`, page `/dashboard/admin`.

| ID | Steps | Expected | Actual | Result |
|---|---|---|---|---|
| UI1 | Open `/dashboard/admin` as admin | Title "Admin Dashboard", "Platform overview · Updated at (time)" | As expected | ✅ |
| UI2 | Look at the six cards | Total users, Pending approvals, Crisis requests, NGO referrals, Workshops, Active enrollments, all with numbers | As expected | ✅ |
| UI3 | Look at the six panels | Users by role / status, Requests by status / category, Referrals by status, Workshops by status, each with rows and bars | As expected | ✅ |
| UI4 | Requests by category | Mental Health shows at least 2 (the C5.1 QA requests) | As expected | ✅ |
| UI5 | Click **Refresh** | Shows "Loading...", then the time under the title updates | As expected | ✅ |
| UI6 | Click **Review →** on the Pending approvals card | Opens the Verifications page | Review → opens /dashboard/verifications; back arrow returns to the dashboard | ✅ |
| UI7 | Click the three quick links | Verify accounts, Manage users, Manage resources each open their page | As expected | ✅ |
| UI8 | Make the window narrow | Cards wrap onto more rows, no sideways scrolling | As expected | ✅ |
| UI9 | Log in as a seeker and open `/dashboard/admin` | Redirected to the seeker dashboard | As expected | ✅ |

---

## 3. Admin API checks (T16.11)

### 3a. `GET /api/admin/summary` (T16.3)

| ID | Request | Expected | Actual | Result |
|---|---|---|---|---|
| D01 | Summary, no token | 401 | 401 "No token provided. Access denied." | ✅ |
| D02 | Summary, fake token | 401 | 401 "Invalid or expired token." | ✅ |
| D03 | Summary as seeker | 403 | 403 "You are not allowed to access this resource." | ✅ |
| D04 | Summary as volunteer | 403 | 403 "You are not allowed to access this resource." | ✅ |
| D05 | Summary as NGO | 403 | 403 "You are not allowed to access this resource." | ✅ |
| D06 | Summary as admin | 200, every bucket present even when 0 (6 roles, 3 user statuses, 5 request statuses, 6 categories, 4 workshop and 4 referral statuses), plus `activeEnrollments` and `generatedAt` | 200; every bucket present (6 roles, 3 user statuses, 5 request statuses, 6 categories, 4 workshop, 4 referral statuses), activeEnrollments and generatedAt present | ✅ |
| D07 | Totals in the D06 response | Each total equals the sum of its buckets; users by role = users by status; requests by status = by category | totals add up: users 27, requests 13, workshops 46, referrals 2 | ✅ |
| D08 | Register a new volunteer, then summary again | Total users +1, pending +1, volunteers +1 | after registering a volunteer: total 27→28, pending 5→6, volunteers 9→10 | ✅ |

### 3b. Verification APIs behind "Pending approvals" (T8.4, T8.5)

| ID | Request | Expected | Actual | Result |
|---|---|---|---|---|
| D09 | `GET /api/admin/pending-users` as admin | 200, the new volunteer is listed, **no password field** | 200; 6 pending; new volunteer listed; no password field | ✅ |
| D10 | Compare D09 with the summary | Pending list length = summary `users.byStatus.pending` (the dashboard card is correct) | pending list has 6, summary says 6 pending | ✅ |
| D11 | Pending users as seeker | 403 | 403 "You are not allowed to access this resource." | ✅ |
| D12 | Approve with id `123` | 400 "Invalid user id." | 400 "Invalid user id." | ✅ |
| D13 | Approve an id that does not exist | 404 "User not found." | 404 "User not found." | ✅ |
| D14 | Approve as volunteer | 403 | 403 "You are not allowed to access this resource." | ✅ |
| D15 | Reject with a blank reason | 400 "A rejection reason is required." | 400 "A rejection reason is required." | ✅ |
| D16 | Approve the new volunteer | 200, status approved, `verifiedAt` set, no password returned | 200 "Account approved."; status approved, verifiedAt set, no password | ✅ |
| D17 | Approve the same account again | 400 "This account is already approved." | 400 "This account is already approved." | ✅ |
| D18 | Summary after approving | Pending −1, approved +1 | after approving: pending 6→5, approved 20→21 | ✅ |
| D19 | The approved volunteer logs in | 200 | approved volunteer login: 200 | ✅ |
| D20 | Reject a second new volunteer with a reason | 200, status rejected, reason saved | 200 "Account rejected."; status rejected, reason "QA T16.11 test rejection" | ✅ |
| D21 | The rejected volunteer logs in | 403 "Your account was not approved." | rejected volunteer login: 403 "Your account was not approved." | ✅ |

### 3c. Users list and suspend / reactivate: waiting for T16.5 and T16.1 (Tanjila)

These run automatically in the same script once the routes are merged.

| ID | Request | Expected | Actual | Result |
|---|---|---|---|---|
| D22 | `GET /api/admin/users` as admin | 200, no password field | Waiting for T16.5 (GET /api/admin/users returns 404, not merged yet) | Waiting |
| D23 | `?role=volunteer&status=approved` | Only approved volunteers returned | Waiting for T16.5 (GET /api/admin/users returns 404, not merged yet) | Waiting |
| D24 | Users list as seeker | 403 | Waiting for T16.5 (GET /api/admin/users returns 404, not merged yet) | Waiting |
| D25 | Suspend without a reason | 400 | Waiting for T16.5 (GET /api/admin/users returns 404, not merged yet) | Waiting |
| D26 | Suspend the D16 volunteer with a reason | 200, status suspended | Waiting for T16.5 (GET /api/admin/users returns 404, not merged yet) | Waiting |
| D27 | The suspended volunteer logs in | 403 (login refused) | Waiting for T16.5 (GET /api/admin/users returns 404, not merged yet) | Waiting |
| D28 | Reactivate the same volunteer | 200, status approved | Waiting for T16.5 (GET /api/admin/users returns 404, not merged yet) | Waiting |

---

## 4. Spec checks (SRS v1.0)

| ID | Requirement | Found | Result |
|---|---|---|---|
| S1 | FR 9.1: administrators manage user and stakeholder accounts | Approve / reject work (D16–D21). Suspend / reactivate waiting for T16.5 (D25–D28) | Partly met: approve / reject ✅, suspend waiting for T16.5 |
| S2 | FR 9.2: administrators verify psychologists, NGOs, volunteers | Pending list and approve / reject work for any role; dashboard links to Verifications | ✅ |
| S3 | FR 9.3: administrators monitor overall platform activity | Dashboard shows users, requests, referrals and workshops from live data (D06–D08, UI1–UI4) | ✅ |
| S4 | §4.1: an administrative dashboard for user management, verification, resources, workshops and system activities | Dashboard has stats plus links to Verifications, Manage users and Manage resources. Moderation of reported content is not in this sprint | ✅ (moderation of reported content is out of scope for Sprint 5) |

---

## 5. Other BL-16 tests (owned by teammates, listed for completeness)

| Task | Owner | Status |
|---|---|---|
| T16.8 Unit tests: AdminDashboard | Bithi | Not merged yet (22 Oct) |
| T16.12 Thunder Client: suspended-user login and token | Roshni | Not merged yet (22 Oct) |
| T16.13 Selenium: admin sees the stats | Bithi | Not merged yet (22 Oct) |
| T16.14 Selenium: admin suspends a user, user cannot log in | Roshni | Not merged yet (22 Oct) |

---

## 6. Bugs / issues found

| # | Severity | Where | Problem | Suggested fix |
|---|---|---|---|---|
| – | – | – | None so far | – |

## 7. Conclusion

First run, 22 October 2026. The admin summary API (T16.3) and the verification APIs behind the dashboard work as specified: 21 of 21 runnable API checks passed. Only admins can read the summary, every bucket is present even when empty, the totals add up, and the counts change correctly when an account is registered and approved. The new Admin Dashboard (T16.7) passed all 9 browser checks. Users list and suspend / reactivate (D22–D28) are waiting for T16.1 / T16.5 and will be filled in by re-running `node test/t16.11-admin-api-qa.js --fill-note` once those are merged. No bugs found so far.
