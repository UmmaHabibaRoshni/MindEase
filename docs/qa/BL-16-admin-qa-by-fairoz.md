# BL-16 Admin Reports and User Management: QA (T16.11, T16.15)

**Tester:** Fairoz
**Date:** 22 October 2026 (first run), 27 October 2026 (second run, after T16.1 / T16.5 were merged)
**Tasks:** T16.11 (API tests of the admin APIs), T16.15 (this QA note); also records the browser check of T16.7 (Admin Dashboard)
**Environment:** macOS (Apple Silicon), Chrome, Node 22, server on `localhost:5000`, client on `localhost:5173`, shared Atlas database
**Code tested:** `main` at commit `b2af95b`
**Tools:** API checks run with the script `test/t16.11-admin-api-qa.js` (Thunder Client could not be used: it now requires a paid login). Chrome for the dashboard.

Test data: the script registers two volunteers named "QA T16.11 Approve" / "QA T16.11 Reject" (emails `qa.t1611.*@test.com`). One is approved, one rejected.

---

## 1. Summary

| | |
|---|---|
| Checks planned | 28 API + 9 dashboard UI + 4 spec checks |
| Passed | 41 (28 API, 9 UI, 4 spec) |
| Failed | 0 |
| Waiting for teammates | 0 |
| Bugs found | 1 (test data, not code) |

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
| D06 | Summary as admin | 200, every bucket present even when 0 (6 roles, 4 user statuses incl. suspended, 5 request statuses, 6 categories, 4 workshop and 4 referral statuses), plus `activeEnrollments` and `generatedAt` | 200; every bucket present (6 roles, 4 user statuses incl. suspended, 5 request statuses, 6 categories, 4 workshop, 4 referral statuses), activeEnrollments and generatedAt present | ✅ |
| D07 | Totals in the D06 response | Each total equals the sum of its buckets; users by role = users by status; requests by status = by category | totals add up: users 41, requests 23, workshops 46, referrals 9 | ✅ |
| D08 | Register a new volunteer, then summary again | Total users +1, pending +1, volunteers +1 | after registering a volunteer: total 41→42, pending 4→5, volunteers 23→24 | ✅ |

### 3b. Verification APIs behind "Pending approvals" (T8.4, T8.5)

| ID | Request | Expected | Actual | Result |
|---|---|---|---|---|
| D09 | `GET /api/admin/pending-users` as admin | 200, the new volunteer is listed, **no password field** | 200; 5 pending; new volunteer listed; no password field | ✅ |
| D10 | Compare D09 with the summary | Pending list length = summary `users.byStatus.pending` (the dashboard card is correct) | pending list has 5, summary says 5 pending | ✅ |
| D11 | Pending users as seeker | 403 | 403 "You are not allowed to access this resource." | ✅ |
| D12 | Approve with id `123` | 400 "Invalid user id." | 400 "Invalid user id." | ✅ |
| D13 | Approve an id that does not exist | 404 "User not found." | 404 "User not found." | ✅ |
| D14 | Approve as volunteer | 403 | 403 "You are not allowed to access this resource." | ✅ |
| D15 | Reject with a blank reason | 400 "A rejection reason is required." | 400 "A rejection reason is required." | ✅ |
| D16 | Approve the new volunteer | 200, status approved, `verifiedAt` set, no password returned | 200 "Account approved."; status approved, verifiedAt set, no password | ✅ |
| D17 | Approve the same account again | 400 "This account is already approved." | 400 "This account is already approved." | ✅ |
| D18 | Summary after approving | Pending −1, approved +1 | after approving: pending 5→4, approved 33→34 | ✅ |
| D19 | The approved volunteer logs in | 200 | approved volunteer login: 200 | ✅ |
| D20 | Reject a second new volunteer with a reason | 200, status rejected, reason saved | 200 "Account rejected."; status rejected, reason "QA T16.11 test rejection" | ✅ |
| D21 | The rejected volunteer logs in | 403 "Your account was not approved." | rejected volunteer login: 403 "Your account was not approved." | ✅ |

