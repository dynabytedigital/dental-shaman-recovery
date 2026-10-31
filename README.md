# The Dental Shaman - Abandoned Checkout Recovery Engine

Custom Shopify application engineered for The Dental Shaman (shop.thedentalshaman.com) providing an automated 5-stage cadence and manual dispatch interface.

---

## Architecture & Integration

- Store: shop.thedentalshaman.com (myjrue-ku.myshopify.com)
- UI System: Official Shopify Polaris Design System (App Bridge enabled)
- Backend: Node.js, Express, Nodemailer, REST Admin API
- Database: Embedded JSON persistence (database.js)

---

## 5-Stage Cadence

- Stage 1 (1–2 Hours): Cart Reservation Notice
- Stage 2 (24 Hours): Clinical Science Monograph (Dr. Marc Mortiboys, BDS)
- Stage 3 (48 Hours): Documented Patient Outcomes
- Stage 4 (72 Hours): Courtesy Privilege Incentive (HOLISTIC10 + Protocol Monograph)
- Stage 5 (5 Days / 120 Hours): Inventory Reallocation Notification

---

## Installation in Shopify Admin

To embed this application inside your Shopify Admin navigation:

1. Open Shopify Admin:
   Navigate to Settings > Apps and sales channels > Develop apps.
2. Select your custom application (The Dental Shaman App).
3. Under App Setup:
   - App URL: https://new-pugs-own.loca.lt
   - Allowed redirection URL(s): https://new-pugs-own.loca.lt/auth/callback
4. Save configuration.
5. The application will be embedded and accessible in the Shopify Admin sidebar under Apps.
