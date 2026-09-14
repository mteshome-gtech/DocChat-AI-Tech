import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export default function Card({
  children,
  className = "",
}: CardProps) {
  return (
    <div
      className={`
        border
        border-[#deddd7]
        bg-white
        shadow-[0_12px_40px_rgba(0,0,0,0.035)]
        ${className}
      `}
    >
      {children}
    </div>
  );
}