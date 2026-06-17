let currentCrop = null;
let charts = {};

function quickSearch(name) { document.getElementById('crop-input').value = name; searchCrop(); }

async function searchCrop() {
  const name = document.getElementById('crop-input').value.trim();
  if (!name) { alert('Please enter a crop name'); return; }
  const state = document.getElementById('state-filter').value;
  const period = document.getElementById('period-filter').value;
  const rs = document.getElementById('results-section');
  rs.style.display = 'block';
  document.getElementById('search-loader').style.display = 'flex';
  document.getElementById('results-content').style.display = 'none';
  rs.scrollIntoView({ behavior: 'smooth' });
  try {
    const res = await fetch('/api/search?crop=' + encodeURIComponent(name) + '&state=' + state + '&period=' + period);
    const data = await res.json();
    if (data.error) {
      document.getElementById('search-loader').style.display = 'none';
      alert(data.message || 'Crop not found. Try: Tomato, Rice, Cotton, Onion, Maize.');
      return;
    }
    setTimeout(() => renderResults(name, data), 600);
  } catch (err) {
    document.getElementById('search-loader').style.display = 'none';
    alert('Error fetching crop data. Please try again.');
  }
}

function renderResults(name, data) {
  currentCrop = data;
  document.getElementById('search-loader').style.display = 'none';
  document.getElementById('results-content').style.display = 'block';
  document.getElementById('result-title').textContent = data.emoji + ' ' + name.charAt(0).toUpperCase() + name.slice(1) + ' Prices';
  document.getElementById('result-sub').textContent = 'Data from ' + data.districts.length + ' mandis \u2022 Source: ' + (data.source || 'AGMARKNET') + ' \u2022 ' + (data.dataDate || 'Today');
  document.getElementById('max-price').textContent = '\u20B9' + data.max.toLocaleString();
  document.getElementById('max-district').textContent = data.maxDistrict;
  document.getElementById('min-price').textContent = '\u20B9' + data.min.toLocaleString();
  document.getElementById('min-district').textContent = data.minDistrict;
  document.getElementById('avg-price').textContent = '\u20B9' + data.avg.toLocaleString();
  const bestDist = data.districts[data.districts.length - 1];
  document.getElementById('best-buy').textContent = bestDist.name;
  document.getElementById('best-buy-price').textContent = '\u20B9' + bestDist.min + '/q lowest seen';

  // MSP comparison
  if (data.msp && data.msp.kharif) {
    const mspBox = document.createElement('div');
    mspBox.className = 'price-card avg';
    mspBox.style.borderTop = '4px solid #16a34a';
    mspBox.innerHTML = '<div class="price-card-label">Govt MSP</div><div class="price-card-value" style="font-size:1.5rem">\u20B9' + data.msp.kharif.toLocaleString() + '</div><div class="price-card-unit">' + data.msp.unit + '</div><div class="price-card-sub">' + (data.avg > data.msp.kharif ? '\u2705 Above MSP' : '\u26A0\uFE0F Below MSP') + '</div>';
    document.querySelector('.price-cards').appendChild(mspBox);
  }

  const il = document.getElementById('ai-insights-list');
  il.innerHTML = data.insights.map(function(i) { return '<li><i class="fas fa-circle-check"></i> ' + i + '</li>'; }).join('');

  const tb = document.getElementById('district-tbody');
  tb.innerHTML = data.districts.map(function(d) {
    var badge = d.status === 'high' ? '<span class="badge-high">High Rate</span>' : d.status === 'low' ? '<span class="badge-low">Best Buy</span>' : '<span class="badge-mid">Average</span>';
    var variety = d.varieties ? '<br><small style="color:var(--text-light)">' + d.varieties + '</small>' : '';
    return '<tr><td><strong>' + d.name + '</strong></td><td>' + d.state + '</td><td>' + d.mandi + variety + '</td><td>\u20B9' + d.min.toLocaleString() + '</td><td>\u20B9' + d.max.toLocaleString() + '</td><td>\u20B9' + d.modal.toLocaleString() + '</td><td>' + badge + '</td></tr>';
  }).join('');

  renderCharts(data);
}

