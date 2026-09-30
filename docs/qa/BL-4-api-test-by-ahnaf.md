# BL-4 / BL-5 API Test (T5.8)

Tester: Ahnaf Shakib
Tool: Thunder Client
Date: 2026-09-30

| Criterion | Expected | Actual | Pass/Fail |
|---|---|---|---|
| Seeker submits valid request | 201 | 201, status pending | Pass |
| Missing field rejected | 400 | 400 | Pass |
| No token rejected | 401 | 401 | Pass |
| Non-volunteer cannot accept | 403 | 403 | Pass |
| Volunteer accepts request | 200 | 200, status accepted | Pass |
| Double-accept blocked | 409 | 409 | Pass |

## Bugs found

None.