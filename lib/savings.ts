/**
 * @file lib/savings.ts
 * @description 예측 절약 토큰. 대시보드가 "이 레포를 Cushion으로 읽으면 얼마나 아끼나"를 보여준다.
 *
 * **추정이다.** 대조군은 "에이전트가 문서를 전부 읽는다", 실험군은 "목차 한 번 + 작업당
 * 섹션 하나"라는 실측(acceptance §11.1)과 같은 모델을 쓴다. 토큰 환산은 문자수 ÷ 2 —
 * 한국어 위주 문서의 보수적 근사이고, 화면은 반드시 '추정'을 명시한다.
 *
 * 순수 함수만 둔다. `node --test`가 직접 실행하므로 확장자 포함 상대 경로 (D-008).
 */
import { headings, splitSections } from "./markdown.ts";

export interface SavingsInput {
  path: string;
  title: string | null;
  content: string;
}

export interface Savings {
  /** 전량 로드 (대조군) */
  controlTokens: number;
  /** 목차 한 번 */
  outlineTokens: number;
  /** 작업 하나 = 목차는 이미 읽었고 섹션 하나만 (평균 크기) */
  perTaskTokens: number;
  /** 첫 작업 기준 절약분 (control − outline − perTask) */
  savedTokens: number;
  /** control / (outline + perTask) */
  ratio: number;
}

const toTokens = (chars: number) => Math.ceil(chars / 2);

/** 문서가 없으면 null — 보여줄 근거가 없다. 화면이 "문서를 넣으면 보인다"로 처리한다. */
export function estimateSavings(docs: SavingsInput[]): Savings | null {
  if (docs.length === 0) return null;

  let controlChars = 0;
  let outlineChars = 0;
  let sectionChars = 0;
  let sectionCount = 0;

  for (const doc of docs) {
    // 저장 경로가 LF로 접지만(document.schema) 여기서도 접는다 — 안 그러면 CRLF 문서에서
    // 대조군(원문 그대로)과 섹션(splitSections가 접음)의 기준이 달라 비율이 흔들린다.
    const content = doc.content.replace(/\r\n/g, "\n");
    controlChars += content.length;
    // doc_outline 한 줄: "slug/path — 제목" + 헤딩당 "  ## 제목"
    outlineChars += doc.path.length + (doc.title?.length ?? 0) + 4;
    for (const heading of headings(content)) outlineChars += heading.length + 6;

    for (const section of splitSections(content)) {
      sectionChars += section.text.length;
      sectionCount += 1;
    }
  }

  const avgSectionChars = sectionCount > 0 ? sectionChars / sectionCount : controlChars;
  const controlTokens = toTokens(controlChars);
  const outlineTokens = toTokens(outlineChars);
  const perTaskTokens = toTokens(avgSectionChars);
  const experiment = outlineTokens + perTaskTokens;

  return {
    controlTokens,
    outlineTokens,
    perTaskTokens,
    // 문서가 아주 작으면 목차가 본문보다 클 수 있다 — 음수 절약도 정직하게 돌려준다.
    savedTokens: controlTokens - experiment,
    ratio: experiment > 0 ? controlTokens / experiment : 1,
  };
}
