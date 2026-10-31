# MindEase

MindEase is a crisis-support web app. Seekers submit crisis requests, volunteers accept them and chat (encrypted), cases can be escalated to psychologists or referred to NGOs with the seeker's consent, facilitators run workshops, and admins verify accounts and manage the resource library.

- **Backend:** Node.js, Express, MongoDB Atlas (Mongoose), Socket.io, in `server/`
- **Frontend:** React and Vite, in `client/`
- **End-to-end tests:** Selenium and Mocha, in `test/`
- **QA notes:** `docs/qa/`

---

## 1. What you need to install

| Tool | Version | Notes |
|---|---|---|
| Node.js | 22 LTS (20.19+ also works) | Includes `npm` |
| Git | any recent | |
| VS Code | any | Recommended extensions: **Thunder Client**, **ESLint** |
| Google Chrome | latest | Needed by the Selenium tests |
| MongoDB Compass | optional | To look at the database |

**macOS (with Homebrew):**
```bash
xcode-select --install                      # gives you git
brew install node@22 gh
brew install --cask mongodb-compass google-chrome
```

**Windows:** install Node.js LTS from nodejs.org and Git from git-scm.com. If PowerShell blocks `npm` with an execution-policy error, run
`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once.

---

## 2. Get the code

```bash
git clone https://github.com/UmmaHabibaRoshni/MindEase.git
cd MindEase
```

## 3. Install packages (3 places)

There are three `package.json` files. Install each one:

```bash
npm ci                 # root: Selenium/Mocha for the E2E tests
cd server && npm ci    # backend
cd ../client && npm ci # frontend
cd ..
```

> Use `npm ci`, not `npm install`. `npm install` can rewrite `package-lock.json`, and those changes should not go into your commits.
> `npm warn` lines and "vulnerabilities" messages are normal. Do **not** run `npm audit fix`.

---

## 4. Environment file (`server/.env`)

The backend reads its settings from `server/.env`. This file is **not in Git** (`.gitignore` blocks `.env`).
**Ask Roshni for the values. They are sent privately and never committed or posted in chats.**

Create the file at `server/.env` (the file name is exactly `.env`) with these keys:

```
PORT=5000
MONGO_URI=          # MongoDB Atlas connection string
JWT_SECRET=         # secret used to sign login tokens
JWT_EXPIRES_IN=     # token lifetime, e.g. 7d
CHAT_KEY=           # 64 hex characters (32 bytes), AES-256-GCM key for chat messages
```

Optional keys:

| Key | Used by | Default |
|---|---|---|
| `CLIENT_ORIGIN` | Socket.io CORS | `http://localhost:5173` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | `seeds/seedAdmin.js` (first admin only) | none |
| `VITE_SOCKET_URL` (in `client/.env`) | chat socket URL | `http://localhost:5000` |
| `JITSI_DOMAIN` | BL-18 video rooms | `meet.jit.si` |
| `VIDEO_ROOM_SECRET` | BL-18 video rooms, salts the room name | a constant in the repo |

> **`VIDEO_ROOM_SECRET` must be the same on every machine.** A video room name
> is derived from the workshop or case id *and* this salt, so two people running
> their own backend with different salts would compute two different room names
> and end up in two different empty calls. Use the shared value from the team
> `.env`, the same way `CHAT_KEY` is shared.

Check that Git is ignoring the file. `git status` must **not** list `.env`.

**Database network access:** the Atlas cluster currently allows `0.0.0.0/0` (any IP), so no per-person IP setup is needed. If that changes, ask the Atlas owner to add your IP under *Atlas → Network Access*.

---

## 5. Ports

| Part | URL |
|---|---|
| Backend API | http://localhost:5000 (all routes under `/api/...`) |
| Frontend | http://localhost:5173 |

The frontend forwards `/api` calls to port 5000 (see `client/vite.config.js`), so **the backend must use port 5000**.

---

## 6. Run the project (run order)

Use two terminals. **Start the backend first.**

**Terminal 1: backend**
```bash
cd server
npm run dev        # or: npm start
```
Wait for:
```
MongoDB connected
Server running on port 5000
```

