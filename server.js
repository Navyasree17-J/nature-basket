const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── CONFIG ───
const DATAGOV_API_KEY = process.env.DATAGOV_API_KEY || '';
const MANDI_API_BASE = 'https://mandi-api-production.up.railway.app/api/mandi/prices';
const DATAGOV_RESOURCE = '9ef84268-d588-465a-a308-a864a43d0070';

// ─── MSP DATA (Source: data.gov.in / CACP recommendations 2024-25) ───
const MSP_DATA = {
  'Rice': { kharif: 2300, rabi: 2300, unit: '₹/quintal' },
  'Wheat': { kharif: 2275, rabi: 2275, unit: '₹/quintal' },
  'Maize': { kharif: 2225, rabi: 2225, unit: '₹/quintal' },
  'Cotton': { kharif: 7020, rabi: 7020, unit: '₹/quintal (long staple)' },
  'Groundnut': { kharif: 6783, rabi: 6783, unit: '₹/quintal' },
  'Soybean': { kharif: 4892, rabi: 4892, unit: '₹/quintal' },
  'Turmeric': { kharif: 7000, rabi: 7000, unit: '₹/quintal (indicative)' },
  'Onion': { kharif: null, rabi: null, unit: 'No MSP (market determined)' },
  'Tomato': { kharif: null, rabi: null, unit: 'No MSP (market determined)' },
  'Chilli': { kharif: null, rabi: null, unit: 'No MSP (market determined)' },
  'Potato': { kharif: null, rabi: null, unit: 'No MSP (market determined)' },
  'Paddy': { kharif: 2300, rabi: 2300, unit: '₹/quintal' },
};

// ─── GOVERNMENT SCHEMES DATA (Source: pmkisan.gov.in, data.gov.in) ───
const SCHEMES = {
  'pm kisan': {
    name: 'PM-KISAN Samman Nidhi',
    details: 'Central sector scheme launched 24 Feb 2019. Provides ₹6,000/year to all landholding farmer families in 3 equal instalments of ₹2,000 via Direct Benefit Transfer (DBT).',
    eligibility: 'All landholding farmer families. Exclusion: institutional landholders, former/current holders of constitutional posts, govt employees, pensioners, income tax payers.',
    website: 'pmkisan.gov.in',
    contact: 'PM-KISAN Helpline: 155261 / 1800-180-1551'
  },
  'pmfby': {
    name: 'Pradhan Mantri Fasal Bima Yojana',
    details: 'Crop insurance scheme. Premium: Kharif 2%, Rabi 1.5%, Commercial/Horticultural 5% of sum insured. Government pays remaining premium.',
    eligibility: 'All farmers including sharecroppers and tenant farmers growing notified crops in notified areas.',
    website: 'pmfby.gov.in',
    contact: 'Toll-free: 1800-180-1551'
  },
  'kcc': {
    name: 'Kisan Credit Card (KCC)',
    details: 'Provides affordable credit to farmers at 4% p.a. (after subvention). Covers crop production, post-harvest expenses, maintenance, and consumption needs.',
    eligibility: 'All farmers, fishers, and animal husbandry farmers.',
    website: 'www.nabard.org',
    contact: 'Contact your nearest bank branch'
  },
  'enam': {
    name: 'e-NAM (Electronic National Agriculture Market)',
    details: 'Online trading platform connecting 1000+ APMC mandis across India. Ensures transparent price discovery through auction mechanism.',
    eligibility: 'All farmers registered at any APMC mandi.',
    website: 'enam.gov.in',
    contact: 'e-NAM Helpdesk: 1800-180-1551'
  },
  'soil health': {
    name: 'Soil Health Card Scheme',
    details: 'Provides soil nutrient status and recommendations for appropriate fertilizer dosage. Free soil testing for all farmers.',
    eligibility: 'All farmers across India.',
    website: 'soilhealth.dac.gov.in',
    contact: 'Contact nearest KVK or agriculture office'
  },
  'rythu bharosa': {
    name: 'Rythu Bharosa - PM Kisan (AP/TG)',
    details: 'State scheme providing additional investment support to farmers. AP: ₹13,500/year (incl PM-KISAN). TG: ₹10,000/year investment support.',
    eligibility: 'All farmer families in AP/Telangana with land records.',
    website: 'ysrrythubharosa.gov.in (AP) / rythubandhu.telangana.gov.in (TG)',
    contact: 'AP: 1967 / TG: 1800-425-0012'
  }
};

