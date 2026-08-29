/**
 * Waafi Mobile Money Payment Utility
 * Uses Node.js built-in fetch (Node 18+) — no external dependency needed.
 */

import crypto from 'crypto'

const WAAFI_URL = 'https://api.waafipay.net/asm'
const WAAFI_TIMEOUT_MS = 120_000

function buildWaafiTimestamp() {
  const d = new Date()
  const pad = (n, len = 2) => String(n).padStart(len, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
}

function sanitizeReferenceId(ref) {
  return String(ref ?? '')
    .replace(/[^a-zA-Z0-9\-_.]/g, '-')
    .slice(0, 50) || `REF-${Date.now()}`
}

/**
 * Normalize Somali mobile numbers for Waafi (e.g. 0612345678 → 252612345678).
 */
export function normalizeWaafiPhone(phone) {
  let digits = String(phone ?? '').trim().replace(/[\s\-()]/g, '')
  if (digits.startsWith('+')) digits = digits.slice(1)
  if (digits.startsWith('00')) digits = digits.slice(2)
  digits = digits.replace(/\D/g, '')

  if (digits.startsWith('252')) {
    // already international
  } else if (digits.startsWith('0')) {
    digits = `252${digits.slice(1)}`
  } else if (/^[67]\d{8}$/.test(digits)) {
    digits = `252${digits}`
  } else if (/^\d{9,10}$/.test(digits)) {
    digits = `252${digits}`
  }

  if (!/^252[67]\d{7,8}$/.test(digits)) {
    throw new Error('Invalid Waafi number. Use 61XXXXXXX or 25261XXXXXXX')
  }

  return digits
}

/**
 * Waafi returns 2001 when the request is accepted; params.state must be APPROVED.
 */
export function isWaafiPaymentSuccess(data) {
  const code = String(data?.responseCode ?? data?.params?.responseCode ?? '')
  if (code !== '2001') return false

  const state = String(data?.params?.state ?? '').trim().toUpperCase()
  if (!state) return true
  return state === 'APPROVED'
}

export function getWaafiUserMessage(responseCode, responseMsg, paramsDescription) {
  const code = String(responseCode ?? '')
  const msg = String(responseMsg ?? '').trim()
  const desc = String(paramsDescription ?? '').trim()

  switch (code) {
    case '5310':
      return 'Waafi payment was not approved. Open the Waafi app, approve the payment popup, and enter your PIN. Do not close the prompt.'
    case '5306':
      return 'Payment was cancelled on your phone.'
    case '5309':
      return 'Payment timed out. Approve on your phone within 5 minutes when the Waafi prompt appears.'
    case '5206':
      if (/insufficient|kuguma filna/i.test(msg)) {
        return 'Insufficient balance in your Waafi wallet.'
      }
      if (/aborted|cancel/i.test(msg)) {
        return 'Payment was cancelled on your phone.'
      }
      return desc || msg || 'Payment declined by your mobile wallet.'
    case 'ERR':
      if (/timeout|aborted/i.test(msg)) {
        return 'Payment request timed out. If money was deducted, contact support before retrying.'
      }
      return msg || 'Could not reach Waafi. Please try again.'
    default:
      if (desc && !/^customer rejected/i.test(desc)) return desc
      if (msg && !/^RCS_/i.test(msg)) return msg
      return msg.replace(/^RCS_/, '').replace(/_/g, ' ') || 'Payment failed. Please try again.'
  }
}

function buildWaafiResult(data, { transactionId, accountNo, referenceId }) {
  const responseCode = String(data?.responseCode ?? data?.params?.responseCode ?? 'ERR')
  const responseMsg = data?.responseMsg ?? data?.params?.description ?? data?.params?.responseMsg ?? 'Unknown error'
  const paramsDescription = data?.params?.description

  return {
    responseCode,
    responseMsg,
    referenceId: data?.params?.transactionId ?? data?.responseId ?? transactionId,
    raw: data,
    isSuccess: isWaafiPaymentSuccess(data),
    userMessage: getWaafiUserMessage(responseCode, responseMsg, paramsDescription),
    accountNo,
    internalReference: referenceId,
  }
}

async function callWaafi(payload) {
  const response = await fetch(WAAFI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(WAAFI_TIMEOUT_MS),
  })

  const data = await response.json()
  console.log(`Waafi ${payload.serviceName} Response:`, JSON.stringify(data, null, 2))
  return data
}

