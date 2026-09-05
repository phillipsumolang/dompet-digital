import { expect, test, type Page } from '@playwright/test'

/**
 * Guards the two ways this app has broken on a phone but not on a desktop:
 * content spilling sideways, and the modal body collapsing to a single row.
 * Both rendered perfectly in Chromium, which is why these run in WebKit.
 */

const ROUTES = [
  '/',
  '/transactions',
  '/analytics',
  '/budget',
  '/reports',
  '/accounts',
  '/categories',
  '/split-bill',
] as const

/**
 * First run shows a welcome dialog; it is not what these tests are about.
 *
 * Every test gets a fresh browser context, so it always appears -- but it is
 * rendered from a Dexie live query, so it can arrive a beat after load. Waiting
 * for it unconditionally is what makes that deterministic; probing with
 * `count()` races it and leaves the dialog swallowing the next click.
 */
async function dismissWelcome(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Skip' }).click()
  await expect(page.locator('dialog[open]')).toHaveCount(0)
}

interface Overflow {
  tag: string
  className: string
  text: string
  left: number
  right: number
}

/**
 * Anything sticking out past the viewport edge, ignoring descendants of a
 * container that is deliberately allowed to scroll sideways (wide tables).
 */
async function findOverflowing(page: Page): Promise<Overflow[]> {
  return page.evaluate(() => {
    const limit = document.documentElement.clientWidth
    const found: Overflow[] = []

    for (const el of document.querySelectorAll('main *')) {
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) continue

      let insideScroller = false
      for (let p = el.parentElement; p; p = p.parentElement) {
        const overflowX = getComputedStyle(p).overflowX
        if (overflowX === 'auto' || overflowX === 'scroll') {
          insideScroller = true
          break
        }
      }
      if (insideScroller) continue

      if (rect.right > limit + 1 || rect.left < -1) {
        found.push({
          tag: el.tagName.toLowerCase(),
          className: String((el as HTMLElement).className ?? '').slice(0, 80),
          text: (el.textContent ?? '').trim().slice(0, 40),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
        })
      }
    }
    return found
  })
}

test.describe('mobile layout', () => {
  for (const route of ROUTES) {
    test(`${route} fits the screen`, async ({ page }) => {
      await page.goto(route)
      await dismissWelcome(page)
      await page.waitForTimeout(300)

      const overflowing = await findOverflowing(page)
      expect(
        overflowing,
        `Elements spill past the right edge on ${route}:\n${JSON.stringify(overflowing, null, 2)}`,
      ).toEqual([])

      const scrollsSideways = await page.evaluate(
        () =>
          document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      )
      expect(scrollsSideways, `${route} scrolls horizontally`).toBe(false)
    })
  }
})

test.describe('transaction modal', () => {
  test('opens at its content height rather than collapsing', async ({ page }) => {
    await page.goto('/')
    await dismissWelcome(page)
    await page.getByRole('button', { name: 'Add transaction' }).first().click()

    const dialog = page.locator('dialog[open]')
    await expect(dialog).toBeVisible()

    const metrics = await dialog.evaluate((el) => {
      const body = el.children[1] as HTMLElement
      const dialogRect = el.getBoundingClientRect()
      const fields = [...body.querySelectorAll('input, select, textarea')].map((f) => ({
        name: f.getAttribute('aria-label') ?? (f as HTMLInputElement).type ?? f.tagName,
        overflowsDialog: f.getBoundingClientRect().right > dialogRect.right + 1,
      }))
      return {
        dialogHeight: Math.round(dialogRect.height),
        bodyHeight: Math.round(body.getBoundingClientRect().height),
        bodyFlexGrow: getComputedStyle(body).flexGrow,
        bodyScrollsSideways: body.scrollWidth > body.clientWidth + 1,
        footerBottom: Math.round(el.children[2].getBoundingClientRect().bottom),
        viewportHeight: window.innerHeight,
        fieldCount: fields.length,
        spilling: fields.filter((f) => f.overflowsDialog),
        dateField: (() => {
          const date = body.querySelector('input[type="date"]')
          if (!date) return null
          const cs = getComputedStyle(date)
          return { maxWidth: cs.maxWidth, appearance: cs.appearance }
        })(),
      }
    })

    // A rule, asserted rather than a behaviour, and deliberately so.
    //
    // `flex-grow: 1` on the body means `flex: 1 1 0%` -- a flex base size of
    // zero. A <dialog> is `fit-content`, so it has to derive its height from
    // its items, and on iOS that zero basis leaves it nothing to measure: the
    // body collapses to about one row. Neither Chromium nor the WebKit build
    // Playwright ships reproduces it, so no assertion about the rendered
    // result can catch it here -- but the cause is one computed value, and
    // this pins it.
    expect(
      metrics.bodyFlexGrow,
      'Modal body must not use flex-grow; it collapses the dialog on iOS',
    ).toBe('0')

    // Same reasoning for the date field. iOS lays it out as a native control
    // sized by its own content, and it spills past a narrow container; a cap
    // alone does not stop it, because the native shadow content is drawn
    // outside the capped box. Turning the native appearance off is what puts
    // the field back on the normal box model.
    expect(
      metrics.dateField,
      'Modal should contain a date field',
    ).not.toBeNull()
    expect(
      metrics.dateField?.appearance,
      'Date input must not use the native appearance; it overflows on iOS',
    ).toBe('none')
    expect(
      metrics.dateField?.maxWidth,
      'Date input needs a max-width as well, capping the box itself',
    ).not.toBe('none')

    // The collapse bug left the body at roughly one row while the header and
    // footer kept their height. A healthy body is far taller than that.
    expect(
      metrics.bodyHeight,
      `Modal body collapsed to ${metrics.bodyHeight}px (dialog ${metrics.dialogHeight}px)`,
    ).toBeGreaterThan(200)

    expect(metrics.fieldCount).toBe(6)
    expect(
      metrics.spilling,
      `Form controls wider than the dialog: ${JSON.stringify(metrics.spilling)}`,
    ).toEqual([])
    expect(metrics.bodyScrollsSideways, 'Modal body scrolls sideways').toBe(false)
    expect(
      metrics.footerBottom,
      'Footer buttons sit below the fold',
    ).toBeLessThanOrEqual(metrics.viewportHeight)
  })

  test('keeps its buttons reachable when the keyboard takes the screen', async ({ page }) => {
    await page.goto('/')
    await dismissWelcome(page)
    await page.getByRole('button', { name: 'Add transaction' }).first().click()
    await expect(page.locator('dialog[open]')).toBeVisible()

    // Roughly what an open keyboard leaves of an iPhone 13.
    await page.setViewportSize({ width: 390, height: 420 })
    await page.waitForTimeout(300)

    const metrics = await page.locator('dialog[open]').evaluate((el) => {
      const body = el.children[1] as HTMLElement
      return {
        footerBottom: Math.round(el.children[2].getBoundingClientRect().bottom),
        viewportHeight: window.innerHeight,
        bodyScrolls: body.scrollHeight > body.clientHeight + 1,
      }
    })

    expect(
      metrics.footerBottom,
      'Footer is pushed off screen once the viewport shrinks',
    ).toBeLessThanOrEqual(metrics.viewportHeight)
    // The overflow has to go somewhere: the body absorbs it as a scroll area.
    expect(metrics.bodyScrolls, 'Modal body should scroll when space is tight').toBe(true)
  })
})
