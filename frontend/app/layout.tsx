import "./globals.css";

import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";

export const metadata = {
  title: "DocChatAI",
  description:
    "AI-powered document intelligence platform. Upload, analyze, and chat with your documents.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-slate-50">

          {/* Top Navigation */}
          <Header />

          <div className="flex">

            {/* Left Navigation */}
            <Sidebar />


            {/* Main Workspace */}
            <main className="
              flex-1
              min-h-screen
              p-8
              bg-slate-50
            ">
              {children}
            </main>


          </div>

        </div>
      </body>
    </html>
  );
}