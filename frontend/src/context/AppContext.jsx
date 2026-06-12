import React, { createContext, useState, useEffect, useContext } from 'react';

const AppContext = createContext();

const translations = {
  ar: {
    appName: 'أرز مارت',
    home: 'الرئيسية',
    shop: 'المتجر',
    cart: 'سلة المشتريات',
    myOrders: 'طلباتي السابقة',
    dashboard: 'لوحة التحكم',
    go_to_store: 'الدخول إلى المتجر',
    login: 'تسجيل الدخول',
    register: 'إنشاء حساب جديد',
    logout: 'تسجيل الخروج',
    welcome: 'مرحباً بك في أرز مارت',
    search_placeholder: 'ابحث عن منتج...',
    filters: 'الفلاتر والتصنيفات',
    all_categories: 'كل التصنيفات',
    price_range: 'نطاق السعر',
    min_rating: 'التقييم الأدنى',
    rating_stars: 'نجوم وأكثر',
    no_products: 'لا يوجد منتجات تطابق البحث',
    product_details: 'تفاصيل المنتج',
    add_to_cart: 'إضافة إلى السلة',
    in_stock: 'متوفر في المخزون',
    out_of_stock: 'نفذ من المخزون',
    quantity: 'الكمية',
    subtotal: 'المجموع الفرعي',
    delivery: 'خدمة التوصيل',
    free: 'مجاني',
    free_delivery_hint: 'توصيل مجاني عند الشراء بقيمة أكثر من',
    total: 'المجموع الكلي',
    checkout: 'تأكيد الطلبية',
    checkout_title: 'تفاصيل التوصيل والدفع',
    phone: 'رقم الهاتف',
    address: 'العنوان بالتفصيل',
    payment_method: 'طريقة الدفع',
    cod: 'الدفع عند الاستلام (نقدي)',
    online: 'الدفع أونلاين (بطاقة ائتمان)',
    place_order: 'تأكيد وشراء',
    close: 'إغلاق',
    empty_cart: 'سلة المشتريات فارغة حالياً',
    username: 'اسم المستخدم',
    password: 'كلمة المرور',
    welcome_back: 'أهلاً بك مجدداً',
    create_account: 'سجل حسابك الآن للحصول على خصم ١٠٪',
    already_have_account: 'لديك حساب بالفعل؟ سجل دخولك',
    dont_have_account: 'ليس لديك حساب؟ أنشئ حساب جديد',
    order_success: 'تهانينا! تم تسجيل طلبيتك بنجاح.',
    tracking_number: 'رقم التتبع الخاص بك',
    status: 'الحالة',
    actions: 'الإجراءات',
    pending: 'قيد الانتظار',
    processing: 'قيد التحضير',
    shipped: 'تم الشحن',
    delivered: 'تم التسليم',
    track_order: 'تتبع طلبيتك',
    chat_admin: 'الدردشة مع الإدارة',
    chat_placeholder: 'اكتب رسالتك هنا...',
    admin_title: 'لوحة الإدارة الاحترافية',
    reports: 'التقارير المالية',
    daily_sales: 'المبيعات اليومية',
    monthly_sales: 'المبيعات الشهرية',
    profits: 'حساب الأرباح',
    inventory: 'المخزون',
    coupons: 'الكوبونات والخصومات',
    settings: 'الإعدادات العامة',
    employees: 'الموظفين والصلاحيات',
    users: 'المستخدمين',
    categories: 'التصنيفات',
    products: 'المنتجات',
    orders: 'الطلبيات',
    new_orders: 'الطلبيات الجديدة',
    delivered_orders: 'الطلبيات المسلمة',
    add_product: 'إضافة منتج جديد',
    add_category: 'إضافة تصنيف جديد',
    edit: 'تعديل',
    delete: 'حذف',
    save: 'حفظ والتحديث',
    banner_texts: 'الكتابة على البانرات الإعلانية',
    app_settings: 'إعدادات المتجر والشعار',
    exchange_rate_label: 'سعر الصرف (ليرة لبنانية مقابل الدولار)',
    currency: 'العملة',
    rate_product: 'تقييم هذا المنتج',
    submit: 'إرسال',
    print_invoice: 'طباعة الفاتورة',
    print_order_no_price: 'طباعة بدون سعر',
    print_report: 'طباعة التقرير',
    congrats_title: 'تهانينا الحارة! 🎉',
    congrats_desc: 'لقد حصلت على كود خصم بقيمة ١٠٪ على طلبيتك الأولى بمناسبة انضمامك إلينا.',
    congrats_code: 'رمز الخصم هو: WELCOME10',
    privacy_policy: 'سياسة الخصوصية'
  },
  en: {
    appName: 'Arz-Mart',
    home: 'Home',
    shop: 'Shop',
    cart: 'Shopping Cart',
    myOrders: 'Order History',
    dashboard: 'Dashboard',
    go_to_store: 'Go to Store',
    login: 'Login',
    register: 'Register',
    logout: 'Logout',
    welcome: 'Welcome to Arz-Mart',
    search_placeholder: 'Search products...',
    filters: 'Filters & Categories',
    all_categories: 'All Categories',
    price_range: 'Price Range',
    min_rating: 'Minimum Rating',
    rating_stars: 'Stars & Up',
    no_products: 'No products matches criteria',
    product_details: 'Product Details',
    add_to_cart: 'Add to Cart',
    in_stock: 'In Stock',
    out_of_stock: 'Out of Stock',
    quantity: 'Quantity',
    subtotal: 'Subtotal',
    delivery: 'Delivery service',
    free: 'Free',
    free_delivery_hint: 'Free delivery on orders above',
    total: 'Total',
    checkout: 'Checkout',
    checkout_title: 'Delivery & Payment Details',
    phone: 'Phone Number',
    address: 'Detailed Address',
    payment_method: 'Payment Method',
    cod: 'Cash on Delivery (COD)',
    online: 'Pay Online (Credit Card)',
    place_order: 'Place Order',
    close: 'Close',
    empty_cart: 'Your cart is currently empty',
    username: 'Username',
    password: 'Password',
    welcome_back: 'Welcome back',
    create_account: 'Register now to get 10% discount',
    already_have_account: 'Already have an account? Login',
    dont_have_account: 'Don\'t have an account? Sign up',
    order_success: 'Congratulations! Your order was successfully placed.',
    tracking_number: 'Your tracking number',
    status: 'Status',
    actions: 'Actions',
    pending: 'Pending',
    processing: 'Processing',
    shipped: 'Shipped',
    delivered: 'Delivered',
    track_order: 'Track your order',
    chat_admin: 'Chat with Admin',
    chat_placeholder: 'Type your message...',
    admin_title: 'Professional Admin Panel',
    reports: 'Financial Reports',
    daily_sales: 'Daily Sales',
    monthly_sales: 'Monthly Sales',
    profits: 'Profit Analysis',
    inventory: 'Inventory',
    coupons: 'Coupons & Discounts',
    settings: 'General Settings',
    employees: 'Employees & Permissions',
    users: 'Users',
    categories: 'Categories',
    products: 'Products',
    orders: 'Orders',
    new_orders: 'New Orders',
    delivered_orders: 'Delivered Orders',
    add_product: 'Add New Product',
    add_category: 'Add New Category',
    edit: 'Edit',
    delete: 'Delete',
    save: 'Save Changes',
    banner_texts: 'Edit Banner Writing',
    app_settings: 'App Name & Logo Settings',
    exchange_rate_label: 'Exchange Rate (LBP per 1 USD)',
    currency: 'Currency',
    rate_product: 'Rate this product',
    submit: 'Submit',
    print_invoice: 'Print Invoice',
    print_order_no_price: 'Print Without Price',
    print_report: 'Print Report',
    congrats_title: 'Congratulations! 🎉',
    congrats_desc: 'You received a 10% discount promo code for your first purchase as a welcome gift.',
    congrats_code: 'Discount Code: WELCOME10',
    privacy_policy: 'Privacy Policy'
  }
};

