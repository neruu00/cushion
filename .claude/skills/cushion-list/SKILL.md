---
name: cushion-list
description: Show the Cushion libraries (document bundles) you can reach. Only when the user asks with /cushion-list.
---

# Document libraries you can reach

```
doc_outline(depth:"libraries")
```

Leave `depth` off and you drag in the `##` headings of every document — they asked for a
list, not an outline.

The response comes back one per line, like this:

```
cushion — Cushion docs (neruu00/cushion) · 2 docs
design-system — Design system (acme/*) · 0 docs
```

Pass it through almost as is. Add a leading `- ` and leave the rest alone.

- `acme/*` means that whole organisation uses this library. Do not expand it
- If you get `No libraries you can reach`, relay that and add one line saying
  `library_create` makes one
- No tools at all means MCP is not connected. Check with `claude mcp list` first, say which
  it is (not registered, or a 401), and point them at `/settings/tokens` for the connect
  command

Do not add anything beyond the list.
