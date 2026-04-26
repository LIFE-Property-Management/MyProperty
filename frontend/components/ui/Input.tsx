"use client";

// Input primitive — labeled text input with optional hint/error and optional
// left/right addons (e.g. a currency symbol). Ref is forwarded so React Hook
// Form's register() can attach directly to the DOM element. When an error is
// present it takes visual priority over hint and sets aria-invalid. An addon
// wrapper is used only when addons are actually provided, so the standalone
// input keeps the simpler single-border styling.

import { forwardRef, InputHTMLAttributes, ReactNode, useId } from "react";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
  leftAddon?: ReactNode;
  rightAddon?: ReactNode;
  containerClassName?: string;
};

const CONTAINER_CLASSES = "flex flex-col gap-1 w-full";

const LABEL_CLASSES = "text-sm font-medium text-primary-text";

const HINT_CLASSES = "text-xs text-muted-text";
const ERROR_CLASSES = "text-xs text-danger";

const STANDALONE_INPUT_BASE =
  "w-full h-10 px-3 " +
  "rounded-md border " +
  "bg-surface " +
  "text-primary-text " +
  "placeholder:text-muted-text " +
  "focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:border-transparent " +
  "disabled:opacity-50 disabled:cursor-not-allowed " +
  "transition-colors duration-150";

const STANDALONE_INPUT_NEUTRAL =
  "border-border focus-visible:ring-primary";

const STANDALONE_INPUT_ERROR =
  "border-danger focus-visible:ring-danger";

const ADDON_WRAPPER_BASE =
  "flex items-center " +
  "rounded-md border " +
  "bg-surface " +
  "focus-within:ring-2 focus-within:border-transparent " +
  "transition-colors duration-150";

const ADDON_WRAPPER_NEUTRAL =
  "border-border focus-within:ring-primary";

const ADDON_WRAPPER_ERROR =
  "border-danger focus-within:ring-danger";

const NESTED_INPUT_CLASSES =
  "flex-1 h-10 px-3 " +
  "bg-transparent border-0 " +
  "text-primary-text " +
  "placeholder:text-muted-text " +
  "focus:outline-none " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

const ADDON_BASE = "flex items-center px-3 text-muted-text";
const LEFT_ADDON_BORDER = "border-r border-border";
const RIGHT_ADDON_BORDER = "border-l border-border";

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    hint,
    error,
    leftAddon,
    rightAddon,
    containerClassName,
    id: idProp,
    className,
    ...rest
  },
  ref,
) {
  const generatedId = useId();
  const inputId = idProp ?? generatedId;
  const describedById = `${inputId}-description`;

  const hasError = Boolean(error);
  const hasAddon = Boolean(leftAddon || rightAddon);
  const hasDescription = hasError || Boolean(hint);

  const wrapperClasses =
    CONTAINER_CLASSES + (containerClassName ? " " + containerClassName : "");

  const sharedInputAria = {
    "aria-invalid": hasError || undefined,
    "aria-describedby": hasDescription ? describedById : undefined,
  };

  const inputElement = hasAddon ? (
    <div
      className={
        ADDON_WRAPPER_BASE +
        " " +
        (hasError ? ADDON_WRAPPER_ERROR : ADDON_WRAPPER_NEUTRAL)
      }
    >
      {leftAddon && (
        <span className={ADDON_BASE + " " + LEFT_ADDON_BORDER}>
          {leftAddon}
        </span>
      )}
      <input
        ref={ref}
        id={inputId}
        className={
          NESTED_INPUT_CLASSES + (className ? " " + className : "")
        }
        {...sharedInputAria}
        {...rest}
      />
      {rightAddon && (
        <span className={ADDON_BASE + " " + RIGHT_ADDON_BORDER}>
          {rightAddon}
        </span>
      )}
    </div>
  ) : (
    <input
      ref={ref}
      id={inputId}
      className={
        STANDALONE_INPUT_BASE +
        " " +
        (hasError ? STANDALONE_INPUT_ERROR : STANDALONE_INPUT_NEUTRAL) +
        (className ? " " + className : "")
      }
      {...sharedInputAria}
      {...rest}
    />
  );

  return (
    <div className={wrapperClasses}>
      {label && (
        <label htmlFor={inputId} className={LABEL_CLASSES}>
          {label}
        </label>
      )}
      {inputElement}
      {hasError ? (
        <p id={describedById} className={ERROR_CLASSES}>
          {error}
        </p>
      ) : hint ? (
        <p id={describedById} className={HINT_CLASSES}>
          {hint}
        </p>
      ) : null}
    </div>
  );
});

Input.displayName = "Input";

export { Input };
export default Input;
