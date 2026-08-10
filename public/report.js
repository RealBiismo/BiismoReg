(() => {
  const container = document.getElementById('sharedReport');
  const status = document.getElementById('sharedReportStatus');

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function display(value, suffix = '') {
    return value === null || value === undefined || value === '' || value === 'Unknown' ? 'N/A' : `${escapeHtml(value)}${suffix}`;
  }

  function date(value) {
    if (!value) return 'N/A';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 'N/A' : parsed.toLocaleDateString('en-GB');
  }

  function motHistory(vehicle) {
    const tests = [...(vehicle.motHistory || [])].sort((a,b) => new Date(b.completedDate) - new Date(a.completedDate)).slice(0,8);
    if (!tests.length) return '<p class="feature-empty">No MOT history included in this snapshot.</p>';
    return `<div class="mot-timeline">${tests.map((test) => {
      const result = String(test.result || 'UNKNOWN').toUpperCase();
      const mileage = test.mileage ? `${Number(String(test.mileage).replace(/[^\d]/g,'')).toLocaleString()} mi` : 'Mileage N/A';
      return `<div class="timeline-item is-${result === 'PASSED' ? 'pass' : 'fail'}"><span class="timeline-dot"></span><div><strong>${escapeHtml(result)}</strong><small>${escapeHtml(date(test.completedDate))} · ${escapeHtml(mileage)} · ${(test.defects || []).length} issue${(test.defects || []).length === 1 ? '' : 's'}</small></div></div>`;
    }).join('')}</div>`;
  }

  function render(report) {
    const vehicle = report.snapshot || {};
    const analysis = vehicle.biismoAnalysis || {};
    document.title = `${vehicle.registration || 'Vehicle'} · BIISMO REG`;
    status.textContent = `Snapshot created ${new Date(report.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })} · expires ${new Date(report.expiresAt).toLocaleDateString('en-GB')}`;
    container.innerHTML = `
      <section class="result-card">
        <div class="result-heading">
          <div><span class="eyebrow">SHARED BIISMO REPORT</span><h1 class="car-title">${escapeHtml(vehicle.make || 'Unknown')} ${escapeHtml(vehicle.model || '')}</h1></div>
          <div class="result-plate"><div class="gb">GB</div><div class="result-reg">${escapeHtml(vehicle.registration || 'N/A')}</div></div>
        </div>
        <div class="intelligence-top">
          <article class="score-card"><span>BIISMO SCORE</span><strong>${Number.isFinite(Number(analysis.score)) ? Number(analysis.score) : '—'}</strong><small>/ 100</small></article>
          <article class="verdict-card is-${escapeHtml(analysis.verdictTone || 'good')}"><span>BIISMO VERDICT</span><strong>${escapeHtml(analysis.verdict || 'Vehicle snapshot')}</strong><p>${(analysis.reasons || []).map(escapeHtml).join(' · ')}</p></article>
        </div>
        <div class="vehicle-grid primary-grid">
          <div class="info-box"><div class="info-title">MOT status</div><div class="info-value">${display(vehicle.motStatus)}</div><small>${display(date(vehicle.motExpiryDate))}</small></div>
          <div class="info-box"><div class="info-title">Tax status</div><div class="info-value">${display(vehicle.taxStatus)}</div><small>${display(date(vehicle.taxDueDate))}</small></div>
          <div class="info-box"><div class="info-title">Fuel</div><div class="info-value">${display(vehicle.fuelType)}</div></div>
          <div class="info-box"><div class="info-title">Engine</div><div class="info-value">${display(vehicle.engineCapacity, vehicle.engineCapacity ? 'cc' : '')}</div></div>
          <div class="info-box"><div class="info-title">Colour</div><div class="info-value">${display(vehicle.colour)}</div></div>
          <div class="info-box"><div class="info-title">First registered</div><div class="info-value">${display(vehicle.monthOfFirstRegistration)}</div></div>
        </div>
        <article class="feature-panel"><span class="feature-kicker">MOT HEALTH TIMELINE</span><h3>Recent recorded history</h3>${motHistory(vehicle)}</article>
        ${analysis.annualCost ? `<article class="cost-panel"><div><span class="feature-kicker">OWNERSHIP COST ESTIMATE</span><h3>Rough annual running budget</h3></div><strong>£${Number(analysis.annualCost.low || 0).toLocaleString()}–£${Number(analysis.annualCost.high || 0).toLocaleString()}</strong><small>Estimate only; excludes insurance, finance and exact VED.</small></article>` : ''}
        <p class="derived-notice">This is a time-limited BIISMO REG snapshot of official records and clearly labelled calculated insights. Check the live registration again before making a purchase decision.</p>
        <div class="actions-row"><a class="primary-button button-link" href="/?reg=${encodeURIComponent(vehicle.registration || '')}">Run a live BIISMO check</a></div>
      </section>`;
  }

  async function load() {
    const token = new URLSearchParams(location.search).get('token') || '';
    if (!/^[0-9a-f]{24}$/i.test(token)) {
      status.textContent = 'That shared BIISMO report link is invalid.';
      return;
    }
    try {
      const response = await fetch(`/api/shared-report/${encodeURIComponent(token)}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'This report is unavailable.');
      render(data);
    } catch (error) {
      status.textContent = error.message || 'This shared report could not be loaded.';
    }
  }

  load();
})();