**Terminal 2: frontend**
```bash
cd client
npm run dev
```
Open http://localhost:5173.

Stop either one with **Ctrl+C**.

---

## 7. Test accounts and seed scripts

The shared Atlas database already contains these test accounts. If one is missing, run its seed script from the `server/` folder. All seed scripts are **safe to run more than once**: they only create what is missing.

| Role | Email | Seed script |
|---|---|---|
| Seeker | `seeker@test.com` | `node seeds/seedTestSeeker.js` |
| Volunteer | `volunteer@test.com` | created by `node seeds/seedTestNgo.js` |
| NGO | `ngo@test.com` | `node seeds/seedTestNgo.js` (also creates a sample referral) |
| Psychologist | `psychologist@mindease.test` | `node seeds/seedPsychologist.js` |
| Facilitator | `facilitator@test.com` | `node seeds/seedFacilitator.js` |
| Admin (test) | `admin.test@mindease.com` | `node seeds/seedTestAdmin.js` |

Each script prints the login for its account when it runs. Ask the team if you need a password.

Other seed scripts:

| Script | What it does |
|---|---|
| `node seeds/seedNgos.js` | 3 demo NGO organisations |
| `node seeds/seedResources.js` | resource-library categories |
| `node seeds/seedAdmin.js` | the **first** admin only (needs `ADMIN_EMAIL`/`ADMIN_PASSWORD` in `.env`); refuses to run if an admin exists |

Volunteers, psychologists, NGOs and facilitators who register through the site start as **pending** and cannot log in until an admin approves them (*Dashboard → Verifications*). Seekers are approved automatically.

---

## 8. Running the tests

| Tests | Command | Needs |
|---|---|---|
| Backend unit tests (Jest) | `cd server && npm test` | nothing running (uses an in-memory MongoDB; the first run downloads it) |
| Frontend unit tests (Vitest) | `cd client && npm test` | nothing running |
| Frontend lint | `cd client && npm run lint` | |
| Selenium E2E, Sprint 3 | `npm run test:e2e` (from the root) | backend **and** frontend running, Chrome, seeded accounts |
| Selenium E2E, Sprint 4 | `npm run test:e2e:sprint4` | same |
| All E2E / API tests | `npm run test:e2e:all` | same |

Some E2E specs read logins from environment variables, e.g. `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `E2E_SEEKER_EMAIL`.

Thunder Client collections are in `docs/thunder-client/`. Import them in VS Code: *Thunder Client → Collections → menu → Import*.

---

## 9. Git workflow

- Never commit to `main` directly.
- Create a branch per task: `git checkout main && git pull && git checkout -b feature/<task-id>-<short-name>` (e.g. `feature/t14-9-ngo-tests`).
- Push the branch and open a pull request into `main`. **Roshni reviews and merges.**
- Never commit `server/.env`, `node_modules/`, or unrelated `package-lock.json` changes.

---

## 10. Troubleshooting

| Problem | Fix |
|---|---|
| **macOS:** `EADDRINUSE :::5000`, or the site gets `403` errors from port 5000 | macOS AirPlay Receiver uses port 5000. Turn it off: *System Settings → General → AirDrop & Handoff → AirPlay Receiver: off*. |
| `MongoDB connection failed` | Check `MONGO_URI` in `server/.env`. Check that Atlas Network Access allows your IP. |
| `CHAT_KEY must be 64 hex chars (32 bytes)` | `CHAT_KEY` in `.env` is missing or incomplete. |
| Login fails for a test account | Run that account's seed script (section 7). For a new non-seeker account, an admin must approve it first. |
| Server says it can't find settings / `undefined` values | The file must be named exactly `.env` (not `.env.txt`, and not named after its first line) and placed in `server/`. |
| `git status` shows `package-lock.json` modified after installing | Run `git restore client/package-lock.json server/package-lock.json`. Use `npm ci` next time. |
| `code: command not found` (macOS) | In VS Code: *Cmd+Shift+P → "Shell Command: Install 'code' command in PATH"*, then reopen Terminal. |

---

*Setup guide tested on macOS (Apple Silicon), Node 22. Sprint 5, task C5.9.*