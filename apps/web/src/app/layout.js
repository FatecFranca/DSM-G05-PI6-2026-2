import "./globals.css";
import "./workspace.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { WorkspaceShell } from '@/components/workspace-shell';
const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const metadata = {
  title: "Estoque Inteligente",
  description: "Gest\xE3o inteligente de estoque e previs\xE3o de demanda"
};
const viewport = {
  width: "device-width",
  initialScale: 1
};
function RootLayout({ children }) {
  return <html lang="pt-BR" data-scroll-behavior="smooth" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
      <body><WorkspaceShell>{children}</WorkspaceShell></body>
    </html>;
}
export {
  RootLayout as default,
  metadata,
  viewport
};
