import { describe, expect, it } from 'vitest'
import { checkName, MAX_NAME } from './profile'

describe('checkName', () => {
  it('trims and tidies spaces', () => {
    expect(checkName('  Robin   de  Coach ')).toEqual({ name: 'Robin de Coach' })
  })
  it('rejects empty and too long names', () => {
    expect('error' in checkName('   ')).toBe(true)
    expect('error' in checkName('x'.repeat(MAX_NAME + 1))).toBe(true)
    expect(checkName('x'.repeat(MAX_NAME))).toEqual({ name: 'x'.repeat(MAX_NAME) })
  })
})
