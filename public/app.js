/* ========================================================
   THE DENTAL SHAMAN • CLINICAL RECOVERY DASHBOARD CLIENT
   Engineered for Ultra-Premium Responsiveness & Delivery
   ======================================================== */

let currentCheckouts = [];
let activeFilter = 'all';
let currentLogs = [];
let logActiveFilter = 'all';
let currentModalCheckout = null;
let currentSettings = null;
let currentUser = null;

// Helper: Authenticated Fetch
async function authFetch(url, options = {}) {
  const token = localStorage.getItem('shaman_auth_token');
  if (!token) {
    showAuthScreen();
    return null;
  }

  const headers = options.headers ? { ...options.headers } : {};
  headers['Authorization'] = `Bearer ${token}`;
  options.headers = headers;

  const res = await fetch(url, options);
  if (res.status === 401) {
    localStorage.removeItem('shaman_auth_token');
    currentUser = null;
    showAuthScreen();
    return null;
  }
  return res;
}

// Check Authentication Status on Startup
async function checkAuth() {
  const token = localStorage.getItem('shaman_auth_token');
  if (!token) {
    showAuthScreen();
    return;
  }

  try {
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.authenticated && data.user) {
        currentUser = data.user;
        showMainApp();
        return;
      }
    }
  } catch (e) {}

  localStorage.removeItem('shaman_auth_token');
  showAuthScreen();
}

function showAuthScreen() {
  const auth = document.getElementById('authScreen');
  const app = document.getElementById('mainApp');
  if (auth) auth.style.display = 'flex';
  if (app) app.style.display = 'none';
}

function showMainApp() {
  const auth = document.getElementById('authScreen');
  const app = document.getElementById('mainApp');
  if (auth) auth.style.display = 'none';
  if (app) app.style.display = 'block';

  if (currentUser) {
    const badge = document.getElementById('userProfileBadge');
    if (badge) badge.innerText = `${currentUser.name || 'Authorized Operator'}`;
  }

  loadStatus();
  loadCheckouts();
  loadSettings();
  loadLogs();
  loadTemplateEditor(1);
}

// Master Key Access Handler
async function handleGetIn(e) {
  e.preventDefault();
  const btn = document.getElementById('btnGetInSubmit');
  btn.disabled = true;
  btn.innerText = 'Verifying Key...';

  const accessKey = document.getElementById('accessKeyInput').value.trim();

  try {
    const res = await fetch('/api/auth/access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessKey })
    });
    const data = await res.json();
    if (data.success && data.token) {
      localStorage.setItem('shaman_auth_token', data.token);
      currentUser = data.user;
      showMainApp();
      showToast('Access granted to The Dental Shaman dashboard');
    } else {
      showToast(data.error || 'Invalid master access key', true);
    }
  } catch (err) {
    showToast('Verification failed: ' + err.message, true);
  } finally {
    btn.disabled = false;
    btn.innerText = 'Get In';
  }
}

async function handleLogout() {
  try {
    await authFetch('/api/auth/logout', { method: 'POST' });
  } catch (e) {}
  localStorage.removeItem('shaman_auth_token');
  currentUser = null;
  showAuthScreen();
  showToast('Session ended');
}

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  setInterval(() => {
    if (currentUser) loadStatus();
  }, 30000);
});

function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.className = isError ? 'Polaris-Toast error' : 'Polaris-Toast';
  toast.innerText = message;
  toast.style.display = 'block';
  setTimeout(() => {
    toast.style.display = 'none';
  }, 4500);
}

function switchTab(tabId) {
  document.querySelectorAll('.Polaris-Tab').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.Polaris-TabContent').forEach(content => content.classList.remove('active'));

  const activeBtn = Array.from(document.querySelectorAll('.Polaris-Tab')).find(b => b.getAttribute('onclick')?.includes(tabId));
  if (activeBtn) activeBtn.classList.add('active');

  const targetTab = document.getElementById(`tab-${tabId}`);
  if (targetTab) targetTab.classList.add('active');

  if (tabId === 'checkouts') loadCheckouts();
  if (tabId === 'flow') {
    if (!currentSettings) loadSettings();
    else renderCadenceEditor();
  }
  if (tabId === 'logs') loadLogs();
  if (tabId === 'settings') loadSettings();
}

/* ========================================================
   STATUS & METRICS
   ======================================================== */
async function loadStatus() {
  try {
    const res = await authFetch('/api/status');
    if (!res) return;
    const data = await res.json();

    const subtext = document.getElementById('storeStatusSubtext');
    if (subtext) {
      if (data.connected) {
        subtext.innerHTML = `Connected: ${data.shop.name} (${data.shop.domain}) &bull; Currency: ${data.shop.currency || 'GBP'}`;
      } else {
        subtext.innerHTML = `<span style="color: var(--color-danger-text);">Connection pending: Verify API credentials.</span>`;
      }
    }

    const pulse = document.getElementById('headerPulseDot');
    const badge = document.getElementById('automationBadge');
    const toggleBtn = document.getElementById('btnToggleAutomation');

    if (data.automation && data.automation.active) {
      if (pulse) pulse.className = 'pulse-dot live';
      if (badge) {
        badge.className = 'status-pill sent';
        badge.innerHTML = `<span class="dot"></span> Active (${data.automation.scanIntervalMinutes}m cadence)`;
      }
      if (toggleBtn) {
        toggleBtn.className = 'Polaris-Button Polaris-Button--slim';
        toggleBtn.innerText = 'Pause Automation';
      }
    } else {
      if (pulse) pulse.className = 'pulse-dot standby';
      if (badge) {
        badge.className = 'status-pill pending';
        badge.innerHTML = `<span class="dot"></span> Engine Standby`;
      }
      if (toggleBtn) {
        toggleBtn.className = 'Polaris-Button Polaris-Button--primary Polaris-Button--slim';
        toggleBtn.innerText = 'Enable Automation';
      }
    }

    if (data.metrics) {
      const uncompleted = document.getElementById('metricUncompletedCount');
      const pipeline = document.getElementById('metricRecoverableTotal');
      const total = document.getElementById('metricTotalCheckouts');
      const sent = document.getElementById('metricEmailsSent');

      if (uncompleted) uncompleted.innerText = data.metrics.uncompletedCount;
      if (pipeline) pipeline.innerText = data.metrics.recoverableTotalFormatted;
      if (total) total.innerText = data.metrics.totalCheckoutsCount;
      if (sent) sent.innerText = data.metrics.totalEmailsSent;

      const tabCheckouts = document.getElementById('tabCheckoutsCount');
      if (tabCheckouts) tabCheckouts.innerText = data.metrics.uncompletedCount;
    }
  } catch (e) {
    console.error('Failed to load status:', e);
  }
}

