"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { authApi } from '@/lib/api/auth/authApi';
import {
  dispatchOrdersChanged,
  dispatchRefreshNotifications,
  dispatchMenuChanged,
  OrderSocketPayload,
} from '@/lib/live-updates';
import { clearOrdersListCache } from '@/lib/api/restaurant/orderApi';
import { menuItemApi } from '@/lib/api/restaurant/menuItemApi';
import { categoryApi } from '@/lib/api/restaurant/categoryApi';
import { playOrderReadyChime } from '@/lib/order-ready-sound';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({ socket: null, isConnected: false });

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const userRoleRef = React.useRef<string | null>(null);

  useEffect(() => {
    const getSocketUrl = () => {
      if (process.env.NEXT_PUBLIC_API_URL) {
        return process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '');
      }
      if (typeof window !== 'undefined') {
        const protocol = window.location.protocol;
        const host = window.location.hostname;
        if (protocol === 'https:' || (!host.includes('localhost') && !host.includes('127.0.0.1') && !/^\d+\.\d+\.\d+\.\d+$/.test(host))) {
          return `${protocol}//${host}`;
        }
        return `${protocol}//${host}:7005`;
      }
      return 'http://localhost:7005';
    };
    const socketUrl = getSocketUrl();
    const socketInstance = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    const joinRooms = async () => {
      try {
        const user = await authApi.getMe();
        const role = user.role?.toLowerCase();
        userRoleRef.current = role || null;
        if (role) socketInstance.emit('join_role', role);
        if (user.id) socketInstance.emit('join_user', String(user.id));
      } catch {
        // Public pages — no role rooms
      }
    };

    socketInstance.on('connect', () => {
      setIsConnected(true);
      joinRooms();
    });

    socketInstance.io.on('reconnect', () => {
      joinRooms();
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
    });

    // Targeted live updates — no full-page refresh
    socketInstance.on('new_order', (payload: OrderSocketPayload) => {
      clearOrdersListCache();
      dispatchOrdersChanged({ ...payload, action: 'new' });
      dispatchRefreshNotifications();
      const role = userRoleRef.current;
      if (role === 'pos' || role === 'cashier') {
        playOrderReadyChime();
      }
    });

    socketInstance.on('order_update', (payload: OrderSocketPayload) => {
      clearOrdersListCache();
      dispatchOrdersChanged({ ...payload, action: 'update' });
    });

    socketInstance.on('order_ready', (payload: OrderSocketPayload) => {
      clearOrdersListCache();
      const role = userRoleRef.current;
      const orderType = payload.orderType?.toLowerCase();
      const isDineIn = orderType === 'dine-in' || Boolean(payload.table);
      if (role === 'waiter' && isDineIn) {
        playOrderReadyChime();
      }
      if (role === 'pos' && (orderType === 'takeaway' || orderType === 'delivery' || (!isDineIn && !orderType))) {
        playOrderReadyChime();
      }
      dispatchOrdersChanged({ ...payload, action: 'ready', status: 'ready' });
      dispatchRefreshNotifications();
    });

    socketInstance.on('notification', () => {
      dispatchRefreshNotifications();
    });

    socketInstance.on('menu_changed', () => {
      menuItemApi.clearPosMenuCache();
      categoryApi.clearCategoryCache();
      dispatchMenuChanged();
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
