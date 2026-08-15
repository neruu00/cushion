/**
 * @file components/CushionDrop.tsx
 * @description 랜딩 히어로 애니메이션 — AI 로고가 떨어지고, 쿠션이 푹 꺼지며 받아낸다.
 *
 * 은유가 곧 제품 설명이다: 에이전트가 컨텍스트에 태울 토큰을 Cushion이 흡수한다.
 * 그래서 **로고는 튕겨 나가지 않는다.** 쿠션이 가운데부터 푹 꺼져 충격을 삼키고,
 * 다시 부풀어 오르는 동안 로고는 그 위에서 옆으로 굴러 내려간다. 되튀는 순간이
 * 있으면 "받아냈다"가 아니라 "밀어냈다"로 읽힌다.
 *
 * 딱딱한 것(로고)은 변형되지 않고 무른 것(쿠션)만 변형된다 — squash를 로고에
 * 주지 않는 이유다.
 *
 * **순수 CSS다.** 물리 엔진은 장식 루프에 과하다. 서버 컴포넌트라 클라이언트 JS 0.
 *
 * ## 좌표계
 *
 * 모든 수치는 `.cd-stage`(640×300 고정) 안의 px다. 밴드 폭은 뷰포트마다 다르지만
 * 스테이지는 고정이라 좌표가 흔들리지 않는다 — 밴드가 좁으면 양옆이 잘릴 뿐이다.
 * 쿠션은 스테이지 한가운데(x=320)에 있고, 로고의 `translate(0,0)`이 곧 쿠션 마루와
 * 닿는 지점이라 키프레임 값은 전부 충돌점 기준 상대 좌표로 읽힌다.
 *
 * ## 타이밍 계약 (건드리려면 같이 건드려야 한다)
 *
 * 로고 21s × 7개(지연 0·3·…·18s) → 충돌이 3s마다. 쿠션·`− tok`은 주기 3s.
 *
 * | 시각  | 로고 21s | 쿠션 3s | 일어나는 일                       |
 * | ----- | -------- | ------- | --------------------------------- |
 * | 0.63s | 3%       | 21%     | 접촉                              |
 * | 0.84s | 4%       | 28%     | 최대 함몰 — 로고가 가장 깊이 잠김 |
 * | 1.26s | 6%       | 42%     | 쿠션이 되부풂                     |
 * | 1.47s | 7%       | 49%     | 쿠션 원상복귀, 로고가 기울기 시작 |
 * | 2.10s | 10%      | —       | 바닥 도달, 이후 굴러가며 사라짐   |
 *
 * 로고 1% = 0.21s, 쿠션 1% = 0.03s. 접촉 시점(3%)을 옮기면 쿠션·tok의
 * 21/28/35/42/49% 위상을 전부 같이 옮겨야 한다. **로고 개수도 계약의 일부다** —
 * 7개 × 3s = 21s라서 두 주기가 맞물린다. 개수를 바꾸면 모든 퍼센트가 어긋난다.
 *
 * 지연을 쓰는 애니메이션에는 `backwards`가 반드시 붙어야 한다 — 없으면 지연
 * 구간에서 요소가 기본 위치(= 접촉 지점)에 얹혀 박자가 무너진다.
 *
 * 굴러가는 회전량은 이동 거리에 비례시킨다 — 실측한 그림 지름 평균 39.4px →
 * 반지름 19.7px → 원주 124px → **2.9°/px**. 박스(44px)가 아니라 그림 크기를
 * 쓴다. 이 비율이 깨지면 미끄러지는 것처럼 보인다.
 */
import Image from "next/image";

interface Logo {
  name: string;
  src: string;
  /** 21s 주기 안에서 이 로고의 차례. 3s 간격 고정 */
  delay: string;
}

/**
 * `public/logos/`에 Grok도 있지만 뺐다 — 흰색으로 그려져 있어 칩 없이 얹으면
 * 밝은 배경에 통째로 묻는다. 그 하나 때문에 다른 로고까지 칩을 씌울 수는 없다.
 */