/* ========================================================
   CHECKOUTS TABLE & FILTERING
   ======================================================== */
async function loadCheckouts() {
  const tbody = document.getElementById('checkoutsTableBody');
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 32px; color: var(--color-text-muted);">Fetching real checkouts from shop.thedentalshaman.com...</td></tr>`;
  }

  try {
    const res = await authFetch('/api/checkouts');
    if (!res) return;
    const data = await res.json();
    currentCheckouts = data.checkouts || [];
    renderCheckouts();

    const tabBadge = document.getElementById('tabCheckoutsCount');
    if (tabBadge) {
      const recoverableCount = currentCheckouts.filter(c => !c.isCompleted).length;
      tabBadge.innerText = recoverableCount;
    }
  } catch (e) {
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 24px; color: var(--color-danger-text);">Error loading checkouts: ${e.message}</td></tr>`;
    }
  }
}

function setFilter(filter, btn) {
  activeFilter = filter;
  document.querySelectorAll('.Polaris-FilterPills .Polaris-FilterPill').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderCheckouts();
}

function filterCheckouts() {
  renderCheckouts();
}

function getInitials(name) {
  if (!name || name === 'Valued Customer') return 'DS';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function cleanProductTitle(title) {
  if (!title) return 'Dental Shaman Oral Care';
  // Strip raw emojis from catalog line item names
  return title
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu, '')
    .trim();
}

function getStageBadge(c) {
  const nextStage = c.recommendedTemplateId || 1;
  const ageLabel = c.ageHours < 24 ? `${c.ageHours}h ago` : `${Math.round(c.ageHours / 24)}d ago`;

  if (c.sequence && c.sequence.active) {
    return `
      <span class="stage-pill s2">Stage ${nextStage} Queued</span>
      <div class="cell-subtext">Cart age: ${ageLabel}</div>
    `;
  }

  if (c.sentCount > 0) {
    return `
      <span class="stage-pill s${Math.min(5, c.sentCount)}">Stage ${c.sentCount} Sent</span>
      <div class="cell-subtext">Next: Stage ${nextStage} &bull; ${ageLabel}</div>
    `;
  }

  return `
    <span class="stage-pill s1">Ready: Stage 1</span>
    <div class="cell-subtext">Abandoned ${ageLabel}</div>
  `;
}

function updateFilterPillCounts() {
  const allCount = currentCheckouts.length;
  const actionCount = currentCheckouts.filter(c => !c.isCompleted && c.sentCount === 0 && !(c.sequence && c.sequence.active)).length;
  const seqCount = currentCheckouts.filter(c => c.sequence && c.sequence.active).length;
  const sentCount = currentCheckouts.filter(c => c.sentCount > 0).length;

  const elAll = document.getElementById('pillCountAll');
  const elAction = document.getElementById('pillCountAction');
  const elSeq = document.getElementById('pillCountSequence');
  const elSent = document.getElementById('pillCountSent');

  if (elAll) elAll.innerText = allCount;
  if (elAction) elAction.innerText = actionCount;
  if (elSeq) elSeq.innerText = seqCount;
  if (elSent) elSent.innerText = sentCount;
}

