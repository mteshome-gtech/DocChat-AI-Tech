import React from "react";

interface ButtonProps {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "outline";
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
}

export default function Button({
  children,
  variant = "primary",
  className = "",
  disabled = false,
  onClick,
}: ButtonProps) {

  const styles = {
    primary:
      "bg-blue-600 text-white border-blue-600 hover:bg-blue-700",

    secondary:
      "bg-slate-900 text-white border-slate-900 hover:bg-slate-800",

    outline:
      "bg-white text-slate-900 border-slate-300 hover:bg-slate-100",
  };

  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`
        h-11
        px-6
        border
        font-medium
        text-sm
        transition
        duration-200
        disabled:opacity-50
        disabled:cursor-not-allowed
        ${styles[variant]}
        ${className}
      `}
    >
      {children}
    </button>
  );
}