import type { ReactNode } from "react";

type AdminPanelProps = {
  children: ReactNode;
  className?: string;
};

export default function AdminPanel({ children, className = "" }: AdminPanelProps) {
  return <section className={`admin-page-panel ${className}`.trim()}>{children}</section>;
}
