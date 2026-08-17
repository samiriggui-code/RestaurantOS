import { getEnabledModules, isModuleEnabled, resetModulesCache } from '../../lib/modules'

describe('modules', () => {
  beforeEach(() => {
    resetModulesCache()
    delete process.env.ENABLED_MODULES
  })

  it('enables V1 default modules', () => {
    const mods = getEnabledModules()
    expect(mods.has('menu')).toBe(true)
    expect(mods.has('orders')).toBe(true)
    expect(mods.has('wifi')).toBe(false)
  })

  it('respects ENABLED_MODULES env', () => {
    process.env.ENABLED_MODULES = 'menu,wifi'
    resetModulesCache()
    expect(isModuleEnabled('wifi')).toBe(true)
    expect(isModuleEnabled('orders')).toBe(false)
  })
})