### 3c. Users list and suspend / reactivate (T16.5, T16.1)

Run on 27 October 2026, after T16.1 / T16.5 were merged.

| ID | Request | Expected | Actual | Result |
|---|---|---|---|---|
| D22 | `GET /api/admin/users` as admin | 200, no password field | 200; 43 users; no password field | ✅ |
| D23 | `?role=volunteer&status=approved` | Only approved volunteers returned | 200; 18 returned, 0 outside the filter | ✅ |
| D24 | Users list as seeker | 403 | 403 "You are not allowed to access this resource." | ✅ |
| D25 | Suspend without a reason | 400 | 400 "A suspension reason is required." | ✅ |
| D26 | Suspend the D16 volunteer with a reason | 200, status suspended | 200 "Account suspended."; status suspended | ✅ |
| D27 | The suspended volunteer logs in | 403 (login refused) | suspended volunteer login: 403 "Your account has been suspended. Please contact support." | ✅ |
| D28 | Reactivate the same volunteer | 200, status approved | 200 "Account reactivated."; status approved | ✅ |

---

## 4. Spec checks (SRS v1.0)

| ID | Requirement | Found | Result |
|---|---|---|---|
| S1 | FR 9.1: administrators manage user and stakeholder accounts | Approve / reject (D16–D21) and suspend / reactivate (D25–D28) all work; a suspended user cannot log in (D27) | ✅ |
| S2 | FR 9.2: administrators verify psychologists, NGOs, volunteers | Pending list and approve / reject work for any role; dashboard links to Verifications | ✅ |
| S3 | FR 9.3: administrators monitor overall platform activity | Dashboard shows users, requests, referrals and workshops from live data (D06–D08, UI1–UI4) | ✅ |
| S4 | §4.1: an administrative dashboard for user management, verification, resources, workshops and system activities | Dashboard has stats plus links to Verifications, Manage users and Manage resources. Moderation of reported content is not in this sprint | ✅ (moderation of reported content is out of scope for Sprint 5) |

---

## 5. Other BL-16 tests (owned by teammates, listed for completeness)

| Task | Owner | Status |
|---|---|---|
| T16.8 Unit tests: AdminDashboard | Bithi | Not merged yet (27 Oct) |
| T16.12 Thunder Client: suspended-user login and token | Roshni | Not merged yet (27 Oct) |
| T16.13 Selenium: admin sees the stats | Bithi | Not merged yet (27 Oct) |
| T16.14 Selenium: admin suspends a user, user cannot log in | Roshni | Not merged yet (27 Oct) |

---

## 6. Bugs / issues found

| # | Severity | Where | Problem | Suggested fix |
|---|---|---|---|---|
| 1 | Medium (test data) | Shared test account `ngo@test.com` | Its password is no longer `Ngo@12345` (login returns 401 "Invalid email or password." on 27 Oct), although `seedTestNgo.js` and the README document that password. NGO tests (T14.11 Selenium, C5.1 N1–N4, this D05) fail for anyone using the documented login. D05 was run with `ngo1@example.org` instead | Whoever changed it: set it back to `Ngo@12345`, or update the seed/README. Shared test accounts should not be changed during testing |

## 7. Conclusion

Two runs: 22 October 2026 and 27 October 2026 (after T16.1 / T16.5 were merged). 28 of 28 API checks passed. The admin summary API (T16.3) is admin-only, reports every bucket including the new suspended status, and its counts change correctly when an account is registered and approved. Approve / reject and the new users list, suspend and reactivate (T16.5) behave as specified, and a suspended user is refused at login (T16.1). The Admin Dashboard (T16.7) passed all 9 browser checks. BL-16 meets SRS FR 9.1–9.3 for this sprint. Remaining BL-16 tests owned by teammates are listed in section 5.
