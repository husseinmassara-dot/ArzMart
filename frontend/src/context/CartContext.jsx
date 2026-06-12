import React, { createContext, useState, useEffect, useContext } from 'react';
import { useApp } from './AppContext';

const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const { settings } = useApp();
  const [cartItems, setCartItems] = useState(() => {
    const localData = localStorage.getItem('cart');
    return localData ? JSON.parse(localData) : [];
  });
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cartItems));
  }, [cartItems]);

  const addToCart = (product, quantity = 1) => {
    setCartItems((prevItems) => {
      const existingItem = prevItems.find((item) => item.product.id === product.id);
      if (existingItem) {
        // Ensure quantity doesn't exceed stock
        const newQty = Math.min(existingItem.quantity + quantity, product.stock);
        return prevItems.map((item) =>
          item.product.id === product.id ? { ...item, quantity: newQty } : item
        );
      }
      return [...prevItems, { product, quantity: Math.min(quantity, product.stock) }];
    });
  };

  const removeFromCart = (productId) => {
    setCartItems((prevItems) => prevItems.filter((item) => item.product.id !== productId));
  };

  const updateQuantity = (productId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCartItems((prevItems) =>
      prevItems.map((item) =>
        item.product.id === productId ? { ...item, quantity: Math.min(quantity, item.product.stock) } : item
      )
    );
  };

  const clearCart = () => {
    setCartItems([]);
  };

  // Subtotal in USD
  const subtotal = cartItems.reduce((sum, item) => sum + item.product.price_usd * item.quantity, 0);

  // Delivery calculations
  const freeThreshold = settings ? settings.free_delivery_threshold : 50;
  const baseDeliveryFee = settings ? settings.delivery_fee : 4;
  const deliveryFee = subtotal >= freeThreshold || subtotal === 0 ? 0 : baseDeliveryFee;

  const total = subtotal + deliveryFee;

  return (
    <CartContext.Provider value={{
      cartItems,
      isCartOpen,
      setIsCartOpen,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      subtotal,
      deliveryFee,
      total
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
export default CartContext;
