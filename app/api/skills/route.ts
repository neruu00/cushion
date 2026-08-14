/**
 * @file app/api/skills/route.ts
 * @description 스킬 배포. `GET /api/skills` 한 번이면 전부 받는다.
 *
 * **인증이 없다.** 스킬 파일에는 비밀도 프로젝트 정보도 없다 — 토큰은 MCP 설정에 있고,
 * 어느 라이브러리를 쓸지는 `/cushion-use`가 런타임에 찾는다. 인증을 걸면 설치 안내가
 * "먼저 토큰을 받고…"로 길어지는데, 그게 이 라우트가 없애려는 마찰이다.
 *
 * 파일별 라우트를 두지 않는 이유: 설치하는 쪽이 N번 요청하게 만들 이유가 없다.
 */
import { readSkills } from "@/lib/skills";

export async function GET() {
  try {
    return Response.json(readSkills());
  } catch (cause) {
    // 배포 번들에 .claude/skills가 안 실리면 여기로 온다 (next.config.ts의 트레이싱 설정).
    // 로컬에서는 파일이 그냥 있어서 절대 재현되지 않는다 — 배포 후 프로덕션에서 확인할 것.
    console.error("skills: read", cause);
    return Response.json({ error: "스킬을 읽지 못했다" }, { status: 500 });
  }
}
