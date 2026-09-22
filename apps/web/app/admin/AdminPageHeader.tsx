import type { ReactNode } from "react";

type AdminPageHeaderProps = {
  kicker: string;
  title: string;
  description?: string | undefined;
  actions?: ReactNode | undefined;
};

export default function AdminPageHeader({ kicker, title, description, actions }: AdminPageHeaderProps) {
  return (
    <header className="admin-topbar">
      <div>
        <p className="admin-kicker">{kicker}</p>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="admin-toolbar-actions">{actions}</div> : null}
    </header>
  );
}