function getWaafiCredentials() {
  const merchantUid = process.env.WAAFI_MERCHANT_UID
  const apiUserId = process.env.WAAFI_API_USER_ID
  const apiKey = process.env.WAAFI_API_KEY

  if (!merchantUid || !apiUserId || !apiKey) {
    throw new Error('Waafi credentials missing in .env (WAAFI_MERCHANT_UID, WAAFI_API_USER_ID, WAAFI_API_KEY)')
  }

  return { merchantUid, apiUserId, apiKey }
}

async function cancelWaafiPreauthorize(transactionId, description) {
  try {
    const { merchantUid, apiUserId, apiKey } = getWaafiCredentials()
    await callWaafi({
      schemaVersion: '1.0',
      requestId: crypto.randomUUID(),
      timestamp: buildWaafiTimestamp(),
      channelName: 'WEB',
      serviceName: 'API_PREAUTHORIZE_CANCEL',
      serviceParams: {
        merchantUid,
        apiUserId,
        apiKey,
        transactionId: String(transactionId),
        description: description || 'Checkout cancelled',
      },
    })
  } catch (err) {
    console.error('Waafi preauth cancel failed:', err.message)
  }
}

/**
 * Charge via Waafi PREAUTHORIZE → COMMIT (recommended flow).
 */
export const sendWaafiPayment = async ({ transactionId, accountNo, amount, description }) => {
  const { merchantUid, apiUserId, apiKey } = getWaafiCredentials()
  const normalizedAccount = normalizeWaafiPhone(accountNo)
  const referenceId = sanitizeReferenceId(transactionId)
  const amountStr = Number(amount).toFixed(2)

  console.log(`Waafi payment → account: ${normalizedAccount}, amount: ${amountStr}, ref: ${referenceId}`)

  const preauthPayload = {
    schemaVersion: '1.0',
    requestId: crypto.randomUUID(),
    timestamp: buildWaafiTimestamp(),
    channelName: 'WEB',
    serviceName: 'API_PREAUTHORIZE',
    serviceParams: {
      merchantUid,
      apiUserId,
      apiKey,
      paymentMethod: 'MWALLET_ACCOUNT',
      payerInfo: { accountNo: normalizedAccount },
      transactionInfo: {
        referenceId,
        amount: amountStr,
        currency: 'USD',
        description: description || 'Ruut Caffe Payment',
      },
    },
  }

  try {
    const preauthData = await callWaafi(preauthPayload)
    const preauthResult = buildWaafiResult(preauthData, {
      transactionId,
      accountNo: normalizedAccount,
      referenceId,
    })

    if (!preauthResult.isSuccess) {
      return preauthResult
    }

    const waafiTransactionId = preauthData?.params?.transactionId
    if (!waafiTransactionId) {
      return {
        ...preauthResult,
        isSuccess: false,
        userMessage: 'Payment was not completed by Waafi. Please try again.',
      }
    }

    const commitData = await callWaafi({
      schemaVersion: '1.0',
      requestId: crypto.randomUUID(),
      timestamp: buildWaafiTimestamp(),
      channelName: 'WEB',
      serviceName: 'API_PREAUTHORIZE_COMMIT',
      serviceParams: {
        merchantUid,
        apiUserId,
        apiKey,
        transactionId: String(waafiTransactionId),
        description: description || 'Ruut Caffe order payment',
      },
    })

    const commitResult = buildWaafiResult(commitData, {
      transactionId: waafiTransactionId,
      accountNo: normalizedAccount,
      referenceId,
    })

    if (!commitResult.isSuccess) {
      await cancelWaafiPreauthorize(waafiTransactionId, 'Commit failed – releasing hold')
    }

    return commitResult
  } catch (err) {
    console.error('Waafi API Error:', err.message)
    const responseMsg = err.message
    return {
      responseCode: 'ERR',
      responseMsg,
      referenceId: null,
      raw: null,
      isSuccess: false,
      userMessage: getWaafiUserMessage('ERR', responseMsg),
      accountNo: normalizedAccount,
      internalReference: referenceId,
    }
  }
}
