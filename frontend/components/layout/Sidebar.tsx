import Link from "next/link";

const navigation = [
  {
    name:"Chat",
    href:"/chat"
  },
  {
    name:"Documents",
    href:"/documents"
  },
  {
    name:"Upload",
    href:"/documents/upload"
  },
  {
    name:"Translate",
    href:"/translate"
  },
];


export default function Sidebar(){

return (

<aside
className="
w-64
border-r
border-slate-200
bg-white
min-h-screen
p-6
"
>

<div
className="
text-xs
uppercase
tracking-wider
text-slate-500
mb-6
"
>
Workspace
</div>


<nav
className="
space-y-2
"
>

{
navigation.map((item)=>(
<Link
key={item.name}
href={item.href}
className="
block
px-4
py-3
text-sm
border
border-transparent
hover:border-slate-300
hover:bg-slate-50
transition
"
>

{item.name}

</Link>
))
}


</nav>


<div
className="
absolute
bottom-8
px-6
"
>

<Link
href="/settings"
className="
text-sm
text-slate-600
"
>
Settings
</Link>

</div>


</aside>

)

}