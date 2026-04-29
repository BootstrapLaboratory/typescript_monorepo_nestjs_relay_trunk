import { type ComponentPropsWithoutRef } from "react";
import { cx } from "./classNames";
import { surface, type SurfaceVariants } from "./Surface.css";

type SurfaceProps = ComponentPropsWithoutRef<"div"> & SurfaceVariants;

export function Surface({
  className,
  tone,
  children,
  ...props
}: SurfaceProps) {
  return (
    <div className={cx(surface({ tone }), className)} {...props}>
      {children}
    </div>
  );
}
