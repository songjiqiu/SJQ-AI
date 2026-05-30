import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "icon";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const variantClassNames: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-white hover:bg-accent-strong disabled:bg-accent/55 disabled:text-white/80",
  secondary:
    "border border-border bg-surface text-foreground hover:bg-surface-muted disabled:text-muted",
  ghost: "text-muted hover:bg-surface-muted hover:text-foreground disabled:text-muted"
};

const sizeClassNames: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-sm",
  icon: "size-10 p-0"
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed",
        variantClassNames[variant],
        sizeClassNames[size],
        className
      )}
      type={type}
      {...props}
    />
  );
}