// ─── FETCH FROM COMMUNITY MANDI API (real data.gov.in data) ───
async function fetchFromMandiAPI(cropName) {
  try {
    const res = await fetch(`${MANDI_API_BASE}/crop/${encodeURIComponent(cropName)}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) throw new Error(`Mandi API returned ${res.status}`);
    const data = await res.json();
    if (!data.value || data.value.length === 0) return null;
    return data.value;
  } catch (err) {
    console.error('Mandi API error:', err.message);
    return null;
  }
}

// ─── FETCH FROM data.gov.in (requires API key) ───
async function fetchDataGovIn(cropName, state) {
  if (!DATAGOV_API_KEY) return null;
  try {
    let url = `https://api.data.gov.in/resource/${DATAGOV_RESOURCE}?api-key=${DATAGOV_API_KEY}&format=json&limit=500&filters[commodity]=${encodeURIComponent(cropName)}`;
    if (state && state !== 'both') {
      const stateName = state === 'AP' ? 'ANDHRA PRADESH' : 'TELANGANA';
      url += `&filters[state]=${encodeURIComponent(stateName)}`;
    }
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`data.gov.in returned ${res.status}`);
    const data = await res.json();
    if (!data.records || data.records.length === 0) return null;
    return data.records.map(r => ({
      state: r.State || r.state || '',
      district: r.District || r.district || '',
      market: r.Market || r.market || '',
      commodity: r.Commodity || r.commodity || '',
      variety: r.Variety || r.variety || '',
      grade: r.Grade || r.grade || '',
      min_price: parseInt(r['Min Price'] || r.min_price || '0'),
      max_price: parseInt(r['Max Price'] || r.max_price || '0'),
      modal_price: parseInt(r['Modal Price'] || r.modal_price || '0'),
      arrival_date: r.Arrival_Date || r.arrival_date || ''
    }));
  } catch (err) {
    console.error('data.gov.in API error:', err.message);
    return null;
  }
}

