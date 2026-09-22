import type { ReactNode } from "react";

type AdminTableProps = {
  headers: readonly string[];
  children: ReactNode;
  empty?: ReactNode;
};

export default function AdminTable({ headers, children, empty }: AdminTableProps) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {headers.map((header) => <th key={header}>{header}</th>)}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {empty}
    </div>
  );
}
