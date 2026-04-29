import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cx } from "./classNames";
import { selectField } from "./SelectField.css";

type SelectFieldProps = ComponentPropsWithoutRef<"select">;

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ className, ...props }, ref) => (
    <select ref={ref} className={cx(selectField, className)} {...props} />
  ),
);

SelectField.displayName = "SelectField";
