---
name: cushion-new
description: Create a new document in Cushion following the existing conventions (ADR, runbook, meeting notes, and so on). Only when the user asks with /cushion-new [kind] [title].
---

# Creating a document the way this library does it

`doc_put` will happily create anything anywhere. That is exactly why you end up reinventing
"what is the next ADR number" and "where do meeting notes go" every single time. This skill
removes that.

## 1. Read the conventions first

```
doc_outline(library:"<slug>")
```

**Follow what is already there.** Do not invent a new scheme. The usual shapes:

```
adr/0007-token-rotation.md      number + kebab-case
runbook/deploy.md               procedures
meetings/2026-08-14.md          dates
glossary.md                     a single page
```

- If documents with the same prefix already exist, **copy their shape exactly**
- For numbered kinds (`adr/` and friends) use **the highest existing number + 1**. Count it
  off the list yourself
- If there is no convention at all (the first document), propose one of the shapes above and
  **get the user to confirm it**

## 2. Use a template if there is one

If the library has `templates/<kind>.md`, that is your skeleton:

```
doc_get(library:"<slug>", path:"templates/adr.md")
```

Otherwise build the smallest skeleton that works — **do not scatter empty sections around.**
A heading with nothing under it only teaches the next person that this field goes unused.

For an ADR this is plenty:

```markdown
# 0007. Title

## Context
What is the problem.

## Decision
What we decided to do.

## Rationale
Why. What was rejected, and for what reason.

## Revisit when
What would make us look at this again.
```

## 3. Create it

```
doc_put(library:"<slug>", path:"adr/0007-….md", content:"…", note:"…")
```

- **A new document has no `base_sha`.** If you are passing one, you are overwriting something
  that already exists
- If the response says the document already exists, **stop rather than overwrite.** It means
  the path collided, and overwriting destroys somebody's document. Tell the user and propose
  another path
- Fill in only what you actually know. Leave the rest empty and **report what you left empty**

## 4. Report

One line for the path you created, one line for what you could not fill in. Do not print the
body back out.
