import { hasPermission, PERMISSION } from '../lib/permissions';

describe('permissions — orders matrix', () => {
  it('WAITER cannot read reports or take payment', () => {
    expect(hasPermission('WAITER', PERMISSION.REPORTS_READ)).toBe(false);
    expect(hasPermission('WAITER', PERMISSION.ORDERS_PAYMENT)).toBe(false);
    expect(hasPermission('WAITER', PERMISSION.ORDERS_CUSTOMER_PII)).toBe(false);
    expect(hasPermission('WAITER', PERMISSION.ORDERS_READ)).toBe(true);
    expect(hasPermission('WAITER', PERMISSION.ORDERS_WRITE)).toBe(true);
  });

  it('CASHIER can pay and look up customer PII, not assign driver', () => {
    expect(hasPermission('CASHIER', PERMISSION.ORDERS_PAYMENT)).toBe(true);
    expect(hasPermission('CASHIER', PERMISSION.ORDERS_CUSTOMER_PII)).toBe(true);
    expect(hasPermission('CASHIER', PERMISSION.ORDERS_ASSIGN_DRIVER)).toBe(false);
    expect(hasPermission('CASHIER', PERMISSION.REPORTS_READ)).toBe(false);
  });

  it('CHEF can cancel and write kitchen status, not pay', () => {
    expect(hasPermission('CHEF', PERMISSION.ORDERS_CANCEL)).toBe(true);
    expect(hasPermission('CHEF', PERMISSION.ORDERS_WRITE)).toBe(true);
    expect(hasPermission('CHEF', PERMISSION.ORDERS_PAYMENT)).toBe(false);
  });

  it('DRIVER read-only on orders', () => {
    expect(hasPermission('DRIVER', PERMISSION.ORDERS_READ)).toBe(true);
    expect(hasPermission('DRIVER', PERMISSION.ORDERS_WRITE)).toBe(false);
  });

  it('ADMIN has reports + all orders', () => {
    expect(hasPermission('ADMIN', PERMISSION.REPORTS_READ)).toBe(true);
    expect(hasPermission('ADMIN', PERMISSION.ORDERS_ASSIGN_DRIVER)).toBe(true);
    expect(hasPermission('ADMIN', PERMISSION.SETTINGS_WRITE)).toBe(true);
    expect(hasPermission('ADMIN', PERMISSION.DEVICES_ONBOARDING)).toBe(true);
  });

  it('MANAGER reads settings/devices but cannot write settings or onboarding', () => {
    expect(hasPermission('MANAGER', PERMISSION.SETTINGS_READ)).toBe(true);
    expect(hasPermission('MANAGER', PERMISSION.SETTINGS_WRITE)).toBe(false);
    expect(hasPermission('MANAGER', PERMISSION.DEVICES_WRITE)).toBe(true);
    expect(hasPermission('MANAGER', PERMISSION.DEVICES_ONBOARDING)).toBe(false);
  });

  it('WAITER cannot read settings or devices', () => {
    expect(hasPermission('WAITER', PERMISSION.SETTINGS_READ)).toBe(false);
    expect(hasPermission('WAITER', PERMISSION.DEVICES_READ)).toBe(false);
  });

  it('CHEF can print-lan but not manage devices CRM', () => {
    expect(hasPermission('CHEF', PERMISSION.DEVICES_PRINT)).toBe(true);
    expect(hasPermission('CHEF', PERMISSION.DEVICES_WRITE)).toBe(false);
  });
});
