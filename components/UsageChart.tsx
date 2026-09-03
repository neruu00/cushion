/**
 * @file components/UsageChart.tsx
 * @description 토큰 사용량 선 그래프 + 절약 요약.
 *
 * 실측(오간 양)과 추정(절약)을 **한 카드에 두되 역할을 나눈다** — 그래프는 실제로 오간
 * 것만 그리고, 절약은 그 아래 텍스트다. 절약은 "일어나지 않은 일"이라 축에 올릴 수 없다.
 *
 * 단위는 **추정 토큰**이다. 저장은 문자수이고 환산 계수는 문서의 한글/영문 비율에 따라
 * 달라진다 — 그래서 화면 어디서든 '추정'을 뗀 적이 없다.
 *
 * 시리즈가 하나뿐이라 범례를 두지 않는다(제목이 그 이름이다). 대신 최고점 하나만
 * 직접 라벨한다 — 모든 점에 숫자를 붙이면 선이 안 보인다.
 *
 * 탭은 `<Link>` + searchParams다. `ui/tabs`를 쓰면 'use client'가 붙어 보기 화면에
 * 클라이언트 런타임이 실린다 (SPEC §9). 링크면 서버 렌더가 유지되고 URL 공유도 된다.
 *
 * 호버 툴팁이 없으므로 각 점에 `<title>`을 달아 둔다 — 브라우저가 기본 툴팁을 띄우고
 * 스크린리더도 읽는다. 클라이언트 JS 0을 유지하면서 값에 닿는 유일한 길이다.
 */
import Link from "next/link";

import type { Savings } from "@/lib/savings";
import { USAGE_RANGES, type UsageRange, type UsageSummary } from "@/lib/usage";
import { cn } from "@/lib/utils";

interface UsageChartProps {
  summary: UsageSummary;
  range: UsageRange;
  /** 문서 본문에서 계산한 예상 절약. 문서가 없으면 null */
  savings: Savings | null;
  documentCount: number;
  /** 탭 링크가 돌아올 경로 */
  basePath: string;
}

const fmt = (n: number) => n.toLocaleString();

/** 뷰박스 좌표계. 실제 크기는 CSS가 정하고 선 굵기만 vector-effect로 고정한다. */
const W = 720;
const H = 180;
const PAD = { top: 16, right: 12, bottom: 22, left: 12 };

