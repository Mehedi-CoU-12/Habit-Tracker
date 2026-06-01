import type { Metadata } from "next";
import { Caprasimo, Manrope, JetBrains_Mono } from "next/font/google";
import { Providers } from "../provider/providers";

import "./globals.css";

const manrope = Manrope({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700", "800"],
    variable: "--font-manrope",
    display: "swap",
});

const caprasimo = Caprasimo({
    subsets: ["latin"],
    weight: "400",
    variable: "--font-caprasimo",
    display: "swap",
});

const jetbrains = JetBrains_Mono({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
    variable: "--font-jetbrains",
    display: "swap",
});

export const metadata: Metadata = {
    title: "Bloom | Habits that grow with you",
    description:
        "Track what matters and watch your plants bloom as your streaks stretch out.",
    icons: { icon: "/favicon-bluebg.svg" },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html
            lang="en"
            className={`${manrope.variable} ${caprasimo.variable} ${jetbrains.variable}`}
            suppressHydrationWarning
        >
            <body className="font-sans antialiased">
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
