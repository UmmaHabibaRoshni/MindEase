# BL-18 / T18.1 - Jitsi spike: embed or open in a new tab

Author: Ahnaf
Date: 2026-10-31 (Day 1)
Decides: T18.6 (VideoRoom component, Tanjila), and the shape of T18.2 / T18.3

## Question

For the online workshop room and the psychologist consultation room, do we
embed Jitsi inside our own page with the iframe API (`external_api.js`), or do
we open `https://<domain>/<room>` in a new browser tab?

## Decision

**Open in a new tab.** The backend hands the frontend a room name and a full
URL; the frontend renders a link/button that opens it with
`window.open(url, "_blank", "noopener")`.

## Why

1. **meet.jit.si asks the room creator to sign in.** Since August 2023 the
   public `meet.jit.si` deployment stopped allowing anonymous room *creation* -
   the first person into a room (our facilitator, or the psychologist) has to
   sign in with Google / GitHub / Facebook as moderator. Guests still join
   without an account, so the seeker side is unaffected. That sign-in is a
   third-party OAuth redirect, and third-party OAuth inside an iframe is the
   exact thing browsers block hardest (popup blocking, third-party cookie
   rules). In a new tab it is just a normal sign-in.

2. **Less that can break during the demo.** The iframe API means loading an
   external script at runtime, a wrapper component with a lifecycle to manage,
   and a container that has to be given a real height or it renders 0px tall.
   A link has none of that. We have four working days.

3. **Permissions prompts are cleaner in a tab.** Camera and microphone prompts
   come from the Jitsi origin either way, but in an iframe they also need the
   right `allow="camera; microphone; display-capture"` attribute, and a wrong
   value fails silently.

4. **It keeps T18.6 small.** `VideoRoom` becomes a presentational component -
   call the API, show the room details and a "Join" button - which is testable
   with plain React Testing Library and no iframe mocking (T18.10, T18.11,
   T18.12).

Embedding is allowed by Jitsi (their API docs ask only that the jitsi.org logo
stays in the top-left corner), so this is a cost/risk decision, not a licensing
one. If we ever want it embedded, only `VideoRoom` changes - the APIs built in
T18.2 and T18.3 already return everything the iframe API would need
(`domain`, `roomName`, `displayName`, `subject`).

## What this means for the other tasks

- **T18.2 / T18.3** return `{ roomName, domain, url, displayName, subject,
  isModerator }`. `url` is what the button opens; the rest is there so an
  embedded version needs no API change.
- **T18.6 (Tanjila)** no iframe, no `external_api.js`, no new dependency.
- **T18.13 / T18.14 (Selenium)** assert that the button exists, is enabled for
  the right role and carries the right room URL. The tests must **not** follow
  the link into Jitsi - the call itself is checked by hand in T18.15.

## Configuration

`server/.env` gains two optional keys:

| key | default | why |
| --- | --- | --- |
| `JITSI_DOMAIN` | `meet.jit.si` | so a self-hosted instance can be swapped in without a code change |
| `VIDEO_ROOM_SECRET` | a constant in the repo | salts the room name so it cannot be guessed from a workshop id |

**Everyone must put the same `VIDEO_ROOM_SECRET` in their own `.env`.** The room
name is derived from the id *and* this salt, so two people running their own
backend with different salts would compute two different room names and end up
in two different empty rooms. The in-repo default keeps a fresh clone (D6.1)
working; the shared value goes in the team's .env the same way `CHAT_KEY` does.

## Honest limits of this spike

- The room-name salt is a speed bump, not access control. Anyone reading this
  repo can compute a room name for a given id when the default salt is in use.
  The real check is the API: it only returns the room to the facilitator who
  owns the workshop, an enrolled seeker, the assigned psychologist, or the
  seeker on the case. Jitsi rooms are open to anyone who knows the name, so a
  leaked name means a stranger could walk in.
- A moderator can lock a room with a password from inside the Jitsi UI. We are
  not automating that - it is a manual step if we want it on the day.
- **Not yet run:** the live two-browser call (two machines, camera and mic on,
  seven minutes) that this task budgeted for. It needs two real browsers and a
  human to watch it, so it is folded into **T18.15** (Roshni, Day 4) rather
  than claimed here. The decision above does not depend on that result - it
  rests on the sign-in behaviour and on how much there is to go wrong, both of
  which are known now.
- The August 2023 sign-in change is well documented, but I found no official
  2026 restatement of the policy. If `meet.jit.si` has tightened further by
  demo day, `JITSI_DOMAIN` is the one knob we need to turn.
