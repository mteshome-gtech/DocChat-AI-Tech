import "./globals.css";

export const metadata = {
  title: "DocChatAI — Turn Information Into Intelligence",
  description:
    "Upload, analyze, understand, translate, compare, research, and create with your documents using AI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-white text-slate-950 antialiased">
        {children}
      </body>
    </html>
  );
}