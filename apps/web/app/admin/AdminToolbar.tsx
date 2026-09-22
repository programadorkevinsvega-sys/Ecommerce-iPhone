type AdminToolbarProps = {
  children: React.ReactNode;
};

export default function AdminToolbar({ children }: AdminToolbarProps) {
  return <div className="admin-toolbar">{children}</div>;
}