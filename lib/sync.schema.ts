/**
 * @file lib/sync.schema.ts
 * @description `/api/sync` 페이로드 검증. CI가 보내는 외부 입력이고 여기가 신뢰 경계다.
 *
 * 이 모양의 원본은 `lib/snippets.ts`의 워크플로다. 한쪽을 바꾸면 양쪽을 바꾼다.
 */
import { z } from "zod";

/** 레포 루트 기준 상대 경로만 받는다. 미러 테이블에 이상한 키가 들어가지 않게. */
const docPath = z
  .string()
  .min(1)
  .max(400)
  .refine((p) => !p.startsWith("/") && !p.split("/").includes(".."), "잘못된 경로");

export const syncPayloadSchema = z.object({
  /** workflow_dispatch 전체 동기화. 페이로드에 없는 문서는 미러에서 지운다 (T-304) */
  full: z.boolean().default(false),
  /** 워크플로가 diff를 상한에서 잘랐다는 표시 */
  truncated: z.boolean().default(false),

  commit: z
    .object({
      sha: z.string().max(64).default(""),
      author: z.string().max(200).default(""),
      message: z.string().max(4000).default(""),
    })
    .default({ sha: "", author: "", message: "" }),

  changed: z
    .array(
      z.object({
        path: docPath,
        // 스펙 문서 하나가 512KB를 넘으면 그건 스펙이 아니다.
        content: z.string().max(512 * 1024),
      }),
    )
    .max(500)
    .default([]),

  /** 삭제 동기화. 이게 빠지면 에이전트가 지워진 스펙을 계속 읽는다 (SPEC §4) */
  deleted: z.array(docPath).max(500).default([]),

  diff: z.string().max(200 * 1024).default(""),
});

export type SyncPayload = z.infer<typeof syncPayloadSchema>;
