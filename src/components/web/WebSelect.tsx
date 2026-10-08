import type { SelectHTMLAttributes } from "react";
import { Icon } from "./NoriUI";

type WebSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  variant?: "default" | "form" | "quiet";
};

export function WebSelect({
  children,
  className = "",
  variant = "default",
  ...props
}: WebSelectProps) {
  return (
    <span className={`nori-select nori-select-${variant}`}>
      <select {...props} className={`nori-select-input ${className}`}>
        {children}
      </select>
      <Icon name="chevron" size={16} />
    </span>
  );
}
