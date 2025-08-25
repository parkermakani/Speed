import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";
import type { MerchItem } from "../services/api";

export interface CartItem {
  id: string;
  name: string;
  price: string;
  imageUrl: string;
  quantity: number;
}

type CartState = {
  items: CartItem[];
};

type CartAction =
  | { type: "ADD_ITEM"; item: Omit<CartItem, "quantity">; quantity?: number }
  | { type: "REMOVE_ITEM"; id: string }
  | { type: "SET_QUANTITY"; id: string; quantity: number }
  | { type: "CLEAR" };

const STORAGE_KEY = "speed_cart_v1";

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD_ITEM": {
      const qty = Math.max(1, action.quantity ?? 1);
      const existing = state.items.find((i) => i.id === action.item.id);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.id === action.item.id ? { ...i, quantity: i.quantity + qty } : i
          ),
        };
      }
      return { items: [...state.items, { ...action.item, quantity: qty }] };
    }
    case "REMOVE_ITEM": {
      return { items: state.items.filter((i) => i.id !== action.id) };
    }
    case "SET_QUANTITY": {
      if (action.quantity <= 0) {
        return { items: state.items.filter((i) => i.id !== action.id) };
      }
      return {
        items: state.items.map((i) =>
          i.id === action.id ? { ...i, quantity: action.quantity } : i
        ),
      };
    }
    case "CLEAR":
      return { items: [] };
    default:
      return state;
  }
}

type CartContextValue = {
  items: CartItem[];
  addItem: (
    item: Omit<CartItem, "quantity"> | MerchItem,
    quantity?: number
  ) => void;
  removeItem: (id: string) => void;
  setQuantity: (id: string, quantity: number) => void;
  clear: () => void;
  totalItems: number;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(cartReducer, undefined, () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CartState;
        if (parsed && Array.isArray(parsed.items)) return parsed;
      }
    } catch {}
    return { items: [] } as CartState;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  const value = useMemo<CartContextValue>(
    () => ({
      items: state.items,
      addItem: (item: any, quantity?: number) => {
        const base = {
          id: item.id,
          name: item.name,
          price: item.price,
          imageUrl: item.imageUrl,
        } as Omit<CartItem, "quantity">;
        dispatch({ type: "ADD_ITEM", item: base, quantity });
      },
      removeItem: (id: string) => dispatch({ type: "REMOVE_ITEM", id }),
      setQuantity: (id: string, quantity: number) =>
        dispatch({ type: "SET_QUANTITY", id, quantity }),
      clear: () => dispatch({ type: "CLEAR" }),
      totalItems: state.items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    [state]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
