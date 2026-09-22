type AdminEmptyStateProps = {
  title: string;
  description?: string | undefined;
  icon?: string | undefined;
};

export default function AdminEmptyState({ title, description, icon }: AdminEmptyStateProps) {
  return (
    <div className="admin-empty">
      {icon ? <span>{icon}</span> : null}
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
    </div>
  );
}
