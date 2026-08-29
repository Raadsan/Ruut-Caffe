const writableFields = new Set([
  'company_id', 'vendor_code', 'name', 'partner_type', 'tax_id', 'email', 'phone',
  'address', 'city', 'country', 'currency_id', 'payment_term_id',
  'payable_account_id', 'default_bank_account', 'notes', 'is_active',
])
export const validateVendor = (body, { partial = false } = {}) => {
  const input = body && typeof body === 'object' ? body : {}
  const unknown = Object.keys(input).filter((key) => !writableFields.has(key))
  if (unknown.length) return { error: `Unsupported fields: ${unknown.join(', ')}` }
  const data = {}
  for (const key of writableFields) if (input[key] !== undefined) data[key] = typeof input[key] === 'string' ? input[key].trim() : input[key]
  if (!partial && !data.name) return { error: 'name is required' }
  if (data.name !== undefined && !data.name) return { error: 'Vendor name cannot be empty' }
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return { error: 'Invalid email address' }
  return { data }
}
export const validateId = (value) => {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}
