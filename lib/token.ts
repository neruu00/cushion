/**
 * @file lib/token.ts
 * @description 토큰 발급과 파싱. 순수 함수만 둔다(의존성: node:crypto). DB 조회는 lib/authz.ts.
 *
 * 평문은 `generateToken`의 반환값으로만 존재한다. 저장하는 건 sha256 해시뿐이고,
 * 발급 순간 1회 노출 후 재조회 경로가 없다. (SPEC §6)
 *
 * 종류는 두 가지다 — 접근 토큰(`cshn_pat_`)과 초대 링크(`cshn_inv_`). 원본이 Cushion에
 * 있어 레포가 미는 경로가 없어졌고, 그래서 CI용 sync 토큰도 사라졌다 (D-011). 접두사는
 * 남겨 둔다 — 다른 시스템의 키와 섞였을 때 한눈에 갈리고, 종류가 다시 늘면 그대로 확장된다.
 */
import { createHash, randomBytes } from "node:crypto";

export const TOKEN_PREFIX = {
  access: "cshn_pat_",
  invite: "cshn_inv_",
} as const;

export type TokenKind = keyof typeof TOKEN_PREFIX;

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** 새 토큰. `plaintext`를 보여줄 기회는 이 반환값 한 번뿐이다. */
export function generateToken(kind: TokenKind): { plaintext: string; hash: string } {
  const plaintext = TOKEN_PREFIX[kind] + randomBytes(32).toString("base64url");
  return { plaintext, hash: sha256(plaintext) };
}

/**
 * `Authorization: Bearer <token>` 에서 **요청한 종류의** 토큰 해시만 뽑는다.
 * 접두사가 다르면 해시조차 뜨지 않는다 — 남의 시스템 키를 실수로 보냈을 때
 * DB를 한 번 더 두드리지 않고 그 자리에서 걸러진다.
 */
export function hashFromAuthHeader(
  header: string | null | undefined,
  kind: TokenKind,
): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  const raw = header.slice("Bearer ".length).trim();
  if (!raw.startsWith(TOKEN_PREFIX[kind])) return null;
  return sha256(raw);
}