const LOGOS: Logo[] = [
  { name: "Claude", src: "/logos/Claude.svg", delay: "0s" },
  { name: "ChatGPT", src: "/logos/ChatGPT.svg", delay: "3s" },
  { name: "Gemini", src: "/logos/Gemini.svg", delay: "6s" },
  { name: "Copilot", src: "/logos/Copilot.svg", delay: "9s" },
  { name: "DeepSeek", src: "/logos/DeepSeek.svg", delay: "12s" },
  { name: "Perplexity", src: "/logos/Perplexity.svg", delay: "15s" },
  { name: "Manus", src: "/logos/manus.svg", delay: "18s" },
];

export function CushionDrop() {
  return (
    <div aria-hidden className="cd-band">
      <div className="cd-stage">
        <div className="cd-ground" />

        <div className="cd-cushion" />

        <span className="cd-tok">− tok</span>

        {/* 바깥은 Y(중력 가속) + 페이드, 안쪽은 X(등속) + 회전.
            한 요소에 다 넣으면 timing-function이 두 축에 함께 걸려 포물선이 아니라
            대각선이 된다 — 수평 속도까지 같이 가속되기 때문이다.
            Y가 바깥인 건 합성 순서 때문이다: T(0,y)·T(x,0)·R(θ) = T(x,y)·R(θ)로
            회전이 마지막에 오지만, 뒤집으면 회전한 좌표계에서 Y가 밀려 궤도가 휜다. */}
        {LOGOS.map((logo) => (
          <span
            key={logo.name}
            className="cd-flight"
            style={{ animationDelay: logo.delay }}
          >
            <span className="cd-logo" style={{ animationDelay: logo.delay }}>
              <Image
                src={logo.src}
                alt=""
                width={44}
                height={44}
                unoptimized
                loading="eager"
              />
            </span>
          </span>
        ))}
      </div>

      {/* 컴포넌트 전용 키프레임. 전역 CSS를 어지럽히지 않으려고 여기 둔다. */}
      <style>{`
        .cd-band {
          position: relative;
          height: 300px;
          overflow: hidden;
          pointer-events: none;
          user-select: none;
        }
        .cd-stage {
          position: absolute;
          bottom: 0;
          left: 50%;
          margin-left: -320px;
          width: 640px;
          height: 300px;
        }
        /* 밴드 밖까지 늘려 둔다 — 좁은 화면에서 스테이지가 축소돼도 선이 끊기지 않게 */
        .cd-ground {
          position: absolute;
          left: -600px;
          right: -600px;
          bottom: 22px;
          height: 1px;
          background: var(--border);
        }

        /* ── 쿠션: 빵빵한 베개 ─────────────────────────────────────────
           위쪽 60px 남짓은 평평하고 양 끝만 둥글다(수평 38+38%, 남는 24%가 평면).
           테두리선 대신 위아래 명암으로 부피를 낸다 — 1px 선을 두면 함몰이 그 선을
           끊어 먹는다.

           함몰은 clip-path(cd-press)가 쿠션 실루엣 자체를 오목하게 만든다.
           바깥 그림자를 box-shadow로 주면 안 된다 — clip-path가 잘라낸다.
           drop-shadow는 클리핑 **뒤에** 적용돼 파인 윤곽까지 따라간다. */
        .cd-cushion {
          position: absolute;
          bottom: 22px;
          left: 320px;
          margin-left: -110px;
          width: 220px;
          height: 86px;
          border-radius: 38% 38% 34% 34% / 56% 56% 44% 44%;
          background:
            radial-gradient(64% 58% at 30% 24%, color-mix(in srgb, var(--background) 40%, transparent), transparent 70%),
            linear-gradient(
              to bottom,
              color-mix(in oklab, var(--muted) 90%, var(--foreground) 10%),
              color-mix(in oklab, var(--muted) 74%, var(--foreground) 26%)
            );
          box-shadow:
            inset 0 1px 2px color-mix(in srgb, var(--background) 40%, transparent),
            inset 0 -12px 18px -12px color-mix(in srgb, var(--foreground) 35%, transparent);
          filter: drop-shadow(0 5px 5px color-mix(in srgb, var(--foreground) 20%, transparent));
          transform-origin: bottom center;
          animation: cd-squash 3s infinite, cd-press 3s infinite;
        }
        /* 박음질 — 베개로 읽히게 하는 가장 싼 신호 */
        .cd-cushion::before {
          content: "";
          position: absolute;
          inset: 9px 15px;
          border: 1px dashed color-mix(in srgb, var(--foreground) 16%, transparent);
          border-radius: inherit;
          opacity: 0.55;
        }
        .cd-tok {
          position: absolute;
          left: 396px;
          bottom: 124px;
          font-size: 11px;
          font-family: var(--font-mono, monospace);
          color: var(--muted-foreground);
          opacity: 0;
          animation: cd-tok 3s infinite;
        }

        /* ── 로고 ──────────────────────────────────────────────────── */
        /* backwards가 없으면 지연(3·6·…s) 동안 애니메이션이 적용되지 않아 요소가
           기본 위치 — 즉 translate(0,0) = 쿠션 마루 — 에 그대로 얹힌다. 로고 7개가
           쿠션 위에 쌓인 채 시작하고, 쿠션만 제 박자로 눌려 박자가 따로 논다. */
        .cd-flight {
          position: absolute;
          /* 쿠션 마루는 108px. 4px 낮춘 건 SVG 자체 여백 때문이다 — 곡선을 평탄화해
             실측한 7종 평균 아래 여백이 128 중 12.1(44px 기준 4.17px)이라, 박스
             바닥을 마루에 맞추면 그림은 그만큼 뜬 채로 쿠션이 먼저 눌린다.
             이 값이 바뀌면 바닥 안착 값(cd-y의 86px)도 같이 어긋난다. */
          bottom: 104px;
          left: 320px;
          margin-left: -22px;
          width: 44px;
          height: 44px;
          animation: cd-y 21s infinite backwards;
        }
        .cd-logo {
          display: block;
          width: 44px;
          height: 44px;
          animation: cd-x 21s infinite backwards;
        }

        /* 수직 + 페이드. 낙하 구간의 easeInQuad가 곧 중력(거리 ∝ 시간²)이다.
           10% 이후 Y는 상수라, 페이드 키프레임을 끼워도 궤적이 갈라지지 않는다.

           **접촉 이후 값은 쿠션 표면을 따라간다.** 표면이 내려가는 양은 함몰 하나가
           아니라 둘의 합이다 — cd-press의 함몰 깊이 D와, cd-squash가 마루를
           끌어내리는 86 × (1 − scaleY). 게다가 D는 쿠션의 로컬 좌표라 scaleY가
           한 번 더 곱해진다. 함몰 깊이만 보고 값을 맞추면 가장 깊은 순간에 로고가
           표면 위에 뜬다.

             위상 | D×s          | 마루 하강      | 표면 하강 | +3 파묻힘
             28%  | 22×0.92=20.2 | 86×0.08 = 6.9 |   27.1   |   30
             35%  |  8×0.97= 7.8 | 86×0.03 = 2.6 |   10.4   |   13
             42%  |  2×1.03= 2.1 | 86×(−0.03)=−2.6|  −0.5   |    3

           +3px는 파묻힘 여유다. 딱 맞추면 접선처럼 스쳐 보인다.
           바닥(86px)에는 이 여유를 주지 않는다 — 지면은 파이지 않는다. */
        @keyframes cd-y {
          0%   { transform: translateY(-200px); opacity: 1;
                 animation-timing-function: cubic-bezier(0.11, 0, 0.5, 0); }
          /* 접촉 — 여기부터 쿠션이 삼킨다 */
          3%   { transform: translateY(3px);
                 animation-timing-function: cubic-bezier(0.25, 0.6, 0.4, 1); }
          4%   { transform: translateY(30px);
                 animation-timing-function: cubic-bezier(0.3, 0, 0.5, 1); }
          /* 쿠션이 되부풀며 로고를 도로 마루까지 올린다. 튕겨 올리지는 않는다 */
          5%   { transform: translateY(13px); animation-timing-function: ease-out; }
          6%   { transform: translateY(3px);  animation-timing-function: ease-in-out; }
          7%   { transform: translateY(3px);
                 animation-timing-function: cubic-bezier(0.3, 0, 0.7, 0.6); }
          /* 오른쪽 어깨를 타고 바닥으로 */
          10%  { transform: translateY(86px); opacity: 1; }
          14%  { transform: translateY(86px); opacity: 1; }
          24%  { transform: translateY(86px); opacity: 0; }
          100% { transform: translateY(86px); opacity: 0; }
        }

        /* 수평 + 회전. 낙하 중엔 등속, 접촉하면 거의 멈췄다가, 쿠션이 되부푸는 힘으로
           오른쪽 어깨를 타고 내려가 바닥에서 서서히 감속한다.
           7% 이후 회전은 이동 거리 × 2.9°/px */
        @keyframes cd-x {
          0%   { transform: translateX(-280px) rotate(0deg);
                 animation-timing-function: linear; }
          3%   { transform: translateX(0) rotate(26deg);
                 animation-timing-function: cubic-bezier(0.15, 0.7, 0.3, 1); }
          4%   { transform: translateX(4px) rotate(30deg);
                 animation-timing-function: ease-out; }
          6%   { transform: translateX(12px) rotate(38deg);
                 animation-timing-function: ease-in; }
          7%   { transform: translateX(26px) rotate(56deg);
                 animation-timing-function: cubic-bezier(0.35, 0, 0.6, 0.55); }
          10%  { transform: translateX(130px) rotate(359deg);
                 animation-timing-function: cubic-bezier(0.15, 0.55, 0.5, 1); }
          24%  { transform: translateX(300px) rotate(854deg); }
          100% { transform: translateX(300px) rotate(854deg); }
        }

        /* 가운데가 꺼지는 동안 옆구리는 부푼다 — 베개를 눌렀을 때 그렇다 */
        @keyframes cd-squash {
          0%, 21%   { transform: scale(1, 1);
                      animation-timing-function: cubic-bezier(0.2, 0.8, 0.3, 1); }
          28%       { transform: scale(1.07, 0.92);
                      animation-timing-function: cubic-bezier(0.3, 0, 0.4, 1); }
          35%       { transform: scale(1.03, 0.97);
                      animation-timing-function: ease-in-out; }
          42%       { transform: scale(0.985, 1.03);
                      animation-timing-function: cubic-bezier(0.3, 0, 0.3, 1); }
          49%, 100% { transform: scale(1, 1); }
        }
        /* 함몰. 쿠션 실루엣 자체를 오목하게 만든다 — 배경색 도형을 겹쳐 파내는
           방식으로는 두 곡선이 만나는 양쪽에 반드시 꼭짓점이 남는다(교차점에서
           오버레이 호는 올라가고 쿠션 어깨는 내려가 42°짜리 모서리가 생긴다).
           겹치는 도형이 없으면 교차점 자체가 없다.

           윗변에 더하는 함몰 프로파일은 깊이 × cos²(π·dx / 2·82)다. cos²는
           |dx|=82에서 값도 기울기도 0이라 원래 윗변과 **접한다** — 꼭짓점이 생길 수
           없는 이유가 이거다. 다른 함수로 바꾸려면 이 두 조건을 유지해야 한다.

           좌표는 scripts/cushion-clip.mjs가 생성한다. 46점, 윗변 각짐 0.68px 이하.
           polygon은 border-radius 곡선 바깥으로 살짝 부풀어 있다(1/cos(반각)) —
           실제 가장자리는 두 도형의 교집합이라 쉴 때는 다각형 티가 나지 않는다.
           **손으로 고치지 말고 스크립트를 고쳐 다시 생성한다.** */
        @keyframes cd-press {
          0%, 21% {
            clip-path: polygon(-0.08% 56.00%, 0.24% 48.67%, 1.22% 41.48%, 2.82% 34.52%, 5.02% 27.94%, 7.79% 21.84%, 11.07% 16.32%, 14.82% 11.48%, 18.96% 7.40%, 23.43% 4.15%, 28.14% 1.79%, 33.03% 0.36%, 38.00% -0.12%, 41.00% -0.70%, 44.00% -0.70%, 47.00% -0.70%, 50.00% -0.70%, 53.00% -0.70%, 56.00% -0.70%, 59.00% -0.70%, 62.00% -0.12%, 66.97% 0.36%, 71.86% 1.79%, 76.57% 4.15%, 81.04% 7.40%, 85.18% 11.48%, 88.93% 16.32%, 92.21% 21.84%, 94.98% 27.94%, 97.18% 34.52%, 98.78% 41.48%, 99.76% 48.67%, 100.08% 56.00%, 100.42% 56.00%, 98.74% 69.77%, 93.85% 82.18%, 86.23% 92.04%, 76.64% 98.37%, 66.00% 100.55%, 50.00% 100.70%, 34.00% 100.55%, 23.36% 98.37%, 13.77% 92.04%, 6.15% 82.18%, 1.26% 69.77%, -0.42% 56.00%);
            animation-timing-function: cubic-bezier(0.2, 0.8, 0.3, 1);
          }
          28% {
            clip-path: polygon(-0.08% 56.00%, 0.24% 48.67%, 1.22% 41.48%, 2.82% 34.52%, 5.02% 27.94%, 7.79% 21.84%, 11.07% 16.32%, 14.82% 11.67%, 18.96% 9.12%, 23.43% 9.01%, 28.14% 11.15%, 33.03% 14.94%, 38.00% 19.46%, 41.00% 21.38%, 44.00% 23.28%, 47.00% 24.48%, 50.00% 24.88%, 53.00% 24.48%, 56.00% 23.28%, 59.00% 21.38%, 62.00% 19.46%, 66.97% 14.94%, 71.86% 11.15%, 76.57% 9.01%, 81.04% 9.12%, 85.18% 11.67%, 88.93% 16.32%, 92.21% 21.84%, 94.98% 27.94%, 97.18% 34.52%, 98.78% 41.48%, 99.76% 48.67%, 100.08% 56.00%, 100.42% 56.00%, 98.74% 69.77%, 93.85% 82.18%, 86.23% 92.04%, 76.64% 98.37%, 66.00% 100.55%, 50.00% 100.70%, 34.00% 100.55%, 23.36% 98.37%, 13.77% 92.04%, 6.15% 82.18%, 1.26% 69.77%, -0.42% 56.00%);
            animation-timing-function: cubic-bezier(0.3, 0, 0.4, 1);
          }
          35% {
            clip-path: polygon(-0.08% 56.00%, 0.24% 48.67%, 1.22% 41.48%, 2.82% 34.52%, 5.02% 27.94%, 7.79% 21.84%, 11.07% 16.32%, 14.82% 11.55%, 18.96% 8.03%, 23.43% 5.92%, 28.14% 5.20%, 33.03% 5.66%, 38.00% 7.00%, 41.00% 7.33%, 44.00% 8.02%, 47.00% 8.46%, 50.00% 8.60%, 53.00% 8.46%, 56.00% 8.02%, 59.00% 7.33%, 62.00% 7.00%, 66.97% 5.66%, 71.86% 5.20%, 76.57% 5.92%, 81.04% 8.03%, 85.18% 11.55%, 88.93% 16.32%, 92.21% 21.84%, 94.98% 27.94%, 97.18% 34.52%, 98.78% 41.48%, 99.76% 48.67%, 100.08% 56.00%, 100.42% 56.00%, 98.74% 69.77%, 93.85% 82.18%, 86.23% 92.04%, 76.64% 98.37%, 66.00% 100.55%, 50.00% 100.70%, 34.00% 100.55%, 23.36% 98.37%, 13.77% 92.04%, 6.15% 82.18%, 1.26% 69.77%, -0.42% 56.00%);
            animation-timing-function: ease-in-out;
          }
          42% {
            clip-path: polygon(-0.08% 56.00%, 0.24% 48.67%, 1.22% 41.48%, 2.82% 34.52%, 5.02% 27.94%, 7.79% 21.84%, 11.07% 16.32%, 14.82% 11.49%, 18.96% 7.56%, 23.43% 4.59%, 28.14% 2.64%, 33.03% 1.69%, 38.00% 1.66%, 41.00% 1.31%, 44.00% 1.48%, 47.00% 1.59%, 50.00% 1.63%, 53.00% 1.59%, 56.00% 1.48%, 59.00% 1.31%, 62.00% 1.66%, 66.97% 1.69%, 71.86% 2.64%, 76.57% 4.59%, 81.04% 7.56%, 85.18% 11.49%, 88.93% 16.32%, 92.21% 21.84%, 94.98% 27.94%, 97.18% 34.52%, 98.78% 41.48%, 99.76% 48.67%, 100.08% 56.00%, 100.42% 56.00%, 98.74% 69.77%, 93.85% 82.18%, 86.23% 92.04%, 76.64% 98.37%, 66.00% 100.55%, 50.00% 100.70%, 34.00% 100.55%, 23.36% 98.37%, 13.77% 92.04%, 6.15% 82.18%, 1.26% 69.77%, -0.42% 56.00%);
            animation-timing-function: cubic-bezier(0.3, 0, 0.3, 1);
          }
          49%, 100% {
            clip-path: polygon(-0.08% 56.00%, 0.24% 48.67%, 1.22% 41.48%, 2.82% 34.52%, 5.02% 27.94%, 7.79% 21.84%, 11.07% 16.32%, 14.82% 11.48%, 18.96% 7.40%, 23.43% 4.15%, 28.14% 1.79%, 33.03% 0.36%, 38.00% -0.12%, 41.00% -0.70%, 44.00% -0.70%, 47.00% -0.70%, 50.00% -0.70%, 53.00% -0.70%, 56.00% -0.70%, 59.00% -0.70%, 62.00% -0.12%, 66.97% 0.36%, 71.86% 1.79%, 76.57% 4.15%, 81.04% 7.40%, 85.18% 11.48%, 88.93% 16.32%, 92.21% 21.84%, 94.98% 27.94%, 97.18% 34.52%, 98.78% 41.48%, 99.76% 48.67%, 100.08% 56.00%, 100.42% 56.00%, 98.74% 69.77%, 93.85% 82.18%, 86.23% 92.04%, 76.64% 98.37%, 66.00% 100.55%, 50.00% 100.70%, 34.00% 100.55%, 23.36% 98.37%, 13.77% 92.04%, 6.15% 82.18%, 1.26% 69.77%, -0.42% 56.00%);
          }
        }
        /* 토큰은 위로 튀지 않고 쿠션 속으로 가라앉으며 사라진다 — 흡수니까 */
        @keyframes cd-tok {
          0%, 24%   { opacity: 0; transform: translateY(-14px); }
          31%       { opacity: 1; transform: translateY(-4px); }
          39%       { opacity: 0.9; transform: translateY(4px); }
          53%, 100% { opacity: 0; transform: translateY(18px); }
        }

        /* 스테이지는 640px 고정이라 좁은 화면에서는 포물선 앞부분이 통째로 잘린다.
           쿠션(스테이지 한가운데)을 기준으로 축소해 낙하 구간을 끌어온다.
           .cd-ground도 스테이지 안에 있어 같이 축소된다 — 밖에 두면 바닥선만
           제자리에 남아 쿠션이 공중에 뜬다. */
        @media (max-width: 720px) {
          .cd-band { height: 236px; }
          .cd-stage { transform: scale(0.7); transform-origin: 50% 100%; }
        }

        @media (prefers-reduced-motion: reduce) {
          /* 쿠션의 animation을 끄면 clip-path도 같이 빠진다 — 기본 규칙에는 없고
             키프레임에만 있기 때문이다. 그래서 매끄러운 border-radius 실루엣이 남는다 */
          .cd-flight, .cd-logo, .cd-cushion {
            animation: none;
          }
          /* 첫 로고만 남겨 쿠션 위에 얹어 둔다 — 무애니메이션 기본 위치가 곧 접촉점 */
          .cd-flight ~ .cd-flight, .cd-tok { display: none; }
        }
      `}</style>
    </div>
  );
}
