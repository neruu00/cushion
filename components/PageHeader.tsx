/**
 * @file components/PageHeader.tsx
 * @description 페이지 머리. 제목 크기·간격·액션 자리를 화면마다 다시 정하지 않게 한다.
 *
 * 슬롯 넷: breadcrumb(제목 위 작은 경로) · title · description · action(우측).
 * 문서 보기 화면(`[...path]`)만 이걸 안 쓴다 — 제목이 마크다운 본문에 있어서
 * 머리가 메타 링크 줄뿐이고, 그건 이 모양이 아니다.
 */
interface PageHeaderProps {
  breadcrumb?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}

export function PageHeader({ breadcrumb, title, description, action }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1">
        {breadcrumb ? <p className="text-xs text-muted-foreground">{breadcrumb}</p> : null}
        <h1 className="text-xl font-semibold">{title}</h1>
        {description ? (
          // p가 아니라 div — description에 링크·목록 같은 블록이 들어올 수 있다
          <div className="text-sm text-muted-foreground">{description}</div>
        ) : null}
      </div>
      {action}
    </header>
  );
}
