/**
 * Shopify Client for Cloudflare Workers
 * Uses native fetch() for high-performance edge communication
 */

const PRODUCT_IMAGE_REGISTRY = {
  // Flossers by color
  'flosser:blue': 'https://cdn.shopify.com/s/files/1/0946/8238/2665/files/ozone-water-flosser-blue.png?v=1794725190',
  'flosser:black': 'https://cdn.shopify.com/s/files/1/0946/8238/2665/files/ozone-water-flosser-black.png?v=1794725981',
  'flosser:white': 'https://cdn.shopify.com/s/files/1/0946/8238/2665/files/ozone-water-flosser-white.png?v=1794726128',
  'flosser:default': 'https://cdn.shopify.com/s/files/1/0946/8238/2665/files/ozone-water-flosser-white.png?v=1794726128',

  // Flosser parts & accessories
  'parts:bundle': 'https://cdn.shopify.com/s/files/1/0946/8238/2665/files/Minimalistproductsetupwithclearaccessories.png?v=1780706035',
  'parts:reservoir': 'https://cdn.shopify.com/s/files/1/0946/8238/2665/files/WhatsAppImage2026-03-24at10.20.29.jpg?v=1774391789',
  'parts:tips': 'https://cdn.shopify.com/s/files/1/0946/8238/2665/files/WhatsAppImage2026-03-24at10.20.38.jpg?v=1774391547',

  // Oral care items & gifts
  'item:mouthwash_cup': 'https://cdn.shopify.com/s/files/1/0946/8238/2665/files/ozone-mouthwash-cup.jpg?v=1794736390',
  'item:ozomist': 'https://cdn.shopify.com/s/files/1/0946/8238/2665/files/ozomist-ozone-spray-bottle.png?v=1794743074',
  'item:toothpaste_recipes': 'https://cdn.shopify.com/s/files/1/0946/8238/2665/files/Toothpastemockup_2_fd9fefdc-c739-4422-a54c-5054b052694d.webp?v=1794461112',
  'item:mouthwash_recipes': 'https://cdn.shopify.com/s/files/1/0946/8238/2665/files/Mockup_1_3577f9ee-b2d2-4575-ae7b-335d4934762d.webp?v=1794400932',
  'item:smile_gate': 'https://cdn.shopify.com/s/files/1/0946/8238/2665/files/Smilegatecover.jpg?v=1791554216',
  'item:daily_rituals': 'https://cdn.shopify.com/s/files/1/0946/8238/2665/files/Mockup_4.jpg?v=1794400036',
  'item:tongue_scraper': 'https://cdn.shopify.com/s/files/1/0946/8238/2665/files/2851919949000.jpg?v=1769188443',
  'item:children_bundle': 'https://cdn.shopify.com/s/files/1/0946/8238/2665/files/childrens_dental_book_bundle.png?v=1762598625',
  'item:luna': 'https://cdn.shopify.com/s/files/1/0946/8238/2665/files/luna-and-the-breath-of-the-smile-spirit-children-bedtime-book-cover.jpg?v=1751408173',
  'item:mary_jamie': 'https://cdn.shopify.com/s/files/1/0946/8238/2665/files/Mary_Jamie_Go_To_The_Dental_Shaman_Book.png?v=1753389920',
  'item:misty_max': 'https://cdn.shopify.com/s/files/1/0946/8238/2665/files/Misty_Max_Discover_the_Ancestral_Smile.png?v=1762598949',
  'item:cavity_creatures': 'https://cdn.shopify.com/s/files/1/0946/8238/2665/files/the-cavity-creatures-and-the-crystal-tooth-shield-kids-with-glowing-guardian.png?v=1751408170',
  'item:self_confidence': 'https://cdn.shopify.com/s/files/1/0946/8238/2665/files/how-to-tap-in-to-unstoppable-self-confidence-illustration-woman-meditation.png?v=1751408165'
};