function renderCheckouts() {
  const tbody = document.getElementById('checkoutsTableBody');
  if (!tbody) return;

  updateFilterPillCounts();

  const searchInput = document.getElementById('searchInput');
  const search = searchInput ? searchInput.value.toLowerCase().trim() : '';

  let filtered = currentCheckouts.filter(c => {
    if (search) {
      const matchName = c.fullName?.toLowerCase().includes(search);
      const matchEmail = c.email?.toLowerCase().includes(search);
      const matchItems = c.items?.some(it => it.title?.toLowerCase().includes(search));
      const matchId = String(c.id).includes(search);
      if (!matchName && !matchEmail && !matchItems && !matchId) return false;
    }

    if (activeFilter === 'pending_email') return !c.isCompleted && c.sentCount === 0 && !(c.sequence && c.sequence.active);
    if (activeFilter === 'sequence_active') return Boolean(c.sequence && c.sequence.active);
    if (activeFilter === 'notice_sent') return c.sentCount > 0;
    if (activeFilter === 'recoverable') return !c.isCompleted;
    if (activeFilter === 'converted') return c.isCompleted;

    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 42px; color: var(--color-text-muted);">No matching abandoned checkouts found for this filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(c => {
    const initials = getInitials(c.fullName);
    const countryPill = c.countryCode ? `<span class="country-pill">${c.countryCode}</span>` : '';

    const allItems = c.items || [];
    const visibleItems = allItems.slice(0, 2);
    const extraCount = Math.max(0, allItems.length - 2);
    const fullItemsTooltip = allItems.map(it => `${it.quantity}x ${cleanProductTitle(it.title)}`).join(' • ');

    const itemsChips = visibleItems.map(it => {
      const cleanTitle = cleanProductTitle(it.title);
      const isTruncatable = cleanTitle.length > 34;
      return `
        <div class="cart-item-chip ${isTruncatable ? 'is-expandable' : ''}" onclick="toggleExpandItem(this, event)" title="Click to expand/collapse full item name">
          <span class="qty-tag">${it.quantity}x</span>
          <span class="cart-item-title-text">${cleanTitle}</span>
        </div>
      `;
    }).join('');

    const moreItemsBadge = extraCount > 0
      ? `<div class="extra-cart-items-list" id="extraItems_${c.id}" style="display: none;">
           ${allItems.slice(2).map(it => {
             const cleanTitle = cleanProductTitle(it.title);
             const isTruncatable = cleanTitle.length > 34;
             return `
               <div class="cart-item-chip ${isTruncatable ? 'is-expandable' : ''}" onclick="toggleExpandItem(this, event)" title="Click to expand/collapse full item name">
                 <span class="qty-tag">${it.quantity}x</span>
                 <span class="cart-item-title-text">${cleanTitle}</span>
               </div>
             `;
           }).join('')}
         </div>
         <button type="button" class="more-items-toggle" onclick="toggleExtraCartItems(this, '${c.id}', event)" data-more-text="+${extraCount} more item${extraCount > 1 ? 's' : ''}">
           <span class="more-items-toggle-label">+${extraCount} more item${extraCount > 1 ? 's' : ''}</span>
           <svg class="more-items-chevron" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="6 9 12 15 18 9"></polyline></svg>
         </button>`
      : '';

    const isSeqActive = Boolean(c.sequence && c.sequence.active);
    let statusBadge = '';
    if (isSeqActive) {
      statusBadge = `<span class="status-pill sent"><span class="dot"></span> Sequence Active (${c.sentCount}/5)</span>`;
    } else if (c.sentCount > 0) {
      statusBadge = `<span class="status-pill sent"><span class="dot"></span> Notice Sent (${c.sentCount}/5)</span>`;
    } else {
      statusBadge = `<span class="status-pill pending"><span class="dot"></span> Action Required</span>`;
    }

    const priceFormatted = `${c.currencySymbol || '£'}${parseFloat(c.totalPrice || 0).toFixed(2)}`;
    const dateFormatted = new Date(c.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    const sequenceActionBtn = isSeqActive
      ? `<button class="btn-seq-stop" onclick="stopCustomerSequence('${c.id}', this)" title="Pause automated sequence for this customer">
           <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
           Pause Sequence
         </button>`
      : `<button class="btn-seq-start" onclick="startCustomerSequence('${c.id}', this)" ${!c.email ? 'disabled' : ''} title="Start sequence immediately and send Stage 1 now">
           <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>
           Start Sequence
         </button>`;

    return `
      <tr class="checkout-pro-row ${isSeqActive ? 'row-seq-active' : ''}">
        <td class="col-customer">
          <div class="customer-cell">
            <div class="avatar-initials">${initials}</div>
            <div class="customer-meta">
              <div class="customer-name">${c.fullName} ${countryPill}</div>
              <div class="customer-email" title="${c.email || ''}">${c.email || '<em>No email captured</em>'}</div>
              ${c.phone ? `<div class="customer-phone">${c.phone}</div>` : ''}
            </div>
          </div>
        </td>
        <td class="col-items">
          <div class="cart-items-wrapper">
            ${itemsChips || '<em>Empty Cart</em>'}
            ${moreItemsBadge}
          </div>
        </td>
        <td class="col-value">
          <div class="price-primary">${priceFormatted}</div>
          <div class="cell-subtext">${c.currency || 'GBP'} &bull; ${allItems.length} item${allItems.length === 1 ? '' : 's'}</div>
        </td>
        <td class="col-stage">
          ${getStageBadge(c)}
          <div class="cell-subtext">${dateFormatted}</div>
        </td>
        <td class="col-status">
          ${statusBadge}
        </td>
        <td class="col-action">
          <div class="row-action-group">
            ${sequenceActionBtn}
            <button class="action-review-btn" onclick="openReviewModal('${c.id}')" ${!c.email ? 'disabled' : ''} title="Preview & customize recovery email">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              Preview
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function startCustomerSequence(checkoutId, btnEl) {
  const checkout = currentCheckouts.find(c => String(c.id) === String(checkoutId));
  if (!checkout) return;

  if (!confirm(`Start the 5-stage recovery sequence for ${checkout.fullName} (${checkout.email})?\n\nStage 1 will be sent immediately, and Stages 2–5 will follow your scheduled timing.`)) {
    return;
  }

  if (btnEl) {
    btnEl.disabled = true;
    btnEl.innerText = 'Starting...';
  }

  try {
    const res = await authFetch(`/api/checkouts/${checkoutId}/start-sequence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Sequence started for ${checkout.fullName} — Stage ${data.immediateStageSent || 1} sent immediately`);
      await loadCheckouts();
      loadLogs();
      loadStatus();
    } else {
      showToast(`Could not start sequence: ${data.error}`, true);
      if (btnEl) {
        btnEl.disabled = false;
        btnEl.innerText = 'Start Sequence';
      }
    }
  } catch (e) {
    showToast(`Error: ${e.message}`, true);
    if (btnEl) {
      btnEl.disabled = false;
      btnEl.innerText = 'Start Sequence';
    }
  }
}

async function stopCustomerSequence(checkoutId, btnEl) {
  const checkout = currentCheckouts.find(c => String(c.id) === String(checkoutId));
  if (btnEl) {
    btnEl.disabled = true;
    btnEl.innerText = 'Pausing...';
  }

  try {
    const res = await authFetch(`/api/checkouts/${checkoutId}/stop-sequence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Sequence paused for ${checkout ? checkout.fullName : 'customer'}`);
      await loadCheckouts();
      loadStatus();
    } else {
      showToast(`Could not pause sequence: ${data.error}`, true);
    }
  } catch (e) {
    showToast(`Error: ${e.message}`, true);
  }
}

/* ========================================================
   MODAL: REVIEW & SEND
   ======================================================== */
async function openReviewModal(checkoutId) {
  const checkout = currentCheckouts.find(c => String(c.id) === String(checkoutId));
  if (!checkout) return;

  currentModalCheckout = checkout;

  // Populate Avatar & Customer Profile
  const initialsEl = document.getElementById('modalCustomerInitials');
  if (initialsEl) initialsEl.innerText = getInitials(checkout.fullName);

  document.getElementById('modalCustomerName').innerText = checkout.fullName || 'Valued Customer';
  document.getElementById('modalCustomerEmail').innerText = checkout.email || 'No email address';

  const countryEl = document.getElementById('modalCustomerCountry');
  if (countryEl) {
    if (checkout.countryCode) {
      countryEl.innerText = checkout.countryCode;
      countryEl.style.display = 'inline-block';
    } else {
      countryEl.style.display = 'none';
    }
  }

  const phoneEl = document.getElementById('modalCustomerPhone');
  if (phoneEl) {
    if (checkout.phone) {
      phoneEl.innerText = checkout.phone;
      phoneEl.style.display = 'inline-flex';
    } else {
      phoneEl.style.display = 'none';
    }
  }

  // Populate Status Badge in Modal Header
  const statusBadgeEl = document.getElementById('modalCustomerStatusBadge');
  const isSeqActive = Boolean(checkout.sequence && checkout.sequence.active);
  if (statusBadgeEl) {
    if (isSeqActive) {
      statusBadgeEl.className = 'status-pill sent';
      statusBadgeEl.innerHTML = `<span class="dot"></span> Sequence Active (${checkout.sentCount || 0}/5)`;
    } else if (checkout.sentCount > 0) {
      statusBadgeEl.className = 'status-pill sent';
      statusBadgeEl.innerHTML = `<span class="dot"></span> Notice Sent (${checkout.sentCount}/5)`;
    } else {
      statusBadgeEl.className = 'status-pill pending';
      statusBadgeEl.innerHTML = `<span class="dot"></span> Action Required`;
    }
  }

  // Update Modal Sequence Button
  const seqBtn = document.getElementById('btnStartSeqFromModal');
  if (seqBtn) {
    if (isSeqActive) {
      seqBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
        Pause Customer Sequence
      `;
    } else {
      seqBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>
        Start Full 5-Stage Sequence
      `;
    }
  }

  // Populate Cart Value & Age Meta
  const symbol = checkout.currencySymbol || '£';
  document.getElementById('modalCartTotal').innerText = `${symbol}${parseFloat(checkout.totalPrice || 0).toFixed(2)} ${checkout.currency || 'GBP'}`;
  const ageFormatted = checkout.ageHours < 24
    ? `Abandoned ${checkout.ageHours} hours ago`
    : `Abandoned ${Math.round(checkout.ageHours / 24)} days ago (${new Date(checkout.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })})`;
  document.getElementById('modalCartAge').innerText = ageFormatted;

  // Populate Structured Line Items Grid
  const items = checkout.items || [];
  const totalQty = items.reduce((sum, it) => sum + Number(it.quantity || 1), 0);
  const countBadge = document.getElementById('modalCartItemsCountBadge');
  if (countBadge) {
    countBadge.innerText = `${items.length} line item${items.length === 1 ? '' : 's'} (${totalQty} total qty)`;
  }

  const summaryGrid = document.getElementById('modalCartSummary');
  if (summaryGrid) {
    if (items.length === 0) {
      summaryGrid.innerHTML = `<div style="font-size: 12px; color: var(--color-text-muted);">No line items recorded in cart.</div>`;
    } else {
      summaryGrid.innerHTML = items.map(it => {
        const cleanTitle = cleanProductTitle(it.title);
        const itemPrice = parseFloat(it.price || 0);
        const priceTag = itemPrice > 0 ? `${symbol}${itemPrice.toFixed(2)}` : 'Complimentary';
        return `
          <div class="modal-line-item-pill" onclick="toggleExpandModalItem(this)" title="Click to expand/collapse full product name">
            <div class="modal-line-item-left">
              <span class="qty-tag">${it.quantity}x</span>
              <span class="modal-line-item-title">${cleanTitle}</span>
            </div>
            <div class="modal-line-item-right">
              <span class="modal-line-item-price ${itemPrice === 0 ? 'free' : ''}">${priceTag}</span>
              <svg class="item-expand-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  const select = document.getElementById('modalTemplateSelect');
  select.value = checkout.recommendedTemplateId || 1;

  await updateModalPreview();

  const modal = document.getElementById('reviewModal');
  modal.classList.add('active');
}

async function startSequenceFromModal() {
  if (!currentModalCheckout) return;
  const isSeqActive = Boolean(currentModalCheckout.sequence && currentModalCheckout.sequence.active);
  const checkoutId = currentModalCheckout.id;
  closeModal();
  if (isSeqActive) {
    await stopCustomerSequence(checkoutId);
  } else {
    await startCustomerSequence(checkoutId);
  }
}

function closeModal() {
  const modal = document.getElementById('reviewModal');
  modal.classList.remove('active');
  currentModalCheckout = null;
}

function toggleExpandModalItem(pillEl) {
  if (!pillEl) return;
  pillEl.classList.toggle('expanded');
}

function toggleExpandItem(chipEl, event) {
  if (event) event.stopPropagation();
  if (!chipEl) return;
  chipEl.classList.toggle('expanded');
}

function toggleExtraCartItems(btnEl, checkoutId, event) {
  if (event) event.stopPropagation();
  const container = document.getElementById(`extraItems_${checkoutId}`);
  if (!container) return;
  const isExpanding = container.style.display === 'none';
  container.style.display = isExpanding ? 'flex' : 'none';

  // When expanding the extra items list, also expand all truncated item titles in this cell so nothing is cut off
  const wrapper = btnEl.closest('.cart-items-wrapper');
  if (wrapper) {
    wrapper.querySelectorAll('.cart-item-chip').forEach(chip => {
      chip.classList.toggle('expanded', isExpanding);
    });
  }

  if (btnEl) {
    const labelEl = btnEl.querySelector('.more-items-toggle-label');
    const moreText = btnEl.getAttribute('data-more-text') || '+More items';
    if (labelEl) {
      labelEl.innerText = isExpanding ? 'Show less' : moreText;
    }
    btnEl.classList.toggle('expanded', isExpanding);
  }
}

async function updateModalPreview() {
  if (!currentModalCheckout) return;
  const templateId = document.getElementById('modalTemplateSelect').value;

  try {
    const res = await authFetch(`/api/checkouts/${currentModalCheckout.id}/preview?templateId=${templateId}`);
    if (!res || !res.ok) {
      console.error('Error fetching preview:', res ? res.status : 'No response');
      return;
    }
    const data = await res.json();

    document.getElementById('modalSubjectInput').value = data.subject || '';
    const iframe = document.getElementById('modalPreviewIframe');
    if (iframe) {
      iframe.srcdoc = data.html || '';
    }
  } catch (e) {
    console.error('Error previewing modal:', e);
  }
}

function updateModalPreviewSubject() {
  // Real-time subject edits in review modal
}

async function sendModalEmail() {
  if (!currentModalCheckout) return;

  const btn = document.getElementById('btnSendModalEmail');
  btn.disabled = true;
  btn.innerText = 'Dispatching Notice...';

  const templateId = document.getElementById('modalTemplateSelect').value;
  const customSubject = document.getElementById('modalSubjectInput').value;

  try {
    const res = await authFetch(`/api/checkouts/${currentModalCheckout.id}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId, customSubject })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Recovery notice successfully sent to ${currentModalCheckout.email}`);
      closeModal();
      loadCheckouts();
      loadLogs();
      loadStatus();
    } else {
      showToast(`Dispatch failed: ${data.error}`, true);
    }
  } catch (e) {
    showToast(`Failed: ${e.message}`, true);
  } finally {
    btn.disabled = false;
    btn.innerText = 'Send Recovery Email Now';
  }
}

/* ========================================================
   TEMPLATE EDITOR & RESPONSIVE DEVICE VIEWPORTS
   ======================================================== */
function openPreviewForTemplate(templateId) {
  switchTab('templates');
  const sel = document.getElementById('templateSelectorDropdown');
  if (sel) sel.value = templateId;
  loadTemplateEditor(templateId);
}

async function loadTemplateEditor(templateId) {
  try {
    const res = await authFetch(`/api/templates/${templateId}`);
    if (!res) return;
    const data = await res.json();

    const subjectInput = document.getElementById('tplSubjectInput');
    const htmlTextarea = document.getElementById('tplHtmlTextarea');
    const iframe = document.getElementById('templateLivePreviewIframe');

    if (subjectInput) subjectInput.value = data.config?.subject || '';
    if (htmlTextarea) htmlTextarea.value = data.html || '';
    if (iframe) iframe.srcdoc = data.html || '';
  } catch (e) {
    console.error('Error loading template editor:', e);
  }
}

document.addEventListener('input', (e) => {
  if (e.target && e.target.id === 'tplHtmlTextarea') {
    const iframe = document.getElementById('templateLivePreviewIframe');
    if (iframe) iframe.srcdoc = e.target.value;
  }
});

function switchPreviewDevice(device) {
  const frame = document.getElementById('previewViewportFrame');
  const btnDesktop = document.getElementById('btnPreviewDesktop');
  const btnMobile = document.getElementById('btnPreviewMobile');

  if (device === 'mobile') {
    frame.className = 'preview-viewport-frame mobile';
    btnMobile.classList.add('active');
    btnDesktop.classList.remove('active');
  } else {
    frame.className = 'preview-viewport-frame desktop';
    btnDesktop.classList.add('active');
    btnMobile.classList.remove('active');
  }
}

async function saveCurrentTemplate() {
  const templateId = document.getElementById('templateSelectorDropdown').value;
  const subject = document.getElementById('tplSubjectInput').value;
  const html = document.getElementById('tplHtmlTextarea').value;

  try {
    const res = await authFetch(`/api/templates/${templateId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, html })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Template (Stage ${templateId}) saved successfully`);
    } else {
      showToast('Save failed: ' + data.error, true);
    }
  } catch (e) {
    showToast('Error: ' + e.message, true);
  }
}

