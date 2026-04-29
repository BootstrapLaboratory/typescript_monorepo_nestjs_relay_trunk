import { Slot } from "@radix-ui/react-slot";
import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cx } from "./classNames";
import { button, type ButtonVariants } from "./Button.css";

type ButtonProps = ComponentPropsWithoutRef<"button"> &
  ButtonVariants & {
    asChild?: boolean;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { asChild = false, className, variant, size, type = "button", ...props },
    ref,
  ) => {
    const Component = asChild ? Slot : "button";

    return (
      <Component
        ref={ref}
        className={cx(button({ variant, size }), className)}
        type={asChild ? undefined : type}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
