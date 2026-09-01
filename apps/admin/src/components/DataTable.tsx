import { Fragment, type ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";

// spec §3/§11.2: "TanStack Table ile server-side pagination/sorting/filtering."
// Sunucu tarafı filtre/sıralama/sayfalama zaten her ekranın kendi query
// hook'unda (bkz. PartnersPage) — bu bileşen yalnızca RENDER katmanı, tüm
// liste ekranlarında (Sipariş/Şikayet/Kullanıcı/Mezarlık) tekrar kullanılmak
// üzere Phase 4'te bir kez inşa edildi.
export function DataTable<T>({
  columns,
  data,
  emptyMessage,
  renderRowDetail,
}: {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  emptyMessage?: string;
  renderRowDetail?: (row: T) => ReactNode | null;
}) {
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-white">
      <table className="w-full text-sm">
        <thead className="bg-[var(--muted)] text-left text-xs uppercase text-[var(--muted-foreground)]">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="px-4 py-2 font-medium">
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-[var(--muted-foreground)]"
              >
                {emptyMessage ?? "Kayıt yok."}
              </td>
            </tr>
          )}
          {table.getRowModel().rows.map((row) => {
            const detail = renderRowDetail?.(row.original);
            return (
              <Fragment key={row.id}>
                <tr className="border-t border-[var(--border)]">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-2 align-top">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
                {detail && (
                  <tr className="border-t border-[var(--border)] bg-[var(--muted)]">
                    <td colSpan={columns.length} className="px-4 py-3">
                      {detail}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
