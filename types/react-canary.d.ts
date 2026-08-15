/**
 * @file types/react-canary.d.ts
 * @description `<ViewTransition>` 타입을 켠다.
 *
 * Next는 앱 코드의 `react`를 번들 React로 별칭한다(`create-compiler-aliases.js`) — 그게
 * 19.3.0-canary라 `ViewTransition`이 **런타임에는 이미 있다.** 없는 건 타입뿐이고,
 * `@types/react`는 그걸 `canary.d.ts`에 따로 담아 뒀다.
 *
 * 파일 안에서 `import {} from "react/canary"`로 켜는 방법도 문서에 있지만 쓰지 않는다 —
 * 그 모듈은 실재하지 않아서, 번들러가 부수효과 import로 남기면 런타임에 죽는다.
 * 삼중 슬래시 참조는 컴파일 타임에만 존재한다.
 *
 * tsconfig의 `types` 배열을 쓰지 않은 것도 같은 이유다 — 그 키를 쓰는 순간 자동 포함이
 * 꺼져서 `@types/node`까지 손으로 나열해야 한다.
 */
/// <reference types="react/canary" />
