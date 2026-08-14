---
name: cushion-use
description: 이 프로젝트가 쓸 Cushion 레포를 정해 AGENTS.md에 기록한다. 사용자가 /cushion-use [slug] 로 부를 때만.
---

# 이 프로젝트의 문서 묶음 정하기

인자로 slug가 오면 그걸 쓴다. **없으면 아래 순서로 알아서 고른다.**

## 1. 고르기

1. `doc_outline`을 인자 없이 불러 접근 가능한 레포를 파악한다
2. slug가 하나뿐이면 그걸로 확정
3. 여러 개면 `git remote get-url origin`에서 레포 이름을 뽑아(`…/neruu00/cushion.git`
   → `cushion`) 같은 이름의 slug가 있으면 그걸로 확정한다.
   **이름이 같다는 것 이상은 모른다** — Cushion이 저장한 GitHub 이름은 `doc_outline`에
   실려 오지 않으므로 이건 어디까지나 추측이다. 그래서 아래 4번이 있다
4. 못 정하거나 추측이 애매하면 **묻는다.** 목록을 보여주고 고르게 한다 — 틀린 레포를
   박아 두면 이후 모든 세션이 엉뚱한 문서를 읽는다

고른 slug가 실재하는지 `doc_outline(repo:"<slug>")`로 확인한다. 오타를 그대로
기록하면 다음 세션이 조용히 실패한다.

## 2. AGENTS.md에 기록

세션 메모리가 아니라 **파일에 남긴다.** 다음 세션에도 남고, 커밋되니 팀원 전원이
같은 레포를 본다. `AGENTS.md`가 없으면 만든다.

이미 Cushion을 언급하는 줄이 있으면 그 slug만 고치고, 없으면 문서 맨 앞
(제목 바로 아래)에 넣는다:

```markdown
## 문서

이 프로젝트의 문서(스펙·ADR·런북·회의록 등)는 레포가 아니라 Cushion의
`<slug>` 에 있다. MCP 서버 `cushion`의 `doc_*` 툴로 읽고 쓴다.
자세한 사용법은 `cushion` 스킬에 있다.
```

`CLAUDE.md`가 `AGENTS.md`를 import 하고 있으면 그쪽은 건드리지 않는다.

## 3. 보고

무엇을 골랐고 **왜 그걸 골랐는지**(인자 / GitHub 이름 일치 / 사용자 선택) 한 줄,
그리고 `AGENTS.md`의 몇 번째 줄을 고쳤는지 한 줄. 그게 전부다.
