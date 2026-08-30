import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-24 w-full rounded-sm border border-hairline bg-background px-3 py-3.5 text-base text-ink outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ink focus-visible:shadow-[inset_0_0_0_1px_var(--color-ink)] disabled:cursor-not-allowed disabled:border-border-strong disabled:bg-surface-soft disabled:text-muted-soft",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
