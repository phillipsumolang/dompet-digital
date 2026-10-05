import { expect, test } from '@playwright/test'
import { dismissWelcome } from './helpers'

/**
 * Both of these used to fail silently, and both lie about data that cannot be
 * recovered: a crash showed a blank page, and a browser refusing to store
 * anything showed an app that looked freshly wiped.
 */

test.describe('when the page crashes', () => {
  // Breaks number formatting, which every money figure goes through, without
  // putting a test hook in the shipped app. The crash screen itself formats
  // nothing, so it still renders.
  // `format` is an accessor on the prototype, not a data property, so plain
  // assignment is silently ignored -- it has to be redefined.
  const breakRendering = `
    Object.defineProperty(Intl.NumberFormat.prototype, 'format', {
      configurable: true,
      get() {
        return () => { throw new Error('forced render failure') }
      },
    })
  `

  test('offers the backup instead of a blank page', async ({ page }) => {
    await page.addInitScript(breakRendering)
    await page.goto('/')

    await dismissWelcome(page)

    await expect(page.getByText('Something broke on this screen')).toBeVisible()

    // The point of the screen: rescue the data before touching anything.
    await expect(page.getByRole('button', { name: 'Save a backup' })).toBeVisible()
    await expect(page.getByText(/do not clear this site's data/i)).toBeVisible()

    // And it must never be the blank page it replaced.
    const text = await page.locator('body').innerText()
    expect(text.trim().length).toBeGreaterThan(80)
  })

  test('the backup button actually writes a file', async ({ page }) => {
    await page.addInitScript(breakRendering)
    await page.goto('/')
    await dismissWelcome(page)
    await expect(page.getByText('Something broke on this screen')).toBeVisible()

    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Save a backup' }).click()
    const file = await download

    expect(file.suggestedFilename()).toMatch(/^dompet-backup-\d{4}-\d{2}-\d{2}\.json$/)
    await expect(page.getByText(/^Saved dompet-backup/)).toBeVisible()
  })

  test.describe('on a wide screen', () => {
    // The sidebar is where Categories lives; the phone's bottom bar carries
    // only the five money-formatting pages, all of which fail here by design.
    test.use({ viewport: { width: 1280, height: 900 } })

    test('a broken page leaves the rest of the app reachable', async ({ page }) => {
      await page.addInitScript(breakRendering)
      await page.goto('/')
      await dismissWelcome(page)
      await expect(page.getByText('Something broke on this screen')).toBeVisible()

      // Only the routed page is wrapped separately, so the shell survives.
      await page.getByRole('link', { name: 'Categories' }).click()

      // Categories formats no money, so it renders -- which it only can if the
      // boundary reset on the route change rather than staying crashed.
      await expect(page.getByRole('heading', { name: 'Categories', exact: true })).toBeVisible()
      await expect(page.getByText('Something broke on this screen')).toHaveCount(0)
    })
  })
})

test.describe('when the browser refuses to store anything', () => {
  test('says so instead of looking freshly wiped', async ({ page }) => {
    await page.addInitScript(`
      Object.defineProperty(window, 'indexedDB', {
        configurable: true,
        get: () => undefined,
      })
    `)
    await page.goto('/')

    const banner = page.getByRole('alert')
    await expect(banner).toBeVisible()
    await expect(banner).toContainText('Nothing is being saved')
    await expect(banner).toContainText(/will be kept|support the storage/i)

    // It must not be dismissible: every screen behind it is lying.
    await expect(banner.getByRole('button')).toHaveCount(0)
  })

  test('a failed write surfaces rather than disappearing', async ({ page }) => {
    await page.goto('/')
    await dismissWelcome(page)
    await expect(page.getByRole('alert')).toHaveCount(0)

    // Exactly what a quota failure looks like from a fire-and-forget write.
    await page.evaluate(() => {
      const error = new Error('The quota has been exceeded.')
      error.name = 'QuotaExceededError'
      void Promise.reject(error)
    })

    const banner = page.getByRole('alert')
    await expect(banner).toBeVisible()
    await expect(banner).toContainText(/run out of space/i)
  })
})
