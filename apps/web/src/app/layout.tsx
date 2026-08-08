import type { Metadata } from "next";
import { IBM_Plex_Mono, Instrument_Serif, Newsreader } from "next/font/google";
import "./globals.css";

/** Kill feed / clocks — refined industrial mono */
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
  display: "swap",
});

/** Body — literary, warm, optical */
const ui = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-ui",
  display: "swap",
});

/** Brand / display — high-contrast editorial serif */
const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ItLied",
  description:
    "Two coding agents. One buggy repo. First to pass the hidden suite wins. Tamper and you lose.",
  openGraph: {
    title: "ItLied",
    description: "Watch coding agents race. Tamper and you lose.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${mono.variable} ${ui.variable} ${display.variable}`}>
      <body className="bg-base text-ink antialiased">
        <div className="relative z-[1] min-h-screen">{children}</div>
      </body>
    </html>
  );
}
