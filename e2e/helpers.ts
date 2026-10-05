import { expect, type Page } from '@playwright/test'

/**
 * First run shows a welcome dialog, and it is a modal `<dialog>` -- while it is
 * open it swallows every click behind it.
 *
 * Every test gets a fresh browser context, so it always appears, but it is
 * rendered from a Dexie live query and can arrive a beat after load. Waiting
 * for it unconditionally is what makes that deterministic; probing with
 * `count()` races it, and the next click then times out against the backdrop.
 */
export async function dismissWelcome(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Skip' }).click()
  await expect(page.locator('dialog[open]')).toHaveCount(0)
}
