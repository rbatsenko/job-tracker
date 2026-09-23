import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import Nav from "@/components/nav";
import "./globals.css";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Jobshelf", template: "%s · Jobshelf" },
  description: "Track the jobs you are actually pursuing, and find new ones.",
};

// Sets the theme before first paint so there is no flash.
const themeScript = `(function(){try{
var stored=localStorage.getItem('job-tracker:theme')||'system';
var dark=stored==='dark'||(stored==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);
document.documentElement.setAttribute('data-theme',dark?'dark':'light');
}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${figtree.className} min-h-screen`}>
        <Nav />
        {children}
      </body>
    </html>
  );
}
