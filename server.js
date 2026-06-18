const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000; // Defaulting to Render's port

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── CONFIG ───
const DATAGOV_API_KEY = process.env.DATAGOV_API_KEY || '';
const MANDI_API_BASE = 'https://mandi-api-production.up.railway.app/api/mandi/prices';
const DATAGOV_RESOURCE = '9ef84268-d588-465a-a308-a864a43d0070';

// ─── MSP DATA ───
const MSP_DATA = {
  'rice': { kharif: 2300, rabi: 2300, unit: '₹/quintal' },
  'wheat': { kharif: 2275, rabi: 2275, unit: '₹/quintal' },
  'maize': { kharif: 2225, rabi: 2225, unit: '₹/quintal' },
  'cotton': { kharif: 7020, rabi: 7020, unit: '₹/quintal (long staple)' },
  'groundnut': { kharif: 6783, rabi: 6783, unit: '₹/quintal' },
  'soybean': { kharif: 4892, rabi: 4892, unit: '₹/quintal' },
  'turmeric': { kharif: 7000, rabi: 7000, unit: '₹/quintal (indicative)' },
  'onion': { kharif: null, rabi: null, unit: 'No MSP (market determined)' },
  'tomato': { kharif: null, rabi: null, unit: 'No MSP (market determined)' },
  'chilli': { kharif: null, rabi: null, unit: 'No MSP (market determined)' },
  'potato': { kharif: null, rabi: null, unit: 'No MSP (market determined)' },
  'paddy': { kharif: 2300, rabi: 2300, unit: '₹/quintal' },
};

// ─── GOVERNMENT SCHEMES DATA ───
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

// ─── HELPER FUNCTIONS ───
function getCropEmoji(name) {
  const map = { tomato: '🍅', rice: '🌾', cotton: '🌿', onion: '🧅', maize: '🌽', groundnut: '🥜', turmeric: '🌼', chilli: '🌶️', wheat: '🌾', potato: '🥔', soybean: '🫘', paddy: '🌾' };
  return map[name.toLowerCase()] || '🌱';
}

function generateDynamicFallback(cropName, state = 'AP') {
  const cacheKey = cropName.toLowerCase();
  const mspInfo = MSP_DATA[cacheKey] || { kharif: 2200, rabi: 2200, unit: '₹/quintal' };
  const basePrice = mspInfo.kharif || mspInfo.rabi || 2000;
  
  const avg = Math.round(basePrice * 1.05); 
  const min = Math.round(basePrice * 0.85);
  const max = Math.round(basePrice * 1.25);

  const statesToInclude = (state === 'both' || !state) ? ['AP', 'TG'] : [state.toUpperCase()];
  const defaultDistrictsByState = {
    'AP': ['Kurnool', 'Guntur', 'Krishna', 'Anantapur'],
    'TG': ['Warangal', 'Karimnagar', 'Nizamabad', 'Rangareddy']
  };

  const districts = [];
  statesToInclude.forEach(st => {
    const names = defaultDistrictsByState[st] || ['Central Region'];
    names.forEach((name, idx) => {
      districts.push({
        name: name,
        state: st,
        mandi: `${name} Mandi Yard`,
        min: Math.round(min * (0.9 + idx * 0.05)),
        max: Math.round(max * (0.95 + idx * 0.04)),
        modal: Math.round(avg * (0.92 + idx * 0.03)),
        status: idx % 2 === 0 ? 'mid' : (idx === 0 ? 'high' : 'low')
      });
    });
  });

  return {
    crop: cropName,
    emoji: getCropEmoji(cropName),
    unit: 'quintal',
    source: 'Dynamically Generated Market Projection',
    max: Math.max(...districts.map(d => d.max)),
    maxDistrict: `${districts[0]?.name || 'Market'}, ${districts[0]?.state || 'IN'}`,
    min: Math.min(...districts.map(d => d.min)),
    minDistrict: `${districts[districts.length - 1]?.name || 'Market'}, ${districts[districts.length - 1]?.state || 'IN'}`,
    avg: avg,
    msp: mspInfo,
    districts: districts,
    insights: [
      `Live APMC feeds for "${cropName}" currently empty. Generating real-time market baseline.`,
      `Baseline calculations weighted against active Minimum Support Price configurations.`
    ]
  };
}

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

  const msp = MSP_DATA[cropName.toLowerCase()];
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
    msp: MSP_DATA[cropName.toLowerCase()] || null,
    districts: districtList,
    insights: [
      `Real market data from ${districtList.length} mandis across India. Updated ${new Date().toLocaleDateString('en-IN')}.`,
      `Note: AP & Telangana specific data not available for this crop. Showing nationwide data.`,
      `Source: data.gov.in AGMARKNET portal — Government of India.`
    ]
  };
}

// ─── API ROUTES ───

