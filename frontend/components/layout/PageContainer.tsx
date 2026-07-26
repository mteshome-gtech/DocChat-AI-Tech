import React from "react";

export default function PageContainer({
children
}:{
children:React.ReactNode
}){

return (

<main
className="
flex-1
p-8
bg-slate-50
"
>

{children}

</main>

)

}