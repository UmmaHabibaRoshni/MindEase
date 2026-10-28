# Working on a second PC (lab, library, laptop)

For anyone who starts at home and continues on a university machine, or the
other way round.

**First time installing anything?** Use the setup guide in the
[README](../README.md) — Node, Git, cloning, `npm ci`, the `.env` keys. This
note only covers the extra problems that come from *switching machines*, which
that guide does not.

---

## Before you leave the first machine

**1. Push everything.** A commit sitting on one PC is a commit you do not have.

```bash
git status            # must say nothing to commit
git push
```

**2. Take `server/.env` with you.** It is gitignored on purpose, so cloning
does not bring it. **Copy the file itself** — USB, or email it to yourself.

Do not retype it by hand. Typing it out is how you end up with a UTF-8 BOM in
front of the first key or stray leading spaces, and then `MONGO_URI` silently
fails to load while the file looks perfectly fine on screen. If you suspect it:

```bash
head -c 3 server/.env | od -An -tx1     # ef bb bf means there is a BOM
```

**3. Have your GitHub login ready** — a Personal Access Token, or be ready to
sign in through the browser.

---

## Setting up on the second machine

```bash
git clone https://github.com/UmmaHabibaRoshni/MindEase.git
cd MindEase

# Do this BEFORE your first commit - see "Commits in the wrong name" below
git config user.name  "Your Name"
git config user.email "your.id@uap-bd.edu"

npm ci
cd server && npm ci
cd ../client && npm ci
```

Then put `server/.env` in place and start both halves:

```bash
cd server && npm run dev     # :5000
cd client && npm run dev     # :5173
```

---

## The five things that actually go wrong

### 1. Commits in the wrong name

A shared machine remembers whoever used it last. If a classmate configured Git
there, **your commits will carry their name**, and the contributor list will be
wrong for the rest of the project.

Set your identity before your first commit, then check it took:

```bash
git log -1 --format='%an <%ae>'
```

If a commit is already wrong, fix just that one:

```bash
git commit --amend --author="Your Name <your.id@uap-bd.edu>" --no-edit
```

### 2. Push rejected, or pushed as somebody else

Windows keeps GitHub logins in **Credential Manager**. If a teammate signed in
on that PC, Git will quietly use their account.

**Fix:** Windows → Credential Manager → Windows Credentials → delete anything
for `github.com`, then push again and sign in as yourself.

### 3. Old Node

The project needs **Node 20 or newer** (Vite 8 and Mongoose 9 both require it).
Lab machines are often on 16 or 18, and the failure is a confusing build error
rather than a clear message.

```bash
node -v
```

If it is too old you will need to install Node — and on a lab machine you may
not have the rights to. Worth checking in the first five minutes, not after an
hour of debugging.

### 4. Port 5000 already in use

The client reaches the API through a proxy to `localhost:5000`
(`client/vite.config.js`). If something else on the machine holds that port,
the website loads normally but **every API call fails**, which looks like a
broken site rather than a port problem.

The server says `EADDRINUSE` when it starts. To clear it:

```bash
netstat -ano | findstr :5000
taskkill /PID <number> /F
```

### 5. The database refuses to connect

Atlas currently allows `0.0.0.0/0`, so a new IP should not be a problem. If it
ever is, the symptom is specific:

| What you see | What it means |
|---|---|
| Hangs, then `Could not connect to any servers` | **IP** — ask the Atlas owner (Roshni) to allow your address under *Network Access* |
| `bad auth : authentication failed` | **Password** — your `MONGO_URI` is stale, not your IP |

A timeout is never a password problem, and `bad auth` is never an IP problem.
Telling them apart saves an hour.

---

## Before you leave the second machine

**1. Commit and push.** Same as before — otherwise the work is stranded on a
machine you may not sit at again.

**2. Delete `server/.env`, or delete the whole folder.**

That file holds the live password to the team's shared database, on a computer
other people use. This is the one item on this page with consequences past your
own marks.

```bash
rm server/.env
```

---

## Quick checklist

**Leaving home:** push → copy `server/.env` → GitHub token in your pocket.

**Arriving:** clone → `git config` your name → three `npm ci` → drop in `.env`
→ check `node -v`.

**Leaving:** push → delete `server/.env`.