function renderCharts(data) {
  Object.values(charts).forEach(function(c) { c.destroy(); });
  charts = {};

  // District bar chart
  var top10 = data.districts.slice(0, 10);
  charts.district = new Chart(document.getElementById('districtChart'), {
    type: 'bar',
    data: { labels: top10.map(function(d) { return d.name; }), datasets: [
      { label: 'Min', data: top10.map(function(d) { return d.min; }), backgroundColor: 'rgba(245,158,11,0.7)' },
      { label: 'Modal', data: top10.map(function(d) { return d.modal; }), backgroundColor: 'rgba(45,122,79,0.7)' },
      { label: 'Max', data: top10.map(function(d) { return d.max; }), backgroundColor: 'rgba(49,130,206,0.7)' }
    ] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, scales: { y: { ticks: { callback: function(v) { return '\u20B9' + v.toLocaleString(); } } } } }
  });

  // Price distribution
  var prices = data.districts.map(function(d) { return d.modal; }).sort(function(a, b) { return a - b; });
  var min = Math.min.apply(null, prices);
  var max = Math.max.apply(null, prices);
  var step = Math.max(1, Math.round((max - min) / 6));
  var buckets = [];
  var bucketLabels = [];
  for (var i = min; i <= max; i += step) {
    var count = prices.filter(function(p) { return p >= i && p < i + step; }).length;
    if (count > 0) {
      bucketLabels.push('\u20B9' + i + '-' + (i + step));
      buckets.push(count);
    }
  }
  charts.trend = new Chart(document.getElementById('trendChart'), {
    type: 'bar',
    data: { labels: bucketLabels, datasets: [{ label: 'Number of Mandis', data: buckets, backgroundColor: 'rgba(45,122,79,0.6)', borderRadius: 6 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, title: { display: true, text: 'Price Distribution Across Mandis' } } }
  });

  // State comparison
  var apDistricts = data.districts.filter(function(d) { return d.state === 'AP'; });
  var tgDistricts = data.districts.filter(function(d) { return d.state === 'TG'; });
  var apAvg = apDistricts.length > 0 ? Math.round(apDistricts.reduce(function(s, d) { return s + d.modal; }, 0) / apDistricts.length) : 0;
  var tgAvg = tgDistricts.length > 0 ? Math.round(tgDistricts.reduce(function(s, d) { return s + d.modal; }, 0) / tgDistricts.length) : 0;
  charts.seasonal = new Chart(document.getElementById('seasonalChart'), {
    type: 'bar',
    data: { labels: ['Andhra Pradesh', 'Telangana'], datasets: [{ label: 'Avg Modal Price (\u20B9/q)', data: [apAvg, tgAvg], backgroundColor: ['rgba(45,122,79,0.7)', 'rgba(245,158,11,0.7)'], borderRadius: 6 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: function(v) { return '\u20B9' + v.toLocaleString(); } } } } }
  });

  // Min vs Max spread
  charts.supply = new Chart(document.getElementById('supplyChart'), {
    type: 'scatter',
    data: { datasets: [{
      label: 'Min vs Max Price',
      data: data.districts.map(function(d) { return { x: d.min, y: d.max }; }),
      backgroundColor: 'rgba(45,122,79,0.6)',
      pointRadius: 8
    }] },
    options: { responsive: true, maintainAspectRatio: false, scales: { x: { title: { display: true, text: 'Min Price (\u20B9/q)' } }, y: { title: { display: true, text: 'Max Price (\u20B9/q)' } } } }
  });
}

function switchChart(name, btn) {
  document.querySelectorAll('.chart-tab').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  ['trend', 'district', 'seasonal', 'supply'].forEach(function(n) {
    document.getElementById('chart-' + n).style.display = n === name ? 'block' : 'none';
  });
}

function exportData() { downloadCSV(); }

