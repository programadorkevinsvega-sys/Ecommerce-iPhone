import type { ReactNode } from "react";

type AdminSectionHeadingProps = {
  kicker?: string;
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
};

export default function AdminSectionHeading({ kicker, title, meta, actions }: AdminSectionHeadingProps) {
  return (
    <div className="admin-section-heading">
      <div>
        {kicker ? <p className="admin-kicker">{kicker}</p> : null}
        <h2>{title}</h2>
      </div>
      {actions ?? meta ? <div className="admin-toolbar-actions">{actions ?? meta}</div> : null}
    </div>
  );
}
