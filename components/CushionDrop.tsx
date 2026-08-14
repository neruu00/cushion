/**
 * @file components/CushionDrop.tsx
 * @description 랜딩 히어로 애니메이션 — AI 로고 공이 떨어지고, 쿠션이 받아낸다.
 *
 * 은유가 곧 제품 설명이다: 떨어진 공의 운동 에너지를 쿠션이 흡수하듯,
 * 에이전트가 컨텍스트에 태울 토큰을 Cushion이 흡수한다. 그래서 되튀는 높이가
 * 낙하 높이보다 훨씬 낮고(에너지를 뺏겼다), 충돌 순간 쿠션이 눌리며 `− tok`이 스며든다.
 *
 * **순수 CSS다.** 물리 엔진은 장식 루프에 과하다 — 중력 가속은 cubic-bezier,
 * 흡수는 squash & stretch로 충분하다. 서버 컴포넌트라 클라이언트 JS 0.
 *
 * 실제 브랜드 로고 SVG를 쓰지 않는다 — 상표를 마케팅 페이지에 무단 사용하는 셈이 된다.
 * 브랜드 색 공 + 텍스트 라벨이면 즉시 읽힌다.
 *
 * 타이밍 계약: 공 주기 9s × 3개(지연 0·3·6s) → 충돌이 3s마다 온다.
 * 쿠션·`− tok`은 주기 3s로 그 위상(66%)에 맞춰 눌린다. 공의 충돌 시점(22%)을
 * 바꾸면 쿠션 위상도 같이 바꿔야 한다: 9s × 22% = 1.98s = 3s의 66%.
 */

const BALLS = [
  { label: "Claude", color: "#d97757", delay: "0s" },
  { label: "GPT", color: "#10a37f", delay: "3s" },
  { label: "Gemini", color: "#4285f4", delay: "6s" },
] as const;

export function CushionDrop() {
  return (
    <div aria-hidden className="cd-band" >
      {BALLS.map((ball) => (
        <span
          key={ball.label}
          className="cd-ball"
          style={{ background: ball.color, animationDelay: ball.delay }}
        >
          {ball.label}
        </span>
      ))}

      <span className="cd-tok">− tok</span>
      <div className="cd-cushion">cushion</div>
      <div className="cd-ground" />

      {/* 컴포넌트 전용 키프레임. 전역 CSS를 어지럽히지 않으려고 여기 둔다. */}
      <style>{`
        .cd-band {
          position: relative;
          height: 250px;
          overflow: hidden;
          pointer-events: none;
          user-select: none;
        }
        .cd-ground {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 20px;
          height: 1px;
          background: var(--border);
        }
        .cd-cushion {
          position: absolute;
          bottom: 21px;
          left: calc(18% - 53px);
          width: 150px;
          height: 48px;
          border-radius: 24px;
          border: 1px solid var(--border);
          background: var(--muted);
          color: var(--muted-foreground);
          font-family: var(--font-mono, monospace);
          font-size: 13px;
          display: flex;
          align-items: center;
          justify-content: center;
          transform-origin: bottom center;
          animation: cd-squash 3s infinite;
        }
        .cd-ball {
          position: absolute;
          bottom: 69px; /* 쿠션 윗면 = 충돌 지점(translate 0,0) */
          left: 18%;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          color: #fff;
          font-size: 10px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0; /* 자기 차례(delay) 전에는 안 보인다 */
          animation: cd-drop 9s infinite;
          will-change: transform;
        }
        .cd-tok {
          position: absolute;
          bottom: 76px;
          left: calc(18% + 40px);
          font-size: 11px;
          font-family: var(--font-mono, monospace);
          color: var(--muted-foreground);
          opacity: 0;
          animation: cd-tok 3s infinite;
        }

        @keyframes cd-drop {
          /* 낙하 — 중력 가속 */
          0%   { transform: translate(0, -230px) rotate(0deg); opacity: 0;
                 animation-timing-function: cubic-bezier(0.5, 0, 0.9, 0.6); }
          4%   { opacity: 1; }
          22%  { transform: translate(0, 0) rotate(0deg);
                 animation-timing-function: ease-out; }
          /* 충돌 — 쿠션에 박히며 짜부라진다 */
          25%  { transform: translate(2px, 7px) scale(1.28, 0.62);
                 animation-timing-function: ease-out; }
          28%  { transform: translate(14px, -4px) scale(0.94, 1.06);
                 animation-timing-function: ease-out; }
          /* 되튐 — 낙하(230px)보다 훨씬 낮다(64px). 에너지를 쿠션이 가져갔다 */
          38%  { transform: translate(96px, -64px) rotate(120deg) scale(1, 1);
                 animation-timing-function: ease-in; }
          47%  { transform: translate(180px, 48px) rotate(240deg);
                 animation-timing-function: ease-out; }
          /* 잔튐 한 번 후 굴러간다 */
          52%  { transform: translate(216px, 34px) rotate(300deg);
                 animation-timing-function: ease-in; }
          56%  { transform: translate(248px, 48px) rotate(340deg);
                 animation-timing-function: linear; }
          74%  { transform: translate(520px, 48px) rotate(700deg); opacity: 1; }
          80%  { transform: translate(610px, 48px) rotate(820deg); opacity: 0; }
          100% { transform: translate(610px, 48px) rotate(820deg); opacity: 0; }
        }

        /* 공 주기 9s의 22% = 1.98s = 이 주기(3s)의 66%. cd-drop과 맞물려 있다 */
        @keyframes cd-squash {
          0%, 60%   { transform: scale(1, 1); }
          66%       { transform: scale(1.12, 0.72); }
          74%       { transform: scale(0.97, 1.05); }
          82%, 100% { transform: scale(1, 1); }
        }
        @keyframes cd-tok {
          0%, 64%   { opacity: 0; transform: translateY(-12px); }
          70%       { opacity: 1; transform: translateY(-4px); }
          84%, 100% { opacity: 0; transform: translateY(10px); }
        }

        @media (prefers-reduced-motion: reduce) {
          .cd-ball, .cd-tok { display: none; }
          .cd-cushion { animation: none; }
        }
      `}</style>
    </div>
  );
}
