/**
 * @file lib/action.type.ts
 * @description 서버 액션 반환 규약. 예외를 던지지 않고 이 모양으로 통일한다. (AGENTS.md)
 */

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

/**
 * 발급 직후 **1회만** 노출되는 값. 서버는 해시만 갖고 있으므로 이 응답을 놓치면 재조회가 없다.
 * `files`는 함께 보여줄 붙여넣기용 설정 파일 (T-202).
 */
export interface SecretPayload {
  /** 1회 노출할 비밀값. 보여줄 게 없으면 생략한다 (설정 파일만 주는 경우) */
  secret?: string;
  hint: string;
  files?: { name: string; content: string }[];
}

/** `useActionState` 초기값이 null이라 union에 포함한다. */
export type SecretState = ActionResult<SecretPayload> | null;
