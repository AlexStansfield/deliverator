import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "default" | "primary" | "ghost" | "danger";
type Size = "sm" | "md" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  default: "bg-panel-2 border-line hover:border-muted text-fg",
  primary: "bg-accent text-accent-ink border-transparent hover:brightness-105",
  ghost: "bg-transparent border-transparent text-muted hover:bg-panel-2 hover:text-fg",
  danger: "bg-transparent border-transparent text-bad hover:bg-bad/10",
};
const sizes: Record<Size, string> = {
  sm: "px-2.5 py-1 text-[12.5px] gap-1.5",
  md: "px-3 py-1.5 text-[13px] gap-2",
  icon: "p-1.5",
};

/** The button look as a class string, for links that should look like buttons. */
export function buttonClass({ variant = "default", size = "md", className }: { variant?: Variant; size?: Size; className?: string } = {}) {
  return cn(
    "inline-flex items-center justify-center whitespace-nowrap rounded-lg border font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "default", size = "md", loading, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={buttonClass({ variant, size, className })}
      {...props}
    >
      {loading ? <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
      {children}
    </button>
  );
});