export function UsageChart({
  summary,
  range,
  savings,
  documentCount,
  basePath,
}: UsageChartProps) {
  const { buckets, readTokens, writeTokens, totalTokens, totalCalls, peak, empty } = summary;
  const hourly = range === "today";

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  // 점이 하나뿐일 리는 없지만(24 또는 7 이상), 0으로 나누는 길은 막아 둔다
  const stepX = buckets.length > 1 ? plotW / (buckets.length - 1) : 0;
  // 최고점이 천장에 닿으면 선이 잘려 보인다. 눈금은 항상 최고점보다 위에 둔다.
  const ceiling = Math.max(1, peak) * 1.15;

  const x = (index: number) => PAD.left + index * stepX;
  const y = (tokens: number) => PAD.top + plotH - (tokens / ceiling) * plotH;

  const line = buckets.map((bucket, i) => `${x(i)},${y(bucket.tokens)}`).join(" ");
  // 면적은 선 아래를 바닥까지 닫는다. 시리즈가 하나일 때만 쓰는 표현이다.
  const area = `${PAD.left},${PAD.top + plotH} ${line} ${x(buckets.length - 1)},${PAD.top + plotH}`;
  const peakIndex = buckets.findIndex((bucket) => bucket.tokens === peak);

  return (
    <section className="space-y-4 rounded-lg border p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-sm font-medium">토큰 사용량</h2>
          <p className="text-xs text-muted-foreground">
            에이전트가 MCP로 주고받은 토큰의 양이에요. 실제로 저장하는 값은 문자 수라서 토큰은{" "}
            <strong className="text-foreground">추정치</strong>이고, 날짜와 시각은 UTC를 기준으로
            표시해요.
          </p>
        </div>

        <nav aria-label="기간" className="flex shrink-0 gap-1 text-xs">
          {USAGE_RANGES.map((item) => (
            <Link
              key={item.value}
              href={item.value === "today" ? basePath : `${basePath}?range=${item.value}`}
              aria-current={item.value === range ? "page" : undefined}
              className={cn(
                "rounded-md px-2 py-1 transition-colors",
                item.value === range
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      {empty ? (
        <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          이 기간에는 기록이 없어요.
          <br />
          <span className="text-xs">에이전트가 MCP로 이 라이브러리를 읽으면 여기에 기록이 쌓여요.</span>
        </p>
      ) : (
        <div className="space-y-1">
          <div className="flex items-baseline gap-2 text-xs text-muted-foreground">
            <span className="font-mono text-base font-semibold tabular-nums text-foreground">
              {fmt(totalTokens)}
            </span>
            <span>tok · 호출 {fmt(totalCalls)}회</span>
          </div>

          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full"
            style={{ height: 180 }}
            role="img"
            aria-label={`${hourly ? "시간별" : "일별"} 토큰 사용량. 합계 ${fmt(totalTokens)} 토큰`}
          >
            {/* 바닥선. 격자는 두지 않는다 — 점이 24개까지 가면 격자가 선을 이긴다 */}
            <line
              x1={PAD.left}
              y1={PAD.top + plotH}
              x2={W - PAD.right}
              y2={PAD.top + plotH}
              className="stroke-border"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <polygon points={area} className="fill-chart-2/15" />
            <polyline
              points={line}
              fill="none"
              className="stroke-chart-4"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            {buckets.map((bucket, i) =>
              bucket.tokens > 0 ? (
                <circle key={bucket.key} cx={x(i)} cy={y(bucket.tokens)} r={3} className="fill-chart-4">
                  {/* <title>은 텍스트 전용이라 자식이 여러 조각이면 하이드레이션이 깨진다.
                      React가 조각 사이에 주석 구분자를 못 넣어 서버·클라이언트 DOM이
                      어긋나기 때문이다. 반드시 문자열 하나로 만들어 넣는다. */}
                  <title>{`${hourly ? `${bucket.label}시` : bucket.label} · ${fmt(bucket.tokens)} tok`}</title>
                </circle>
              ) : null,
            )}
            {/* 최고점만 직접 라벨. 모든 점에 숫자를 붙이면 선이 묻힌다 */}
            {peak > 0 && peakIndex >= 0 && (
              <text
                x={Math.min(Math.max(x(peakIndex), PAD.left + 18), W - PAD.right - 18)}
                y={y(peak) - 8}
                textAnchor="middle"
                className="fill-foreground font-mono text-[11px] tabular-nums"
              >
                {fmt(peak)}
              </text>
            )}
          </svg>

          {/* 축 라벨. 24칸·30칸이면 눈금이 뭉치므로 몇 개만 남긴다 */}
          <div className="flex justify-between px-[2px] text-[10px] text-muted-foreground">
            {axisTicks(buckets.map((b) => b.label), hourly).map((tick) => (
              <span key={tick}>{hourly ? `${tick}시` : tick}</span>
            ))}
          </div>
        </div>
      )}

      {/* 절약은 그래프에 올리지 않는다 — 일어나지 않은 일이라 축에 자리가 없다 */}
      <div className="space-y-1 border-t pt-3 text-xs text-muted-foreground">
        {savings ? (
          <p>
            이 라이브러리의 문서 {documentCount}개를 통째로 읽으면 한 번에 약{" "}
            <strong className="text-foreground">{fmt(savings.controlTokens)} tok</strong>이 들어요.
            목차를 한 번 읽고 작업마다 섹션을 하나씩 읽으면 약{" "}
            <strong className="text-foreground">
              {fmt(savings.outlineTokens + savings.perTaskTokens)} tok
            </strong>
            으로 끝나서, 세션마다{" "}
            <strong className="text-foreground">{fmt(savings.savedTokens)} tok</strong>을 아껴요.
            비율로는 {savings.ratio.toFixed(1)}배예요. 목차는 세션당 한 번만 읽으면 되니까 작업이
            늘어날수록 격차는 더 벌어져요.
          </p>
        ) : (
          <p>문서를 넣으면 절약 추정치가 여기에 나와요.</p>
        )}
        <p>
          읽기 {fmt(readTokens)} tok · 쓰기 {fmt(writeTokens)} tok.{" "}
          <code>library</code> 인자 없이 부른 <code>doc_outline</code>은 어느 라이브러리의
          기록인지 특정할 수 없어서 이 집계에서 빠져 있어요.
        </p>
      </div>
    </section>
  );
}

/**
 * 축에 실제로 찍을 눈금만 고른다. 전부 찍으면 24개·30개가 겹쳐서 아무것도 못 읽는다.
 * 시간축은 6시간 간격, 날짜축은 처음·중간·끝.
 */
function axisTicks(labels: string[], hourly: boolean): string[] {
  if (hourly) return labels.filter((_, i) => i % 6 === 0).concat(labels[labels.length - 1]);
  if (labels.length <= 3) return labels;
  return [labels[0], labels[Math.floor(labels.length / 2)], labels[labels.length - 1]];
}
