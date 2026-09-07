---
name: cushion
description: For reading or writing this project's docs (specs, ADRs, runbooks, meeting notes, glossaries). The docs live in Cushion, not in the repo, and you read and write them a piece at a time with the doc_* tools on the `cushion` MCP server. Check this first when you cannot find a document locally.
---

# Cushion — how to use the doc library

**The source of truth lives in Cushion.** There being no `SPEC.md` in the local repo is the
design, not an omission. There is no git to fall back on, so the rules below are safety
equipment rather than convenience.

## Reading

```
doc_outline                                    # what exists, not the body
doc_get(library:"…", path:"SPEC.md", heading:"6. Auth")
```

- **Never read a whole document.** Read the outline, then take only the `##` section you
  need. That is the entire reason this tool exists
- If you do not know which document holds it, use `doc_search(query:"…")` — you get back
  the matching sections only
- Reading the same document again? Pass the previous sha as `if_none_match`. If nothing
  changed you get the single word `unchanged` instead of a body
- **Do not throw away the `sha:…` on the first line of a `doc_get` response.** You have to
  hand it back when you edit

## Writing

```
doc_put(library:"…", path:"SPEC.md", heading:"6. Auth",
        content:"## 6. Auth\n…", base_sha:"<sha from doc_get>", note:"what changed and why")
```

- **`base_sha` is required** (only a brand-new document is exempt). Pass back the sha you
  got when reading
- **To change one section, pass `heading`.** Then you never resend the whole document, and
  `content` holds that entire section including its `##` line
- `note` is the commit message slot. One line on what changed and **why**
- For a new document just give a new `path`. It has to end in `.md`

## When there is a conflict

If `base_sha` no longer matches, the write is rejected and you get back **the current sha
and body**.

**Do not merge.** There are no branches, so there is nothing to merge against. Reapply your
change on top of the body you were handed, and send it again with the sha you were handed as
`base_sha`. If it looks like you would be erasing someone else's edit, stop and tell the
person you are working with.

## When you see `[stale]`

A trailing `[stale] repo: path…` line means **someone edited since you last looked**. Call
`doc_changes_since` and you get a summary of what changed, and your cursor moves forward.
No such line means you are up to date — do not re-read to check.

## Easy mistakes

- Do not create a document just because there is nothing locally. **Call `doc_outline` first**
- Do not `doc_get` a large document whole. Use `heading`
- Do not re-read after editing to confirm. The `doc_put` response gives you the new sha
- To remove a document use `doc_delete` — the previous body stays in the history, so do not
  make a backup copy first

## Where to put a new document

The path is the taxonomy. Look at the conventions already in use with `doc_outline` and
follow them (`adr/0001-*.md`, `runbook/*.md`, `meetings/2026-08-13.md`, and so on).
If there is no library to put it in at all, `library_create(slug:"…", name:"…")`.

## If you are not connected

No `doc_*` tools means MCP is not connected. Issue a token at Cushion's `/settings/tokens`
and the screen hands you the whole `claude mcp add` command.
