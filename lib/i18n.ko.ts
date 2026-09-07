/**
 * @file lib/i18n.ko.ts
 * @description 한국어 문구. 키의 목록과 형태는 `lib/i18n.en.ts`가 정한다 —
 *              `Dict`를 받으므로 키가 하나라도 빠지거나 남으면 `pnpm typecheck`가 잡는다.
 *
 * 기존 화면의 문장을 그대로 옮겼다. 번역체로 다시 쓰지 않는다 — 이 서비스의 원래 말투가
 * 여기 있고, 영어 쪽이 그걸 따라간 것이지 반대가 아니다.
 */
import type { Dict } from "@/lib/i18n.en";

export const ko: Dict = {
  common: {
    cancel: "취소",
    save: "저장",
    saving: "저장 중…",
    saved: "저장했어요",
    delete: "삭제",
    edit: "편집",
    create: "만들기",
    working: "처리 중…",
    none: "없음",
    more: "더보기",
    name: "이름",
    email: "이메일",
    status: "상태",
    required: "필수",
    signIn: "로그인",
    signingIn: "이동 중…",
    signInWithGoogle: "Google로 시작하기",
    signInWithGoogleBusy: "Google로 이동 중…",
    signOut: "로그아웃",
  },

  nav: {
    docs: "문서",
    admin: "관리",
    tokens: "토큰",
    langKo: "KO",
    langEn: "EN",
    switchLanguage: "언어",
    korean: "한국어",
    english: "English",
  },

  meta: {
    description:
      "프로젝트 문서를 한곳에 모아 두는 도서관이에요. 에이전트는 MCP로 필요한 조각만 읽고 쓰고, 팀에는 변경 알림이 전달돼요.",
    docsTitleTemplate: "%s · Cushion 문서",
    docsTitleDefault: "Cushion 문서",
  },

  landing: {
    viewDocs: "문서 보기",
    dropCaption: "에이전트가 컨텍스트에 실어야 하는 토큰을 쿠션처럼 받아 내요.",
  },

  docsNav: {
    label: "문서 목차",
    pagerLabel: "이전·다음 문서",
    previous: "이전",
    next: "다음",
    overview: "개요",
    overviewSummary: "무엇을, 왜",
    install: "설치",
    installSummary: "플러그인 두 줄, 또는 세 단계",
    usage: "사용법",
    usageSummary: "doc_* 툴과 읽기·쓰기",
    skills: "스킬",
    skillsSummary: "에이전트 슬래시 명령",
  },

  dashboard: {
    title: "대시보드",
    description: "라이브러리를 만들면 에이전트가 MCP로 그 문서를 읽고 써요.",
    emptyLine1: "아직 라이브러리가 없어요.",
    emptyLine2: "새로 만들거나 팀원에게 초대를 요청하세요.",
    andMore: "외 {count}",
  },

  library: {
    noChannel: "알림 채널 없음",
    recentChanges: "최근 변경",
    seeAll: "더보기",
    noChanges: "아직 변경 기록이 없어요.",
    documents: "문서",
    newDocument: "새 문서",
    noDocuments: "아직 문서가 없어요.",
    noDocumentsMember:
      '아직 문서가 없어요. 위에 있는 "새 문서"로 직접 만들거나, 에이전트가 {tool}으로 만들 수 있어요.',
    documentCount: "문서 {count}",
  },

  changes: {
    title: "변경 내역",
    latest: "가장 최근 {count}건을 보여 줘요.",
    total: "모두 {count}건이에요.",
    empty: "아직 변경 기록이 없어요.",
    noSummary: "요약 없음",
  },

  doc: {
    edit: "편집",
    history: "이력",
    sourceRepo: "관련 GitHub 레포",
    newTitle: "새 문서",
    editTitle: "편집",
    changeHistory: "변경 이력",
    path: "경로",
    content: "내용",
    note: "무엇을 왜 바꿨나",
    notePlaceholder: "세션 만료 정책 변경",
    deleteHeading: "삭제",
    deleteHelp: "이전 본문은 이력에 남아요. 이력 화면에서 되돌릴 수 있어요.",
    deleteTrigger: "이 문서 삭제",
    deleteConfirmTitle: "이 문서를 삭제할까요?",
    deleteConfirmBody: "본문은 이력에 남아요. 이력 화면에서 되돌릴 수 있어요.",
    conflictTitle: "편집하는 사이에 다른 사람이 저장했어요",
    conflictBody:
      "쓰던 내용은 그대로 뒀어요. 아래 서버 본문과 비교해 보세요. 이대로 저장하면 서버 내용을 덮어써요.",
    conflictShowServer: "서버의 현재 내용 보기",
    conflictTakeServer: "서버 내용으로 바꾸기 (내가 쓴 내용은 버리기)",
  },

  history: {
    title: "변경 이력",
    current: "현재 {when}",
    deleted: "이 문서는 삭제됐어요. 아래에서 되돌릴 수 있어요.",
    emptyFirst: "아직 이력이 없어요. 처음 저장된 뒤로 바뀌지 않았어요.",
    emptyEnd: "이 뒤로는 더 남은 기록이 없어요.",
    first: "처음으로",
    older: "이전 기록 더보기",
    restoreNote: "되돌려도 지금 내용은 이력에 남아요.",
    restoreTrigger: "이 버전으로 되돌리기",
    restoreConfirmTitle: "이 버전으로 되돌릴까요?",
    restoreConfirmLabel: "되돌리기",
    backToList: "이력 목록",
    showFull: "이 버전의 전문 보기 ({count}줄)",
    noNote: "메모 없음",
    restoredNote: "{when} 버전으로 되돌렸어요",
  },

  tokens: {
    title: "access token",
    description:
      "에이전트가 MCP로 연결할 때 쓰는 값이에요. 권한은 토큰이 아니라 {email} 계정을 따라가요.",
    stepsTitle: "연결하는 순서",
    stepsDescription: "모두 세 단계예요. ①만 마쳐도 에이전트가 문서를 읽고 써요.",
    issueHelp:
      "발급하면 Claude Code · Antigravity · Codex CLI용 스니펫이 나와요. 쓰는 것만 골라 붙여 넣으세요. 토큰은 설정 파일에 평문으로 남으니 유출되면 재발급하세요.",
    issue: "발급",
    namePlaceholder: "노트북",
    empty: "아직 발급한 토큰이 없어요.",
    colIssued: "발급",
    colLastUsed: "마지막 사용",
    unnamed: "(이름 없음)",
    revoked: "{date} 폐기",
    revoke: "폐기",
  },

  onboarding: {
    step1: "연결하기",
    step1Hint: "셸에서 한 번만 실행하면 이때부터 doc_* 툴이 보여요",
    step2: "스킬 설치하기",
    step2Hint: "선택이지만 설치하기를 권해요. 없어도 기본 동작은 해요",
    step3: "어느 라이브러리를 볼지 정하기",
    step3Hint: "AGENTS.md에 한 줄을 적어 두면 다음 세션이 그 줄을 보고 시작해요",
    step3Body:
      "에이전트가 {remote}로 이 프로젝트에 맞는 라이브러리를 찾아 {file}에 적어 둬요. 팀원이 이미 커밋해 뒀다면 건너뛰어도 돼요.",
    sendToAgent: "에이전트에게 그대로 보내세요",
  },

  skillInstall: {
    sentence:
      "{url} 를 받아서 files의 각 항목을 {root}<path> 경로에 저장해 줘. 이미 파일이 있으면 덮어써도 괜찮아.",
    copyLabel: "에이전트에게 그대로 보내세요 ({root})",
    everywhere: "내 컴퓨터 전체",
    thisProject: "이 프로젝트만",
    claudeGlobal:
      "{path}에 두면 한 번만 설치해도 {scope}에서 쓸 수 있어요. 스킬 파일에는 프로젝트별 정보가 없어서 보통 이쪽이 맞아요.",
    claudeGlobalScope: "모든 프로젝트",
    claudeProject:
      "{path}에 두고 커밋하면 {scope}이 자동으로 받아요. 대신 프로젝트마다 따로 설치해야 하고, 원본이 갱신돼도 커밋해 둔 사본은 그대로 남아요.",
    claudeProjectScope: "팀 전원",
    antigravityGlobal: "{path}에 두면 모든 프로젝트에서 쓸 수 있어요.",
    antigravityProject:
      "프로젝트 루트의 {path}에 두고 커밋하면 팀 전원이 받아요. 이 경로는 Codex CLI와 같아서, 두 클라이언트를 함께 쓴다면 한 번만 설치해도 돼요.",
    codexGlobal: "{path}에 두면 모든 저장소에서 쓸 수 있어요.",
    codexProject:
      "프로젝트 루트의 {path}에 두고 커밋하면 팀 전원이 받아요. Antigravity의 프로젝트 스코프와 경로가 같아요.",
  },

  invite: {
    invalidTitle: "유효하지 않은 링크예요",
    invalidBody: "이미 무효화됐거나 잘못된 링크예요. 소유자에게 새 링크를 요청하세요.",
    title: "라이브러리 초대",
    already: "이미 이 라이브러리의 멤버예요.",
    goToLibrary: "라이브러리로 이동",
    body: "참여하면 이 라이브러리의 문서를 읽고 쓸 수 있어요.",
    join: "참여하기",
  },

  members: {
    trigger: "멤버 {count}",
    title: "멤버",
    description:
      "멤버는 이 라이브러리의 문서를 읽고 쓸 수 있어요. 초대와 제거는 소유자만 하고, 나가기는 누구나 할 수 있어요.",
    you: " (나)",
    removeLabel: "{email} 제거",
    leaveTitle: "이 라이브러리에서 나갈까요?",
    removeTitle: "멤버를 제거할까요?",
    leave: "나가기",
    remove: "제거",
    leaveLast: "마지막 멤버예요. 나가면 아무도 이 라이브러리를 볼 수 없어요.",
    leaveBody: "나가면 문서를 더는 볼 수 없어요. 소유자가 다시 초대할 수 있어요.",
    removeBody: "문서를 더는 읽고 쓸 수 없어요. 다시 초대할 수 있어요.",
    invite: "초대",
    inviteLink: "초대 링크",
    inviteLinkHelp: "링크를 가진 사람은 로그인만 하면 참여해요. 살아 있는 링크는 한 번에 하나예요.",
    liveLink: "지금 살아 있는 링크가 있어요",
    revokeLink: "무효화",
    regenerate: "재생성",
    generate: "생성",
  },

  librarySettings: {
    trigger: "설정",
    title: "라이브러리 설정",
    description: "칸을 비우면 그 값이 지워져요. slug는 여기서 바꿀 수 없어요.",
    githubLabel: "이 라이브러리를 보는 GitHub 레포",
    githubHint: "한 줄에 하나씩 적어 주세요. 조직 전체를 지정하려면 acme/* 한 줄이면 돼요",
    publicLabel: "링크가 있으면 누구나 읽기",
    publicHint:
      "켜면 {who} 문서를 읽어요. 쓰기와 이력, 멤버 목록은 그대로 멤버에게만 보여요. 검색엔진에 올라가지는 않지만 {anyone} 볼 수 있어요.",
    publicWho: "로그인하지 않은 사람도",
    publicAnyone: "링크를 받은 사람은 누구나",
  },

  newLibrary: {
    trigger: "새 라이브러리",
    title: "새 라이브러리",
    description:
      "slug에는 소문자와 숫자, 하이픈만 쓸 수 있어요. 만든 사람이 첫 멤버가 되고, 다른 팀원을 추가하려면 라이브러리 화면에서 초대하면 돼요. 웹훅은 나중에 채워도 돼요.",
    create: "만들기",
    githubLabel: "이 라이브러리를 보는 GitHub 레포 (선택)",
    githubHint: "한 줄에 하나씩 적어 주세요. 조직 전체를 지정하려면 acme/* 한 줄이면 돼요",
    mattermost: "Mattermost webhook (선택)",
    discord: "Discord webhook (선택)",
  },

  admin: {
    title: "관리",
    description: "멤버 관리는 각 라이브러리 화면에서 해요.",
    exportAll: "전체 내보내기",
    statLibraries: "라이브러리",
    statDocuments: "문서",
    statUsers: "사용자",
    statCalls: "{days}일 요청",
    callsHeading: "요청 수",
    callsHelp:
      "최근 {days}일 동안의 MCP 툴 호출 횟수예요. 날짜는 UTC 기준이고, {library} 인자 없이 부른 {outline}은 빠져요.",
    logsHeading: "요청 로그",
    logsHelp: "가장 최근 {count}건이에요. 상태 필터와 전체 목록은 전체 보기에 있어요.",
    seeAll: "전체 보기 →",
    logsEmpty: "아직 로그가 없어요.",
    librariesHeading: "라이브러리",
    librariesEmpty: "등록된 라이브러리가 없어요.",
    colName: "이름",
    colEmail: "이메일",
    colStatus: "상태",
    colIssued: "발급",
    notifyNone: "없음",
    colDocuments: "문서",
    colMembers: "멤버",
    colNotify: "알림",
    colCreated: "생성",
    usersHeading: "사용자",
    usersHelp: "한 번이라도 로그인한 적이 있는 사용자예요.",
    usersEmpty: "아직 아무도 없어요.",
    colLibraries: "라이브러리",
    colLiveTokens: "유효 토큰",
    colTokenLastUsed: "토큰 최근 사용",
    logsTitle: "요청 로그",
    logsDescription: "MCP 요청 전부예요. 5xx는 곧 버그이고, 에러 원문은 자르지 않아요.",
    filterLabel: "상태 필터",
    logsEnd: "여기가 마지막이에요.",
    logsNoMatch: "이 조건에 해당하는 로그가 없어요.",
    logsOlder: "이전 {count}건 더 보기",
    userDescription:
      "라이브러리 {libraries}개에 속해 있고, 발급한 토큰은 폐기한 것까지 포함해 {tokens}개예요.",
    memberOf: "소속 라이브러리",
    memberOfEmpty: "어디에도 속해 있지 않아요.",
    colJoined: "합류",
    tokensHeading: "토큰",
    tokensEmpty: "발급한 토큰이 없어요.",
    colLastUsedShort: "최근 사용",
    tokenRevoked: "폐기",
    tokenLive: "유효",
    recentRequests: "최근 요청 (최신 {count}건)",
    allLogs: "전체 로그 →",
    noRequests: "MCP 요청 기록이 없어요.",
  },

  logs: {
    colTime: "시각",
    colStatus: "상태",
    colRequest: "요청",
    colLibrary: "라이브러리",
    colActor: "누가",
    colError: "에러",
    filterAll: "전체",
    filterOk: "성공",
  },

  diff: {
    tooLarge: "변경이 너무 커서 diff를 생략했어요. 아래 전문을 봐주세요.",
    noChange: "내용 변경이 없어요.",
    preamble: "(머리말)",
  },

  form: {
    onlyOnce: "지금 한 번만 보여요",
    onlyOnceBody:
      "서버에는 해시만 저장돼요. 이 화면을 벗어나면 다시 볼 수 없고, 재발급만 할 수 있어요.",
    copy: "복사",
    copied: "복사했어요",
    copyFailed: "선택했어요: Ctrl+C",
    diagramFailed: "다이어그램을 그리지 못했어요",
    toolsRequired: "{marker} 는 필수 인자예요. 이 표는 서버의 {endpoint} 응답에서 그대로 생성돼요.",
  },

  export: {
    empty: "접근할 수 있는 문서가 없어요.",
  },

  errors: {
    signInRequired: "로그인이 필요해요.",
    badRequest: "잘못된 요청이에요.",
    tooLongName: "이름이 너무 길어요.",
    tokenFailed: "토큰을 발급하지 못했어요. 잠시 후 다시 시도해 주세요.",
    memberDuplicate: "이미 등록된 멤버예요.",
    memberFailed: "등록하지 못했어요. 잠시 후 다시 시도해 주세요.",
    ownerOnlyInvite: "이 라이브러리의 소유자만 초대할 수 있어요.",
    ownerOnlySettings: "이 라이브러리의 소유자만 설정을 바꿀 수 있어요.",
    ownerOnlyLink: "이 라이브러리의 소유자만 초대 링크를 만들 수 있어요.",
    settingsFailed: "저장하지 못했어요. 잠시 후 다시 시도해 주세요.",
    inviteFailed: "초대 링크를 만들지 못했어요. 잠시 후 다시 시도해 주세요.",

    path_format: "경로는 / 로 시작할 수 없고 .. 를 포함할 수 없어요.",
    path_extension: "경로는 .md 로 끝나야 해요.",
    path_required: "경로를 입력해 주세요.",
    path_too_long: "경로가 너무 길어요.",
    content_too_large: "문서가 너무 커서 저장할 수 없어요.",
    note_too_long: "메모가 너무 길어요.",
    heading_too_long: "섹션 이름이 너무 길어요.",
    library_required: "라이브러리를 지정해 주세요.",
    webhook_url: "웹훅은 https:// 로 시작하는 URL이어야 해요.",
    github_repo_format: "GitHub 레포는 org/repo 또는 org/* 형태로 입력해 주세요.",
    github_repo_max: "GitHub 레포는 50개까지 등록할 수 있어요.",
    slug_format: "slug에는 소문자와 숫자, 하이픈만 쓸 수 있어요.",
    name_required: "이름을 입력해 주세요.",
    name_too_long: "이름이 너무 길어요.",
    email_format: "이메일 형식에 맞지 않아요.",

    library_not_found: "그런 라이브러리가 없어요: {name}",
    document_not_found: "그런 문서가 없어요: {path}",
    deleted_meanwhile: "그 사이 문서가 삭제됐어요.",
    changed_meanwhile: "그 사이 문서가 바뀌었어요. 다시 읽고 새 sha로 다시 쓰세요.",
    needs_base_sha: "이미 있는 문서예요. 덮어쓰려면 읽을 때 받은 base_sha를 함께 보내세요.",
    section_needs_document:
      "섹션 수정은 기존 문서에만 쓸 수 있어요. 새 문서는 heading 없이 전체를 보내세요.",
    section_not_found: "그런 섹션이 없어요: {heading}. 헤딩을 먼저 확인하세요.",
    save_failed: "저장하지 못했어요.",
    delete_failed: "삭제하지 못했어요.",
    duplicate_slug: "이미 있는 slug예요.",
    library_failed: "라이브러리를 만들지 못했어요.",
  },

  hints: {
    libraryCreated:
      "{slug} 라이브러리를 만들었어요. 문서는 /libraries/{slug} 에서 관리하고, 에이전트를 붙이는 순서는 /settings/tokens 에서 확인하세요.",
    settingsSaved:
      "설정을 저장했어요. GitHub 레포 {repos}개, 알림 {channels}, 공개 범위는 {visibility}예요.",
    visibilityPublic: "링크를 아는 누구나 읽기",
    visibilityMembers: "멤버만 읽기",
    tokenIssued:
      "이 값은 다시 볼 수 없어요. 대개는 아래에서 실제로 쓰는 클라이언트 탭만 복사하면 돼요.",
    inviteCreated:
      "이 링크는 다시 볼 수 없어요. 링크를 가진 사람은 로그인만 하면 참여할 수 있으니, 꼭 필요한 사람에게만 보내세요.",
  },

  snippets: {
    mcpJsonName:
      ".mcp.json (팀 전체에 배포할 때만 쓰세요. 개인은 /settings/tokens 온보딩으로 충분해요)",
    agentsName: "AGENTS.md 에 덧붙이세요 (에이전트가 Cushion을 찾게 만드는 유일한 줄이에요)",
    shellOnce: "셸에서 한 번 실행",
    geminiConfig: "~/.gemini/config/mcp_config.json 에 추가",
    codexProfile: "먼저 셸 프로필(.zshrc 등)에 추가 (config.toml에는 토큰을 직접 넣지 않아요)",
    codexConfig: "~/.codex/config.toml에 추가",
    agentsHeading: "문서",
    agentsBody:
      "이 프로젝트의 문서(스펙·ADR·런북·회의록 등)는 레포가 아니라 Cushion의 `{slug}` 라이브러리에 있다.\nMCP 서버 `cushion`의 `doc_*` 툴로 읽고 쓴다. 사용법은 `cushion` 스킬에 있다.",
  },
};
