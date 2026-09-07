---
name: cushion-compact
description: Strip out the parts of a Cushion document that no longer do any work. Only when the user asks with /cushion-compact [document]. Given a name it does that document, otherwise it looks for candidates across all of them.
---

# Cutting dead sentences out of a document

Documents only ever grow. In-progress narration of finished work, the backstory of a settled
question, the same thing said in two places — all of it is weight an agent carries every time.

**This is deletion, not summarising.** Sentences that stay keep their exact wording. Rewriting
them is not compaction, it is a rewrite, and the rationale quietly shifts underneath.

## 1. Set the scope

If a document name came in as an argument, look only at that one — `.md` is optional and case
does not matter:

```
/cushion-compact SPEC     →  SPEC.md
```

With no argument, list them with `doc_outline` and choose candidates. **If there are more
than ten documents, ask before reading them all** — judging requires reading the bodies, and
that is the cost. If the name matches several, let the user pick.

## 2. What can go, and what cannot

**This list is the whole point of the skill.** Without it an agent deletes the sentences it
did not understand.

**Delete**

- In-progress narration of finished work — an item marked `[x]` that still says "next we should …"
- **Items struck through with `~~strikethrough~~` to mark them resolved** — keep the one-line
  conclusion, drop the backstory
- The same content in two places → make one of them a one-line reference
- Anything the code, the tools or the screen already answers — file structure, function
  signatures, numbers that the UI displays

**Do not delete**

- **The rationale for a decision, and why alternatives were rejected.** It is the only thing
  stopping the next person proposing the same idea again
- **Traps and order dependencies.** "A has to come before B" is short and therefore easy to
  delete, and it is exactly what you cannot learn by reading the code
- **Revisit-when conditions**
- Sentences that look stale but explain *why something was removed*. Delete those and the
  decision comes back

## 3. Show it, get approval, then delete

For every line you would cut, **label which of the categories above it falls under**. If you
cannot label it, it is not something to cut.

```
SPEC.md ## 9. Screens
  − 12 lines  in-progress narration of finished work
  − 5 lines   numbers the UI displays (the code answers this)
  = 6,796 chars → 5,100 chars (−25%)
```

Only once approved:

```
doc_get(library:"…", path:"…", heading:"…")     # take the sha
doc_put(library:"…", path:"…", heading:"…", content:"…",
        base_sha:"<the sha you got>", note:"what was cut and why")
```

`content` must **include the `##` line** — leave it out and the section title goes with it.

## 4. When to stop

- **One section at a time.** Cutting a whole document at once makes the approval a formality
- **If you would cut more than 30% of a section, stop and ask.** That is a restructure, not
  compaction, and restructuring is a person's call
- If there is nothing to cut, **say so and stop.** Padding it out costs you rationale

What makes this skill acceptable at all is that it is reversible — every deletion lands in
`document_versions` and can be restored from the history screen. Do not run it alongside work
that touches that path.

## 5. Report

One line per section: `path ## section −N chars (−N%)`. Do not print the body back out.
