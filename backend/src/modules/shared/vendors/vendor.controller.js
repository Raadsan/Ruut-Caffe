import { logAudit } from '../../../utils/auditHelper.js'
import { validateId, validateVendor } from './vendor.validation.js'
import { createVendorRecord, deleteVendorRecord, findVendor, listVendors, updateVendorRecord } from './vendor.service.js'

const fail = (res, error, fallback) => res.status(error.status || (error.code === 'P2025' ? 404 : 500)).json({ success: false, message: error.message || fallback })
export const getAll = async (req, res) => { try { res.json({ success: true, data: await listVendors() }) } catch (error) { fail(res, error, 'Failed to fetch vendors') } }
export const getById = async (req, res) => {
  const id = validateId(req.params.id); if (!id) return res.status(400).json({ success: false, message: 'Invalid vendor id' })
  try { const data = await findVendor(id); if (!data) return res.status(404).json({ success: false, message: 'Vendor not found' }); res.json({ success: true, data }) } catch (error) { fail(res, error, 'Failed to fetch vendor') }
}
export const create = async (req, res) => {
  const parsed = validateVendor(req.body); if (parsed.error) return res.status(400).json({ success: false, message: parsed.error })
  try { const data = await createVendorRecord(parsed.data); await logAudit({ userId: req.user?.id, action: 'Created', entity: 'Vendor', entityId: data.id, description: `Created vendor "${data.name}"` }); res.status(201).json({ success: true, message: 'Vendor created successfully', data }) } catch (error) { fail(res, error, 'Failed to create vendor') }
}
export const update = async (req, res) => {
  const id = validateId(req.params.id); if (!id) return res.status(400).json({ success: false, message: 'Invalid vendor id' })
  const parsed = validateVendor(req.body, { partial: true }); if (parsed.error) return res.status(400).json({ success: false, message: parsed.error })
  try { const data = await updateVendorRecord(id, parsed.data); await logAudit({ userId: req.user?.id, action: 'Updated', entity: 'Vendor', entityId: id, description: `Updated vendor "${data.name}"` }); res.json({ success: true, message: 'Vendor updated successfully', data }) } catch (error) { fail(res, error, 'Failed to update vendor') }
}
export const remove = async (req, res) => {
  const id = validateId(req.params.id); if (!id) return res.status(400).json({ success: false, message: 'Invalid vendor id' })
  try { const data = await deleteVendorRecord(id); if (!data) return res.status(404).json({ success: false, message: 'Vendor not found' }); await logAudit({ userId: req.user?.id, action: 'Deleted', entity: 'Vendor', entityId: id, description: `Deleted vendor "${data.name}"` }); res.json({ success: true, message: 'Vendor deleted successfully' }) } catch (error) { fail(res, error, 'Failed to delete vendor') }
}