function downloadCSV() {
  if (!currentCrop) { alert('Search for a crop first'); return; }
  var csv = 'District,State,Market/Mandi,Min Price (INR/q),Max Price (INR/q),Modal Price (INR/q),Status\n';
  currentCrop.districts.forEach(function(d) {
    var status = d.status === 'high' ? 'High Rate' : d.status === 'low' ? 'Best Buy' : 'Average';
    csv += '"' + d.name + '","' + d.state + '","' + d.mandi + '",' + d.min + ',' + d.max + ',' + d.modal + ',"' + status + '"\n';
  });
  var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'NatureBasket_' + (currentCrop.key || 'crop') + '_prices_' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function downloadExcel() {
  if (!currentCrop) { alert('Search for a crop first'); return; }
  var html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">';
  html += '<head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Prices</x:Name></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>';
  html += '<body>';
  html += '<h2>NatureBasket - ' + (currentCrop.key || 'Crop').toUpperCase() + ' Prices</h2>';
  html += '<p>Source: ' + (currentCrop.source || 'AGMARKNET') + ' | Date: ' + (currentCrop.dataDate || new Date().toLocaleDateString('en-IN')) + '</p>';
  html += '<table border="1">';
  html += '<tr style="background:#1a4a2e;color:#fff;font-weight:bold"><th>District</th><th>State</th><th>Market / Mandi</th><th>Min Price (\u20B9/q)</th><th>Max Price (\u20B9/q)</th><th>Modal Price (\u20B9/q)</th><th>Status</th></tr>';
  currentCrop.districts.forEach(function(d) {
    var status = d.status === 'high' ? 'High Rate' : d.status === 'low' ? 'Best Buy' : 'Average';
    var bg = d.status === 'high' ? '#dcfce7' : d.status === 'low' ? '#fee2e2' : '#fef9c3';
    html += '<tr style="background:' + bg + '"><td><b>' + d.name + '</b></td><td>' + d.state + '</td><td>' + d.mandi + '</td><td>\u20B9' + d.min.toLocaleString() + '</td><td>\u20B9' + d.max.toLocaleString() + '</td><td>\u20B9' + d.modal.toLocaleString() + '</td><td>' + status + '</td></tr>';
  });
  html += '</table>';
  if (currentCrop.msp && currentCrop.msp.kharif) {
    html += '<p style="margin-top:10px"><b>Government MSP:</b> \u20B9' + currentCrop.msp.kharif.toLocaleString() + '/q (' + currentCrop.msp.unit + ')</p>';
  }
  html += '</body></html>';
  var blob = new Blob([html], { type: 'application/vnd.ms-excel' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'NatureBasket_' + (currentCrop.key || 'crop') + '_prices_' + new Date().toISOString().slice(0,10) + '.xls';
  a.click();
  URL.revokeObjectURL(url);
}

function printTable() {
  if (!currentCrop) { alert('Search for a crop first'); return; }
  var w = window.open('', '_blank');
  var html = '<!DOCTYPE html><html><head><title>NatureBasket - ' + currentCrop.key + ' Prices</title>';
  html += '<style>body{font-family:Arial,sans-serif;padding:20px}h1{color:#1a4a2e}table{width:100%;border-collapse:collapse;margin:20px 0}th{background:#1a4a2e;color:#fff;padding:10px;text-align:left}td{padding:8px 10px;border-bottom:1px solid #e0ece5}.high{background:#dcfce7}.low{background:#fee2e2}.mid{background:#fef9c3}@media print{button{display:none}}</style>';
  html += '</head><body>';
  html += '<h1>NatureBasket - ' + (currentCrop.key || 'Crop').charAt(0).toUpperCase() + (currentCrop.key || '').slice(1) + ' Prices</h1>';
  html += '<p><b>Source:</b> ' + (currentCrop.source || 'AGMARKNET') + ' | <b>Date:</b> ' + (currentCrop.dataDate || new Date().toLocaleDateString('en-IN')) + '</p>';
  if (currentCrop.msp && currentCrop.msp.kharif) {
    html += '<p><b>Government MSP:</b> \u20B9' + currentCrop.msp.kharif.toLocaleString() + '/q (' + currentCrop.msp.unit + ')</p>';
  }
  html += '<table><tr><th>District</th><th>State</th><th>Market / Mandi</th><th>Min (\u20B9/q)</th><th>Max (\u20B9/q)</th><th>Modal (\u20B9/q)</th><th>Status</th></tr>';
  currentCrop.districts.forEach(function(d) {
    var status = d.status === 'high' ? 'High Rate' : d.status === 'low' ? 'Best Buy' : 'Average';
    html += '<tr class="' + d.status + '"><td><b>' + d.name + '</b></td><td>' + d.state + '</td><td>' + d.mandi + '</td><td>\u20B9' + d.min.toLocaleString() + '</td><td>\u20B9' + d.max.toLocaleString() + '</td><td>\u20B9' + d.modal.toLocaleString() + '</td><td>' + status + '</td></tr>';
  });
  html += '</table>';
  html += '<p style="color:#888;font-size:12px;margin-top:20px">Generated by NatureBasket | data.gov.in AGMARKNET</p>';
  html += '<div style="text-align:center;margin:20px 0"><button onclick="window.print()" style="padding:10px 24px;background:#1a4a2e;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px">Print Now</button></div>';
  html += '</body></html>';
  w.document.write(html);
  w.document.close();
}

window.addEventListener('DOMContentLoaded', function() {
  var params = new URLSearchParams(window.location.search);
  var crop = params.get('crop');
  if (crop) {
    document.getElementById('crop-input').value = crop;
    searchCrop();
  }
});
