import React from "react";

interface InputProps
extends React.InputHTMLAttributes<HTMLInputElement> {
}

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
border-slate-300
bg-white
px-4
text-sm
outline-none
focus:border-blue-600
transition
${className}
`}
{...props}
/>

);

}