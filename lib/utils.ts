import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * `{name}` 자리표시자를 채운다. 사전(`lib/i18n.*.ts`)의 값이 전부 평문 문자열이라
 * 보간이 필요한 자리는 전부 여기를 지난다.
 *
 * 클라이언트에서도 쓰므로 `lib/i18n.ts`가 아니라 여기 둔다 — 그쪽은 `next/headers`를
 * 임포트해서 클라이언트 번들에 들어가지 못한다.
 *
 * 없는 키는 자리표시자를 **그대로 남긴다.** 조용히 빈칸으로 만들면 문장이 멀쩡해 보여서
 * 빠진 걸 아무도 못 찾는다.
 */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole,
  );
}
