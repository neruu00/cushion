/**
 * @file components/DocsTransition.tsx
 * @description 문서 본문의 방향성 전환. 목차에서 아래로 가면 왼쪽으로, 위로 가면 오른쪽으로.
 *
 * 방향은 공간 감각이다 — 앞으로 갈 때와 돌아올 때가 같아 보이면 어디로 움직였는지
 * 알 수 없다. 어느 쪽이 "앞"인지는 자동으로 정해지지 않으므로 `DocsNav`가
 * `transitionTypes`로 알려주고, 여기가 그 이름을 애니메이션에 매핑한다.
 *
 * **레이아웃이 아니라 페이지마다 감싸야 한다.** 레이아웃은 이동해도 살아남아
 * enter·exit이 아예 발생하지 않는다.
 *
 * `default: "none"`이 중요하다. 브라우저 뒤로가기·`router.refresh()`·Suspense 노출처럼
 * 타입이 없는 전환에는 방향이 없다 — 거기까지 미끄러지면 방향이 거짓말이 된다.
 *
 * 타입은 `types/react-canary.d.ts`가 켠다. 런타임 `ViewTransition`은 Next가 별칭하는
 * 번들 React(canary)에 이미 있다. 브라우저가 View Transitions를 모르면 전환만 빠지고
 * 화면은 정상 동작한다.
 */
import { ViewTransition } from "react";

const DIRECTION = {
  "docs-forward": "docs-forward",
  "docs-back": "docs-back",
  default: "none",
};

interface DocsTransitionProps {
  children: React.ReactNode;
}

export function DocsTransition({ children }: DocsTransitionProps) {
  return (
    <ViewTransition enter={DIRECTION} exit={DIRECTION} default="none">
      {children}
    </ViewTransition>
  );
}