// ─── TRANSFORM RAW DATA INTO APP FORMAT ───
function transformData(records, cropName) {
  const apRecords = records.filter(r => r.state === 'Andhra Pradesh' || r.state === 'ANDHRA PRADESH');
  const tgRecords = records.filter(r => r.state === 'Telangana' || r.state === 'TELANGANA');
  const relevantRecords = [...apRecords, ...tgRecords];

  if (relevantRecords.length === 0) {
    if (records.length > 0) {
      return transformFromAllIndia(records, cropName);
    }
    return null;
  }

  const districts = {};
  relevantRecords.forEach(r => {
    const key = r.district + '|' + r.state;
    if (!districts[key]) {
      districts[key] = {
        name: r.district,
        state: r.state === 'Andhra Pradesh' || r.state === 'ANDHRA PRADESH' ? 'AP' : 'TG',
        mandi: r.market,
        prices: [],
        varieties: new Set()
      };
    }
    districts[key].prices.push(r.modal_price || r.max_price || r.min_price);
    if (r.variety) districts[key].varieties.add(r.variety);
  });

  const districtList = Object.values(districts).map(d => {
    const prices = d.prices.filter(p => p > 0);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const modal = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
    return {
      name: d.name,
      state: d.state,
      mandi: d.mandi,
      min, max, modal,
      varieties: [...d.varieties].join(', '),
      status: 'mid'
    };
  }).sort((a, b) => b.modal - a.modal);

  if (districtList.length === 0) return null;

  const allPrices = districtList.flatMap(d => [d.min, d.max, d.modal]);
  const overallMax = Math.max(...allPrices);
  const overallMin = Math.min(...allPrices.filter(p => p > 0));
  const overallAvg = Math.round(districtList.reduce((s, d) => s + d.modal, 0) / districtList.length);

  districtList.forEach(d => {
    d.status = d.modal > overallAvg * 1.1 ? 'high' : d.modal < overallAvg * 0.9 ? 'low' : 'mid';
  });

  const bestHigh = districtList[0];
  const bestLow = districtList[districtList.length - 1];

  const msp = MSP_DATA[cropName.charAt(0).toUpperCase() + cropName.slice(1)];
  const insights = [];
  if (msp && msp.kharif) {
    if (overallAvg > msp.kharif) {
      insights.push(`Market price (₹${overallAvg}/q) is ABOVE MSP of ₹${msp.kharif}/q — good returns for farmers.`);
    } else {
      insights.push(`Market price (₹${overallAvg}/q) is below MSP of ₹${msp.kharif}/q — consider government procurement.`);
    }
  }
  insights.push(`Data from ${districtList.length} mandis in AP & Telangana. Updated ${new Date().toLocaleDateString('en-IN')}.`);
  if (bestHigh) insights.push(`Highest prices in ${bestHigh.name}, ${bestHigh.state === 'AP' ? 'Andhra Pradesh' : 'Telangana'} at ₹${bestHigh.max}/q.`);
  if (bestLow) insights.push(`Lowest prices in ${bestLow.name} at ₹${bestLow.min}/q — sell at higher-price mandi if transport allows.`);
  if (districtList.length > 3) {
    const priceGap = bestHigh.modal - bestLow.modal;
    const gapPercent = Math.round((priceGap / bestLow.modal) * 100);
    insights.push(`Price variation of ₹${priceGap}/q (${gapPercent}%) across mandis — location matters for profitability.`);
  }

  return {
    key: cropName.toLowerCase().trim(),
    emoji: getCropEmoji(cropName),
    unit: 'quintal',
    source: 'data.gov.in AGMARKNET via Mandi API',
    dataDate: records[0]?.arrival_date || new Date().toLocaleDateString('en-IN'),
    max: bestHigh ? bestHigh.max : overallMax,
    maxDistrict: bestHigh ? `${bestHigh.name}, ${bestHigh.state}` : 'N/A',
    min: bestLow ? bestLow.min : overallMin,
    minDistrict: bestLow ? `${bestLow.name}, ${bestLow.state}` : 'N/A',
    avg: overallAvg,
    msp: msp || null,
    districts: districtList,
    insights
  };
}

