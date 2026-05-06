import type { Metadata } from "next"
import { Geist } from "next/font/google"
import "./globals.css"
import Providers from "@/components/Providers"

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "VšehoEvidencia",
  description: "Evidencia majetku spoločnosti",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="sk" className={`${geist.variable} h-full`} suppressHydrationWarning>
      <body className="h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
