import * as React from "react";
import { cn } from "@/lib/utils";

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "info" | "success" | "warning" | "error";
  title?: string;
}

export function Alert({
  className,
  variant = "info",
  title,
  children,
  ...props
}: AlertProps) {
  const variantStyles = {
    info: "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950 dark:border-blue-900 dark:text-blue-200",
    success: "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950 dark:border-emerald-900 dark:text-emerald-200",
    warning: "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950 dark:border-amber-900 dark:text-amber-200",
    error: "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950 dark:border-rose-900 dark:text-rose-200",
  };

  return (
    <div
      role="alert"
      className={cn(
        "rounded-md border p-4 text-sm",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {title && <h5 className="mb-1 font-semibold leading-none tracking-tight">{title}</h5>}
      <div className="text-sm opacity-90">{children}</div>
    </div>
  );
}
