import { useEffect, useId, useRef, type KeyboardEvent } from "react";

const WHEEL_ROW_HEIGHT = 44;
type WheelOption = { value: string; label: string; placeholder?: boolean };

export function WheelPicker({ label, value, options, onChange, disabled = false, summaryId, className = "" }: {
  label: string;
  value: string;
  options: WheelOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  summaryId: string;
  className?: string;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ value, options, onChange, disabled });
  latest.current = { value, options, onChange, disabled };
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const optionKey = options.map((option) => option.value).join(",");

  useEffect(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    if (ref.current) ref.current.scrollTop = selectedIndex * WHEEL_ROW_HEIGHT;
    return () => {
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, [selectedIndex, optionKey]);

  function select(index: number) {
    const current = latest.current;
    const option = current.options[Math.max(0, Math.min(index, current.options.length - 1))];
    if (current.disabled || !option) return;
    if (ref.current) ref.current.scrollTop = current.options.indexOf(option) * WHEEL_ROW_HEIGHT;
    if (option.value !== current.value) current.onChange(option.value);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    let next = selectedIndex;
    if (event.key === "ArrowDown") next += 1;
    else if (event.key === "ArrowUp") next -= 1;
    else if (event.key === "PageDown") next += 3;
    else if (event.key === "PageUp") next -= 3;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = options.length - 1;
    else return;
    event.preventDefault();
    select(next);
  }

  return (
    <div className="wheel-picker-column">
      <span id={`${id}-label`} className="wheel-picker-label">{label}</span>
      <div
        ref={ref}
        className={`wheel-picker ${className}`}
        role="listbox"
        aria-labelledby={`${id}-label`}
        aria-describedby={summaryId}
        aria-orientation="vertical"
        aria-activedescendant={`${id}-option-${selectedIndex}`}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={onKeyDown}
        onScroll={() => {
          if (timer.current !== null) clearTimeout(timer.current);
          timer.current = setTimeout(() => {
            if (ref.current) select(Math.round(ref.current.scrollTop / WHEEL_ROW_HEIGHT));
          }, 150);
        }}
      >
        {options.map((option, index) => (
          <div
            key={option.value}
            id={`${id}-option-${index}`}
            role="option"
            aria-selected={option.value === value}
            className={`wheel-picker-option ${option.placeholder ? "is-placeholder" : ""}`}
            onClick={() => {
              select(index);
              ref.current?.focus({ preventScroll: true });
            }}
          >
            {option.label}
          </div>
        ))}
      </div>
    </div>
  );
}
