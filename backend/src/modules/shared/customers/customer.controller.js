import { logAudit } from '../../../utils/auditHelper.js'
import { validateCustomer, validateId } from './customer.validation.js'
import {
  createCustomerRecord, deleteCustomerRecord, findCustomer, findCustomerByPhone,
  listCustomers, updateCustomerRecord,
} from './customer.service.js'

const fail = (res, error, fallback) => res.status(error.status || (error.code === 'P2025' ? 404 : 500))
  .json({ success: false, message: error.message || fallback })

export const getAll = async (req, res) => {
  try { const data = await listCustomers(); res.json({ success: true, count: data.length, data }) }
  catch (error) { fail(res, error, 'Failed to fetch customers') }
}
export const getPosList = async (req, res) => {
  try { const data = await listCustomers({ lightweight: true }); res.json({ success: true, count: data.length, data }) }
  catch (error) { fail(res, error, 'Failed to fetch customers') }
}
export const getByPhone = async (req, res) => {
  try {
    const data = await findCustomerByPhone(String(req.params.phone || '').trim())
    if (!data) return res.status(404).json({ success: false, message: 'Customer not found' })
    res.json({ success: true, data })
  } catch (error) { fail(res, error, 'Failed to fetch customer') }
}
export const getById = async (req, res) => {
  const id = validateId(req.params.id)
  if (!id) return res.status(400).json({ success: false, message: 'Invalid customer id' })
  try {
    const data = await findCustomer(id)
    if (!data) return res.status(404).json({ success: false, message: 'Customer not found' })
    res.json({ success: true, data })
  } catch (error) { fail(res, error, 'Failed to fetch customer') }
}
export const create = async (req, res) => {
  const parsed = validateCustomer(req.body)
  if (parsed.error) return res.status(400).json({ success: false, message: parsed.error })
  try {
    const data = await createCustomerRecord(parsed.data)
    await logAudit({ userId: req.user?.id, action: 'Created', entity: 'Customer', entityId: data.id, description: `Created customer "${data.name}"` })
    res.status(201).json({ success: true, message: 'Customer created successfully', data })
  } catch (error) { fail(res, error, 'Failed to create customer') }
}
export const update = async (req, res) => {
  const id = validateId(req.params.id)
  if (!id) return res.status(400).json({ success: false, message: 'Invalid customer id' })
  const parsed = validateCustomer(req.body, { partial: true })
  if (parsed.error) return res.status(400).json({ success: false, message: parsed.error })
  try {
    const data = await updateCustomerRecord(id, parsed.data)
    await logAudit({ userId: req.user?.id, action: 'Updated', entity: 'Customer', entityId: id, description: `Updated customer "${data.name}"` })
    res.json({ success: true, message: 'Customer updated successfully', data })
  } catch (error) { fail(res, error, 'Failed to update customer') }
}
export const remove = async (req, res) => {
  const id = validateId(req.params.id)
  if (!id) return res.status(400).json({ success: false, message: 'Invalid customer id' })
  try {
    const data = await deleteCustomerRecord(id)
    if (!data) return res.status(404).json({ success: false, message: 'Customer not found' })
    await logAudit({ userId: req.user?.id, action: 'Deleted', entity: 'Customer', entityId: id, description: `Deleted customer "${data.name}"` })
    res.json({ success: true, message: 'Customer deleted successfully' })
  } catch (error) { fail(res, error, 'Failed to delete customer') }
}
