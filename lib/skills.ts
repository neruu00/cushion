/**
 * @file lib/skills.ts
 * @description 배포할 스킬 파일을 읽어 매니페스트로 만든다. `/api/skills`가 이걸 그대로 낸다.
 *
 * **소스는 `.claude/skills/**` 한 벌뿐이다.** 우리가 도그푸딩하는 그 파일이 곧 배포본이라,
 * 여기서 고치면 쓰는 쪽도 같이 고쳐진다. 사본을 하나 더 두면 한쪽만 갱신되는 날이 온다.
 *
 * 스킬 파일에 프로젝트 정보가 하나도 없다는 점이 이 구조를 가능하게 한다 —
 * 어느 라이브러리를 쓸지는 `/cushion-use`가 런타임에 `git remote`로 찾는다.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface SkillFile {
  /** 스킬 루트 기준 상대 경로. 어디에 심을지는 설치하는 쪽이 정한다 */
  path: string;
  content: string;
}

export interface SkillManifest {
  /** 내용 해시. 손으로 올리는 번호가 아니라 파일이 바뀌면 저절로 바뀐다 */
  version: string;
  files: SkillFile[];
}

const ROOT = join(process.cwd(), ".claude", "skills");

export function readSkills(): SkillManifest {
  const files: SkillFile[] = readdirSync(ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      path: `${entry.name}/SKILL.md`,
      // 저장소에 따라 CRLF로 체크아웃되므로 접는다. 안 그러면 같은 내용인데 해시가 달라진다.
      content: readFileSync(join(ROOT, entry.name, "SKILL.md"), "utf8").replace(/\r\n/g, "\n"),
    }))
    .sort((a, b) => a.path.localeCompare(b.path));

  const digest = createHash("sha256")
    .update(files.map((file) => `${file.path}\n${file.content}`).join("\n"))
    .digest("hex")
    .slice(0, 8);

  return { version: digest, files };
}