// Completely Dynamic Crop Dropdown List
app.get('/api/crops', (req, res) => {
  try {
    const cropKeys = Object.keys(MSP_DATA);
    const dynamicCrops = cropKeys.map(key => {
      const formattedName = key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
      return {
        key: key,
        emoji: getCropEmoji(key),
        name: formattedName
      };
    });
    return res.json({ crops: dynamicCrops });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error assembling dynamic directory." });
  }
});

// Search Route
app.get('/api/search', async (req, res) => {
  const { crop, state, period } = req.query;
  if (!crop) return res.status(400).json({ error: 'crop parameter is required' });

  const cleanInput = crop.trim().toLowerCase();
  const validCrops = Object.keys(MSP_DATA); // ['rice', 'wheat', 'maize', 'tomato', etc.]
  if (!validCrops.includes(cleanInput)) {
    return res.status(400).json({ 
      error: `"${crop}" is not recognized as a valid farming commodity. Please search for agricultural items (e.g., Rice, Wheat, Tomato, Groundnut).` 
    });
  }
  const cropName = cleanInput.charAt(0).toUpperCase() + cleanInput.slice(1).toLowerCase();

  console.log(`[SEARCH] ${cropName} | state=${state} | period=${period}`);

  let records = await fetchFromMandiAPI(cropName);
  if (!records) {
    records = await fetchDataGovIn(cropName, state);
  }

  if (records && records.length > 0) {
    const transformed = transformData(records, cropName);
    if (transformed) {
      if (state && state !== 'both') {
        transformed.districts = transformed.districts.filter(d => d.state === state);
      }
      return res.json(transformed);
    }
  }

  try {
    const dynamicData = generateDynamicFallback(cropName, state);
    return res.json(dynamicData);
  } catch (err) {
    return res.status(500).json({ error: "Failed to generate dynamic market projection." });
  }
});

// Get specific crop data Route
app.get('/api/crops/:name', async (req, res) => {
  const cleanParam = req.params.name.trim().toLowerCase();
  const validCrops = Object.keys(MSP_DATA);
  if (!validCrops.includes(cleanParam)) {
    return res.status(400).json({ error: 'Requested item is not a valid agricultural commodity.' });
  }
  const cropNameTitleCase = cleanParam.charAt(0).toUpperCase() + cleanParam.slice(1).toLowerCase();

  let records = await fetchFromMandiAPI(cropNameTitleCase);
  if (records && records.length > 0) {
    const transformed = transformData(records, cropNameTitleCase);
    if (transformed) return res.json(transformed);
  }

  try {
    const stateQuery = req.query.state || 'AP'; 
    const dynamicData = generateDynamicFallback(cropNameTitleCase, stateQuery);
    return res.json(dynamicData);
  } catch (error) {
    return res.status(504).json({ error: 'Crop data unavailable' });
  }
});

// Schemes Directory Route
app.get('/api/schemes', (req, res) => {
  const { query } = req.query;
  if (!query) return res.json({ schemes: SCHEMES });
  const q = query.toLowerCase();
  const matched = Object.entries(SCHEMES).filter(([k, v]) =>
    k.includes(q) || v.name.toLowerCase().includes(q) || v.details.toLowerCase().includes(q)
  );
  return res.json({ schemes: Object.fromEntries(matched) });
});

// Chat AI Assistant Endpoint
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });
  
  // Basic responses mapped higher up
  const m = message.toLowerCase().replace(/[?!.,]/g, '');
  if (m.match(/\b(hello|hi|hey|namaste)\b/)) {
    return res.json({ reply: 'Namaskaram! I am your NatureBasket AI advisor. How can I help you today?', source: 'knowledge-base' });
  }
  
  return res.json({ reply: 'I can help you with crop advice, government schemes (PM-KISAN, Fasal Bima), and market prices. Please ask about a crop or scheme!', source: 'knowledge-base' });
});

// Static HTML Page Deliveries
app.get('/price-check', (req, res) => res.sendFile(path.join(__dirname, 'public', 'price-check.html')));
app.get('/how-it-works', (req, res) => res.sendFile(path.join(__dirname, 'public', 'how-it-works.html')));
app.get('/features', (req, res) => res.sendFile(path.join(__dirname, 'public', 'features.html')));
app.get('/market-data', (req, res) => res.sendFile(path.join(__dirname, 'public', 'market-data.html')));

// ─── SINGLE COMPACT PORT LISTENER WITH FAILSAFE COOLDOWN ───
const server = app.listen(PORT, () => {
  console.log(`🚀 Dynamic Server successfully running on port ${PORT}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[PORT CONFLICT] Port ${PORT} is busy. Clearing listener process...`);
    setTimeout(() => {
      server.close();
      app.listen(PORT);
    }, 1000);
  } else {
    console.error('Server error:', err);
  }
});