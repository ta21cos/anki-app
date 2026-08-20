import { useEffect, useRef } from "react";
import type { SelectionState } from "@/lib/deck-tree";
import { cn } from "@/lib/utils";

interface TriStateCheckboxProps {
  state: SelectionState;
  onChange: (next: boolean) => void;
  isDisabled?: boolean;
  label: string;
  className?: string;
}

// NOTE: indeterminate は属性ではなく DOM プロパティなので ref から設定する。
export function TriStateCheckbox({
  state,
  onChange,
  isDisabled,
  label,
  className,
}: TriStateCheckboxProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = state === "some";
  }, [state]);

  return (
    <input
      ref={inputRef}
      type="checkbox"
      aria-label={label}
      checked={state === "all"}
      disabled={isDisabled}
      onChange={(e) => onChange(e.target.checked)}
      onClick={(e) => e.stopPropagation()}
      className={cn("size-4 accent-primary", className)}
    />
  );
}
