/**
 * @file lib/document.schema.ts
 * @description 문서 쓰기 입력 검증. 웹 폼과 MCP 툴 인자가 같은 문턱을 지난다.
 */
import { z } from "zod";

/**
 * 줄바꿈을 LF로 접는다. CRLF로 들어오면 `## 제목\r`이 되고 JS 정규식의 `.`는 `\r`를
 * 매치하지 않아 **섹션 인식이 통째로 실패한다** — 목차도 섹션 조회도 빈 결과가 된다.
 * 저장 직전이 그걸 막을 수 있는 유일한 자리다.
 */
const crlfToLf = (value: string) => value.replace(/\r\n/g, "\n");

export const documentPath = z
  .string()
  .trim()
  .min(1)
  .max(400)
  .refine((p) => !p.startsWith("/") && !p.split("/").includes(".."), "잘못된 경로예요.")
  // 목차·섹션 조회가 전부 마크다운을 전제한다. 다른 걸 받으면 조용히 쓸모없어진다.
  .refine((p) => p.toLowerCase().endsWith(".md"), "경로는 .md 로 끝나야 해요.");

const note = z.string().trim().max(200).optional();

export const putDocumentSchema = z.object({
  library: z.string().trim().min(1),
  path: documentPath,
  // 스펙 문서 하나가 512KB를 넘으면 그건 스펙이 아니다.
  content: z.string().max(512 * 1024).transform(crlfToLf),
  /** 주면 그 `##` 섹션만 교체. content는 헤딩 줄 포함 섹션 전체 — 문서 전체를 실어 보내지 않기 위한 것 */
  heading: z.string().trim().min(1).max(200).optional(),
  /**
   * 수정이면 직전에 읽은 sha. 새 문서면 생략한다.
   * 없이 기존 문서를 덮으려 하면 거부한다 — 조용한 덮어쓰기가 제일 나쁘다.
   */
  base_sha: z.string().trim().max(64).optional(),
  note,
});

export const deleteDocumentSchema = z.object({
  library: z.string().trim().min(1),
  path: documentPath,
  base_sha: z.string().trim().max(64),
  note,
});

export const restoreSchema = z.object({
  library: z.string().trim().min(1),
  path: documentPath,
  version_id: z.coerce.number().int().positive(),
});