function transformFromAllIndia(records, cropName) {
  const districtList = [];
  const byDistrict = {};
  records.forEach(r => {
    const key = r.state + '|' + r.district;
    if (!byDistrict[key]) {
      byDistrict[key] = { state: r.state, district: r.district, market: r.market, prices: [] };
    }
    byDistrict[key].prices.push(r.modal_price || r.max_price || r.min_price);
  });
  Object.values(byDistrict).forEach(d => {
    const prices = d.prices.filter(p => p > 0);
    if (prices.length === 0) return;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const modal = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
    const isAP = d.state === 'Andhra Pradesh' || d.state === 'ANDHRA PRADESH';
    const isTG = d.state === 'Telangana' || d.state === 'TELANGANA';
    districtList.push({
      name: d.district,
      state: isAP ? 'AP' : isTG ? 'TG' : d.state.substring(0, 4).toUpperCase(),
      mandi: d.market,
      min, max, modal,
      status: 'mid'
    });
  });
  districtList.sort((a, b) => b.modal - a.modal);
  if (districtList.length === 0) return null;
  const allPrices = districtList.flatMap(d => [d.min, d.max, d.modal]);
  const overallAvg = Math.round(districtList.reduce((s, d) => s + d.modal, 0) / districtList.length);
  districtList.forEach(d => {
    d.status = d.modal > overallAvg * 1.1 ? 'high' : d.modal < overallAvg * 0.9 ? 'low' : 'mid';
  });
  return {
    key: cropName.toLowerCase().trim(),
    emoji: getCropEmoji(cropName),
    unit: 'quintal',
    source: 'data.gov.in AGMARKNET (nationwide)',
    dataDate: records[0]?.arrival_date || new Date().toLocaleDateString('en-IN'),
    max: districtList[0].max,
    maxDistrict: `${districtList[0].name}, ${districtList[0].state}`,
    min: districtList[districtList.length - 1].min,
    minDistrict: `${districtList[districtList.length - 1].name}, ${districtList[districtList.length - 1].state}`,
    avg: overallAvg,
    msp: MSP_DATA[cropName.charAt(0).toUpperCase() + cropName.slice(1)] || null,
    districts: districtList,
    insights: [
      `Real market data from ${districtList.length} mandis across India. Updated ${new Date().toLocaleDateString('en-IN')}.`,
      `Note: AP & Telangana specific data not available for this crop. Showing nationwide data.`,
      `Source: data.gov.in AGMARKNET portal — Government of India.`
    ]
  };
}

function getCropEmoji(name) {
  const map = { tomato: '\u{1F345}', rice: '\u{1F33E}', cotton: '\u{1F33F}', onion: '\u{1F9C5}', maize: '\u{1F33D}', groundnut: '\u{1F95C}', turmeric: '\u{1F33B}', chilli: '\u{1F336}\uFE0F', wheat: '\u{1F33E}', potato: '\u{1F954}', soybean: '\u{1FAD8}', paddy: '\u{1F33E}' };
  return map[name.toLowerCase()] || '\u{1F331}';
}

