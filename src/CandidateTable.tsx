import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { Candidate } from "../lib/model";

export function CandidateTable({
  data,
  compact = false,
  onSelect,
  empty,
  filterKey = "",
}: {
  data: Candidate[];
  compact?: boolean;
  onSelect: (candidate: Candidate) => void;
  empty: ReactNode;
  filterKey?: string;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const columns = useMemo<ColumnDef<Candidate>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Candidate",
        cell: ({ row }) => {
          const candidate = row.original;
          const initials = candidate.name
            .split(" ")
            .map((part) => part[0])
            .slice(0, 2)
            .join("");
          const color =
            [...candidate.name].reduce(
              (value, char) => value + char.charCodeAt(0),
              0,
            ) % 5;
          return (
            <div className="person">
              <span className={`avatar color${color}`}>{initials}</span>
              <div>
                <strong>{candidate.name}</strong>
                <small>{candidate.email}</small>
              </div>
            </div>
          );
        },
      },
      { accessorKey: "role", header: "Position" },
      {
        accessorKey: "stage",
        header: "Stage",
        cell: ({ getValue }) => (
          <span className={`badge ${getValue<string>()}`}>
            {getValue<string>()}
          </span>
        ),
      },
      compact
        ? { accessorKey: "source", header: "Source" }
        : {
            accessorKey: "experience",
            header: "Experience",
            cell: ({ getValue }) =>
              `${getValue<number>()} ${getValue<number>() === 1 ? "year" : "years"}`,
          },
      {
        accessorKey: "createdAt",
        header: "Applied",
        cell: ({ getValue }) => (
          <span className="muted">
            {new Date(getValue<string>()).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        ),
      },
      {
        id: "details",
        header: "",
        enableSorting: false,
        cell: () => <ChevronRight size={16} aria-hidden="true" />,
      },
    ],
    [compact],
  );
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
    getRowId: (candidate) => candidate.id,
    enableSorting: !compact,
    autoResetPageIndex: false,
  });
  const { pageIndex, pageSize } = table.getState().pagination;
  useEffect(() => {
    table.setPageIndex(0);
  }, [filterKey, sorting]);
  useEffect(() => {
    const lastPage = Math.max(0, Math.ceil(data.length / pageSize) - 1);
    if (pageIndex > lastPage) table.setPageIndex(lastPage);
  }, [data.length, pageIndex, pageSize]);
  return (
    <>
      <div className="table-scroll">
        <table>
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <th
                    key={header.id}
                    aria-label={header.id === "details" ? "Details" : undefined}
                    aria-sort={
                      header.column.getIsSorted() === "asc"
                        ? "ascending"
                        : header.column.getIsSorted() === "desc"
                          ? "descending"
                          : undefined
                    }
                  >
                    {header.column.getCanSort() ? (
                      <button
                        className="sort-button"
                        onClick={header.column.getToggleSortingHandler()}
                        aria-label={`Sort by ${header.column.columnDef.header}`}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        {header.column.getIsSorted() === "asc" ? (
                          <ArrowUp size={13} />
                        ) : header.column.getIsSorted() === "desc" ? (
                          <ArrowDown size={13} />
                        ) : (
                          <ArrowUpDown size={13} />
                        )}
                      </button>
                    ) : (
                      flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                tabIndex={0}
                onClick={() => onSelect(row.original)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(row.original);
                  }
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!data.length && empty}
      </div>
      {!compact && data.length > 0 && (
        <div className="table-pagination">
          <span>
            {pageIndex * pageSize + 1}–
            {Math.min((pageIndex + 1) * pageSize, data.length)} of {data.length}{" "}
            candidates
          </span>
          <div>
            <label>
              Rows per page{" "}
              <select
                aria-label="Rows per page"
                value={pageSize}
                onChange={(event) =>
                  table.setPageSize(Number(event.target.value))
                }
              >
                {[10, 25, 50].map((size) => (
                  <option key={size}>{size}</option>
                ))}
              </select>
            </label>
            <button
              aria-label="Previous page"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              <ChevronLeft size={16} />
            </button>
            <span>
              Page {pageIndex + 1} of {table.getPageCount()}
            </span>
            <button
              aria-label="Next page"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
