---
name: cushion-use
description: Decide which Cushion library this project uses and record it in AGENTS.md. Only when the user asks with /cushion-use [slug].
---

# Deciding this project's document library

If a slug came in as an argument, use it. **Otherwise work it out in this order.**

## 1. Pick one

```
doc_outline(depth:"libraries")
```

What is in the parentheses is **the GitHub repos that use that library**:

```
cushion — Cushion docs (neruu00/cushion) · 2 docs
platform — Platform docs (acme/*) · 14 docs
```

1. Get `org/repo` from `git remote get-url origin`
   (`https://github.com/acme/web.git` → `acme/web`)
2. Compare it against the parenthesised lists. An **exact match** (`acme/web`) or an
   **organisation wildcard** (`acme/*`) is your library
3. If several match, prefer the exact one. Still more than one? Go to 4
4. If nothing matches, or more than one still does, **ask.** Show the list and let them
   choose — pinning the wrong library means every later session reads the wrong docs

No git remote, or not GitHub? Go straight to 4.

### If there is no library to use at all

If you get `No libraries you can reach`, or nothing in the list matches, **propose creating
one** (do not just create it — a slug cannot be changed later):

```
library_create(slug:"<proposed>", name:"<proposed>", github_repos:["<org/repo from git remote>"])
```

- Take the slug candidate from the git repo name. Keep only lowercase letters, digits and hyphens
- Putting the current repo in `github_repos` means **this whole step resolves itself next time**
- If a whole organisation will share one library, suggest a single `acme/*` line
- Whoever creates it becomes the first member. Teammates get invited from the library screen on the web

**Do not pick a library because the slug looks similar.** That is a guess; the comparison
above is evidence.

## 2. Record it in AGENTS.md

Put it **in a file**, not in session memory. It survives into the next session, and being
committed it points the whole team at the same library. Create `AGENTS.md` if it does not exist.

If a line mentioning Cushion is already there, change only the slug. Otherwise add it at the
top of the document, right below the title:

```markdown
## Docs

This project's docs (specs, ADRs, runbooks, meeting notes) live in the `<slug>` library on
Cushion, not in this repo. Read and write them with the `doc_*` tools on the `cushion` MCP
server. The `cushion` skill explains how.
```

If `CLAUDE.md` imports `AGENTS.md`, leave `CLAUDE.md` alone.

## 3. Report

One line on what you picked and **why** (argument / `acme/web` matched / `acme/*` matched /
the user chose), and one line on what you changed in `AGENTS.md`. That is all.

If the chosen library's GitHub list does **not** include this repo, add one line: adding it in
the library settings on the web makes this step resolve itself next time.
