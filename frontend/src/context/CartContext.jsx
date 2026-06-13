import React, { createContext, useState, useEffect, useContext } from 'react';
import { useApp } from './AppContext';

const CartContext = createContext();

export function getOptionPrice(optionString, basePrice) {
  if (!optionString) return basePrice;
  const priceRegex = /\(\s*[+-]?\s*\$?\s*([0-9.]+)\s*\$?_?\)/;
  const match = optionString.match(priceRegex);
  if (match) {
    const val = parseFloat(match[1]);
    const relativeMatch = optionString.match(/\(\s*([+-])\s*\$?\s*([0-9.]+)\s*\$?_?\)/);
    if (relativeMatch) {
      const sign = relativeMatch[1];
      const offset = parseFloat(relativeMatch[2]);
      return sign === '-' ? (basePrice - offset) : (basePrice + offset);
    }
    return val;
  }
  return basePrice;
}

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

  const addToCart = (product, quantity = 1, selectedColor = null, selectedSize = null) => {
    setCartItems((prevItems) => {
      const existingItem = prevItems.find((item) => 
        item.product.id === product.id && 
        item.selectedColor === selectedColor && 
        item.selectedSize === selectedSize
      );
      if (existingItem) {
        // Ensure quantity doesn't exceed stock
        const newQty = Math.min(existingItem.quantity + quantity, product.stock);
        return prevItems.map((item) =>
          (item.product.id === product.id && 
           item.selectedColor === selectedColor && 
           item.selectedSize === selectedSize) 
            ? { ...item, quantity: newQty } 
            : item
        );
      }
      return [...prevItems, { 
        product, 
        quantity: Math.min(quantity, product.stock), 
        selectedColor, 
        selectedSize 
      }];
    });
  };

  const removeFromCart = (productId, selectedColor = null, selectedSize = null) => {
    setCartItems((prevItems) => 
      prevItems.filter((item) => 
        !(item.product.id === productId && 
          item.selectedColor === selectedColor && 
          item.selectedSize === selectedSize)
      )
    );
  };

  const updateQuantity = (productId, quantity, selectedColor = null, selectedSize = null) => {
    if (quantity <= 0) {
      removeFromCart(productId, selectedColor, selectedSize);
      return;
    }
    setCartItems((prevItems) =>
      prevItems.map((item) =>
        (item.product.id === productId && 
         item.selectedColor === selectedColor && 
         item.selectedSize === selectedSize) 
          ? { ...item, quantity: Math.min(quantity, item.product.stock) } 
          : item
      )
    );
  };

  const clearCart = () => {
    setCartItems([]);
  };

  // Subtotal in USD
  const subtotal = cartItems.reduce((sum, item) => {
    const itemPrice = getOptionPrice(item.selectedSize, item.product.price_usd);
    return sum + itemPrice * item.quantity;
  }, 0);

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
