/**
 * @file scripts/cushion-clip.mjs
 * @description components/CushionDrop.tsx의 `@keyframes cd-press`를 생성한다.
 *
 * 쿠션 실루엣을 polygon()으로 샘플링하고 윗변에 매끄러운 함몰 프로파일을 더한다.
 * 좌표 46개 × 키프레임 5벌이라 손으로 쓰면 반드시 틀린다.
 *
 *   node scripts/cushion-clip.mjs
 *
 * 출력을 CushionDrop.tsx의 cd-press 블록에 통째로 갈아 끼운다. 쿠션 크기나
 * border-radius를 바꾸면 아래 상수를 맞춘 뒤 반드시 다시 돌린다 — 안 그러면
 * 정지 상태에서 clip-path가 쿠션을 잘라 먹는다.
 */

const W = 220, H = 86;
// border-radius: 38% 38% 34% 34% / 56% 56% 44% 44%
const RXT = 0.38 * W, RYT = 0.56 * H; // 위 모서리
const RXB = 0.34 * W, RYB = 0.44 * H; // 아래 모서리

// 다각형 샘플링은 곡선을 현으로 근사하므로 각짐이 남는다. 정지 상태에서 그게
// 보이면 안 되니 polygon을 border-radius 곡선 **바깥으로** 부풀린다(1/cos(반각)).
// 실제 가장자리는 두 도형의 교집합이라, 쉴 때는 매끄러운 border-radius가 그대로 보인다.
const PAD = 0.6; // 직선 구간(윗변·아랫변)을 밖으로 미는 양(px)

const pt = (x, y) => ({ x, y });
const arc = (cx, cy, rx, ry, a0, a1, steps) => {
  const inflate = 1 / Math.cos((((a1 - a0) / steps / 2) * Math.PI) / 180);
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const a = ((a0 + ((a1 - a0) * i) / steps) * Math.PI) / 180;
    out.push(pt(cx + rx * inflate * Math.cos(a), cy + ry * inflate * Math.sin(a)));
  }
  return out;
};

// 윗변은 촘촘히(함몰 곡선이 여기 얹힌다), 아랫변은 성기게(움직이지 않는다).
const FLAT = 7;
const flatTop = [];
for (let i = 1; i <= FLAT; i++) {
  flatTop.push(pt(RXT + ((W - 2 * RXT) * i) / (FLAT + 1), -PAD));
}

// 시계방향: 왼쪽 중간 → 위 → 오른쪽 → 아래 → 제자리
const outline = [
  ...arc(RXT, RYT, RXT, RYT, 180, 270, 12), // 좌상
  ...flatTop,
  ...arc(W - RXT, RYT, RXT, RYT, 270, 360, 12), // 우상
  ...arc(W - RXB, H - RYB, RXB, RYB, 0, 90, 5), // 우하
  pt(W / 2, H + PAD),
  ...arc(RXB, H - RYB, RXB, RYB, 90, 180, 5), // 좌하
];

// 호 끝점끼리 거의 겹친다 — 부풀림 비율이 달라 완전히 같지는 않다
const pts = outline.filter(
  (p, i) => i === 0 || Math.hypot(p.x - outline[i - 1].x, p.y - outline[i - 1].y) > 0.5,
);

/**
 * 함몰 프로파일. cos²는 |x|=SPAN에서 값도 기울기도 0이 된다 —
 * 즉 원래 윗변과 **접한다**. 꼭짓점이 생길 수 없는 이유가 이거다.
 */
const SPAN = 82;
const dip = (x, depth) => {
  const dx = Math.abs(x - W / 2);
  if (dx >= SPAN || depth === 0) return 0;
  return depth * Math.cos((Math.PI * dx) / (2 * SPAN)) ** 2;
};

const poly = (depth) =>
  pts
    .map((p) => {
      // 윗변만 내린다. 아래 절반은 함몰과 무관하다
      const y = p.y < H / 2 ? p.y + dip(p.x, depth) : p.y;
      return `${((p.x / W) * 100).toFixed(2)}% ${((y / H) * 100).toFixed(2)}%`;
    })
    .join(", ");

const FRAMES = [
  ["0%, 21%", 0, "cubic-bezier(0.2, 0.8, 0.3, 1)"],
  ["28%", 22, "cubic-bezier(0.3, 0, 0.4, 1)"],
  ["35%", 8, "ease-in-out"],
  ["42%", 2, "cubic-bezier(0.3, 0, 0.3, 1)"],
  ["49%, 100%", 0, null],
];

console.log(`        /* ${pts.length}점. scripts로 생성한 좌표다 — 손으로 고치지 말 것 */`);
console.log("        @keyframes cd-press {");
for (const [at, depth, tf] of FRAMES) {
  console.log(`          ${at} {`);
  console.log(`            clip-path: polygon(${poly(depth)});`);
  if (tf) console.log(`            animation-timing-function: ${tf};`);
  console.log("          }");
}
console.log("        }");