/* ========================================================
   ACTIVITY LOGS (SEARCH, FILTER, MODIFY, DELETE & RESEND)
   ======================================================== */
async function loadLogs() {
  const tbody = document.getElementById('logsTableBody');
  if (!tbody) return;

  try {
    const res = await authFetch('/api/logs');
    if (!res) return;
    const data = await res.json();
    currentLogs = data.logs || [];

    const tabBadge = document.getElementById('tabLogsCount');
    if (tabBadge) tabBadge.innerText = currentLogs.length;

    renderLogs();
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--color-danger-text);">Failed to load logs: ${e.message}</td></tr>`;
  }
}

function setLogFilter(filter, btn) {
  logActiveFilter = filter;
  document.querySelectorAll('#tab-logs .Polaris-FilterPill').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderLogs();
}

function filterLogs() {
  renderLogs();
}

function renderLogs() {
  const tbody = document.getElementById('logsTableBody');
  if (!tbody) return;

  const searchInput = document.getElementById('logSearchInput');
  const search = searchInput ? searchInput.value.toLowerCase().trim() : '';

  let filtered = currentLogs.filter(l => {
    if (search) {
      const matchEmail = l.customerEmail?.toLowerCase().includes(search);
      const matchName = l.customerName?.toLowerCase().includes(search);
      const matchSub = l.subject?.toLowerCase().includes(search);
      const matchMode = l.mode?.toLowerCase().includes(search);
      const matchMsgId = l.messageId?.toLowerCase().includes(search);
      if (!matchEmail && !matchName && !matchSub && !matchMode && !matchMsgId) return false;
    }

    if (logActiveFilter === 'sent') return l.status === 'sent';
    if (logActiveFilter === 'failed') return l.status === 'failed';
    if (logActiveFilter === 'auto') return l.mode === 'auto' || l.mode === 'automatic';
    if (logActiveFilter === 'manual') return l.mode === 'manual' || l.mode === 'manual-resend';

    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 32px; color: var(--color-text-muted);">No matching log entries found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(l => {
    const isSent = l.status === 'sent';
    const statusPill = isSent 
      ? `<span class="status-pill converted"><span class="dot"></span> Delivered</span>` 
      : `<span class="status-pill pending"><span class="dot"></span> Failed</span>`;

    return `
      <tr>
        <td style="font-size: 12px; color: var(--color-text-muted); white-space: nowrap;">
          ${new Date(l.sentAt).toLocaleString()}
        </td>
        <td>
          <div style="font-weight: 600; color: var(--color-text-title);">${l.customerEmail}</div>
          ${l.customerName ? `<div style="font-size: 11.5px; color: var(--color-text-muted);">${l.customerName}</div>` : ''}
        </td>
        <td>
          <span class="stage-pill s${l.templateId || 1}">Stage ${l.templateId || 1}</span>
        </td>
        <td style="font-size: 12.5px; color: var(--color-text-body); max-width: 260px; line-height: 1.35;">
          ${l.subject}
        </td>
        <td>
          <span class="kpi-chip" style="text-transform: capitalize;">${l.mode || 'auto'}</span>
        </td>
        <td>
          ${statusPill}
        </td>
        <td style="text-align: right; white-space: nowrap;">
          <div style="display: inline-flex; gap: 4px;">
            <button class="action-review-btn" onclick="openEditLogModal('${l.id}')" title="Modify or Inspect Record" style="padding: 4px 8px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              Edit
            </button>
            <button class="action-review-btn" onclick="resendLogEntry('${l.id}')" title="Resend Recovery Email" style="padding: 4px 8px; color: var(--color-brand); border-color: var(--color-brand-border);">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
            </button>
            <button class="action-review-btn" onclick="deleteLogEntry('${l.id}')" title="Delete Log Record" style="padding: 4px 8px; color: var(--color-danger-text); border-color: var(--color-danger-border);">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function openEditLogModal(logId) {
  const log = currentLogs.find(l => String(l.id) === String(logId));
  if (!log) return;

  document.getElementById('editLogId').value = log.id;
  document.getElementById('editLogRecipient').value = log.customerEmail || '';
  document.getElementById('editLogCustomer').value = log.customerName || '';
  document.getElementById('editLogSubject').value = log.subject || '';
  document.getElementById('editLogTemplate').value = log.templateId || 1;
  document.getElementById('editLogStatus').value = log.status || 'sent';
  document.getElementById('editLogMessageId').innerText = log.messageId || 'N/A';
  
  const subtext = document.getElementById('logDetailMetaSubtext');
  if (subtext) {
    subtext.innerText = `Record ID: ${log.id} &bull; Dispatched: ${new Date(log.sentAt).toLocaleString()}`;
  }

  const modal = document.getElementById('logDetailModal');
  if (modal) modal.classList.add('active');
}

function closeLogModal() {
  const modal = document.getElementById('logDetailModal');
  if (modal) modal.classList.remove('active');
}

async function saveLogModifications() {
  const logId = document.getElementById('editLogId').value;
  if (!logId) return;

  const updates = {
    customerEmail: document.getElementById('editLogRecipient').value.trim(),
    customerName: document.getElementById('editLogCustomer').value.trim(),
    subject: document.getElementById('editLogSubject').value.trim(),
    templateId: Number(document.getElementById('editLogTemplate').value),
    status: document.getElementById('editLogStatus').value
  };

  try {
    const res = await authFetch(`/api/logs/${logId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    const data = await res.json();
    if (data.success) {
      showToast('Dispatch record updated successfully');
      closeLogModal();
      loadLogs();
    } else {
      showToast(`Update failed: ${data.error}`, true);
    }
  } catch (e) {
    showToast(`Error: ${e.message}`, true);
  }
}

async function deleteLogEntry(logId) {
  if (!confirm('Are you sure you want to delete this log entry?')) return;

  try {
    const res = await authFetch(`/api/logs/${logId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('Log entry removed');
      loadLogs();
      loadStatus();
    } else {
      showToast(`Delete failed: ${data.error}`, true);
    }
  } catch (e) {
    showToast(`Error: ${e.message}`, true);
  }
}

async function deleteCurrentLogFromModal() {
  const logId = document.getElementById('editLogId').value;
  if (!logId) return;
  closeLogModal();
  await deleteLogEntry(logId);
}

async function clearAllLogs() {
  if (!confirm('Are you sure you want to clear the entire dispatch audit history? This action cannot be undone.')) {
    return;
  }

  try {
    const res = await authFetch('/api/logs', { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('All activity logs have been cleared');
      loadLogs();
      loadStatus();
    } else {
      showToast(`Clear failed: ${data.error}`, true);
    }
  } catch (e) {
    showToast(`Error: ${e.message}`, true);
  }
}

async function resendLogEntry(logId) {
  const log = currentLogs.find(l => String(l.id) === String(logId));
  if (!log) return;

  showToast(`Re-transmitting notice to ${log.customerEmail}...`);

  try {
    const res = await authFetch(`/api/logs/${logId}/resend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientEmail: log.customerEmail })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Email successfully re-dispatched to ${log.customerEmail}`);
      loadLogs();
      loadStatus();
    } else {
      showToast(`Re-send failed: ${data.error}`, true);
    }
  } catch (e) {
    showToast(`Error: ${e.message}`, true);
  }
}

async function resendCurrentLogFromModal() {
  const logId = document.getElementById('editLogId').value;
  if (!logId) return;
  closeLogModal();
  await resendLogEntry(logId);
}

/* ========================================================
   SETTINGS & LIVE DIAGNOSTIC DISPATCHER (IMAGE 2 UPGRADE)
   ======================================================== */
async function loadSettings() {
  try {
    const res = await authFetch('/api/settings');
    if (!res) return;
    const data = await res.json();
    currentSettings = data.settings;

    document.getElementById('settingFromName').value = currentSettings.senderName || 'Dr. Marc Mortiboys | The Dental Shaman';
    document.getElementById('settingFromEmail').value = currentSettings.senderEmail || 'shop@thedentalshaman.com';
    document.getElementById('settingReplyTo').value = currentSettings.replyTo || 'shop@thedentalshaman.com';

    document.getElementById('settingAutoEnabled').checked = !!currentSettings.automationEnabled;
    document.getElementById('settingScanInterval').value = currentSettings.scanIntervalMinutes || 15;
    document.getElementById('settingCooldown').value = currentSettings.customerCooldownHours || 18;

    document.getElementById('settingService').value = currentSettings.emailService || 'smtp';
    document.getElementById('settingSmtpHost').value = currentSettings.smtpHost || 'smtp.hostinger.com';
    document.getElementById('settingSmtpPort').value = currentSettings.smtpPort || 465;
    document.getElementById('settingSmtpSecure').checked = currentSettings.smtpSecure !== false;
    document.getElementById('settingSmtpUser').value = currentSettings.smtpUser || 'shop@thedentalshaman.com';
    document.getElementById('settingSmtpPass').value = currentSettings.smtpPass || '';

    toggleServiceFields();
    renderCadenceEditor();
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
}

const STAGE_DESCRIPTIONS = {
  1: 'Dispatches immediately when you click Start Sequence on a customer (or after the configured delay) with their direct cart recovery link.',
  2: 'Dr. Marc Mortiboys (BDS) shares clinical insights on the biological advantages of ozonated water flossing.',
  3: 'Verified patient stories and clinical gum health outcomes from switching to The Dental Shaman.',
  4: 'Extends an exclusive 10% courtesy benefit and complimentary holistic dental ritual eBook guide.',
  5: 'Polite final notice before releasing reserved cart inventory back to the store waitlist.'
};

function renderCadenceEditor() {
  const grid = document.getElementById('cadenceFlowGrid');
  if (!grid) return;

  const stages = currentSettings?.templatesConfig || [
    { id: 1, name: 'Stage 1: Cart Saved Check-in', minAgeHours: 1, maxAgeHours: 23, enabled: true },
    { id: 2, name: "Stage 2: Dr. Marc's Story & Clinical Ozone", minAgeHours: 24, maxAgeHours: 47, enabled: true },
    { id: 3, name: 'Stage 3: Social Proof & Gum Health', minAgeHours: 48, maxAgeHours: 71, enabled: true },
    { id: 4, name: 'Stage 4: Courtesy Incentive & eBook', minAgeHours: 72, maxAgeHours: 119, enabled: true },
    { id: 5, name: 'Stage 5: Final Notice & Cart Expiration', minAgeHours: 120, maxAgeHours: 336, enabled: true }
  ];

  const enabledCount = stages.filter(s => s.enabled).length;
  const badge = document.getElementById('cadenceActiveCountBadge');
  if (badge) {
    badge.innerText = `${enabledCount} of 5 Stages Enabled`;
  }

  grid.innerHTML = stages.map(s => {
    const cleanTitle = s.name.replace(/^Stage\s*\d+\s*:\s*/i, '');
    const timingLabel = s.id === 1 && Number(s.minAgeHours) <= 1
      ? `Stage 1 • Immediate / ${s.minAgeHours}h`
      : `Stage ${s.id} • ${s.minAgeHours}h – ${s.maxAgeHours}h`;

    return `
      <div class="Polaris-FlowStep ${s.enabled ? '' : 'stage-disabled'}" data-stage-id="${s.id}">
        <div class="flow-step-top">
          <div class="Polaris-FlowStep__Timing" id="stageTimingLabel_${s.id}">${timingLabel}</div>
          <label class="stage-toggle-label" title="Enable or disable Stage ${s.id}">
            <input type="checkbox" id="cadenceEnabled_${s.id}" ${s.enabled ? 'checked' : ''} onchange="updateStageCardVisual(${s.id})">
            <span>Active</span>
          </label>
        </div>
        <div class="Polaris-FlowStep__Title">${cleanTitle}</div>
        <div class="Polaris-FlowStep__Desc">${STAGE_DESCRIPTIONS[s.id] || ''}</div>

        <div class="cadence-timing-inputs">
          <div class="cadence-input-group">
            <label for="cadenceMin_${s.id}">${s.id === 1 ? 'Start Delay (Hrs)' : 'Send After (Hrs)'}</label>
            <input type="number" min="0" max="720" id="cadenceMin_${s.id}" class="Polaris-TextField__Input cadence-num-input" value="${s.minAgeHours}" oninput="updateStageCardVisual(${s.id})">
          </div>
          <div class="cadence-input-group">
            <label for="cadenceMax_${s.id}">Max Window (Hrs)</label>
            <input type="number" min="1" max="1440" id="cadenceMax_${s.id}" class="Polaris-TextField__Input cadence-num-input" value="${s.maxAgeHours}" oninput="updateStageCardVisual(${s.id})">
          </div>
        </div>

        <div style="display: flex; gap: 6px; margin-top: 12px;">
          <button class="Polaris-Button Polaris-Button--slim" style="width: 100%;" onclick="openPreviewForTemplate(${s.id})">
            Preview &amp; Edit Template
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function updateStageCardVisual(stageId) {
  const minEl = document.getElementById(`cadenceMin_${stageId}`);
  const maxEl = document.getElementById(`cadenceMax_${stageId}`);
  const enabledEl = document.getElementById(`cadenceEnabled_${stageId}`);
  const labelEl = document.getElementById(`stageTimingLabel_${stageId}`);
  const card = document.querySelector(`.Polaris-FlowStep[data-stage-id="${stageId}"]`);

  if (labelEl && minEl && maxEl) {
    const minVal = Number(minEl.value || 0);
    const maxVal = Number(maxEl.value || 1);
    labelEl.innerText = stageId === 1 && minVal === 0
      ? `Stage 1 • Immediate (0h – ${maxVal}h)`
      : `Stage ${stageId} • ${minVal}h – ${maxVal}h`;
  }
  if (card && enabledEl) {
    card.classList.toggle('stage-disabled', !enabledEl.checked);
  }
}

async function saveCadenceTimings() {
  const btn = document.getElementById('btnSaveCadenceTiming');
  if (btn) {
    btn.disabled = true;
    btn.innerText = 'Saving Timing...';
  }

  const templatesConfig = [1, 2, 3, 4, 5].map(id => {
    const minEl = document.getElementById(`cadenceMin_${id}`);
    const maxEl = document.getElementById(`cadenceMax_${id}`);
    const enabledEl = document.getElementById(`cadenceEnabled_${id}`);
    return {
      id,
      minAgeHours: minEl ? Math.max(0, Number(minEl.value)) : 1,
      maxAgeHours: maxEl ? Math.max(1, Number(maxEl.value)) : 24,
      enabled: enabledEl ? Boolean(enabledEl.checked) : true
    };
  });

  try {
    const res = await authFetch('/api/cadence', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templatesConfig })
    });
    const data = await res.json();
    if (data.success) {
      if (currentSettings) currentSettings.templatesConfig = data.templatesConfig;
      renderCadenceEditor();
      showToast('Sequence timing saved for all 5 stages');
    } else {
      showToast(`Failed to save timing: ${data.error}`, true);
    }
  } catch (e) {
    showToast(`Error saving timing: ${e.message}`, true);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = 'Save Sequence Timing';
    }
  }
}

