/**
 * @file lib/i18n.en.ts
 * @description 영어 문구. **이 파일이 사전의 형태를 정한다** — `lib/i18n.ko.ts`가
 *              `Dict` 타입을 받으므로 여기에 키를 더하면 한국어 쪽이 컴파일 에러로 알린다.
 *              반대로 여기서 키를 지우면 한국어의 남은 키가 에러가 된다. 한쪽만 갱신되는
 *              사고를 타입 검사가 막는 구조다.
 *
 * **값은 전부 평문 문자열이다.** 보간은 `{name}` 자리표시자와 `fill()`이 한다.
 * 함수를 넣지 않는 이유: 클라이언트 컴포넌트에는 이 사전의 조각이 **props로** 건너가는데
 * 함수는 RSC 경계를 넘지 못한다. 서버에서만 쓰는 값이라고 함수로 두면, 나중에 그 문구를
 * 다이얼로그로 옮기는 날 런타임에서야 터진다.
 *
 * 산문이 긴 화면(랜딩·`/docs` 4쪽)은 여기 없다. 문장 중간에 `<strong>`·`<code>`·`<Link>`가
 * 섞여 있어 평문으로 접히지 않고, 언어마다 어순이 달라 조각내면 오히려 못 읽는다.
 * 그런 화면은 각 페이지 파일 아래에 두 언어를 나란히 둔다.
 */
