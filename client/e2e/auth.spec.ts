import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test('should show login page', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('should show error on invalid credentials', async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[type="email"]').fill('admin@cafe.com')
    await page.locator('input[type="password"]').fill('wrongpassword')
    await page.locator('button[type="submit"]').click()
    await expect(page.locator('text=Invalid,email,or,password').or(page.locator('text=Invalid credentials')).or(page.locator('[class*="error"]')).or(page.locator('[role="alert"]'))).toBeVisible({ timeout: 5000 })
    await expect(page).not.toHaveURL(/\/admin/)
  })

  test('should redirect to login when accessing protected route without auth', async ({ page }) => {
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/login/)
  })

  test('should redirect to login when accessing kitchen display without auth', async ({ page }) => {
    await page.goto('/kitchen')
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 })
  })

  test('redirects legacy /menu to login', async ({ page }) => {
    await page.goto('/menu')
    await expect(page).toHaveURL(/\/login/)
  })

  test('redirects home to login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })
})