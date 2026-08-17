/**
 * @file lib/datetime.ts
 * @description timestamptz → 사람이 읽는 현지 시각.
 *
 * DB는 UTC로 저장한다. 화면이 `created_at.slice(0, 19)`로 앞을 자르면 UTC가 그대로 뜬다 —
 * 한국에서 오후 4시에 저장한 게 07:21로 보인다. 그걸 고치는 게 이 파일이다.
 *
 * **`toLocaleString()`을 인자 없이 쓰지 않는다.** 서버와 브라우저의 기본 로케일·타임존이
 * 다르면 SSR 결과와 하이드레이션 결과가 갈려 화면이 깨진다. `Intl`에 로케일과 `timeZone`을
 * **둘 다 명시**하면 프로세스 TZ와 무관하게 같은 값이 나온다 — 실제로 `TZ=America/New_York`로
 * 바꿔 놓고도 결과가 같은 것을 확인했다.
 *
 * 포맷을 `Intl`의 기본형(`2026. 08. 15.`)이 아니라 손으로 조립하는 이유: 기존 화면이 전부
 * `YYYY-MM-DD`였고, 표기가 화면마다 갈리면 같은 시각인지 눈으로 대조할 수 없다.
 *
 * ⚠️ **토큰 사용량 차트에는 쓰지 않는다.** `usage_hourly`는 UTC 날짜·시각이 **키**다(D-018).
 * 표시만 현지로 바꾸면 "오늘"의 경계가 데이터와 어긋나 조용히 틀린 그래프가 된다.
 * 그 화면은 UTC 기준임을 스스로 밝히고 있다.
 *
 * 순수 함수뿐이라 `node --test`가 직접 실행한다 (D-008).
 */

/**
 * 표시용 타임존. 남이 자기 인스턴스를 띄울 수 있어야 하므로 환경변수로 연다
 * (`baseUrl()`이 배포 도메인을 박지 않는 것과 같은 이유).
 *
 * `NEXT_PUBLIC_`이 아니다 — 이 함수들은 서버 컴포넌트에서만 쓴다. 클라이언트로 내려가면
 * 값이 `undefined`가 되어 조용히 기본값으로 떨어진다.
 */
const TIME_ZONE = process.env.CUSHION_TZ || "Asia/Seoul";

/**
 * 잘못된 타임존이면 `Intl`이 RangeError를 던진다. 화면 하나 때문에 페이지 전체가 죽는
 * 것보다 UTC로 떨어지는 편이 낫다 — 대신 서버 로그에 한 번 남겨 원인을 알린다.
 */
let zoneChecked = false;
function zone(): string {
  if (!zoneChecked) {
    zoneChecked = true;
    try {
      new Intl.DateTimeFormat("ko-KR", { timeZone: TIME_ZONE });
    } catch {
      console.error(`datetime: CUSHION_TZ가 잘못됐다 ("${TIME_ZONE}") — UTC로 떨어진다`);
      return "UTC";
    }
  }
  try {
    new Intl.DateTimeFormat("ko-KR", { timeZone: TIME_ZONE });
    return TIME_ZONE;
  } catch {
    return "UTC";
  }
}

/** `Intl`이 주는 부분들을 이름으로 꺼낸다. 순서에 기대면 로케일이 바뀔 때 깨진다. */
function parts(iso: string, options: Intl.DateTimeFormatOptions): Record<string, string> {
  const found = new Intl.DateTimeFormat("ko-KR", { timeZone: zone(), ...options }).formatToParts(
    new Date(iso),
  );
  return Object.fromEntries(found.map((part) => [part.type, part.value]));
}

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
};
const TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

/** `2026-08-15`. 목록처럼 날짜만 필요한 자리에. */
export function formatDate(iso: string): string {
  const p = parts(iso, DATE_OPTIONS);
  return `${p.year}-${p.month}-${p.day}`;
}

/** `2026-08-15 16:21`. 이력처럼 몇 시에 바뀌었나가 중요한 자리에. */
export function formatDateTime(iso: string): string {
  const p = parts(iso, { ...DATE_OPTIONS, ...TIME_OPTIONS });
  // hour12:false에서 자정이 "24"로 나오는 로케일이 있다. 날짜는 이미 다음 날이므로 00이 맞다.
  const hour = p.hour === "24" ? "00" : p.hour;
  return `${p.year}-${p.month}-${p.day} ${hour}:${p.minute}`;
}
