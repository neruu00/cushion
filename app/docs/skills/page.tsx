/**
 * @file app/docs/skills/page.tsx
 * @description 문서 — 스킬 상세. **배포되는 그 파일을 그대로 렌더한다.**
 *
 * `readSkills()`는 `/api/skills`가 내보내는 것과 같은 매니페스트다. 설명을 여기 옮겨 적으면
 * 스킬을 고칠 때 한쪽만 고치는 날이 오고, 그러면 설치한 것과 문서가 다르다고 말하게 된다.
 *
 * 스킬 하나가 <details> 하나다. 접힌 줄(이름 + 설명)이 곧 목차라서, 예전처럼 카드 목차와
 * 본문 전문을 따로 두면 같은 내용이 두 번 나열된다 — 7종이 되며 그 중복이 화면을
 * 스크롤 지옥으로 만들었다. 네이티브 요소라 클라이언트 JS 0도 그대로다 (SPEC §9).
 * 앵커(#이름)는 유지한다 — 크롬 계열은 fragment 이동 시 details를 자동으로 펼치고,
 * 아니어도 스크롤은 된다.
 *
 * ⚠️ 스킬 본문은 **한국어 화면에서도 영어로 나온다.** 스킬 파일이 영어 한 벌이기 때문이다 —
 *    배포 경로가 셋(플러그인·`/api/skills`·이 화면)인데 플러그인은 `plugin.json`의 스킬 경로가
 *    하나뿐이라 언어 분기를 받지 못한다. 여기만 번역하면 설치한 것과 화면이 달라진다.
 *
 * **`next.config.ts`의 `outputFileTracingIncludes`에 이 라우트가 들어 있어야 한다.**
 * 파일 경로가 리터럴이 아니라 `readdir` 결과라 Next의 트레이싱이 못 잡는다 —
 * 빠뜨리면 로컬에서는 멀쩡하고 배포본에서만 500이 난다.
 */
import type { Metadata } from "next";
import { ChevronDown, Terminal } from "lucide-react";

import { DocsPager } from "@/components/DocsPager";
import { DocsTransition } from "@/components/DocsTransition";
import { Markdown } from "@/components/Markdown";
import { splitFrontmatter } from "@/lib/frontmatter";
import { readSkills } from "@/lib/skills";
import { getI18n, type Locale } from "@/lib/i18n";
import { skillsUrl } from "@/lib/snippets";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getI18n();
  return { title: locale === "ko" ? "스킬" : "Skills" };
}

interface SkillsCopy {
  title: string;
  lead: React.ReactNode;
  source: React.ReactNode;
  manifest: React.ReactNode;
}

export default async function DocsSkillsPage() {
  const { locale } = await getI18n();
  const { version, files } = readSkills();
  // 매니페스트 해시와 배포 URL이 문장 안에 들어가므로 사전이 아니라 함수다 —
  // 모듈 최상단 상수로 두면 요청마다 달라지는 값을 담을 수 없다
  const c = copy(version)[locale];
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
          <h1 className="text-2xl font-semibold">{c.title}</h1>
          <p className="text-muted-foreground">{c.lead}</p>
          <p className="text-sm text-muted-foreground">{c.source}</p>
        </header>

        <div className="space-y-3">
          {skills.map((skill) => (
            <details
              key={skill.name}
              id={skill.name}
              // scroll-mt는 앵커로 뛰었을 때 제목이 헤더 밑에 숨지 않게 한다
              className="group scroll-mt-8 rounded-lg border transition-colors open:bg-muted/20 hover:bg-muted/40 open:hover:bg-muted/20"
            >
              <summary className="flex cursor-pointer items-start gap-3 p-4 [&::-webkit-details-marker]:hidden [&::marker]:content-none">
                <Terminal className="mt-0.5 size-3.5 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-sm font-semibold">/{skill.name}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                    {skill.description}
                  </span>
                </span>
                <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              {/* prose가 h1부터 시작하므로 스킬 본문의 제목 단계가 페이지와 겹친다.
                  본문을 손대는 대신 컨테이너에서 크기만 눌러 계층을 맞춘다 */}
              <div className="border-t px-5 py-4 prose-h1:mt-0 prose-h1:text-base prose-h2:text-sm">
                <Markdown>{skill.body}</Markdown>
              </div>
            </details>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">{c.manifest}</p>

        <DocsPager current="/docs/skills" />
      </article>
    </DocsTransition>
  );
}

function copy(version: string): Record<Locale, SkillsCopy> {
  return {
    ko: {
      title: "스킬",
      lead: (
        <>
          에이전트가 언제 무엇을 해야 하는지 적어 둔 파일 묶음이에요. 없어도 <code>doc_*</code> 툴은
          동작하고, 스킬은 <strong className="text-foreground">관례</strong>를 더해 줘요. 충돌이
          났을 때의 복구, 새 ADR의 형식, 어느 라이브러리를 볼지 같은 것들이에요.
        </>
      ),
      source: (
        <>
          아래 본문은 <code>{skillsUrl()}</code>가 배포하는{" "}
          <strong className="text-foreground">그 파일 그대로</strong>라 영어예요 — 에이전트에게 주는
          지시문이라 언어를 나누지 않아요. 설치 방법은{" "}
          <a href="/docs/install" className="underline underline-offset-4">
            설치
          </a>{" "}
          문서의 2단계에 있어요.
        </>
      ),
      manifest: (
        <>
          매니페스트 버전은 <code>{version}</code>이에요. 파일 내용의 해시라, 설치해 둔 사본이
          낡았는지 이 값으로 대조할 수 있어요.
        </>
      ),
    },
    en: {
      title: "Skills",
      lead: (
        <>
          A bundle of files telling an agent when to do what. The <code>doc_*</code> tools work
          without them; skills add the <strong className="text-foreground">conventions</strong> —
          how to recover from a conflict, what shape a new ADR takes, which library to look at.
        </>
      ),
      source: (
        <>
          What follows is <strong className="text-foreground">exactly the files</strong> served by{" "}
          <code>{skillsUrl()}</code>. Installing them is step 2 of the{" "}
          <a href="/docs/install" className="underline underline-offset-4">
            install
          </a>{" "}
          page.
        </>
      ),
      manifest: (
        <>
          The manifest version is <code>{version}</code>. It is a hash of the file contents, so you
          can use it to tell whether an installed copy has gone stale.
        </>
      ),
    },
  };
}