// ─── CACHED FALLBACK DATA ───
const CACHED_DATA = {
  tomato: {
    emoji: '\u{1F345}', unit: 'quintal', source: 'Cached AGMARKNET data',
    max: 3200, maxDistrict: 'Kurnool, AP', min: 820, minDistrict: 'Karimnagar, TG', avg: 1850,
    msp: MSP_DATA.Tomato,
    districts: [
      { name: 'Kurnool', state: 'AP', mandi: 'Kurnool APMC', min: 2800, max: 3200, modal: 3050, status: 'high' },
      { name: 'Guntur', state: 'AP', mandi: 'Guntur Main Yard', min: 2200, max: 2800, modal: 2500, status: 'high' },
      { name: 'Krishna', state: 'AP', mandi: 'Vijayawada Market', min: 1800, max: 2400, modal: 2100, status: 'mid' },
      { name: 'East Godavari', state: 'AP', mandi: 'Rajamahendravaram', min: 1600, max: 2200, modal: 1900, status: 'mid' },
      { name: 'West Godavari', state: 'AP', mandi: 'Bhimavaram', min: 1500, max: 2000, modal: 1750, status: 'mid' },
      { name: 'Rangareddy', state: 'TG', mandi: 'Bowenpally Mkt', min: 1200, max: 1800, modal: 1500, status: 'mid' },
      { name: 'Karimnagar', state: 'TG', mandi: 'Karimnagar Yard', min: 820, max: 1400, modal: 1100, status: 'low' },
      { name: 'Warangal', state: 'TG', mandi: 'Hanamkonda Market', min: 900, max: 1500, modal: 1200, status: 'low' }
    ],
    insights: ['Using cached data. API temporarily unavailable.', 'Source: data.gov.in AGMARKNET — Government of India.']
  },
  rice: {
    emoji: '\u{1F33E}', unit: 'quintal', source: 'Cached AGMARKNET data',
    max: 2400, maxDistrict: 'East Godavari, AP', min: 1800, minDistrict: 'Medak, TG', avg: 2100,
    msp: MSP_DATA.Rice,
    districts: [
      { name: 'East Godavari', state: 'AP', mandi: 'Rajamahendravaram', min: 2100, max: 2400, modal: 2250, status: 'high' },
      { name: 'West Godavari', state: 'AP', mandi: 'Bhimavaram Yard', min: 2050, max: 2350, modal: 2200, status: 'high' },
      { name: 'Krishna', state: 'AP', mandi: 'Vijayawada Market', min: 1950, max: 2300, modal: 2100, status: 'high' },
      { name: 'Warangal', state: 'TG', mandi: 'Hanamkonda', min: 2000, max: 2300, modal: 2150, status: 'high' },
      { name: 'Karimnagar', state: 'TG', mandi: 'Karimnagar', min: 1950, max: 2250, modal: 2100, status: 'high' },
      { name: 'Guntur', state: 'AP', mandi: 'Guntur APMC', min: 1900, max: 2250, modal: 2050, status: 'mid' },
      { name: 'Medak', state: 'TG', mandi: 'Medak APMC', min: 1800, max: 2100, modal: 1900, status: 'low' }
    ],
    insights: ['Using cached data. API temporarily unavailable.', 'Source: data.gov.in AGMARKNET — Government of India.']
  },
  cotton: {
    emoji: '\u{1F33F}', unit: 'quintal', source: 'Cached AGMARKNET data',
    max: 7800, maxDistrict: 'Guntur, AP', min: 6200, minDistrict: 'Adilabad, TG', avg: 7100,
    msp: MSP_DATA.Cotton,
    districts: [
      { name: 'Guntur', state: 'AP', mandi: 'Guntur Cotton Yard', min: 7400, max: 7800, modal: 7600, status: 'high' },
      { name: 'Krishna', state: 'AP', mandi: 'Machilipatnam', min: 7200, max: 7700, modal: 7450, status: 'high' },
      { name: 'Warangal', state: 'TG', mandi: 'Hanamkonda', min: 7000, max: 7500, modal: 7200, status: 'high' },
      { name: 'Kurnool', state: 'AP', mandi: 'Kurnool APMC', min: 7000, max: 7500, modal: 7250, status: 'high' },
      { name: 'Karimnagar', state: 'TG', mandi: 'Karimnagar', min: 6800, max: 7300, modal: 7050, status: 'mid' },
      { name: 'Nalgonda', state: 'TG', mandi: 'Suryapet', min: 6500, max: 7000, modal: 6750, status: 'mid' },
      { name: 'Adilabad', state: 'TG', mandi: 'Adilabad APMC', min: 6200, max: 6800, modal: 6500, status: 'low' }
    ],
    insights: ['Using cached data. API temporarily unavailable.', 'Source: data.gov.in AGMARKNET — Government of India.']
  }
};

// ─── API ROUTES ───

// Get available crops list
app.get('/api/crops', (req, res) => {
  res.json({
    crops: [
      { key: 'tomato', emoji: '\u{1F345}', name: 'Tomato' },
      { key: 'rice', emoji: '\u{1F33E}', name: 'Rice' },
      { key: 'cotton', emoji: '\u{1F33F}', name: 'Cotton' },
      { key: 'onion', emoji: '\u{1F9C5}', name: 'Onion' },
      { key: 'maize', emoji: '\u{1F33D}', name: 'Maize' },
      { key: 'groundnut', emoji: '\u{1F95C}', name: 'Groundnut' },
      { key: 'wheat', emoji: '\u{1F33E}', name: 'Wheat' },
      { key: 'potato', emoji: '\u{1F954}', name: 'Potato' },
      { key: 'chilli', emoji: '\u{1F336}\uFE0F', name: 'Chilli' },
      { key: 'soybean', emoji: '\u{1FAD8}', name: 'Soybean' }
    ]
  });
});

