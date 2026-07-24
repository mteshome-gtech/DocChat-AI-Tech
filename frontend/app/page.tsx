export default function Home() {
  return (
    <div className="space-y-10">

      {/* Hero */}
      <section className="
        border
        border-slate-200
        bg-white
        p-10
      ">

        <p className="
          text-sm
          uppercase
          tracking-widest
          text-blue-600
          font-medium
        ">
          AI Document Intelligence
        </p>


        <h1 className="
          mt-4
          text-5xl
          font-semibold
          tracking-tight
          text-slate-900
        ">
          Understand your documents
          <br/>
          with AI.
        </h1>


        <p className="
          mt-5
          max-w-xl
          text-lg
          text-slate-500
        ">
          Upload PDFs, analyze information,
          ask questions, and translate documents
          using advanced AI models.
        </p>


        <button
          className="
          mt-8
          bg-blue-600
          px-8
          py-4
          text-white
          font-medium
          border
          border-blue-700
          hover:bg-blue-700
          transition
          "
        >
          Upload Document
        </button>


      </section>



      {/* Dashboard Grid */}
      <section className="
        grid
        grid-cols-3
        gap-6
      ">


        <DashboardCard
          title="Documents"
          value="0"
          description="Files analyzed"
        />


        <DashboardCard
          title="AI Queries"
          value="0"
          description="Questions answered"
        />


        <DashboardCard
          title="Storage"
          value="0 GB"
          description="Available space"
        />


      </section>



      {/* Recent Documents */}
      <section
        className="
        border
        border-slate-200
        bg-white
        p-8
        "
      >

        <h2
          className="
          text-xl
          font-semibold
          text-slate-900
          "
        >
          Recent Documents
        </h2>


        <div
          className="
          mt-6
          border
          border-dashed
          border-slate-300
          p-10
          text-center
          "
        >

          <p className="
            text-slate-500
          ">
            No documents uploaded yet.
          </p>

        </div>


      </section>


    </div>
  );
}



function DashboardCard({
  title,
  value,
  description
}:{
  title:string;
  value:string;
  description:string;
}){

return (

<div
className="
border
border-slate-200
bg-white
p-6
"
>

<p className="
text-sm
text-slate-500
">
{title}
</p>


<h3
className="
mt-3
text-3xl
font-semibold
text-slate-900
"
>
{value}
</h3>


<p
className="
mt-2
text-sm
text-slate-400
"
>
{description}
</p>


</div>

)

}