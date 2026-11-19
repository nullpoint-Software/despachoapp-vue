import { expect, test, type Page } from '@playwright/test'

/** Smoke test of delivery 0: banner, demo access, simulated session and no network leaks. */
const baseUrl = 'http://localhost:4173'

async function enterAsAdministrator(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('demo-profile-administrator').click()
  await expect(page.getByTestId('session-user')).toContainText('Ana Torres')
}

test('shows the banner and the demo access on load', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('demo-banner')).toContainText('Demo · los datos se borran al recargar · SAT y correo simulados')
  await expect(page.getByTestId('demo-access')).toBeVisible()
  await expect(page.getByTestId('demo-access').locator('[data-testid^="demo-profile-"]')).toHaveCount(3)
})

test('enters as Administrador and lands on Inicio', async ({ page }) => {
  await enterAsAdministrator(page)
})

test('forgets the session on reload', async ({ page }) => {
  await enterAsAdministrator(page)
  await page.reload()
  await expect(page.getByTestId('login-page')).toBeVisible()
})

test('typed login accepts the demo password and rejects a wrong one', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Usuario').fill('contador.demo')
  await page.getByLabel('Contraseña', { exact: true }).fill('x')
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await expect(page.getByTestId('login-error')).toContainText('No se pudo iniciar sesión')
  await page.getByLabel('Contraseña', { exact: true }).fill('demo1234')
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await expect(page.getByTestId('session-user')).toContainText('Luis Méndez')
})

test('opens Configuración without page errors', async ({ page }) => {
  const pageErrors: Error[] = []
  page.on('pageerror', error => pageErrors.push(error))
  await enterAsAdministrator(page)
  await page.getByRole('button', { name: 'Configuración' }).click()
  await expect(page.getByTestId('configuration-page')).toBeVisible()
  await page.waitForTimeout(500)
  expect(pageErrors).toEqual([])
})

test('serves the app on unknown paths', async ({ page }) => {
  await page.goto('/clientes')
  await expect(page.getByTestId('login-page')).toBeVisible()
})

test('never requests another origin', async ({ page }) => {
  const foreignUrls: string[] = []
  page.on('request', request => { const url = request.url(); if (!url.startsWith(baseUrl) && !url.startsWith('data:') && !url.startsWith('blob:')) foreignUrls.push(url) })
  await enterAsAdministrator(page)
  await page.getByRole('button', { name: 'Configuración' }).click()
  await expect(page.getByTestId('configuration-page')).toBeVisible()
  expect(foreignUrls).toEqual([])
})

test('fits the viewport without page scroll on login and in the workspace, with no Catálogos SAT entry', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  const hasPageScroll = (): Promise<boolean> => page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight)
  await page.goto('/')
  await expect(page.getByTestId('login-page')).toBeVisible()
  expect(await hasPageScroll()).toBe(false)
  await enterAsAdministrator(page)
  expect(await hasPageScroll()).toBe(false)
  await expect(page.getByRole('button', { name: 'Catálogos SAT' })).toHaveCount(0)
})
