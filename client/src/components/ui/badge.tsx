import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/*
 * DESIGN.md badges are rounded pills at 11px / 600. `favorite` is the floating
 * "Guest favorite" plate that sits over a photo — white surface carrying the
 * system's single shadow tier. `tag` is the tiny uppercase "NEW" marker.
 */
const badgeVariants = cva(
  "inline-flex items-center rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-amber text-on-amber type-badge px-2.5 py-1",
        secondary: "border-transparent bg-surface-strong text-ink type-badge px-2.5 py-1",
        outline: "border-hairline bg-background text-ink type-badge px-2.5 py-1",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground type-badge px-2.5 py-1",
        favorite: "border-transparent bg-background text-ink type-badge px-2.5 py-1 shadow-float",
        tag: "border-hairline bg-background text-ink type-uppercase-tag px-1.5 py-0.5",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
