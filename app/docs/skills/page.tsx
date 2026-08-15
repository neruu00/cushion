/**
 * @file app/docs/skills/page.tsx
 * @description 문서 — 스킬 상세. **배포되는 그 파일을 그대로 렌더한다.**
 *
 * `readSkills()`는 `/api/skills`가 내보내는 것과 같은 매니페스트다. 설명을 여기 옮겨 적으면
 * 스킬을 고칠 때 한쪽만 고치는 날이 오고, 그러면 설치한 것과 문서가 다르다고 말하게 된다.
 *
 * 한 페이지에 전부 담되 위에 카드로 목차를 두고 앵커로 건너뛴다. 스킬이 다섯 개뿐이라
 * 라우트를 쪼개면 사이드바만 두 단이 되고 얻는 게 없다.
 *
 * **`next.config.ts`의 `outputFileTracingIncludes`에 이 라우트가 들어 있어야 한다.**
 * 파일 경로가 리터럴이 아니라 `readdir` 결과라 Next의 트레이싱이 못 잡는다 —
 * 빠뜨리면 로컬에서는 멀쩡하고 배포본에서만 500이 난다.
 */
import type { Metadata } from "next";
import { Terminal } from "lucide-react";

import { DocsPager } from "@/components/DocsPager";
import { DocsTransition } from "@/components/DocsTransition";
import { Markdown } from "@/components/Markdown";
import { splitFrontmatter } from "@/lib/frontmatter";
import { readSkills } from "@/lib/skills";
import { skillsUrl } from "@/lib/snippets";

export const metadata: Metadata = { title: "스킬" };

export default function DocsSkillsPage() {
  const { version, files } = readSkills();
  const skills = files.map((file) => {
    const { data, body } = splitFrontmatter(file.content);
    // name이 없으면 디렉터리명으로 떨어진다 — 목차에 빈 칸이 생기는 것보다 낫다
    const name = data.name ?? file.path.split("/")[0];
    return { name, description: data.description ?? "", body, path: file.path };
  });

  return (
    <DocsTransition>
      <article className="space-y-10">
        <header className="space-y-3">
          <h1 className="text-2xl font-semibold">스킬</h1>
          <p className="text-muted-foreground">
            에이전트가 언제 무엇을 해야 하는지 적어 둔 파일 묶음이에요. 없어도 <code>doc_*</code> 툴은
            동작해요 — 스킬은 <strong className="text-foreground">관례</strong>를 줘요. 충돌이 났을
            때 어떻게 복구할지, 새 ADR을 어떤 형식으로 만들지, 어느 라이브러리를 볼지.
          </p>
          <p className="text-sm text-muted-foreground">
            아래 본문은 <code>{skillsUrl()}</code>가 배포하는{" "}
            <strong className="text-foreground">그 파일 그대로</strong>예요. 설치 방법은{" "}
            <a href="/docs/install" className="underline underline-offset-4">
              설치
            </a>{" "}
            2단계에 있어요.
          </p>
        </header>

        <nav aria-label="스킬 목록" className="grid gap-3 sm:grid-cols-2">
          {skills.map((skill) => (
            <a
              key={skill.name}
              href={`#${skill.name}`}
              className="rounded-lg border p-4 transition-colors hover:bg-muted/50"
            >
              <span className="flex items-center gap-1.5 font-mono text-sm font-semibold">
                <Terminal className="size-3.5 shrink-0" />/{skill.name}
              </span>
              <span className="mt-1.5 block text-xs leading-relaxed text-muted-foreground">
                {skill.description}
              </span>
            </a>
          ))}
        </nav>

        {skills.map((skill) => (
          <section key={skill.name} className="space-y-3 border-t pt-8">
            {/* scroll-mt는 앵커로 뛰었을 때 제목이 헤더 밑에 숨지 않게 한다 */}
            <h2 id={skill.name} className="scroll-mt-8 font-mono text-lg font-semibold">
              /{skill.name}
            </h2>
            <p className="text-sm text-muted-foreground">{skill.description}</p>
            {/* prose가 h1부터 시작하므로 스킬 본문의 제목 단계가 페이지와 겹친다.
                본문을 손대는 대신 컨테이너에서 크기만 눌러 계층을 맞춘다 */}
            <div className="rounded-lg border bg-muted/20 p-5 prose-h1:mt-0 prose-h1:text-base prose-h2:text-sm">
              <Markdown>{skill.body}</Markdown>
            </div>
          </section>
        ))}

        <p className="text-xs text-muted-foreground">
          매니페스트 버전 <code>{version}</code> — 손으로 올리는 번호가 아니라 파일 내용의 해시예요.
          설치한 사본이 낡았는지 이 값으로 대조할 수 있어요.
        </p>

        <DocsPager current="/docs/skills" />
      </article>
    </DocsTransition>
  );
}
