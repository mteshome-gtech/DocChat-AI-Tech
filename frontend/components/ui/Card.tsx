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
        border-slate-200
        bg-white
        shadow-sm
        ${className}
      `}
    >
      {children}
    </div>
  );
}