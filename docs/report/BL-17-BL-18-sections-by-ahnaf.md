# MindEase project report - sections for BL-17 and BL-18

Author: Ahnaf
Drafted: 2026-11-01
Status: ready to drop into the combined report. Numbering assumes these become
sections 7 and 8; renumber as needed.

---

## 7. Paid workshops (BL-17)

### 7.1 What the feature does

Facilitators may charge for a workshop. When they create one they can enter a
price in BDT; leaving the field blank keeps the workshop free, which is how
every workshop created before this feature continues to behave. A seeker
browsing workshops sees either a **Free** badge and an **Enroll** button, or the
amount and a **Pay … & Enroll** button. Choosing to pay sends them to the
SSLCommerz sandbox gateway; they are enrolled only after the payment has been
confirmed.

### 7.2 Why payment confirmation drives the enrollment

The central design decision in BL-17 is that **the browser is never trusted to
report a successful payment**. A seeker returning from a payment gateway could
be redirected by anyone, and the gateway's redirect carries form fields that a
determined user could forge. The system therefore treats the redirect purely as
navigation and independently asks SSLCommerz, server to server, whether the
transaction identifier it was given corresponds to a real, completed payment of
the expected amount in the expected currency. Only when that second answer
agrees does the backend create the enrollment.

A consequence worth stating plainly is that **no seat is reserved while a seeker
is on the gateway page.** Holding a seat would mean an abandoned payment could
block a place indefinitely, and releasing such holds reliably needs scheduled
work the project does not have. The trade-off accepted instead is that a
workshop can fill while a seeker is paying. That case is detected after the
payment is verified, and the seeker is shown a page explaining that their
payment succeeded but no seat was available and that the situation needs to be
resolved by hand. This is an honest limitation rather than a hidden one: the
application has no refund path, so the alternative — silently keeping the money
— would have been worse.

### 7.3 Separating free and paid enrollment

Allowing a single enrollment endpoint to serve both free and paid workshops
would have meant one code path deciding, from a request body, whether payment
was required. Instead the two are separate:

- `POST /api/workshops/:id/enroll` refuses any workshop with a price above zero.
- `POST /api/workshops/:id/pay` refuses any workshop that is free.

Each endpoint therefore has exactly one job, and neither can be talked into the
other's behaviour by a crafted request. The interface mirrors this: the button a
seeker sees is chosen from the workshop's price, so the two paths are visibly
distinct before anything is clicked.

The distinction between *unpriced* and *priced at zero* is deliberately
preserved in the data model. The price field has no default value, so a workshop
created before this feature is distinguishable from one a facilitator explicitly
made free. A derived `isPaid` property answers the only question the rest of the
system actually asks — "is there money involved?" — so that comparison is
written once rather than repeated wherever a price is read.

### 7.4 Telling the seeker what happened to their money

Three result pages handle the gateway's return: success, failure and
cancellation. These sit outside the authenticated dashboard area on purpose.
The gateway sends an ordinary browser navigation rather than an application
request, and a seeker arriving there must always be told the outcome rather than
being redirected to a login screen at the moment they are most anxious about a
payment.

The failure page distinguishes five reasons the backend can report, and for each
one states explicitly whether money may have left the seeker's account. A
payment that never started invites a retry; a payment that could not be verified
warns against paying twice and asks the seeker to make contact. An automated
test asserts that the set of reasons handled by the interface still matches the
set the backend can emit, so adding a new failure mode without a message for it
causes a test failure rather than a blank page.

### 7.5 Verification

Three layers were used, because each catches something the others cannot.

| Layer | What it covers | Result |
|---|---|---|
| Model and component unit tests | validation boundaries, the free/paid decision, every result page | 69 tests |
| API checks against a running server | access control and each refusal, including a forged transaction identifier | 13 passed, 3 unavailable |
| Browser end-to-end tests | the whole journey from creating a priced workshop to reaching the gateway | 11 passed, 1 unavailable |

The checks marked *unavailable* require SSLCommerz sandbox credentials that were
not accessible to the author. They are reported as unavailable rather than as
passing: a complete payment through the live sandbox remains confirmed only by
the manual check recorded separately. This distinction is maintained deliberately
throughout the project's test reporting, so that the difference between "checked"
and "assumed" is never lost.

---

## 8. Video sessions (BL-18)

### 8.1 What the feature does

Two kinds of conversation can now happen over video: an online workshop between
a facilitator and the seekers enrolled in it, and a private consultation between
a psychologist and the seeker whose case they have accepted. In each case the
participants are offered a button that opens a Jitsi Meet room; everyone
entitled to a given conversation arrives in the same room.

### 8.2 Opening a new tab rather than embedding the call

An early investigation compared embedding Jitsi inside the application using its
iframe API against opening the room in a new browser tab. The new tab was
chosen, for three reasons.

