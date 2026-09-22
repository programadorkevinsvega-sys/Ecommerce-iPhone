import type { ReactNode } from "react";

type AdminToolbarProps = {
  children: ReactNode;
};

export default function AdminToolbar({ children }: AdminToolbarProps) {
  return <div className="admin-toolbar">{children}</div>;
}
