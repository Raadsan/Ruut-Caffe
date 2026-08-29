import prisma from '../../../../config/db.js';
import { v4 as uuidv4 } from 'uuid';
import { logAudit } from '../../../../utils/auditHelper.js';

function normalizeTableStatus(status) {
  return status === 'inactive' ? 'inactive' : 'active';
}

let legacyTableStatusesFixed = false;

let tablesCache = { data: null, at: 0 }
const TABLES_CACHE_TTL_MS = 5 * 60 * 1000

export const clearTablesCache = () => {
  tablesCache = { data: null, at: 0 }
}

async function fixLegacyTableStatuses() {
  if (legacyTableStatusesFixed) return;
  await prisma.table.updateMany({
    where: { status: { notIn: ['active', 'inactive'] } },
    data: { status: 'active' },
  });
  legacyTableStatusesFixed = true;
}

// CREATE TABLE
export const createTable = async (req, res) => {
  try {
    const { number, name, status } = req.body;
    const descriptionValue = Object.prototype.hasOwnProperty.call(req.body, 'description')
      ? (req.body.description == null ? null : String(req.body.description).trim() || null)
      : undefined;

    if (!number) {
      return res.status(400).json({
        success: false,
        message: 'Table number is required',
      });
    }

    const existingTable = await prisma.table.findUnique({
      where: { number: Number(number) },
    });

    if (existingTable) {
      return res.status(409).json({
        success: false,
        message: 'Table number already exists',
      });
    }

    const qrCode = `table-${number}-${uuidv4().slice(0, 8)}`;

    const table = await prisma.table.create({
      data: {
        number: Number(number),
        name: name || `Table ${number}`,
        description: descriptionValue !== undefined ? descriptionValue : null,
        qrCode,
        status: normalizeTableStatus(status || 'active'),
      },
    });

    logAudit({
      userId: req.user?.id,
      action: 'Created',
      entity: 'Table',
      entityId: table.id,
      description: `Created table #${table.number}`,
    });

    clearTablesCache();

    return res.status(201).json({
      success: true,
      message: 'Table created successfully',
      data: table,
    });
  } catch (error) {
    console.error('Create Table Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create table',
      error: error.message,
    });
  }
};

// UPDATE TABLE
export const updateTable = async (req, res) => {
  try {
    const { id } = req.params;
    const { number, name, status } = req.body;
    const descriptionValue = Object.prototype.hasOwnProperty.call(req.body, 'description')
      ? (req.body.description == null ? null : String(req.body.description).trim() || null)
      : undefined;

    const tableId = parseInt(id);

    if (isNaN(tableId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid table id',
      });
    }

    const existingTable = await prisma.table.findUnique({
      where: { id: tableId },
    });

    if (!existingTable) {
      return res.status(404).json({
        success: false,
        message: 'Table not found',
      });
    }

    if (number && Number(number) !== existingTable.number) {
      const numberExists = await prisma.table.findUnique({
        where: { number: Number(number) },
      });

      if (numberExists) {
        return res.status(409).json({
          success: false,
          message: 'Table number already exists',
        });
      }
    }

    const updatedTable = await prisma.table.update({
      where: { id: tableId },
      data: {
        number: number ? Number(number) : existingTable.number,
        name: name !== undefined ? name : existingTable.name,
        description: descriptionValue !== undefined ? descriptionValue : existingTable.description,
        status: status !== undefined ? normalizeTableStatus(status) : existingTable.status,
      },
    });

    logAudit({
      userId: req.user?.id,
      action: 'Updated',
      entity: 'Table',
      entityId: updatedTable.id,
      description: `Updated table #${updatedTable.number}`,
    });

    clearTablesCache();

    return res.status(200).json({
      success: true,
      message: 'Table updated successfully',
      data: updatedTable,
    });
  } catch (error) {
    console.error('Update Table Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update table',
      error: error.message,
    });
  }
};

// DELETE TABLE
export const deleteTable = async (req, res) => {
  try {
    const { id } = req.params;
    const tableId = parseInt(id);

    if (isNaN(tableId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid table id',
      });
    }

    const existingTable = await prisma.table.findUnique({
      where: { id: tableId },
      include: {
        order: true,
      },
    });

    if (!existingTable) {
      return res.status(404).json({
        success: false,
        message: 'Table not found',
      });
    }

    if (existingTable.order.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete table because it has related orders',
      });
    }

    await prisma.table.delete({
      where: { id: tableId },
    });

    logAudit({
      userId: req.user?.id,
      action: 'Deleted',
      entity: 'Table',
      entityId: tableId,
      description: `Deleted table #${existingTable.number}`,
    });

    clearTablesCache();

    return res.status(200).json({
      success: true,
      message: 'Table deleted successfully',
    });
  } catch (error) {
    console.error('Delete Table Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete table',
      error: error.message,
    });
  }
};

// GET ALL TABLES
export const getAllTables = async (req, res) => {
  try {
    const now = Date.now()
    if (tablesCache.data && now - tablesCache.at < TABLES_CACHE_TTL_MS) {
      return res.status(200).json({
        success: true,
        count: tablesCache.data.length,
        data: tablesCache.data,
      })
    }

    await fixLegacyTableStatuses();

    const tables = await prisma.table.findMany({
      orderBy: {
        number: 'asc',
      },
    });

    const normalized = tables.map((t) => ({
      ...t,
      status: normalizeTableStatus(t.status),
    }));

    tablesCache = { data: normalized, at: now }

    res.status(200).json({
      success: true,
      count: normalized.length,
      data: normalized,
    });
  } catch (error) {
    console.error('Get Tables Error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch tables',
      error: error.message,
    });
  }
};

// GET TABLE BY QR CODE
function extractQrCodeFromScan(value) {
  if (!value) return value;

  let decoded = decodeURIComponent(String(value).trim());

  try {
    const uri = new URL(decoded);
    const segments = uri.pathname.split('/').filter(Boolean);
    const menuIndex = segments.indexOf('menu');
    if (menuIndex >= 0 && segments[menuIndex + 1]) {
      return decodeURIComponent(segments[menuIndex + 1]);
    }
  } catch (_) {
    // Not a full URL — use raw value below.
  }

  const marker = '/menu/';
  const markerIndex = decoded.toLowerCase().indexOf(marker);
  if (markerIndex >= 0) {
    decoded = decoded.slice(markerIndex + marker.length).split(/[?#]/)[0];
    return decodeURIComponent(decoded.trim());
  }

  return decoded;
}

export const getTableByQrCode = async (req, res) => {
  try {
    const qrCode = extractQrCodeFromScan(req.params.qrCode);

    if (!qrCode) {
      return res.status(400).json({
        success: false,
        message: 'QR code is required',
      });
    }

    const table = await prisma.table.findFirst({
      where: { qrCode: qrCode },
    });

    if (!table) {
      return res.status(404).json({
        success: false,
        message: 'Table not found',
      });
    }

    res.status(200).json({
      success: true,
      data: table,
    });
  } catch (error) {
    console.error('Get Table By QR Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch table details',
      error: error.message,
    });
  }
};