The decisive one is authentication. Since August 2023 the public Jitsi
deployment has required whoever *creates* a room to sign in with a third-party
account; guests may still join freely. That sign-in is a third-party
authentication redirect, and such redirects inside an iframe are precisely what
modern browser restrictions on third-party cookies and pop-ups are designed to
block. In a normal tab it is an ordinary sign-in.

The second reason is risk relative to time remaining. Embedding requires loading
an external script at runtime, managing a component lifecycle around it, and
sizing a container correctly — a container given no explicit height renders at
zero pixels and fails silently. A link has none of these failure modes.

The third is testability. Because the interface only ever *opens* a URL, its
behaviour can be verified without simulating an embedded video call, which keeps
the automated tests fast and deterministic.

The decision is not irreversible. The data returned to the interface already
includes the separate fields an embedded player would need, so moving to an
embedded call later would change one component and no server code.

### 8.3 Deriving room names instead of storing them

A video room is identified by a name, and that name is computed from the
identifier of the workshop or case it belongs to, combined with a shared secret,
rather than being generated randomly and stored. Two properties follow.

First, everyone entitled to a conversation computes the same name without any
coordination, and the system stores no additional state that could drift out of
step with the workshop or case it describes.

Second, the name cannot be guessed from the workshop identifier alone, which
matters because those identifiers appear in the seeker-facing workshop list. The
shared secret makes the name unguessable to anyone who has not been told it.

This design has one sharp edge that is documented prominently for the
development team: because the name is a function of the identifier *and* the
secret, two deployments configured with different secrets compute different
names, and two participants would join two different empty rooms. The secret
must therefore be identical everywhere, and a check for exactly this property is
included in the automated tests.

### 8.4 Access control is the whole security model

A Jitsi room is open to anyone who knows its name. The endpoints that disclose a
room name are therefore the only barrier, and they were written accordingly. The
rules are expressed as standalone functions, separate from the web layer, so
they can be tested exhaustively without a server or a database:

- An **online** workshop that has not been cancelled discloses its room to the
  facilitator who owns it and to seekers whose enrollment is active. Everyone
  else is refused, including facilitators who own a different workshop.
- A case discloses its room only once it has been **accepted**, and only to the
  assigned psychologist and the seeker the case concerns.

Two ordering choices are deliberate. The workshop's delivery mode is checked
before the requester's identity, so an in-person workshop reveals nothing to
anyone. A case's status is checked before identity for the same reason.

A practical complication arose on the seeker's side. A seeker's dashboard lists
crisis requests, and a seeker never sees the internal identifier of the case
assignment created when a request is escalated. Rather than exposing that
identifier, a third endpoint resolves a request to the accepted case behind it
and returns the same room. Both routes converge on the same underlying record,
and a test asserts that they produce identical room names — if that ever ceased
to hold, the seeker and psychologist would silently fail to meet.

### 8.5 A defect found during end-to-end testing

The browser tests for this feature exposed an existing fault unrelated to video.
The endpoint listing workshops for seekers did not report whether the requesting
seeker was already enrolled. The interface tracked enrollments only in memory,
so reloading the page caused an enrolled seeker to be offered "Enroll" again —
and, once the video button was added, to lose access to it entirely, because the
button is shown only to enrolled seekers.

This is worth recording because of how it was found. The fault had existed
through an earlier iteration and had passed unit testing, since the tests
exercised the enrolment action rather than the state of the page after a reload.
Only a test that drove a real browser through a real reload revealed it. The fix
was small; the lesson about which layer of testing catches which class of fault
was not.

### 8.6 Verification

| Layer | What it covers | Result |
|---|---|---|
| Access rule unit tests | every allow and refuse case, including ordering | 31 tests |
| Room naming unit tests | determinism, separation, sensitivity to the shared secret | 10 tests |
| Component unit tests | the room page and all three join buttons | 37 tests |
| Browser end-to-end tests | who is offered a button, and that both sides match | 9 tests |

A live two-participant call, with cameras and microphones on two machines, is
confirmed separately by manual testing. It is not claimed here, because an
automated test cannot establish that two people could see and hear each other.

---

## Known limitations

Recorded here so they are stated by the authors rather than discovered by a
reader.

1. **Facilitators have no workshop list.** A facilitator can create a workshop
   and the system will admit them to its video room, but no page lists the
   workshops they own, so there is no button for them to press. They reach a
   room by its direct address. Building that list was outside the scope of the
   current iteration.
2. **No refunds.** Cancelling a paid enrollment returns no money, and the
   interface says so plainly at the point of cancellation.
3. **Payment records accumulate.** A record is written when a payment begins,
   not when it completes, so abandoned attempts remain stored as pending.
4. **A leaked room address admits a stranger.** The system controls who is told
   a room name, but Jitsi itself admits anyone who knows one. A moderator can
   lock a room manually during a session; this is not automated.
