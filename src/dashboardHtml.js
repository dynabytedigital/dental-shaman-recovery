/**
 * Modern High-Performance Single-Page UI for Dental Shaman Recovery & Retention
 */

export function getDashboardHtml(env) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>The Dental Shaman | Recovery & Retention Engine</title>
  <link rel="icon" href="https://cdn.shopify.com/s/files/1/0946/8238/2665/files/ozone-water-flosser-white.png?v=1794726128" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0d0f17;
      --card-bg: rgba(26, 29, 45, 0.85);
      --card-border: rgba(255, 255, 255, 0.08);
      --teal: #2D8B7A;
      --teal-light: #3db8a2;
      --teal-glow: rgba(45, 139, 122, 0.25);
      --purple: #2E1760;
      --purple-light: #52319c;
      --text-main: #f0f3f8;
      --text-muted: #9aa3b5;
      --accent-gold: #e2ba64;
      --success: #2ecc71;
      --danger: #e74c3c;
      --warning: #f39c12;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      background-image: 
        radial-gradient(at 0% 0%, rgba(46, 23, 96, 0.35) 0px, transparent 50%),
        radial-gradient(at 100% 100%, rgba(45, 139, 122, 0.25) 0px, transparent 50%);
      color: var(--text-main);
      font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    header {
      border-bottom: 1px solid var(--card-border);
      background: rgba(13, 15, 23, 0.7);
      backdrop-filter: blur(16px);
      padding: 16px 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .brand-logo {
      width: 38px;
      height: 38px;
      border-radius: 8px;
      background: var(--purple);
      border: 1px solid var(--teal);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-weight: bold;
      font-family: 'Cinzel', serif;
    }

    .brand h1 {
      font-family: 'Cinzel', serif;
      font-size: 1.15rem;
      letter-spacing: 0.5px;
      color: #fff;
    }

    .brand span {
      display: block;
      font-size: 0.75rem;
      color: var(--teal-light);
      letter-spacing: 1.5px;
      text-transform: uppercase;
      font-family: 'Plus Jakarta Sans', sans-serif;
    }

    .header-badges {
      display: flex;
      gap: 10px;
      align-items: center;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .badge-live {
      background: rgba(46, 204, 113, 0.15);
      color: #2ecc71;
      border: 1px solid rgba(46, 204, 113, 0.3);
    }
    .badge-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: currentColor;
      box-shadow: 0 0 8px currentColor;
    }

    .nav-tabs {
      display: flex;
      gap: 8px;
      padding: 12px 32px;
      background: rgba(18, 21, 33, 0.6);
      border-bottom: 1px solid var(--card-border);
      overflow-x: auto;
    }

    .tab-btn {
      background: transparent;
      border: 1px solid transparent;
      color: var(--text-muted);
      padding: 8px 18px;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 8px;
      white-space: nowrap;
    }

    .tab-btn:hover {
      color: var(--text-main);
      background: rgba(255, 255, 255, 0.05);
    }

    .tab-btn.active {
      background: var(--card-bg);
      color: #fff;
      border-color: var(--card-border);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }

    main {
      flex: 1;
      padding: 32px;
      max-width: 1400px;
      margin: 0 auto;
      width: 100%;
    }

    .tab-content { display: none; }
    .tab-content.active { display: block; }

    /* Grid & Cards */
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 20px;
      margin-bottom: 28px;
    }

    .metric-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 14px;
      padding: 20px;
      backdrop-filter: blur(12px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
      transition: transform 0.2s ease, border-color 0.2s ease;
    }

    .metric-card:hover {
      transform: translateY(-2px);
      border-color: rgba(45, 139, 122, 0.4);
    }

    .metric-title {
      font-size: 0.8rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }

    .metric-value {
      font-size: 1.8rem;
      font-weight: 700;
      color: #fff;
      letter-spacing: -0.5px;
    }

    .metric-sub {
      font-size: 0.75rem;
      color: var(--teal-light);
      margin-top: 6px;
    }

    /* Modern Table */
    .table-container {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
      margin-bottom: 24px;
    }

    .table-header {
      padding: 18px 24px;
      border-bottom: 1px solid var(--card-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .table-header h2 {
      font-size: 1.05rem;
      font-weight: 700;
      color: #fff;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }

    th {
      padding: 12px 20px;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-muted);
      border-bottom: 1px solid var(--card-border);
      background: rgba(255, 255, 255, 0.02);
    }

    td {
      padding: 16px 20px;
      font-size: 0.85rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      color: var(--text-main);
      vertical-align: middle;
    }

    tr:last-child td { border-bottom: none; }
    tr:hover td { background: rgba(255, 255, 255, 0.02); }

    .btn-action {
      background: linear-gradient(135deg, var(--teal), #1f6b5d);
      color: #fff;
      border: none;
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .btn-action:hover {
      box-shadow: 0 0 12px var(--teal-glow);
      filter: brightness(1.1);
    }

    /* Link Generator Form */
    .generator-panel {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 28px;
    }

    @media (max-width: 900px) {
      .generator-panel { grid-template-columns: 1fr; }
    }

    .form-group {
      margin-bottom: 18px;
    }

    label {
      display: block;
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-muted);
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    input, select, textarea {
      width: 100%;
      background: rgba(13, 15, 23, 0.8);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 10px 14px;
      color: #fff;
      font-family: inherit;
      font-size: 0.9rem;
      transition: border-color 0.2s ease;
    }

    input:focus, select:focus, textarea:focus {
      outline: none;
      border-color: var(--teal);
      box-shadow: 0 0 0 2px var(--teal-glow);
    }

    .code-box {
      background: #08090e;
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 14px;
      font-family: 'Courier New', monospace;
      font-size: 0.8rem;
      color: #79c0ff;
      word-break: break-all;
      position: relative;
      margin-top: 8px;
    }

    .btn-copy {
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #fff;
      padding: 5px 12px;
      border-radius: 6px;
      font-size: 0.75rem;
      cursor: pointer;
      position: absolute;
      top: 10px;
      right: 10px;
      transition: all 0.2s ease;
    }
    .btn-copy:hover {
      background: var(--teal);
      border-color: var(--teal);
    }

    .button-preview-stage {
      background: #ffffff;
      border-radius: 10px;
      padding: 32px;
      text-align: center;
      margin-top: 12px;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .pill {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 0.7rem;
      font-weight: 600;
    }
    .pill-teal { background: rgba(45, 139, 122, 0.2); color: #3db8a2; }
    .pill-purple { background: rgba(82, 49, 156, 0.3); color: #bca4f5; }
    .pill-green { background: rgba(46, 204, 113, 0.2); color: #2ecc71; }
    .pill-gray { background: rgba(255, 255, 255, 0.1); color: #aaa; }
  </style>
</head>
<body>

  <header>
    <div class="brand">
      <div class="brand-logo">DS</div>
      <div>
        <h1>The Dental Shaman</h1>
        <span>Recovery & Retention Engine (Cloudflare Edge)</span>
      </div>
    </div>
    <div class="header-badges">
      <div class="badge badge-live">
        <span class="badge-dot"></span> 100% Free Edge Active
      </div>
      <div class="badge" style="background:rgba(45,139,122,0.15); color:var(--teal-light); border:1px solid rgba(45,139,122,0.3);">
        Google Workspace SMTP
      </div>
    </div>
  </header>

  <nav class="nav-tabs">
    <button class="tab-btn active" onclick="switchTab('tab-dashboard')">📊 Dashboard</button>
    <button class="tab-btn" onclick="switchTab('tab-checkouts')">🛒 Abandoned Checkouts</button>
    <button class="tab-btn" onclick="switchTab('tab-logs')">✉️ Email Logs</button>
    <button class="tab-btn" onclick="switchTab('tab-generator')">🔗 Link & Button Generator</button>
    <button class="tab-btn" onclick="switchTab('tab-settings')">⚙️ Settings</button>
  </nav>

  <main>
    <!-- TAB: DASHBOARD -->
    <section id="tab-dashboard" class="tab-content active">
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-title">Recoverable Checkouts</div>
          <div class="metric-value" id="metric-checkouts">--</div>
          <div class="metric-sub">Synced from Shopify store</div>
        </div>
        <div class="metric-card">
          <div class="metric-title">Recovery Pipeline Value</div>
          <div class="metric-value" id="metric-pipeline">--</div>
          <div class="metric-sub">Open cart value</div>
        </div>
        <div class="metric-card">
          <div class="metric-title">Emails Dispatched</div>
          <div class="metric-value" id="metric-sent">--</div>
          <div class="metric-sub">Via Google Workspace</div>
        </div>
        <div class="metric-card">
          <div class="metric-title">Telemetry Open Rate</div>
          <div class="metric-value" id="metric-open-rate">--%</div>
          <div class="metric-sub">Tracked pixel loads</div>
        </div>
        <div class="metric-card">
          <div class="metric-title">Telemetry Click Rate</div>
          <div class="metric-value" id="metric-click-rate">--%</div>
          <div class="metric-sub">Tracked link clicks</div>
        </div>
      </div>

      <div class="table-container">
        <div class="table-header">
          <h2>Active Recovery Sequences</h2>
          <button class="btn-action" onclick="fetchData()">⚡ Refresh Data</button>
        </div>
        <table id="recent-checkouts-table">
          <thead>
            <tr>
              <th>Checkout ID</th>
              <th>Customer</th>
              <th>Age</th>
              <th>Items</th>
              <th>Total</th>
              <th>Current Stage</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody id="recent-checkouts-body">
            <tr><td colspan="7" style="text-align:center; color:#888;">Loading checkouts...</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- TAB: CHECKOUTS -->
    <section id="tab-checkouts" class="tab-content">
      <div class="table-container">
        <div class="table-header">
          <h2>All Live Shopify Abandoned Checkouts</h2>
          <button class="btn-action" onclick="fetchCheckouts()">🔄 Sync Shopify</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Customer</th>
              <th>Email</th>
              <th>Age</th>
              <th>Value</th>
              <th>Items Summary</th>
              <th>Trigger Recovery</th>
            </tr>
          </thead>
          <tbody id="all-checkouts-body">
            <tr><td colspan="7" style="text-align:center; color:#888;">Loading...</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- TAB: LOGS -->
    <section id="tab-logs" class="tab-content">
      <div class="table-container">
        <div class="table-header">
          <h2>Real-Time Dispatch & Telemetry Logs</h2>
          <button class="btn-action" onclick="fetchLogs()">🔄 Refresh Logs</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Recipient</th>
              <th>Stage / Template</th>
              <th>Subject</th>
              <th>Status</th>
              <th>Opened</th>
              <th>Clicked</th>
            </tr>
          </thead>
          <tbody id="logs-body">
            <tr><td colspan="7" style="text-align:center; color:#888;">Loading logs...</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- TAB: LINK & BUTTON GENERATOR -->
    <section id="tab-generator" class="tab-content">
      <div class="generator-panel">
        <div class="metric-card">
          <h2 style="font-size:1.1rem; margin-bottom:16px; color:#fff;">Configure Campaign Link & Button</h2>
          
          <div class="form-group">
            <label>Store Destination</label>
            <select id="gen-dest-preset" onchange="applyDestPreset()">
              <option value="https://shop.thedentalshaman.com/cart">Cart Page (Default Recovery)</option>
              <option value="https://shop.thedentalshaman.com/products/ozone-water-flosser">Ozone Water Flosser Product Page</option>
              <option value="https://shop.thedentalshaman.com/collections/all">All Collections & Products</option>
              <option value="https://shop.thedentalshaman.com">Store Homepage</option>
              <option value="custom">Custom Destination URL...</option>
            </select>
            <input type="text" id="gen-dest-url" value="https://shop.thedentalshaman.com/cart" style="margin-top:6px;" placeholder="https://shop.thedentalshaman.com/..." />
          </div>

          <div class="form-group" style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div>
              <label>Campaign Name</label>
              <input type="text" id="gen-campaign" value="black_friday" placeholder="e.g. spring_cleanse" />
            </div>
            <div>
              <label>Season / Batch</label>
              <input type="text" id="gen-season" value="2026_q4" placeholder="e.g. season_01" />
            </div>
          </div>

          <div class="form-group" style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div>
              <label>Element Placement</label>
              <input type="text" id="gen-element" value="hero_cta" placeholder="e.g. bottom_button" />
            </div>
            <div>
              <label>Tracking Ref Code</label>
              <input type="text" id="gen-ref" value="TDS-BF-01" placeholder="e.g. TDS-CAM-01" />
            </div>
          </div>

          <div class="form-group" style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;">
            <div>
              <label>Button Color</label>
              <select id="gen-bg-color" onchange="renderButtonPreview()">
                <option value="#2D8B7A">Dr. Marc Teal (#2D8B7A)</option>
                <option value="#2E1760">Shaman Purple (#2E1760)</option>
                <option value="#744B6F">Clinical Plum (#744B6F)</option>
                <option value="#1f6b5d">Deep Forest (#1F6B5D)</option>
              </select>
            </div>
            <div>
              <label>Button Text</label>
              <input type="text" id="gen-text" value="CLAIM MY CART & 11% OFF" oninput="renderButtonPreview()" />
            </div>
            <div>
              <label>Border Radius</label>
              <select id="gen-radius" onchange="renderButtonPreview()">
                <option value="8px">Soft Rounded (8px)</option>
                <option value="24px">Pill (24px)</option>
                <option value="4px">Subtle (4px)</option>
              </select>
            </div>
          </div>

          <button class="btn-action" style="width:100%; padding:12px; font-size:0.9rem;" onclick="generateTrackingAssets()">⚡ Generate Tracking Link & Button</button>
        </div>

        <div class="metric-card">
          <h2 style="font-size:1.1rem; margin-bottom:16px; color:#fff;">Live Preview & Snippet Output</h2>

          <label>1. Live Email Button Preview</label>
          <div class="button-preview-stage" id="button-preview-container">
            <!-- Preview rendered dynamically -->
          </div>

          <label style="margin-top:20px;">2. Dynamic Tracking Link</label>
          <div class="code-box">
            <button class="btn-copy" onclick="copyToClipboard('gen-out-link')">Copy Link</button>
            <span id="gen-out-link">https://dental-shaman-recovery.aador-fit.workers.dev/t/c/{{dispatch_id}}?dest=...</span>
          </div>

          <label style="margin-top:20px;">3. Responsive HTML Button Snippet (Paste in email)</label>
          <div class="code-box" style="max-height:160px; overflow-y:auto;">
            <button class="btn-copy" onclick="copyToClipboard('gen-out-html')">Copy HTML</button>
            <pre id="gen-out-html" style="white-space:pre-wrap; font-size:0.75rem; color:#a5d6ff;"></pre>
          </div>
        </div>
      </div>
    </section>

    <!-- TAB: SETTINGS -->
    <section id="tab-settings" class="tab-content">
      <div class="metric-card" style="max-width:700px; margin:0 auto;">
        <h2 style="font-size:1.1rem; margin-bottom:20px; color:#fff;">Automation & Delivery Settings</h2>
        
        <div class="form-group">
          <label>Email Provider</label>
          <input type="text" value="Google Workspace (Direct TLS Socket on Port 465)" readonly style="opacity:0.7;" />
        </div>

        <div class="form-group" style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
          <div>
            <label>Sender Email</label>
            <input type="text" id="set-from-email" value="shop@thedentalshaman.com" readonly style="opacity:0.7;" />
          </div>
          <div>
            <label>Sender Name</label>
            <input type="text" id="set-from-name" value="Dr. Marc Mortiboys | The Dental Shaman" />
          </div>
        </div>

        <div class="form-group" style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
          <div>
            <label>Batch Rate-Limit Delay (Seconds)</label>
            <input type="number" id="set-delay" value="2" min="1" max="10" />
            <small style="color:var(--text-muted); font-size:0.7rem;">Prevents Gmail spam rate triggers</small>
          </div>
          <div>
            <label>Automatic Retry on Failure</label>
            <input type="text" value="Enabled (Up to 3 retries with backoff)" readonly style="opacity:0.7;" />
          </div>
        </div>

        <div class="form-group">
          <label>Automation Cadence</label>
          <select id="set-cadence">
            <option value="15">Run background scans every 15 minutes (Cloudflare Cron Trigger)</option>
          </select>
        </div>

        <div class="form-group" style="margin-top:24px; padding-top:16px; border-top:1px solid var(--card-border);">
          <label>Send Live Test Email</label>
          <div style="display:flex; gap:10px;">
            <input type="email" id="test-email-dest" placeholder="Enter recipient email (e.g. devnayem30@gmail.com)" value="devnayem30@gmail.com" />
            <button class="btn-action" onclick="sendTestEmail()">Send Test</button>
          </div>
          <span id="test-email-status" style="font-size:0.75rem; margin-top:6px; display:block;"></span>
        </div>
      </div>
    </section>
  </main>

  <script>
    const WORKER_BASE = window.location.origin;

    function switchTab(tabId) {
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.getElementById(tabId).classList.add('active');
      event.target.classList.add('active');
    }

    function applyDestPreset() {
      const preset = document.getElementById('gen-dest-preset').value;
      if (preset !== 'custom') {
        document.getElementById('gen-dest-url').value = preset;
      }
      renderButtonPreview();
    }

    function renderButtonPreview() {
      const text = document.getElementById('gen-text').value || 'COMPLETE YOUR ORDER';
      const bg = document.getElementById('gen-bg-color').value;
      const radius = document.getElementById('gen-radius').value;
      
      const container = document.getElementById('button-preview-container');
      container.innerHTML = '<table border=\"0\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:0 auto;\"><tr><td bgcolor=\"' + bg + '\" style=\"border-radius:' + radius + '; background-color:' + bg + ';\"><a href=\"#\" style=\"display:inline-block; padding:14px 32px; font-family:Arial,sans-serif; font-size:15px; font-weight:bold; color:#ffffff; text-decoration:none; border-radius:' + radius + '; text-transform:uppercase; letter-spacing:0.5px;\">' + text + ' &rarr;</a></td></tr></table>';
    }

    function generateTrackingAssets() {
      const dest = document.getElementById('gen-dest-url').value;
      const campaign = document.getElementById('gen-campaign').value;
      const season = document.getElementById('gen-season').value;
      const element = document.getElementById('gen-element').value;
      const ref = document.getElementById('gen-ref').value;
      const bg = document.getElementById('gen-bg-color').value;
      const text = document.getElementById('gen-text').value;
      const radius = document.getElementById('gen-radius').value;

      const link = WORKER_BASE + '/t/c/{{dispatch_id}}?dest=' + encodeURIComponent(dest) + '&campaign=' + encodeURIComponent(campaign) + '&season=' + encodeURIComponent(season) + '&element=' + encodeURIComponent(element) + '&tds_trk=' + encodeURIComponent(ref);
      document.getElementById('gen-out-link').innerText = link;

      const html = '<!-- TDS Bulletproof Button -->\\n' +
        '<table border=\"0\" cellpadding=\"0\" cellspacing=\"0\" role=\"presentation\" style=\"margin:20px auto; border-collapse:separate;\">\\n' +
        '  <tr>\\n' +
        '    <td align=\"center\" bgcolor=\"' + bg + '\" style=\"border-radius:' + radius + '; background-color:' + bg + ';\">\\n' +
        '      <a href=\"' + link + '\" target=\"_blank\" style=\"display:inline-block; padding:14px 32px; font-family:Arial,sans-serif; font-size:15px; font-weight:bold; color:#ffffff; text-decoration:none; border-radius:' + radius + '; text-transform:uppercase; letter-spacing:0.5px;\">\\n' +
        '        ' + text + ' &rarr;\\n' +
        '      </a>\\n' +
        '    </td>\\n' +
        '  </tr>\\n' +
        '</table>';

      document.getElementById('gen-out-html').innerText = html;
      renderButtonPreview();
    }

    function copyToClipboard(elementId) {
      const text = document.getElementById(elementId).innerText;
      navigator.clipboard.writeText(text).then(() => {
        alert('Copied to clipboard!');
      });
    }

    async function fetchData() {
      try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        document.getElementById('metric-checkouts').innerText = data.totalCheckouts || 0;
        document.getElementById('metric-pipeline').innerText = '£' + (data.pipelineValue || 0).toFixed(2);
        document.getElementById('metric-sent').innerText = data.totalSent || 0;
        document.getElementById('metric-open-rate').innerText = (data.openRate || 0) + '%';
        document.getElementById('metric-click-rate').innerText = (data.clickRate || 0) + '%';

        renderRecentCheckouts(data.recentCheckouts || []);
      } catch (e) {
        console.error(e);
      }
    }

    function renderRecentCheckouts(list) {
      const tbody = document.getElementById('recent-checkouts-body');
      if (!list || list.length === 0) {
        tbody.innerHTML = '<tr><td colspan=\"7\" style=\"text-align:center; color:#888;\">No checkouts found</td></tr>';
        return;
      }
      tbody.innerHTML = list.map(c => {
        return '<tr>' +
          '<td><span class=\"pill pill-purple\">#' + c.id + '</span></td>' +
          '<td><strong>' + (c.fullName || c.firstName) + '</strong><br><small style=\"color:#888;\">' + c.email + '</small></td>' +
          '<td>' + c.ageHours + 'h ago</td>' +
          '<td>' + (c.itemsCount || 1) + ' items</td>' +
          '<td><strong>£' + parseFloat(c.totalPrice).toFixed(2) + '</strong></td>' +
          '<td><span class=\"pill pill-teal\">Stage ' + (c.currentStage || 1) + '</span></td>' +
          '<td><button class=\"btn-action\" onclick=\"triggerStage(' + c.id + ', 1)\">Send Stage 1</button></td>' +
        '</tr>';
      }).join('');
    }

    async function fetchCheckouts() {
      const res = await fetch('/api/checkouts');
      const data = await res.json();
      const tbody = document.getElementById('all-checkouts-body');
      tbody.innerHTML = data.map(c => {
        const itemNames = (c.items || []).map(i => i.title).join(', ');
        return '<tr>' +
          '<td>#' + c.id + '</td>' +
          '<td>' + c.fullName + '</td>' +
          '<td>' + c.email + '</td>' +
          '<td>' + c.ageHours + 'h</td>' +
          '<td>' + c.currencySymbol + parseFloat(c.totalPrice).toFixed(2) + '</td>' +
          '<td style=\"max-width:250px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;\">' + itemNames + '</td>' +
          '<td>' +
            '<button class=\"btn-action\" style=\"margin-right:4px;\" onclick=\"triggerStage(' + c.id + ', 1)\">S1</button>' +
            '<button class=\"btn-action\" style=\"margin-right:4px; background:#4A3060;\" onclick=\"triggerStage(' + c.id + ', 2)\">S2</button>' +
            '<button class=\"btn-action\" style=\"background:#744B6F;\" onclick=\"triggerStage(' + c.id + ', 3)\">S3</button>' +
          '</td>' +
        '</tr>';
      }).join('');
    }

    async function fetchLogs() {
      const res = await fetch('/api/logs');
      const data = await res.json();
      const tbody = document.getElementById('logs-body');
      tbody.innerHTML = data.map(l => {
        const openedBadge = l.opened ? '<span class=\"pill pill-green\">Yes</span>' : '<span class=\"pill pill-gray\">No</span>';
        const clickedBadge = l.clicked ? '<span class=\"pill pill-green\">Yes</span>' : '<span class=\"pill pill-gray\">No</span>';
        return '<tr>' +
          '<td>' + new Date(l.sent_at).toLocaleTimeString() + '</td>' +
          '<td>' + l.customer_email + '</td>' +
          '<td>' + l.template_name + '</td>' +
          '<td>' + l.subject + '</td>' +
          '<td><span class=\"pill pill-teal\">' + l.status + '</span></td>' +
          '<td>' + openedBadge + '</td>' +
          '<td>' + clickedBadge + '</td>' +
        '</tr>';
      }).join('');
    }

    async function triggerStage(checkoutId, stageId) {
      if (!confirm('Dispatch Stage ' + stageId + ' via Google Workspace to Checkout #' + checkoutId + '?')) return;
      try {
        const res = await fetch('/api/send-stage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ checkoutId, stageId })
        });
        const result = await res.json();
        if (result.success) {
          alert('Email successfully dispatched via Google Workspace!');
          fetchData();
        } else {
          alert('Dispatch failed: ' + result.error);
        }
      } catch (e) {
        alert('Error: ' + e.message);
      }
    }

    async function sendTestEmail() {
      const dest = document.getElementById('test-email-dest').value;
      const statusSpan = document.getElementById('test-email-status');
      statusSpan.style.color = '#3db8a2';
      statusSpan.innerText = 'Sending via Google Workspace SMTP...';
      try {
        const res = await fetch('/api/test-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: dest })
        });
        const data = await res.json();
        if (data.success) {
          statusSpan.style.color = '#2ecc71';
          statusSpan.innerText = 'Success! Delivered with Message-ID: ' + data.messageId;
        } else {
          statusSpan.style.color = '#e74c3c';
          statusSpan.innerText = 'Failed: ' + data.error;
        }
      } catch (e) {
        statusSpan.style.color = '#e74c3c';
        statusSpan.innerText = 'Error: ' + e.message;
      }
    }

    // Init
    window.onload = () => {
      fetchData();
      renderButtonPreview();
      generateTrackingAssets();
    };
  </script>
</body>
</html>`;
}
