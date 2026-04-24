import { createElement, forwardRef, HTMLAttributes, ReactNode } from "react";

export type CardPadding = "none" | "sm" | "md" | "lg";
export type CardElement = "div" | "section" | "article";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: CardPadding;
  as?: CardElement;
}

const BASE_CLASSES = "bg-surface border border-border rounded-xl";

const PADDING_CLASSES: Record<CardPadding, string> = {
  none: "p-0",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

const TAG_MAP: Record<CardElement, "div" | "section" | "article"> = {
  div: "div",
  section: "section",
  article: "article",
};

const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { children, padding = "md", as = "div", className, ...rest },
  ref,
) {
  const tag = TAG_MAP[as];
  const classes =
    BASE_CLASSES +
    " " +
    PADDING_CLASSES[padding] +
    (className ? " " + className : "");

  return createElement(
    tag,
    { ref, className: classes, ...rest },
    children,
  );
});

Card.displayName = "Card";

export { Card };
export default Card;
