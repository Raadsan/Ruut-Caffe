import express from "express"

import {
    getAllNotifications,
    getMyNotifications,
    getKitchenNotifications,
    getWaiterNotifications,
    markNotificationRead,
    getCustomerNotifications,
    getCustomerNotificationsByOrder,
    markAllCustomerNotificationsRead,
    getCustomerUnreadCount
} from "./notification.controller.js"

import { protect, authorize } from "../../../../middlewares/authMiddleware.js"

const router = express.Router()

// ALL STAFF — role-aware notifications for bell dropdown
router.get("/me", protect, getMyNotifications)

// ADMIN + MANAGER → SEE ALL
router.get("/", protect, authorize("admin", "manager"), getAllNotifications)

// KITCHEN STAFF
router.get("/kitchen", protect, authorize("kitchen"), getKitchenNotifications)

// WAITER
router.get("/waiter", protect, authorize("waiter"), getWaiterNotifications)

// MARK AS READ
router.patch("/:id/read", protect, markNotificationRead)

// CUSTOMER: by customer id
router.get("/customer/:customerId", getCustomerNotifications)

// CUSTOMER: by order id
router.get("/customer/order/:orderId", getCustomerNotificationsByOrder)


// CUSTOMER: MARK ALL AS READ
router.patch("/customer/:customerId/read-all", markAllCustomerNotificationsRead)

// CUSTOMER: UNREAD COUNT
router.get("/customer/:customerId/unread-count", getCustomerUnreadCount)


export default router
