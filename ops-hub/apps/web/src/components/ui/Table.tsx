import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { createContext, useContext } from "react";

export interface TableProps {
  children: ReactNode;
  /** Zebra rows with `neutral-100` per Flora tables. */
  zebra?: boolean;
  className?: string;
  ariaLabel: string;
}

interface TableContextValue {
  zebra: boolean;
}

const TableContext = createContext<TableContextValue>({ zebra: false });

export function Table({
  children,
  zebra = false,
  className = "",
  ariaLabel,
}: TableProps) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        aria-label={ariaLabel}
        className={`w-full border-collapse text-body2 text-ink-800 ${className}`}
      >
        <TableContext.Provider value={{ zebra }}>
          {children}
        </TableContext.Provider>
      </table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="sticky top-0 z-10 bg-ink-100 text-start">
      {children}
    </thead>
  );
}

export function TH({
  children,
  className = "",
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={`border-b border-ink-300 px-4 py-3 text-start text-caption font-bold text-ink-600 ${className}`}
      {...rest}
    >
      {children}
    </th>
  );
}

export function TR({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const { zebra } = useContext(TableContext);
  return (
    <tr
      className={`${zebra ? "odd:bg-ink-100/60" : ""} border-b border-ink-200 transition-colors hover:bg-ink-100/80 ${className}`}
    >
      {children}
    </tr>
  );
}

export function TD({
  children,
  className = "",
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`px-4 py-3 align-middle ${className}`} {...rest}>
      {children}
    </td>
  );
}
