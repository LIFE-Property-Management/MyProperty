import { HTMLAttributes } from "react";

type Props = HTMLAttributes<HTMLDivElement> & {
  padded?: boolean;
};

export function Card({ padded = true, className = "", ...rest }: Props) {
  return (
    <div
      className={`bg-surface border border-border rounded-lg ${padded ? "p-4 md:p-6" : ""} ${className}`}
      {...rest}
    />
  );
}
