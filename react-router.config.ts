import type { Config } from "@react-router/dev/config";

export default {
  // Shopify app-proxy POSTs originate on the merchant's storefront domain
  // and are then securely forwarded to this app's host.
  allowedActionOrigins: [
    "admin.shopify.com",
    "*.myshopify.com",
    "performancebodykits.com",
    "www.performancebodykits.com",
    "performancebodykits.co.uk",
    "www.performancebodykits.co.uk",
  ],
} satisfies Config;
