---
name: cushion-list
description: 접근 가능한 Cushion 라이브러리(문서 묶음) 목록을 보여준다. 사용자가 /cushion-list 로 부를 때만.
---

# 접근 가능한 문서 라이브러리

```
doc_outline(depth:"libraries")
```

`depth`를 빼면 전 문서의 `##` 헤딩까지 딸려 온다 — 목록을 물었지 목차를 물은 게 아니다.

응답은 한 줄에 하나씩 이렇게 온다:

```
cushion — Cushion 문서 (neruu00/cushion) · 문서 2
design-system — 디자인 시스템 (acme/*) · 문서 0
```

거의 그대로 내면 된다. 앞에 `- `만 붙이고, 손대지 않는다.

- `acme/*`는 그 조직 전체가 이 라이브러리를 본다는 뜻이다. 풀어 쓰지 말 것
- `접근 가능한 라이브러리가 없다`가 오면 그대로 전하고, `library_create`로 만들 수 있다고 한 줄 덧붙인다
- 툴이 없으면 MCP가 안 붙은 것이다. 먼저 `claude mcp list`로 확인해 원인(미등록인지 401인지)을
  말해 주고, `/settings/tokens`에서 연결 명령을 받으라고 안내한다

목록 외에 다른 말을 덧붙이지 않는다.
