"use client";

type AdminLoadingStateProps = {
  label?: string;
  compact?: boolean;
};

export default function AdminLoadingState({
  label = "Cargando información…",
  compact = false,
}: AdminLoadingStateProps) {
  return (
    <div
      className={`admin-loading-state${compact ? " compact" : ""}`}
      role="status"
      aria-live="polite"
    >
      <span className="admin-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