function toggleServiceFields() {
  const service = document.getElementById('settingService').value;
  const smtpFields = document.getElementById('smtpFields');
  const apiFields = document.getElementById('apiFields');

  if (service === 'smtp') {
    smtpFields.style.display = 'block';
    apiFields.style.display = 'none';
  } else {
    smtpFields.style.display = 'none';
    apiFields.style.display = 'block';
  }
}

async function saveSettings() {
  const settings = {
    senderName: document.getElementById('settingFromName').value,
    senderEmail: document.getElementById('settingFromEmail').value,
    replyTo: document.getElementById('settingReplyTo').value,
    automationEnabled: document.getElementById('settingAutoEnabled').checked,
    scanIntervalMinutes: parseInt(document.getElementById('settingScanInterval').value),
    customerCooldownHours: parseInt(document.getElementById('settingCooldown').value),
    emailService: document.getElementById('settingService').value,
    smtpHost: document.getElementById('settingSmtpHost').value,
    smtpPort: parseInt(document.getElementById('settingSmtpPort').value),
    smtpSecure: document.getElementById('settingSmtpSecure').checked,
    smtpUser: document.getElementById('settingSmtpUser').value,
    smtpPass: document.getElementById('settingSmtpPass').value
  };

  const apiKeyInput = document.getElementById('settingApiKey');
  if (apiKeyInput && apiKeyInput.value) {
    settings.apiKey = apiKeyInput.value;
  }

  try {
    const res = await authFetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    const data = await res.json();
    if (data.success) {
      showToast('Settings successfully persisted');
      loadStatus();
    } else {
      showToast('Error saving settings: ' + data.error, true);
    }
  } catch (e) {
    showToast('Error: ' + e.message, true);
  }
}

