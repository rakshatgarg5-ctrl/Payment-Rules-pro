export default {
  ssr: true,
  // Embedded Shopify admin posts actions from admin.shopify.com to the app URL.
  allowedActionOrigins: [
    "admin.shopify.com",
    "*.myshopify.com",
    "*.shopify.com",
    "*.trycloudflare.com",
    "*.ngrok-free.app",
    "*.ngrok.io",
    "*.railway.app",
    "payment-rules-pro-production.up.railway.app",
    "localhost",
  ],
}; 