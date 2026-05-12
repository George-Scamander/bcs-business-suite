import { useEffect } from 'react'

const MOBILE_VIEWPORT_QUERY = '(max-width: 767px)'
const SPLASH_MIN_SHOW_MS = 1800
const SPLASH_FADE_OUT_MS = 260

export function MobileStartupSplash() {
  useEffect(() => {
    const splash = document.getElementById('app-startup-splash')

    if (!splash) {
      return
    }

    if (!window.matchMedia(MOBILE_VIEWPORT_QUERY).matches) {
      splash.remove()
      return
    }

    const startTime = performance.now()

    const removeSplash = () => {
      const elapsed = performance.now() - startTime
      const waitTime = Math.max(0, SPLASH_MIN_SHOW_MS - elapsed)

      window.setTimeout(() => {
        splash.classList.add('is-hiding')

        window.setTimeout(() => {
          splash.remove()
        }, SPLASH_FADE_OUT_MS)
      }, waitTime)
    }

    if (document.readyState === 'complete') {
      removeSplash()
    } else {
      window.addEventListener('load', removeSplash, { once: true })
    }

    return () => {
      window.removeEventListener('load', removeSplash)
    }
  }, [])

  return null
}
