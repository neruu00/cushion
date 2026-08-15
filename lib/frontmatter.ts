/**
 * @file lib/frontmatter.ts
 * @description SKILL.md 앞머리의 `name`·`description`을 떼어낸다.
 *
 * YAML 파서도 `remark-frontmatter`도 들이지 않는다. 대상이 우리가 쓴 두 필드뿐이고,
 * 값에 콜론이 들어가는 것 말고는 문법이랄 게 없다 — 파서를 들이면 값어치보다 먼저 온다.
 *
 * 떼어내지 않고 그냥 렌더하면 `---`가 수평선으로, 그 사이가 문단으로 나온다.
 */
export interface Frontmatter {
  name?: string;
  description?: string;
}

/** `lib/skills.ts`가 CRLF를 접어 주지만, 다른 경로로 들어올 수도 있어 여기서도 본다 */
const BLOCK = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/;

export function splitFrontmatter(source: string): { data: Frontmatter; body: string } {
  const match = source.match(BLOCK);
  if (!match) return { data: {}, body: source };

  const data: Frontmatter = {};
  for (const line of match[1].split(/\r?\n/)) {
    // 값에 콜론이 들어가므로 첫 콜론에서만 자른다
    const at = line.indexOf(":");
    if (at < 1) continue;
    const key = line.slice(0, at).trim();
    const value = line.slice(at + 1).trim();
    if (key === "name" || key === "description") data[key] = value;
  }

  return { data, body: source.slice(match[0].length) };
}
