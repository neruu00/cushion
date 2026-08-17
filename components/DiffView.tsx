/**
 * @file components/DiffView.tsx
 * @description 버전 사이의 변경을 hunk로 보여준다. **서버 컴포넌트다** — 클라이언트 번들 0.
 *
 * 상한을 넘겨 diff를 못 만든 경우(전면 재작성)는 조용히 비우지 않고 그렇게 말한다.
 * 그때는 옆의 "전문 보기"가 유일한 수단이라는 걸 읽는 사람이 알아야 한다.
 */
import { countChanges, diffLines, toHunks } from "@/lib/diff";

interface DiffViewProps {
  before: string;
  after: string;
}

const TONE: Record<string, string> = {
  "+": "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  "-": "bg-red-500/10 text-red-800 dark:text-red-300",
  " ": "text-muted-foreground",
};

export function DiffView({ before, after }: DiffViewProps) {
  const lines = diffLines(before, after);

  if (lines === null) {
    return (
      <p className="px-3 py-2 text-xs text-muted-foreground">
        변경이 너무 커서 diff를 생략했어요. 아래 전문을 봐주세요.
      </p>
    );
  }

  const { added, removed } = countChanges(lines);
  if (added === 0 && removed === 0) {
    return <p className="px-3 py-2 text-xs text-muted-foreground">내용 변경이 없어요.</p>;
  }

  return (
    <div className="space-y-2 px-3 py-2">
      <p className="font-mono text-xs text-muted-foreground">
        +{added} −{removed}
      </p>
      {toHunks(lines, after).map((hunk, index) => (
        <div key={index} className="overflow-hidden rounded border">
          <p className="border-b bg-muted/40 px-2 py-1 font-mono text-xs text-muted-foreground">
            {hunk.heading ? `## ${hunk.heading}` : "(머리말)"}
          </p>
          <pre className="overflow-x-auto font-mono text-xs leading-relaxed">
            {hunk.lines.map((line, i) => (
              <span key={i} className={`block px-2 ${TONE[line.kind]}`}>
                {line.kind}
                {line.text}
              </span>
            ))}
          </pre>
        </div>
      ))}
    </div>
  );
}
