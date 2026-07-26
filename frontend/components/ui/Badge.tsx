interface BadgeProps {
 children: React.ReactNode;
}

export default function Badge({
 children
}: BadgeProps){

return (

<span
className="
inline-flex
border
border-slate-300
px-3
py-1
text-xs
font-medium
text-slate-700
"
>
{children}
</span>

)

}