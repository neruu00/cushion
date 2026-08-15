import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `/api/skills`와 `/docs/skills`가 .claude/skills/**를 런타임에 읽는다. Next의 파일
  // 트레이싱은 이걸 자동으로 못 잡는다(경로가 리터럴이 아니라 readdir 결과다) — 명시하지
  // 않으면 배포본에서만 500이 나고 로컬에서는 절대 재현되지 않는다.
  // `readSkills()`를 부르는 라우트를 추가하면 여기도 같이 추가한다.
  outputFileTracingIncludes: {
    "/api/skills": [".claude/skills/**/*.md"],
    "/docs/skills": [".claude/skills/**/*.md"],
  },
};

export default nextConfig;