export const en = {
  common: {
    cancel: "Cancel",
    save: "Save",
    saving: "Saving…",
    saved: "Saved",
    delete: "Delete",
    edit: "Edit",
    create: "Create",
    working: "Working…",
    none: "None",
    more: "More",
    name: "Name",
    email: "Email",
    status: "Status",
    required: "Required",
    signIn: "Sign in",
    signingIn: "Redirecting…",
    signInWithGoogle: "Continue with Google",
    signInWithGoogleBusy: "Redirecting to Google…",
    signOut: "Sign out",
  },

  nav: {
    docs: "Docs",
    admin: "Admin",
    tokens: "Tokens",
    /**
     * 전환 버튼의 라벨은 **언어 코드**다. 여기에 "한국어"를 쓰면 영어 화면에 한글이
     * 한 덩어리 생기고, 그 글리프 하나 때문에 브라우저가 2MB짜리 Pretendard를 받는다
     * (`app/layout.tsx`의 `preload: false` 주석과 한 쌍이다).
     */
    langKo: "KO",
    langEn: "EN",
    switchLanguage: "Language",
    /**
     * 메뉴 항목 이름. 여기에 "한국어"를 쓰면 영어 화면에 한글이 생기고, 그 글리프 하나
     * 때문에 2MB짜리 Pretendard가 딸려온다 (`app/layout.tsx`의 `preload: false` 참고).
     * 그래서 영어 화면에서는 언어 이름도 영어로 부른다.
     */
    korean: "Korean",
    english: "English",
  },

  meta: {
    description:
      "A library for your project docs. Agents read and write only the piece they need over MCP, and your team gets a notification when something changes.",
    docsTitleTemplate: "%s · Cushion Docs",
    docsTitleDefault: "Cushion Docs",
  },

  landing: {
    viewDocs: "Read the docs",
    dropCaption: "It cushions the tokens an agent would otherwise carry into context.",
  },

  docsNav: {
    label: "Docs contents",
    pagerLabel: "Previous and next page",
    previous: "Previous",
    next: "Next",
    overview: "Overview",
    overviewSummary: "What it is, and why",
    install: "Install",
    installSummary: "Two lines, or three steps",
    usage: "Usage",
    usageSummary: "The doc_* tools, reading and writing",
    skills: "Skills",
    skillsSummary: "Slash commands for agents",
  },

  dashboard: {
    title: "Dashboard",
    description: "Create a library and your agent can read and write its docs over MCP.",
    emptyLine1: "No libraries yet.",
    emptyLine2: "Create one, or ask a teammate for an invite.",
    andMore: "and {count} more",
  },

  library: {
    noChannel: "No notification channel",
    recentChanges: "Recent changes",
    seeAll: "See all",
    noChanges: "No changes recorded yet.",
    documents: "Documents",
    newDocument: "New document",
    noDocuments: "No documents yet.",
    noDocumentsMember:
      'No documents yet. Use "New document" above, or let your agent create one with {tool}.',
    documentCount: "{count} docs",
  },

  changes: {
    title: "Change history",
    latest: "Showing the {count} most recent.",
    total: "{count} in total.",
    empty: "No changes recorded yet.",
    noSummary: "No summary",
  },

  doc: {
    edit: "Edit",
    history: "History",
    sourceRepo: "Related GitHub repo",
    newTitle: "New document",
    editTitle: "Edit",
    changeHistory: "Change history",
    path: "Path",
    content: "Content",
    note: "What changed, and why",
    notePlaceholder: "Change the session expiry policy",
    deleteHeading: "Delete",
    deleteHelp: "The previous body stays in the history. You can restore it from there.",
    deleteTrigger: "Delete this document",
    deleteConfirmTitle: "Delete this document?",
    deleteConfirmBody: "The body stays in the history. You can restore it from there.",
    conflictTitle: "Someone else saved while you were editing",
    conflictBody:
      "Your text is untouched. Compare it with the server copy below — saving as is will overwrite the server.",
    conflictShowServer: "Show the current server copy",
    conflictTakeServer: "Replace with the server copy (discard my edits)",
  },

  history: {
    title: "Change history",
    current: "Current {when}",
    deleted: "This document was deleted. You can restore it below.",
    emptyFirst: "No history yet — nothing has changed since it was first saved.",
    emptyEnd: "Nothing older than this.",
    first: "Back to newest",
    older: "Show older",
    restoreNote: "Restoring keeps the current body in the history too.",
    restoreTrigger: "Restore this version",
    restoreConfirmTitle: "Restore this version?",
    restoreConfirmLabel: "Restore",
    backToList: "History",
    showFull: "Show this version in full ({count} lines)",
    noNote: "No note",
    restoredNote: "Restored to the version from {when}",
  },

  tokens: {
    title: "Access token",
    description:
      "This is what an agent uses to connect over MCP. Permissions follow {email}, not the token.",
    stepsTitle: "How to connect",
    stepsDescription: "Three steps. Step ① alone is enough for an agent to read and write.",
    issueHelp:
      "Once issued you get snippets for Claude Code, Antigravity and Codex CLI. Copy whichever you use. The token sits in a config file in plain text — if it leaks, issue a new one.",
    issue: "Issue",
    namePlaceholder: "Laptop",
    empty: "No tokens issued yet.",
    colIssued: "Issued",
    colLastUsed: "Last used",
    unnamed: "(unnamed)",
    revoked: "revoked {date}",
    revoke: "Revoke",
  },

  onboarding: {
    step1: "Connect",
    step1Hint: "Run it once in a shell. The doc_* tools show up from then on.",
    step2: "Install the skills",
    step2Hint: "Optional, but recommended. The basics work without them.",
    step3: "Pick which library to use",
    step3Hint: "One line in AGENTS.md, and the next session starts from it.",
    step3Body:
      "The agent looks up {remote} to find the library for this project and writes it into {file}. Skip it if a teammate already committed that line.",
    sendToAgent: "Send this to your agent as is",
  },

  skillInstall: {
    sentence:
      "Fetch {url} and save each entry in files to {root}<path>. Overwriting existing files is fine.",
    copyLabel: "Send this to your agent as is ({root})",
    everywhere: "Every project on this machine",
    thisProject: "This project only",
    claudeGlobal:
      "Putting them in {path} installs them once for {scope}. Skill files hold nothing project-specific, so this is usually the right choice.",
    claudeGlobalScope: "every project",
    claudeProject:
      "Put them in {path} and commit, and {scope} gets them automatically. You install per project, and a committed copy stays put even when the original moves on.",
    claudeProjectScope: "your whole team",
    antigravityGlobal: "Putting them in {path} makes them available in every project.",
    antigravityProject:
      "Put them in {path} at the project root and commit, and the whole team gets them. This path is the same as Codex CLI's, so one install covers both.",
    codexGlobal: "Putting them in {path} makes them available in every repository.",
    codexProject:
      "Put them in {path} at the project root and commit, and the whole team gets them. Same path as Antigravity's project scope.",
  },

  invite: {
    invalidTitle: "This link is not valid",
    invalidBody: "It was revoked, or the link is wrong. Ask the owner for a new one.",
    title: "Library invitation",
    already: "You are already a member of this library.",
    goToLibrary: "Go to the library",
    body: "Join and you can read and write this library's docs.",
    join: "Join",
  },

  members: {
    trigger: "Members {count}",
    title: "Members",
    description:
      "Members can read and write this library's docs. Only the owner can invite or remove; anyone can leave.",
    you: " (you)",
    removeLabel: "Remove {email}",
    leaveTitle: "Leave this library?",
    removeTitle: "Remove this member?",
    leave: "Leave",
    remove: "Remove",
    leaveLast: "You are the last member. If you leave, nobody can see this library.",
    leaveBody: "You will no longer see the docs. The owner can invite you again.",
    removeBody: "They can no longer read or write the docs. You can invite them again.",
    invite: "Invite",
    inviteLink: "Invite link",
    inviteLinkHelp: "Anyone with the link joins after signing in. Only one link is live at a time.",
    liveLink: "A link is live right now",
    revokeLink: "Revoke",
    regenerate: "Regenerate",
    generate: "Generate",
  },

  librarySettings: {
    trigger: "Settings",
    title: "Library settings",
    description: "Clearing a field clears that value. The slug cannot be changed here.",
    githubLabel: "GitHub repos that use this library",
    githubHint: "One per line. For a whole org, one line of acme/* is enough.",
    publicLabel: "Anyone with the link can read",
    publicHint:
      "When on, {who} can read the docs. Writing, history and the member list stay members-only. It stays out of search engines, but {anyone} can read it.",
    publicWho: "people who are not signed in",
    publicAnyone: "anyone with the link",
  },

  newLibrary: {
    trigger: "New library",
    title: "New library",
    description:
      "A slug can hold lowercase letters, numbers and hyphens. Whoever creates it becomes the first member; invite teammates from the library screen. Webhooks can wait.",
    create: "Create",
    githubLabel: "GitHub repos that use this library (optional)",
    githubHint: "One per line. For a whole org, one line of acme/* is enough.",
    mattermost: "Mattermost webhook (optional)",
    discord: "Discord webhook (optional)",
  },

  admin: {
    title: "Admin",
    description: "Manage members from each library's own screen.",
    exportAll: "Export everything",
    statLibraries: "Libraries",
    statDocuments: "Documents",
    statUsers: "Users",
    statCalls: "Requests, {days}d",
    callsHeading: "Requests",
    callsHelp:
      "MCP tool calls over the last {days} days. Dates are UTC, and {outline} called without a {library} argument is not counted.",
    logsHeading: "Request log",
    logsHelp: "The {count} most recent. Status filters and the full list are behind See all.",
    seeAll: "See all",
    logsEmpty: "No logs yet.",
    librariesHeading: "Libraries",
    librariesEmpty: "No libraries registered.",
    colName: "Name",
    colEmail: "Email",
    colStatus: "Status",
    colIssued: "Issued",
    notifyNone: "None",
    colDocuments: "Docs",
    colMembers: "Members",
    colNotify: "Notify",
    colCreated: "Created",
    usersHeading: "Users",
    usersHelp: "Everyone who has signed in at least once.",
    usersEmpty: "Nobody yet.",
    colLibraries: "Libraries",
    colLiveTokens: "Live tokens",
    colTokenLastUsed: "Token last used",
    logsTitle: "Request log",
    logsDescription: "Every MCP request. A 5xx is a bug, and error text is never truncated.",
    filterLabel: "Status filter",
    logsEnd: "This is the end.",
    logsNoMatch: "No logs match this filter.",
    logsOlder: "Show {count} older",
    userDescription:
      "Belongs to {libraries} libraries, and has issued {tokens} tokens including revoked ones.",
    memberOf: "Libraries",
    memberOfEmpty: "Not a member of anything.",
    colJoined: "Joined",
    tokensHeading: "Tokens",
    tokensEmpty: "No tokens issued.",
    colLastUsedShort: "Last used",
    tokenRevoked: "Revoked",
    tokenLive: "Live",
    recentRequests: "Recent requests (latest {count})",
    allLogs: "All logs",
    noRequests: "No MCP requests recorded.",
  },

  logs: {
    colTime: "Time",
    colStatus: "Status",
    colRequest: "Request",
    colLibrary: "Library",
    colActor: "Who",
    colError: "Error",
    filterAll: "All",
    filterOk: "OK",
  },

  diff: {
    tooLarge: "The change was too large to diff. See the full text below.",
    noChange: "No content changes.",
    preamble: "(preamble)",
  },

  form: {
    onlyOnce: "Shown only once",
    onlyOnceBody:
      "Only a hash is stored on the server. Once you leave this screen you cannot see it again — you can only issue a new one.",
    copy: "Copy",
    copied: "Copied",
    copyFailed: "Selected — press Ctrl+C",
    diagramFailed: "Could not render the diagram",
    toolsRequired:
      "{marker} marks a required argument. This table is generated from the server's {endpoint} response.",
  },

  export: {
    empty: "There are no documents you can reach.",
  },

  errors: {
    signInRequired: "You need to sign in.",
    badRequest: "That request was not valid.",
    tooLongName: "That name is too long.",
    tokenFailed: "Could not issue the token. Try again in a moment.",
    memberDuplicate: "That person is already a member.",
    memberFailed: "Could not add them. Try again in a moment.",
    ownerOnlyInvite: "Only the owner of this library can invite people.",
    ownerOnlySettings: "Only the owner of this library can change its settings.",
    ownerOnlyLink: "Only the owner of this library can create an invite link.",
    settingsFailed: "Could not save. Try again in a moment.",
    inviteFailed: "Could not create the invite link. Try again in a moment.",

    // 스키마 메시지. `*.schema.ts`가 이 키를 그대로 message로 쓰고 경계에서 번역한다
    path_format: "A path cannot start with / or contain ...",
    path_extension: "A path has to end in .md.",
    path_required: "Enter a path.",
    path_too_long: "That path is too long.",
    content_too_large: "That document is too large to store.",
    note_too_long: "That note is too long.",
    heading_too_long: "That heading is too long.",
    library_required: "Pick a library.",
    webhook_url: "A webhook has to be a URL starting with https://.",
    github_repo_format: "A GitHub repo looks like org/repo or org/*.",
    github_repo_max: "You can register up to 50 GitHub repos.",
    slug_format: "A slug can only hold lowercase letters, numbers and hyphens.",
    name_required: "Enter a name.",
    name_too_long: "That name is too long.",
    email_format: "That is not a valid email address.",

    // 쓰기 경로의 실패 사유. `lib/document.ts`가 reason으로 돌려주고 여기서 문장이 된다
    library_not_found: "No such library: {name}",
    document_not_found: "No such document: {path}",
    deleted_meanwhile: "The document was deleted in the meantime.",
    changed_meanwhile:
      "The document changed in the meantime. Read it again and save with the new sha.",
    needs_base_sha:
      "That document already exists. To overwrite it, send the base_sha you got from reading it.",
    section_needs_document:
      "You can only edit a section of an existing document. For a new one, send the whole body without a heading.",
    section_not_found: "No such section: {heading}. Check the headings first.",
    save_failed: "Could not save.",
    delete_failed: "Could not delete.",
    duplicate_slug: "That slug is already taken.",
    library_failed: "Could not create the library.",
  },

  hints: {
    libraryCreated:
      "Created the library {slug}. Manage its docs at /libraries/{slug}, and see how to connect an agent at /settings/tokens.",
    settingsSaved:
      "Settings saved. {repos} GitHub repos, notifications {channels}, visibility {visibility}.",
    visibilityPublic: "anyone with the link can read",
    visibilityMembers: "members only",
    tokenIssued:
      "You cannot see this value again. Usually you only need to copy the tab for the client you actually use.",
    inviteCreated:
      "You cannot see this link again. Anyone with it joins after signing in, so send it only to the people who need it.",
  },

  snippets: {
    mcpJsonName:
      ".mcp.json (only when rolling out to a whole team — for yourself the /settings/tokens walkthrough is enough)",
    agentsName: "Append to AGENTS.md (the one line that makes an agent find Cushion)",
    shellOnce: "Run once in a shell",
    geminiConfig: "Add to ~/.gemini/config/mcp_config.json",
    codexProfile:
      "First add it to your shell profile (.zshrc and friends) — never put the token in config.toml",
    codexConfig: "Add to ~/.codex/config.toml",
    agentsHeading: "Docs",
    agentsBody:
      "This project's docs (spec, ADRs, runbooks, meeting notes) live in the `{slug}` library on Cushion, not in this repo.\nRead and write them with the `doc_*` tools on the `cushion` MCP server. The `cushion` skill explains how.",
  },
} as const;

/** 사전의 형태. `lib/i18n.ko.ts`가 이걸 받아 키 누락을 컴파일 타임에 잡는다 */
export type Dict = {
  [Area in keyof typeof en]: { [Key in keyof (typeof en)[Area]]: string };
};
