---
name: cushion-capture
description: Fold the decisions, rules and traps settled during this session back into the Cushion docs. Only when the user asks with /cushion-capture.
---

# Writing what was settled back into the docs

Docs go stale not because nobody reads them but because **nobody writes back to them.**
This skill is that step.

## 1. Work out what actually got settled

Take only what **reached a conclusion** in this conversation:

- Decisions and their **rationale** (what, why, and what was rejected)
- Rules and traps you could not learn by reading the code (order dependencies, paths that
  fail silently)
- Contracts that changed (API shape, schema, tool arguments)

**Leave out**: anything still under discussion, anything the code already tells you
(function signatures, file structure), and context that only mattered this session
(throwaway debug logging, one-off commands).
If there is nothing to record, **say so and stop.** Padding it out is how the next person
learns not to trust the docs.

## 2. Find where it belongs

```
doc_outline                       # what documents exist
doc_search(query:"relevant terms")  # is there already a section about this
```

- **Editing an existing section is the default.** A new section splits one topic across two places
- Decisions go in the decision log, rules in the relevant spec section, procedures in the runbook
- If you are not sure which document, **ask**

## 3. Show it, get approval, then write

**Do not skip this order.** An agent quietly editing a spec is itself a new source of drift.

Show a summary like this first:

```
cushion/PLAN.md ## Decision log
  + D-017. The service ships the skills — rationale: …

cushion/SPEC.md ## 9. Screens
  ~ added the three-step onboarding table
```

Only once approved:

```
doc_get(library:"…", path:"…", heading:"…")   # take the sha
doc_put(library:"…", path:"…", heading:"…", content:"…",
        base_sha:"<the sha you got>", note:"what and why")
```

- **Use `heading` to change only that section.** Do not rewrite the whole document
- A mismatched `base_sha` means someone edited in the meantime — do not merge, reapply on
  top of the current body
- Put the **why** in `note`. That is the line the next person reads

## 4. When you write a decision

A decision with no rationale gets reversed by the next person. Cover at least these three:

- **Decision**: what we are doing
- **Rationale**: why. What was rejected, and for what reason
- **Revisit when**: what would make us look at this again

## 5. Report

One line per document and section you changed. That is all. Do not print the body back out.