// Live SMTP Delivery & Template Tester (Image 2 Solution)
async function sendTestEmail() {
  const input = document.getElementById('testEmailTarget');
  const testEmail = input.value.trim();
  const templateId = document.getElementById('testTemplateSelect').value;
  const alertBox = document.getElementById('testResultAlert');
  const btn = document.getElementById('btnSendTestEmail');

  if (!testEmail || !testEmail.includes('@')) {
    showToast('Please enter a valid recipient email address', true);
    input.focus();
    return;
  }

  btn.disabled = true;
  btn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
    Transmitting Stage ${templateId} Test...
  `;
  alertBox.style.display = 'none';

  try {
    const res = await authFetch('/api/settings/test-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testEmail, templateId })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message);
      alertBox.className = 'diagnostic-result-box success';
      alertBox.innerHTML = `
        <strong>Delivery Confirmed:</strong> Stage ${templateId} test email successfully transmitted to <u>${testEmail}</u> via SMTP (Hostinger:465 SSL). Please check your inbox.
      `;
      loadLogs();
      loadStatus();
    } else {
      showToast(`Transmission failed: ${data.error}`, true);
      alertBox.className = 'diagnostic-result-box error';
      alertBox.innerHTML = `<strong>Error:</strong> ${data.error}`;
    }
  } catch (e) {
    showToast(`Failure: ${e.message}`, true);
    alertBox.className = 'diagnostic-result-box error';
    alertBox.innerHTML = `<strong>Delivery Failed:</strong> ${e.message}`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="22" y1="2" x2="11" y2="13"></line>
        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
      </svg>
      Send Test Recovery Email
    `;
  }
}

