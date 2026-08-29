const writableFields = new Set([
  'company_id', 'customer_code', 'name', 'fullName', 'partner_type', 'tax_id',
  'email', 'phone', 'address', 'city', 'country', 'currency_id',
  'payment_term_id', 'receivable_account_id', 'credit_limit', 'notes', 'is_active',
])

export const validateCustomer = (body, { partial = false } = {}) => {
  const input = body && typeof body === 'object' ? body : {}
  const unknown = Object.keys(input).filter((key) => !writableFields.has(key))
  if (unknown.length) return { error: `Unsupported fields: ${unknown.join(', ')}` }

  const data = {}
  for (const key of writableFields) {
    if (input[key] !== undefined) data[key] = typeof input[key] === 'string' ? input[key].trim() : input[key]
  }
  if (data.fullName !== undefined) {
    if (data.name !== undefined && data.name !== data.fullName) return { error: 'name and fullName must match' }
    data.name = data.fullName
    delete data.fullName
  }
  if (!partial && !data.name) return { error: 'name (or fullName) is required' }
  if (data.name !== undefined && !data.name) return { error: 'Customer name cannot be empty' }
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return { error: 'Invalid email address' }
  return { data }
}

export const validateId = (value) => {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}
