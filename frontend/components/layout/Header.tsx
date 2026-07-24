import Link from "next/link";

export default function Header() {
  return (
    <header className="
      h-16
      border-b
      border-slate-200
      bg-white
      flex
      items-center
      justify-between
      px-6
    ">

      <Link
        href="/"
        className="
          text-xl
          font-bold
          tracking-tight
          text-slate-900
        "
      >
        DocChatAI
      </Link>


      <div className="
        flex
        items-center
        gap-6
      ">

        <input
          placeholder="Search documents..."
          className="
            h-10
            w-64
            border
            border-slate-300
            px-4
            text-sm
            outline-none
            focus:border-blue-600
          "
        />


        <button
          className="
            text-sm
            font-medium
          "
        >
          Account
        </button>

      </div>

    </header>
  );
}