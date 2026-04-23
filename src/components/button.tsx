"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success" | "warning";
type Size = "sm" | "md";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  loadingText?: string;
  children: ReactNode;
};

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-navy text-white hover:bg-navy-soft active:bg-navy-soft/90 disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed",
  secondary:
    "bg-surface border border-brand-border text-navy hover:bg-neutral-50 active:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed",
  ghost:
    "bg-transparent text-neutral-dark hover:bg-neutral-100 hover:text-navy active:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed",
  danger:
    "bg-danger text-white hover:bg-danger/90 active:bg-danger/80 disabled:opacity-50 disabled:cursor-not-allowed",
  success:
    "bg-success/15 text-success hover:bg-success/25 active:bg-success/35 disabled:opacity-50 disabled:cursor-not-allowed",
  warning:
    "bg-warning/15 text-warning hover:bg-warning/25 active:bg-warning/35 disabled:opacity-50 disabled:cursor-not-allowed",
};

const SIZES: Record<Size, string> = {
  sm: "px-2.5 py-1 text-xs rounded-md",
  md: "px-4 py-2 text-sm rounded-md",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    loadingText,
    disabled,
    className = "",
    children,
    ...rest
  },
  ref
) {
  const isDisabled = disabled || loading;
  return (
    <button
      ref={ref}
      disabled={isDisabled}
      className={`
        inline-flex items-center justify-center gap-2 font-medium
        transition-all duration-100 ease-out
        active:scale-[0.98]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 focus-visible:ring-offset-surface
        ${VARIANTS[variant]} ${SIZES[size]} ${className}
      `}
      {...rest}
    >
      {loading && <Spinner />}
      <span>{loading ? loadingText ?? "Working…" : children}</span>
    </button>
  );
});

/**
 * Wrap server-action forms with this button to get automatic loading state
 * via useFormStatus. Use inside <form action={serverAction}>.
 */
export function SubmitButton({
  children,
  loadingText,
  variant = "primary",
  size = "md",
  className = "",
  ...rest
}: Omit<ButtonProps, "loading" | "type">) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      loading={pending}
      loadingText={loadingText}
      className={className}
      {...rest}
    >
      {children}
    </Button>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-3.5 w-3.5"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
