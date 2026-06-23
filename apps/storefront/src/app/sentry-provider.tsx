"use client"

import { useEffect } from "react"
import * as Sentry from "@sentry/react"

const SENTRY_DSN =
  "https://cd29be9e7ee014ccbfe4ff665b1de934@o4511610456637440.ingest.us.sentry.io/4511610726318080"

let isSentryInitialized = false

export default function SentryProvider() {
  useEffect(() => {
    if (isSentryInitialized) {
      return
    }

    Sentry.init({
      dsn: SENTRY_DSN,
      dataCollection: {
        // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
        // https://docs.sentry.io/platforms/javascript/guides/react/configuration/options/#dataCollection
        // userInfo: false,
        // httpBodies: [],
      },
    })

    isSentryInitialized = true
  }, [])

  return null
}
