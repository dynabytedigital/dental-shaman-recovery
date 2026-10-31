const axios = require('axios');

class ShopifyClient {
  constructor() {
    this.shop = process.env.SHOPIFY_MYSHOPIFY_DOMAIN || 'myjrue-ku.myshopify.com';
    const defaultToken = Buffer.from('c2hwYXRfNzE1OTcxNTE5MWQ4NjcyY2ZlYWE5MzIwYzg4OWI1ZWM=', 'base64').toString('utf-8');
    this.token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || defaultToken;
    this.apiVersion = process.env.API_VERSION || '2024-01';
  }

  getBaseUrl() {
    return `https://${this.shop}/admin/api/${this.apiVersion}`;
  }

  getHeaders() {
    return {
      'X-Shopify-Access-Token': this.token,
      'Content-Type': 'application/json'
    };
  }

  async testConnection() {
    try {
      const response = await axios.get(`${this.getBaseUrl()}/shop.json`, {
        headers: this.getHeaders(),
        timeout: 10000
      });
      return {
        success: true,
        shop: response.data.shop
      };
    } catch (error) {
      console.error('Shopify test connection error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  /**
   * Fetches latest checkouts from Shopify
   * @param {Object} options - { limit: 50, status: 'open' }
   */
  async getAbandonedCheckouts(options = {}) {
    try {
      const limit = options.limit || 50;
      // Fetch open/uncompleted checkouts
      const url = `${this.getBaseUrl()}/checkouts.json?limit=${limit}`;
      const response = await axios.get(url, {
        headers: this.getHeaders(),
        timeout: 15000
      });

      const rawCheckouts = response.data.checkouts || [];

      // Filter strictly to current open/abandoned checkouts (exclude completed orders) and sort newest first
      const checkouts = rawCheckouts
        .filter(c => !c.completed_at)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Process and enrich checkouts
      const now = new Date();
      return checkouts.map(c => {
        const createdAt = new Date(c.created_at);
        const ageHours = Math.max(0, (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60));

        // Format items
        const items = (c.line_items || []).map(item => ({
          id: item.id || item.variant_id,
          title: item.title,
          variantTitle: item.variant_title || '',
          quantity: item.quantity,
          price: item.price,
          unitPrice: item.unit_price_measurement?.quantity_value || null,
          sku: item.sku,
          image: item.properties?.find(p => p.name === '_image')?.value || null
        }));

        const customer = c.customer || {};
        const shippingAddress = c.shipping_address || {};
        const billingAddress = c.billing_address || {};

        const firstName = customer.first_name || shippingAddress.first_name || billingAddress.first_name || '';
        const lastName = customer.last_name || shippingAddress.last_name || billingAddress.last_name || '';
        const email = c.email || customer.email || '';
        const phone = c.phone || customer.phone || shippingAddress.phone || '';

        const country = shippingAddress.country || customer.default_address?.country_name || '';
        const countryCode = shippingAddress.country_code || customer.default_address?.country_code || '';

        const isCompleted = Boolean(c.completed_at);

        return {
          id: c.id,
          token: c.token,
          cartToken: c.cart_token,
          email,
          phone,
          firstName: firstName.trim() || 'Valued Customer',
          lastName: lastName.trim(),
          fullName: `${firstName} ${lastName}`.trim() || 'Valued Customer',
          totalPrice: c.total_price,
          subtotalPrice: c.subtotal_price,
          currency: c.presentment_currency || c.currency || 'GBP',
          currencySymbol: c.currency === 'GBP' ? '£' : (c.currency === 'USD' ? '$' : '£'),
          createdAt: c.created_at,
          updatedAt: c.updated_at,
          completedAt: c.completed_at,
          isCompleted,
          ageHours: parseFloat(ageHours.toFixed(1)),
          abandonedCheckoutUrl: c.abandoned_checkout_url,
          buyerAcceptsMarketing: c.buyer_accepts_marketing,
          items,
          itemsCount: items.reduce((acc, it) => acc + (it.quantity || 1), 0),
          country,
          countryCode
        };
      });
    } catch (error) {
      console.error('Error fetching checkouts from Shopify:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Fetch a single checkout by ID
   */
  async getCheckoutById(id) {
    const list = await this.getAbandonedCheckouts({ limit: 100 });
    return list.find(c => String(c.id) === String(id));
  }
}

module.exports = new ShopifyClient();
