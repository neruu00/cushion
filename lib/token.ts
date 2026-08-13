/**
 * @file lib/token.ts
 * @description 토큰 발급과 파싱. 순수 함수만 둔다(의존성: node:crypto). DB 조회는 lib/authz.ts.
 *
 * 평문은 `generateToken`의 반환값으로만 존재한다. 저장하는 건 sha256 해시뿐이고,
 * 발급 순간 1회 노출 후 재조회 경로가 없다. (SPEC §6)
 *
 * 두 종류를 절대 섞지 않는다:
 *   `cshn_sync_` = 레포(CI)의 쓰기 토큰,  `cshn_pat_` = 사람의 읽기 토큰.
 *   섞이면 CI 토큰 유출이 곧 전체 스펙 열람이 된다.
 */
import { createHash, randomBytes } from "node:crypto";

export const TOKEN_PREFIX = {
  access: "cshn_pat_",
  sync: "cshn_sync_",
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
 * 종류가 다르면 null — 이 한 줄이 sync 토큰으로 /api/mcp를 부르는 걸 막는다. (SPEC §11.2)
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
