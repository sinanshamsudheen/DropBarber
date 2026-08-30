import * as React from "react";

import { cn } from "@/lib/utils";

/*
 * DESIGN.md text-input: white surface, 1px hairline outline, 8px radius, 56px
 * height. On focus the border thickens to 2px ink — no glow, no ring.
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-14 w-full rounded-sm border border-hairline bg-background px-3 py-3.5 text-base text-ink transition-[border-color,box-shadow] outline-none",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-ink",
          "placeholder:text-muted-foreground",
          "focus-visible:border-ink focus-visible:shadow-[inset_0_0_0_1px_var(--color-ink)]",
          "disabled:cursor-not-allowed disabled:border-border-strong disabled:bg-surface-soft disabled:text-muted-soft",
          "aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:shadow-[inset_0_0_0_1px_var(--color-destructive)]",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
