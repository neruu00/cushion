/**
 * @file components/PageShell.tsx
 * @description 모든 페이지의 <main> 컨테이너. **폭의 단일 출처다.**
 *
 * 이게 생기기 전에는 헤더가 max-w-4xl, 본문 대부분이 max-w-3xl이라 화면을 옮길 때마다
 * 로고와 본문의 좌측선이 어긋났다 — "페이지마다 레이아웃이 다르다"의 정체.
 *
 * 세로 간격(space-y)은 일부러 넣지 않았다 — docs처럼 grid를 쓰는 화면에서
 * space-y의 마진이 grid 자식에 얹혀 이중 간격이 된다. 페이지가 직접 정한다.
 */
import { cn } from "@/lib/utils";

/**
 * 헤더 nav와 모든 페이지 본문이 이 문자열 하나로 폭을 공유한다.
 * 폭을 바꾸려면 여기만 바꾼다 — 클래스를 어느 한쪽에 직접 쓰는 순간 다시 어긋난다.
 */
export const CONTAINER_CLASS = "mx-auto w-full max-w-4xl px-8";

interface PageShellProps {
  className?: string;
  children: React.ReactNode;
}

export function PageShell({ className, children }: PageShellProps) {
  return <main className={cn(CONTAINER_CLASS, "py-10", className)}>{children}</main>;
}