function previewSelectedTestTemplate() {
  const tplId = document.getElementById('testTemplateSelect').value;
  switchTab('templates');
  const sel = document.getElementById('templateSelectorDropdown');
  if (sel) sel.value = tplId;
  loadTemplateEditor(tplId);
}

/* ========================================================
   MANUAL SCAN & AUTOMATION TOGGLES
   ======================================================== */
async function triggerManualScan() {
  const btn = document.getElementById('btnRunScanNow');
  btn.disabled = true;
  btn.innerHTML = `Scanning...`;

  try {
    const res = await authFetch('/api/automation/trigger', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      const stats = data.result;
      showToast(`Scan complete: ${stats.scannedCount || 0} evaluated, ${stats.sentCount || 0} dispatched.`);
      loadCheckouts();
      loadLogs();
      loadStatus();
    } else {
      showToast('Scan error: ' + data.error, true);
    }
  } catch (e) {
    showToast('Scan error: ' + e.message, true);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="23 4 23 10 17 10"></polyline>
        <polyline points="1 20 1 14 7 14"></polyline>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
      </svg>
      Run Scan
    `;
  }
}

async function toggleAutomation() {
  const pulse = document.getElementById('headerPulseDot');
  const isCurrentlyActive = pulse && pulse.classList.contains('live');
  const newState = !isCurrentlyActive;

  try {
    const res = await authFetch('/api/automation/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: newState })
    });
    const data = await res.json();
    showToast(data.automationEnabled ? 'Automation engine activated' : 'Automation engine paused');
    loadStatus();
  } catch (e) {
    showToast('Error: ' + e.message, true);
  }
}
