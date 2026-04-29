import { Slot } from "@radix-ui/react-slot";
import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cx } from "./classNames";
import { link, type LinkVariants } from "./Link.css";

type LinkProps = ComponentPropsWithoutRef<"a"> &
  LinkVariants & {
    asChild?: boolean;
  };

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(
  ({ asChild = false, className, tone, ...props }, ref) => {
    const Component = asChild ? Slot : "a";

    return (
      <Component
        ref={ref}
        className={cx(link({ tone }), className)}
        {...props}
      />
    );
  },
);

Link.displayName = "Link";
