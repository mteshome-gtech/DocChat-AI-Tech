import React from "react";

interface ButtonProps {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "outline";
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
}

export default function Button({
  children,
  variant = "primary",
  className = "",
  disabled = false,
  onClick,
  type = "button",
}: ButtonProps) {
  const styles = {
    primary: `
      bg-[#1d1d1b]
      text-white
      border-[#1d1d1b]
      hover:bg-[#333330]
    `,

    secondary: `
      bg-[#f7f6f3]
      text-[#222220]
      border-[#deddd7]
      hover:bg-[#eeede9]
    `,

    outline: `
      bg-white
      text-[#333330]
      border-[#d8d7d1]
      hover:bg-[#f6f5f2]
    `,
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`
        h-11
        px-6
        border
        text-sm
        font-medium
        tracking-[-0.01em]
        transition-all
        duration-200
        disabled:opacity-40
        disabled:cursor-not-allowed
        ${styles[variant]}
        ${className}
      `}
    >
      {children}
    </button>
  );
}