// Search crop — tries real APIs first, falls back to cached data
app.get('/api/search', async (req, res) => {
  const { crop, state, period } = req.query;
  if (!crop) return res.status(400).json({ error: 'crop parameter is required' });

  const cropName = crop.trim();
  const cacheKey = cropName.toLowerCase();

  console.log(`[SEARCH] ${cropName} | state=${state} | period=${period}`);

  // Try 1: Community Mandi API (free, real data.gov.in data)
  let records = await fetchFromMandiAPI(cropName);

  // Try 2: data.gov.in direct API (if user has API key)
  if (!records) {
    records = await fetchDataGovIn(cropName, state);
  }

  // Try 3: Cached fallback
  if (records && records.length > 0) {
    const transformed = transformData(records, cropName);
    if (transformed) {
      // Apply state filter
      if (state && state !== 'both') {
        transformed.districts = transformed.districts.filter(d => d.state === state);
      }
      return res.json(transformed);
    }
  }

  // Fallback to cached data
  if (CACHED_DATA[cacheKey]) {
    const cached = { ...CACHED_DATA[cacheKey] };
    cached.insights = ['Using cached data — live API temporarily unavailable.', ...cached.insights];
    if (state && state !== 'both') {
      cached.districts = cached.districts.filter(d => d.state === state);
    }
    return res.json(cached);
  }

  // No data at all
  return res.status(404).json({
    error: 'Crop not found',
    message: `No data available for "${cropName}". Try: Tomato, Rice, Cotton, Onion, Maize, Groundnut, Wheat, Potato, Chilli, Soybean.`,
    availableCrops: Object.keys(CACHED_DATA)
  });
});

// Get specific crop data
app.get('/api/crops/:name', async (req, res) => {
  const cropName = req.params.name.toLowerCase().trim();
  const records = await fetchFromMandiAPI(cropName);
  if (records && records.length > 0) {
    const transformed = transformData(records, cropName);
    if (transformed) return res.json(transformed);
  }
  if (CACHED_DATA[cropName]) return res.json(CACHED_DATA[cropName]);
  res.status(404).json({ error: 'Crop not found' });
});

// MSP data
app.get('/api/msp', (req, res) => {
  res.json({ msp: MSP_DATA, source: 'CACP Recommendations 2024-25 via data.gov.in' });
});

// Government schemes
app.get('/api/schemes', (req, res) => {
  const { query } = req.query;
  if (!query) return res.json({ schemes: SCHEMES });
  const q = query.toLowerCase();
  const matched = Object.entries(SCHEMES).filter(([k, v]) =>
    k.includes(q) || v.name.toLowerCase().includes(q) || v.details.toLowerCase().includes(q)
  );
  res.json({ schemes: Object.fromEntries(matched) });
});

// Page routes
app.get('/price-check', (req, res) => res.sendFile(path.join(__dirname, 'public', 'price-check.html')));
app.get('/how-it-works', (req, res) => res.sendFile(path.join(__dirname, 'public', 'how-it-works.html')));
app.get('/features', (req, res) => res.sendFile(path.join(__dirname, 'public', 'features.html')));
app.get('/market-data', (req, res) => res.sendFile(path.join(__dirname, 'public', 'market-data.html')));

app.listen(PORT, () => {
  console.log(`\n===================================`);
  console.log(` NatureBasket Server Running`);
  console.log(` http://localhost:${PORT}`);
  console.log(`===================================`);
  console.log(` Data sources:`);
  console.log(`  - Mandi API: ${MANDI_API_BASE}`);
  console.log(`  - data.gov.in: ${DATAGOV_API_KEY ? 'API key configured' : 'No API key (using Mandi API + cache)'}`);
  console.log(`\n To use data.gov.in directly, set:`);
  console.log(`  $env:DATAGOV_API_KEY="your-key-from-data.gov.in"`);
  console.log(`  npm start`);
  console.log(`===================================\n`);
});