export class ShopifyClient {
  constructor(env) {
    this.shop = env.SHOPIFY_MYSHOPIFY_DOMAIN || 'myjrue-ku.myshopify.com';
    this.token = env.SHOPIFY_ADMIN_ACCESS_TOKEN || atob("c2hwYXRfNzE1OTcxNTE5MWQ4NjcyY2ZlYWE5MzIwYzg4OWI1ZWM=");
    this.apiVersion = '2024-01';
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

  resolveItemImage(item) {
    if (!item) return PRODUCT_IMAGE_REGISTRY['flosser:default'];

    if (item.image && typeof item.image === 'string' && item.image.startsWith('http') && !item.image.includes('placeholder')) {
      return item.image;
    }

    const rawTitle = (item.title || '').trim();
    const rawVariant = (item.variant_title || item.variantTitle || '').trim();
    const combined = `${rawTitle.toLowerCase()} ${rawVariant.toLowerCase()}`;

    // 1. Recipes and Ebooks
    if (combined.includes('toothpaste') || combined.includes('tooth paste')) {
      return PRODUCT_IMAGE_REGISTRY['item:toothpaste_recipes'];
    }
    if (combined.includes('mouthwash recipe') || combined.includes('mouth wash recipe') || (combined.includes('mouthwash') && combined.includes('recipe'))) {
      return PRODUCT_IMAGE_REGISTRY['item:mouthwash_recipes'];
    }
    if (combined.includes('smile gate')) {
      return PRODUCT_IMAGE_REGISTRY['item:smile_gate'];
    }
    if (combined.includes('daily dental rituals') || combined.includes('shaman’s guide') || combined.includes("shaman's guide") || (combined.includes('shaman') && combined.includes('ritual'))) {
      return PRODUCT_IMAGE_REGISTRY['item:daily_rituals'];
    }

    // 2. Parts and Accessories
    if (combined.includes('parts bundle') || (combined.includes('complete') && combined.includes('bundle') && combined.includes('part'))) {
      return PRODUCT_IMAGE_REGISTRY['parts:bundle'];
    }
    if (combined.includes('reservoir')) {
      return PRODUCT_IMAGE_REGISTRY['parts:reservoir'];
    }
    if (combined.includes('tip')) {
      return PRODUCT_IMAGE_REGISTRY['parts:tips'];
    }
    if (combined.includes('cup')) {
      return PRODUCT_IMAGE_REGISTRY['item:mouthwash_cup'];
    }
    if (combined.includes('misty') || combined.includes('max')) {
      return PRODUCT_IMAGE_REGISTRY['item:misty_max'];
    }
    if (combined.includes('ozomist') || /\bmist\b/i.test(combined)) {
      return PRODUCT_IMAGE_REGISTRY['item:ozomist'];
    }
    if (combined.includes('tongue scraper')) {
      return PRODUCT_IMAGE_REGISTRY['item:tongue_scraper'];
    }

    // 3. Water Flosser color resolution
    const isFlosser = (combined.includes('flosser') || combined.includes('irrigator') || combined.includes('starter kit')) && 
                      !combined.includes('recipe') && !combined.includes('guide') && !combined.includes('book');
    const isParts = combined.includes('reservoir') || combined.includes('tip') || combined.includes('parts bundle');

    if (isFlosser && !isParts) {
      if (combined.includes('blue')) return PRODUCT_IMAGE_REGISTRY['flosser:blue'];
      if (combined.includes('black')) return PRODUCT_IMAGE_REGISTRY['flosser:black'];
      if (combined.includes('white')) return PRODUCT_IMAGE_REGISTRY['flosser:white'];
      return PRODUCT_IMAGE_REGISTRY['flosser:default'];
    }

    // 4. Books and Story collections
    if (combined.includes('luna')) return PRODUCT_IMAGE_REGISTRY['item:luna'];
    if (combined.includes('mary') || combined.includes('jamie')) return PRODUCT_IMAGE_REGISTRY['item:mary_jamie'];
    if (combined.includes('cavity creatures') || combined.includes('crystal tooth')) return PRODUCT_IMAGE_REGISTRY['item:cavity_creatures'];
    if (combined.includes('confidence')) return PRODUCT_IMAGE_REGISTRY['item:self_confidence'];
    if (combined.includes('children') || combined.includes('story') || combined.includes('book')) return PRODUCT_IMAGE_REGISTRY['item:children_bundle'];

    // 5. Bundle color fallbacks
    if (combined.includes('blue')) return PRODUCT_IMAGE_REGISTRY['flosser:blue'];
    if (combined.includes('black')) return PRODUCT_IMAGE_REGISTRY['flosser:black'];
    if (combined.includes('white')) return PRODUCT_IMAGE_REGISTRY['flosser:white'];

    return PRODUCT_IMAGE_REGISTRY['flosser:default'];
  }

  parseRawCheckout(c) {
    if (!c) return null;
    const now = new Date();
    const createdAt = new Date(c.created_at || now);
    const ageHours = Math.max(0, (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60));

    const items = (c.line_items || []).map(item => ({
      id: item.id || item.variant_id,
      variantId: item.variant_id || item.id,
      productId: item.product_id || null,
      title: item.title,
      variantTitle: item.variant_title || '',
      quantity: item.quantity,
      price: item.price,
      sku: item.sku,
      image: this.resolveItemImage(item)
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

    let abandonedCheckoutUrl = c.abandoned_checkout_url;
    if (!abandonedCheckoutUrl && items.length > 0) {
      const parts = items
        .filter(it => it.variantId)
        .map(it => `${it.variantId}:${it.quantity || 1}`)
        .join(',');
      if (parts) {
        abandonedCheckoutUrl = `https://shop.thedentalshaman.com/cart/${parts}`;
      }
    }

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
      currencySymbol: (c.currency === 'USD' ? '$' : '£'),
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      completedAt: c.completed_at,
      isCompleted,
      ageHours: parseFloat(ageHours.toFixed(1)),
      abandonedCheckoutUrl,
      items,
      itemsCount: items.reduce((acc, it) => acc + (it.quantity || 1), 0),
      country,
      countryCode
    };
  }

  async getRecentCheckouts(sinceHours = 168, limit = 50) {
    const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();
    const url = `${this.getBaseUrl()}/checkouts.json?limit=${limit}&created_at_min=${encodeURIComponent(since)}`;
    const res = await fetch(url, { headers: this.getHeaders() });
    if (!res.ok) {
      throw new Error(`Shopify API error: ${res.status} ${await res.text()}`);
    }
    const data = await res.json();
    const checkouts = (data.checkouts || [])
      .filter(c => !c.completed_at)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return checkouts.map(c => this.parseRawCheckout(c)).filter(Boolean);
  }

  async getCheckoutById(id) {
    const checkouts = await this.getRecentCheckouts(336, 100);
    return checkouts.find(c => String(c.id) === String(id)) || null;
  }

  async getRecentOrders(sinceHours = 720) {
    const minDate = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();
    const url = `${this.getBaseUrl()}/orders.json?status=any&created_at_min=${encodeURIComponent(minDate)}&limit=250`;
    const res = await fetch(url, { headers: this.getHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    return data.orders || [];
  }
}