export const AppProvider = ({ children }) => {
  const [lang, setLang] = useState(localStorage.getItem('lang') || 'ar');
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [currency, setCurrency] = useState(localStorage.getItem('currency') || 'USD'); // 'USD' or 'LBP'
  const [settings, setSettings] = useState({
    app_name: 'Arz-Mart',
    logo_url: '',
    exchange_rate: 89500,
    free_delivery_threshold: 50,
    delivery_fee: 4,
    hero_banners: [],
    online_payment_enabled: 0
  });

  const apiHost = import.meta.env.VITE_API_URL || (
    (window.location.hostname === 'localhost' || 
     window.location.hostname === '127.0.0.1' || 
     window.location.hostname.startsWith('192.168.'))
      ? `http://${window.location.hostname}:5000`
      : 'https://arz-mart.onrender.com'
  );

  const apiBase = `${apiHost}/api`;

  // Load store settings
  const fetchSettings = async () => {
    try {
      const res = await fetch(`${apiBase}/settings`);
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Update layout direction based on language
  useEffect(() => {
    const root = window.document.documentElement;
    if (lang === 'ar') {
      root.classList.add('rtl');
      root.classList.remove('ltr');
      root.dir = 'rtl';
    } else {
      root.classList.add('ltr');
      root.classList.remove('rtl');
      root.dir = 'ltr';
    }
    localStorage.setItem('lang', lang);
  }, [lang]);

  // Update theme class
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Toggle currency
  const toggleCurrency = (cur) => {
    setCurrency(cur);
    localStorage.setItem('currency', cur);
  };

  // Translation helper
  const t = (key) => {
    return translations[lang][key] || key;
  };

  // Format price helper
  const formatPrice = (priceInUsd) => {
    if (currency === 'USD') {
      return `$${priceInUsd.toFixed(2)}`;
    } else {
      const lbpVal = priceInUsd * settings.exchange_rate;
      return `${lbpVal.toLocaleString()} ل.ل.`;
    }
  };

  return (
    <AppContext.Provider value={{
      lang,
      setLang,
      theme,
      setTheme,
      currency,
      setCurrency,
      toggleCurrency,
      settings,
      setSettings,
      fetchSettings,
      t,
      formatPrice,
      apiBase,
      apiHost
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
export default AppContext;
