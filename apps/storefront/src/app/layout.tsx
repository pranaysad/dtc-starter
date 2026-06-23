import { getBaseURL } from "@lib/util/env"
import { Metadata } from "next"
import Script from "next/script"
import SentryProvider from "./sentry-provider"
import "styles/globals.css"

const GA_MEASUREMENT_ID = "G-CG6MER6SZM"

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
}

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en" data-mode="light">
      <body>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="ga-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
        <Script src="/static/autotrack.js" strategy="afterInteractive" />
        <SentryProvider />
        <main className="relative">{props.children}</main>
      </body>
    </html>
  )
}
