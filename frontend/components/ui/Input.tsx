
import React from "react";

interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

export default function Input({
  className = "",
  ...props
}: InputProps) {
  return (
    <input
      className={`
        h-11
        w-full
        border
        border-[#dcdad4]
        bg-[#fafaf8]
        px-4
        text-sm
        text-[#222220]
        outline-none
        placeholder:text-[#999993]
        transition-all
        duration-200
        focus:border-[#aaa8a0]
        focus:bg-white
        focus:ring-2
        focus:ring-black/[0.025]
        ${className}
      `}
      {...props}
    />
  );
}

