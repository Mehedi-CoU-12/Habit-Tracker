import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "../provider/providers";

import "./globals.css";

const inter = Inter({
    subsets: ["latin"],
    variable: "--font-inter",
    display: "swap",
});

export const metadata: Metadata = {
    title: "HabitFlow | Build Better Habits",
    description:
        "Track your daily habits, visualize your progress, and achieve your goals with HabitFlow.",
    icons: { icon: "/favicon-bluebg.svg" },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className={inter.variable} suppressHydrationWarning>
            <body className="font-sans antialiased">
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
