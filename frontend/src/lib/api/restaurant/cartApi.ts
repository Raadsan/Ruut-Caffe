import api from '../axios';
import { orderApi } from './orderApi';

export interface CartItem {
  id: string;
  menuItemId: string;
  quantity: number;
  unitPrice: number;
  menuItem?: {
    id: string;
    name: string;
    price: number;
    imageUrl?: string;
    isComposite?: boolean;
  };
}

export interface Cart {
  id: string;
  tableId: string;
  items: CartItem[];
  totalAmount: number;
  createdAt?: string;
}

export interface AddToCartPayload {
  cartId: string;
  menuItemId: string;
  quantity: number;
}

export interface CheckoutPayload {
  cartId: string;
  notes?: string;
}

export const cartApi = {
  /** Get or create cart for a table (PUBLIC). */
  getOrCreateCart: async (tableId: string): Promise<Cart> => {
    const res = await api.get(`/cart/table/${tableId}`);
    return res.data.data;
  },

  /** Add a menu item to cart (PUBLIC). */
  addToCart: async (payload: AddToCartPayload): Promise<Cart> => {
    const res = await api.post('/cart/add', payload);
    return res.data.data;
  },

  /** Fetch a cart by ID (PUBLIC). */
  getCart: async (id: string): Promise<Cart> => {
    const res = await api.get(`/cart/${id}`);
    return res.data.data;
  },

  /** Remove one item from cart (PUBLIC). */
  removeCartItem: async (itemId: string): Promise<Cart> => {
    const res = await api.delete(`/cart/item/${itemId}`);
    return res.data.data;
  },

  /** Clear all items in a cart (PUBLIC). */
  clearCart: async (cartId: string): Promise<Cart> => {
    const res = await api.delete(`/cart/${cartId}/clear`);
    return res.data.data;
  },

  /** Checkout: converts cart into an order (PUBLIC). */
  checkoutCart: async (payload: CheckoutPayload): Promise<{ orderId: number }> => {
    const res = await api.post('/cart/checkout', payload);
    return {
      orderId: res.data.data?.orderId ?? res.data.data?.order?.id,
    };
  },
};
