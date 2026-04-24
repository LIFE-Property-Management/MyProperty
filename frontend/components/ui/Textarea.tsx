import { forwardRef, TextareaHTMLAttributes, useId } from "react";

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
  containerClassName?: string;
}

const CONTAINER_CLASSES = "flex flex-col gap-1.5 w-full";

const LABEL_CLASSES = "text-sm font-medium text-primary-text";

const HELPER_CLASSES = "text-xs text-muted-text";
const ERROR_CLASSES = "text-xs text-danger";

const TEXTAREA_BASE =
  "w-full min-h-[6rem] px-3 py-2 " +
  "rounded-md border " +
  "bg-surface " +
  "text-primary-text " +
  "placeholder:text-muted-text " +
  "focus:outline-none focus:ring-2 " +
  "focus:border-transparent " +
  "disabled:opacity-50 disabled:cursor-not-allowed " +
  "resize-y " +
  "transition-colors duration-150";

const TEXTAREA_NEUTRAL = "border-border focus:ring-primary";

const TEXTAREA_ERROR = "border-danger focus:ring-danger";

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    {
      label,
      helperText,
      error,
      containerClassName,
      id: idProp,
      className,
      ...rest
    },
    ref,
  ) {
    const generatedId = useId();
    const textareaId = idProp ?? generatedId;
    const describedById = `${textareaId}-description`;

    const hasError = Boolean(error);
    const hasDescription = hasError || Boolean(helperText);

    const wrapperClasses =
      CONTAINER_CLASSES + (containerClassName ? " " + containerClassName : "");

    const textareaClasses =
      TEXTAREA_BASE +
      " " +
      (hasError ? TEXTAREA_ERROR : TEXTAREA_NEUTRAL) +
      (className ? " " + className : "");

    return (
      <div className={wrapperClasses}>
        {label && (
          <label htmlFor={textareaId} className={LABEL_CLASSES}>
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={textareaClasses}
          aria-invalid={hasError || undefined}
          aria-describedby={hasDescription ? describedById : undefined}
          {...rest}
        />
        {hasError ? (
          <span id={describedById} className={ERROR_CLASSES}>
            {error}
          </span>
        ) : helperText ? (
          <span id={describedById} className={HELPER_CLASSES}>
            {helperText}
          </span>
        ) : null}
      </div>
    );
  },
);

Textarea.displayName = "Textarea";

export { Textarea };
export default Textarea;
