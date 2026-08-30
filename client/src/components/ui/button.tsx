import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/*
 * DESIGN.md buttons: 8px radius, weight 500, 48px tall for primary CTAs.
 * `default` is the brand CTA — the single accent voltage. A dark teal fill
 * carrying a white label (`on-brand`, 6.44:1); the dark-fill/light-label
 * direction is what keeps a CTA from reading like a discount sticker. Press
 * flips to brand-active with no transform and no shadow change; disabled drops
 * to a neutral tint. `secondary` is white with a 1px ink outline; `ghost`/`link`
 * are the tertiary text treatments (underline on hover, no surface).
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm font-medium cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-brand text-on-brand active:bg-brand-active hover:bg-brand-active disabled:bg-brand-disabled disabled:text-muted-soft",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50",
        outline:
          "border border-ink bg-background text-ink hover:bg-surface-soft disabled:border-border-strong disabled:text-muted-soft",
        secondary:
          "border border-hairline bg-background text-ink hover:bg-surface-soft disabled:text-muted-soft",
        ghost: "text-ink hover:bg-surface-soft disabled:text-muted-soft",
        link: "text-ink underline-offset-4 hover:underline disabled:text-muted-soft",
        /* Pill CTA used on featured cells and the category strip. */
        pill: "rounded-full bg-brand text-on-brand hover:bg-brand-active disabled:bg-brand-disabled disabled:text-muted-soft",
        /* The circular Rausch orb terminating the search bar. */
        orb: "rounded-full bg-brand text-on-brand hover:bg-brand-active disabled:bg-brand-disabled disabled:text-muted-soft",
      },
      size: {
        default: "h-12 px-6 text-base [&_svg]:size-4",
        sm: "h-10 px-4 text-sm [&_svg]:size-4",
        xs: "h-8 px-3 text-sm [&_svg]:size-3.5",
        lg: "h-14 px-8 text-base [&_svg]:size-5",
        icon: "size-12 [&_svg]:size-5",
        "icon-sm": "size-10 [&_svg]:size-4",
        "icon-xs": "size-8 [&_svg]:size-4",
        /* DESIGN.md button-pill: 10x20 padding, 14px label. */
        pill: "h-auto px-5 py-2.5 text-sm [&_svg]:size-4",
        /* DESIGN.md search-orb: 48x48. */
        orb: "size-12 [&_svg]:size-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
