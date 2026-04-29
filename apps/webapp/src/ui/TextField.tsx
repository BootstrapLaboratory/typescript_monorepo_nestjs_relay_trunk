import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cx } from "./classNames";
import { textField } from "./TextField.css";

type TextFieldProps = ComponentPropsWithoutRef<"input">;

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cx(textField, className)} {...props} />
  ),
);

TextField.displayName = "TextField";
