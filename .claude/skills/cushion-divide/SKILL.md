---
name: cushion-divide
description: Split a section that has grown heavy, or move it into its own document, so the unit an agent reads gets smaller. Only when the user asks with /cushion-divide [document]. Given a name it does that document, otherwise it looks for candidates across all of them.
---

# Splitting when the unit you read gets too heavy

**Document size is not read cost.** `doc_get(heading:)` works per section, so a document can
grow and you still only get the section you asked for. The outline, which does load every
session, is tiny next to the bodies.

The cost appears when **the addressable unit is coarser than what you need** — when reading
one item means loading the enormous section that item sits in. A decision log is the classic
case. So what you measure is not the document, it is the **section**.

## 1. Set the scope

If a document name came in as an argument, look only at that one (`.md` optional, case
insensitive):

```
/cushion-divide PLAN     →  PLAN.md
```

Otherwise list them with `doc_outline` and pick candidates. **You only learn a section's size
by reading the body** — the outline carries no lengths. If there are more than ten documents,
ask before reading them all.

## 2. When to split

Propose a split only if **at least one** of these three holds. Otherwise leaving it alone is
better.

1. **The section is 5× the median section size in that library or more**
2. **One section mixes different readers or different tasks** — reading one means loading the rest
3. **The section is edited often** — `base_sha` conflicts are per document, so splitting it out reduces contention

## 3. Two different moves — splitting a section is the default

| | When | Outline cost | Read benefit |
|---|---|---|---|
| **Split a section** (same document) | A big section is really one topic | A few heading lines | Large |
| **Split out a document** (new file) | The topic itself is different | Path + every heading | None |

**Splitting a document does not reduce read cost.** The section count is unchanged; only the
outline gets longer. Create a new document only when the topic genuinely differs — what you
gain there is not read cost but **findability** and **write contention**.

## 4. Survey the references first

Identifiers like section numbers (`§6`) and decision numbers (`D-011`) **get cited from
outside the document** — code comments and repo files such as `AGENTS.md` point at them as
`(SPEC §6)` or `(D-011)`. Nothing fails when they break; the next person just hunts for a
section that is not there.

- **Do not renumber.** A number travels with its content even when it moves
- Use `doc_search` to see whether other documents point at that section — fix those too
- References from outside the docs (code, repo files) are beyond this skill's reach. **Report
  them as a list** and let a person decide

## 5. Show it, get approval, then move

Show the range being moved (or split) and the resulting shape first. Proceed only once
approved. Either way `content` must **include the `##` line** — leave it out and the section
title disappears.

**Splitting a section** — one replacement does it. Put several `##` headings in the
replacement body and it splits:

```
doc_get(library:"…", path:"…", heading:"the big section")   # take the body and sha
doc_put(library:"…", path:"…", heading:"the big section",
        content:"## Topic A\n…\n\n## Topic B\n…",
        base_sha:"<the sha you got>", note:"…")
```

**Splitting out a document** — two calls, and the order matters:

```
doc_get(library:"…", path:"<original>", heading:"…")        # take the body and sha
doc_put(library:"…", path:"<new path>", content:"…")        # ① create the new document first
doc_put(library:"…", path:"<original>", heading:"…",
        content:"## …\none-line summary + the new path",
        base_sha:"<the sha you got>", note:"…")              # ② then shrink the original
```

- **Do not reverse ① and ②.** There are no transactions, so a call can fail halfway; in this
  order a failure leaves the content in two places (visible, and fixable). Reversed, it
  leaves the original gone and the new document missing
- If ① comes back saying the document already exists, **stop.** The path collided, and
  overwriting destroys somebody's document. Propose another path
- Leave **a one-line summary plus the new path** in the original. An empty shell heading eats
  outline space and tells you nothing

## 6. Report

One line each for the new document path, how much the original shrank, and **the list of
outside references that need fixing**. Do not print the body back out.
