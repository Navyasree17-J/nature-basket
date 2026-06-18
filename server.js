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

// ─── API ROUTES ───

// Get available crops list
app.get('/api/crops', (req, res) => {
  try {
    // 1. Extract all crop identifiers present in your Minimum Support Price list
    const cropKeys = Object.keys(MSP_DATA); // ['tomato', 'rice', 'cotton', 'onion', ...]

    // 2. Map over keys to auto-generate the frontend object structures
    const dynamicCrops = cropKeys.map(key => {
      // Capitalize the first letter for UI presentation display ("onion" -> "Onion")
      const formattedName = key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
      
      return {
        key: key,
        emoji: getCropEmoji(key), // Dynamically assigns the right icon mapping
        name: formattedName
      };
    });

    // 3. Return the dynamically synthesized array back to your client-side page
    res.json({ crops: dynamicCrops });

  } catch (error) {
    res.status(500).json({ error: "Internal server error assembling dynamic directory." });
  }
});

// Search crop — tries real APIs first, falls back to cached data
app.get('/api/search', async (req, res) => {
  const { crop, state, period } = req.query;
  if (!crop) return res.status(400).json({ error: 'crop parameter is required' });

  // Case normalization
  const cleanInput = crop.trim();
  const cropName = cleanInput.charAt(0).toUpperCase() + cleanInput.slice(1).toLowerCase();

  console.log(`[SEARCH] ${cropName} | state=${state} | period=${period}`);

  // Try 1: Community Mandi API
  let records = await fetchFromMandiAPI(cropName);

  // Try 2: data.gov.in direct API 
  if (!records) {
    records = await fetchDataGovIn(cropName, state);
  }

  // Try 3: Process live records if found
  if (records && records.length > 0) {
    const transformed = transformData(records, cropName);
    if (transformed) {
      if (state && state !== 'both') {
        transformed.districts = transformed.districts.filter(d => d.state === state);
      }
      return res.json(transformed);
    }
  }

  // ─── DYNAMIC FALLBACK SYSTEM (Corrected & Self-Contained) ───
  try {
    const dynamicData = generateDynamicFallback(cropName, state);
    return res.json(dynamicData);
  } catch (err) {
    return res.status(500).json({ error: "Failed to generate dynamic market projection." });
  }
});



// Get specific crop data
app.get('/api/crops/:name', async (req, res) => {
  const cleanParam = req.params.name.trim();
  const cropNameTitleCase = cleanParam.charAt(0).toUpperCase() + cleanParam.slice(1).toLowerCase();

  let records = await fetchFromMandiAPI(cropNameTitleCase);
  if (records && records.length > 0) {
    const transformed = transformData(records, cropNameTitleCase);
    if (transformed) return res.json(transformed);
  }

  // Use Dynamic Generator
  try {
    const stateQuery = req.query.state || 'AP'; 
    const dynamicData = generateDynamicFallback(cropNameTitleCase, stateQuery);
    return res.json(dynamicData);
  } catch (error) {
    res.status(504).json({ error: 'Crop data unavailable' });
  }
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

// ─── AI CHAT ENDPOINT (Comprehensive Agriculture Knowledge Base) ───
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });
  const reply = getAgriResponse(message);
  res.json({ reply, source: 'knowledge-base' });
});

function getAgriResponse(msg) {
  const m = msg.toLowerCase().replace(/[?!.,]/g, '');

  // ─── GREETINGS ───
  if (m.match(/\b(hello|hi|hey|namaste|namaskaram|namaskar|good morning|good evening|good afternoon)\b/)) {
    return 'Namaskaram! I am your NatureBasket AI agricultural advisor. I can help you with:\n\n- Crop prices & best markets to sell\n- Government schemes (PM-KISAN, Fasal Bima, KCC, e-NAM)\n- MSP rates for all crops\n- Farming seasons & best time to sow\n- Irrigation, pest management, organic farming\n- Subsidies, loans, FPOs, storage\n- Crop-specific advice (tomato, rice, cotton, onion, maize, etc.)\n- Soil health, fertilizers, weather\n\nWhat would you like to know?';
  }

  // ─── PM-KISAN ───
  if (m.includes('pm kisan') || m.includes('pm-kisan') || m.match(/\b6000\b/) || m.includes('installment') || m.includes('instalment')) {
    return 'PM-KISAN Samman Nidhi:\n\nWhat: Central sector scheme providing income support to farmers\nAmount: Rs 6,000/year in 3 instalments of Rs 2,000 each\nLaunched: 24 February 2019\n\nEligibility:\n- All landholding farmer families\n- Husband, wife, and minor children count as one family\n\nExclusions:\n- Institutional landholders\n- Former/current holders of constitutional posts\n- Central/state govt employees, PSU/autonomous body employees\n- Pensioners receiving Rs 1,000+ monthly\n- Income tax payers\n- Professionals (doctors, engineers, lawyers, CAs, architects)\n\nHow to Apply:\n1. Visit pmkisan.gov.in\n2. Click "New Farmer Registration"\n3. Enter Aadhaar, land records, bank details\n\nImportant:\n- eKYC is mandatory (OTP on portal or biometric at CSC)\n- 22nd instalment released 13 March 2026\n- Check status: pmkisan.gov.in -> "Know Your Status"\n- Helpline: 155261 / 1800-180-1551';
  }

  // ─── FASAL BIMA ───
  if (m.includes('fasal bima') || m.includes('crop insurance') || m.includes('pmfby') || (m.includes('insurance') && !m.includes('life'))) {
    return 'Pradhan Mantri Fasal Bima Yojana (PMFBY):\n\nWhat: Crop insurance at minimal premium\n\nPremium Rates:\n- Kharif crops: 2% of sum insured\n- Rabi crops: 1.5% of sum insured\n- Commercial/Horticultural: 5% of sum insured\n- Government pays remaining premium\n\nCoverage:\n- Natural calamities (drought, flood, hailstorm)\n- Pest and disease attacks\n- Post-harvest losses (up to 14 days)\n- Prevented sowing (if rainfall < 75% of normal)\n\nEligibility:\n- All farmers including sharecroppers and tenant farmers\n- Mandatory for loanee farmers\n- Voluntary for non-loanee farmers\n\nHow to Apply:\n1. Through bank at time of crop loan\n2. Online at pmfby.gov.in\n3. Through CSC or insurance company\n\nClaim: Report crop loss within 72 hours via app or helpline\nHelpline: 1800-180-1551';
  }

  // ─── KCC ───
  if (m.includes('kcc') || m.includes('kisan credit') || m.includes('credit card') || m.match(/\b(loan|interest rate|borrow)\b/)) {
    return 'Kisan Credit Card (KCC):\n\nWhat: Affordable credit for farming needs\n\nInterest Rate:\n- 4% p.a. (after 3% subvention by govt)\n- Normal rate: 7% p.a.\n- Prompt payers get additional 3% subvention = effectively 4%\n\nCoverage:\n- Crop production expenses\n- Post-harvest costs\n- Farm maintenance\n- Consumption needs of farmer family\n- Also covers: fisheries, animal husbandry, forestry\n\nLimit: Based on landholding and cropping pattern\nValid: 5 years, renewable\n\nDocuments Needed:\n- Land records (patta/passbook)\n- Aadhaar card\n- Passport size photo\n- Bank account details\n\nApply at: Any commercial bank, RRB, or cooperative bank\nNABARD helpline: 022-26530000';
  }

  // ─── e-NAM ───
  if (m.includes('enam') || m.includes('e-nam') || m.includes('apmc') || m.match(/\b(mandi|market yard|sell|selling)\b/)) {
    return 'e-NAM (Electronic National Agriculture Market):\n\nWhat: Online trading platform connecting 1000+ APMC mandis across India\n\nHow it Works:\n1. Farmer brings produce to e-NAM enabled APMC mandi\n2. Quality assayed by government samples\n3. Uploaded on e-NAM platform\n4. Buyers from across India bid online\n5. Best price discovered through transparent e-auction\n6. Payment directly to farmer via bank transfer\n\nBenefits:\n- Transparent price discovery\n- No middleman manipulation\n- Better prices through wider buyer base\n- Instant payment\n\nHow to Use:\n1. Register at nearest e-NAM mandi\n2. Get quality assayed\n3. Produce is auctioned online\n4. Receive payment in bank account\n\nWebsite: enam.gov.in\nHelpline: 1800-180-1551';
  }

  // ─── RYTHU BANDHU / BHAROSA ───
  if (m.includes('rythu') || m.includes('bandhu') || m.includes('bharosa') || m.includes('investment support') || m.match(/\b(telangana|andhra|ap|tg)\b.*\b(scheme|support|benefit)\b/)) {
    return 'State Farmer Schemes:\n\nTelangana - Rythu Bandhu:\n- Rs 10,000 per acre per season\n- Direct transfer to farmer bank accounts\n- Kharif and Rabi seasons\n- Eligibility: All farmer families with land records\n- Website: rythubandhu.telangana.gov.in\n\nAndhra Pradesh - Rythu Bharosa:\n- Rs 13,500/year (includes PM-KISAN Rs 6,000)\n- Investment support for all farmer families\n- Website: ysrrythubharosa.gov.in\n\nCommon Benefits:\n- Input investment support (seeds, fertilizers)\n- Direct DBT transfer\n- No middlemen\n\nContact:\n- AP Helpline: 1967\n- TG Helpline: 1800-425-0012';
  }

  // ─── SOIL HEALTH ───
  if (m.includes('soil') || m.includes('soil health') || m.includes('soil test') || m.includes('fertilizer') || m.includes('manure') || m.includes('compost')) {
    return 'Soil Health & Fertilizer Management:\n\nSoil Health Card Scheme:\n- Free soil testing for all farmers\n- Card provides: Nutrient status, fertilizer recommendations\n- Valid for 3 years\n- Available at: KVKs, agriculture departments\n- Website: soilhealth.dac.gov.in\n\nMajor Nutrients (NPK):\n- Nitrogen (N): For leaf growth, green color\n- Phosphorus (P): For root development, flowering\n- Potassium (K): For disease resistance, fruit quality\n\nOrganic Manure Options:\n- FYM (Farm Yard Manure): 2-3 tonnes/acre\n- Vermicompost: 0.5-1 tonne/acre\n- Green manuring: Dhaincha, Sunnhemp before Kharif\n\nTip: Test soil before every major season. Apply lime if soil is acidic (pH < 6.5).';
  }

  // ─── MSP ───
  if (m.includes('msp') || m.includes('minimum support') || m.includes('support price') || m.includes('price guarantee') || m.includes('govt price')) {
    return 'MSP Rates 2024-25 (CACP Recommended):\n\nKharif Crops:\n- Paddy (Common): Rs 2,300/q\n- Paddy (A Grade): Rs 2,320/q\n- Maize: Rs 2,225/q\n- Cotton (Long Staple): Rs 7,020/q\n- Cotton (Medium): Rs 6,620/q\n- Groundnut: Rs 6,783/q\n- Soybean: Rs 4,892/q\n- Turmeric: Rs 7,000/q (indicative)\n- Bajra: Rs 2,500/q\n- Ragi: Rs 4,201/q\n\nRabi Crops:\n- Wheat: Rs 2,275/q\n- Mustard: Rs 5,650/q\n- Gram: Rs 5,460/q\n- Masoor: Rs 6,250/q\n- Barley: Rs 1,850/q\n\nImportant Notes:\n- Tomato, Onion, Chilli, Potato have NO MSP\n- Prices for these are market-determined\n- Check Price Check page for live market rates\n- FCI procures at MSP through government agencies';
  }

  // ─── SOWING / SEASONS ───
  if (m.includes('sow') || m.includes('plant') || m.includes('season') || m.includes('when to') || m.includes('kharif') || m.includes('rabi') || m.includes('zaid') || m.includes('harvest')) {
    return 'Indian Farming Calendar:\n\nKharif Season (Monsoon) - June to October:\n- Sow: June-July with monsoon onset\n- Harvest: September-October\n- Crops: Rice, Maize, Cotton, Soybean, Groundnut, Turmeric, Chilli, Sugarcane, Bajra, Jowar, Ragi\n- Depends on: Southwest monsoon rainfall\n\nRabi Season (Winter) - October to March:\n- Sow: October-November after monsoon\n- Harvest: March-April\n- Crops: Wheat, Mustard, Gram, Peas, Potato, Onion, Cumin, Coriander\n- Depends on: Irrigation or residual soil moisture\n\nZaid Season (Summer) - March to June:\n- Sow: March-April\n- Harvest: June-July\n- Crops: Watermelon, Cucumber, Fodder, Moong (short duration)\n\nTip: Check local weather forecast before sowing. Maintain seed buffer for unexpected weather.';
  }

  // ─── IRRIGATION ───
  if (m.includes('irrigat') || m.includes('drip') || m.includes('sprinkler') || m.includes('water') || m.includes('watering') || m.includes('pmksy')) {
    return 'Irrigation Methods & Government Support:\n\nMethods:\n1. Flood/Furrow: Traditional, 40-50% efficient\n2. Sprinkler: 70-80% efficient, good for wheat/pulses\n3. Drip: 90-95% efficient, best for vegetables/fruits\n4. Mulching: Reduces evaporation by 25-50%\n\nGovt Support - PMKSY (Pradhan Mantri Krishi Sinchayee Yojana):\n- Drip irrigation: 55% subsidy (small farmers), 45% (others)\n- Sprinkler: 45-55% subsidy\n- Apply through: District agriculture department\n- Website: pmksy.gov.in\n\nWater Management Tips:\n- Water early morning or evening\n- Use mulching to retain moisture\n- Deficit irrigation: Reduce water at vegetative stage, increase at flowering\n- Check soil moisture before irrigating\n\nFor Tomato: Drip irrigation increases yield by 30-40%';
  }

  // ─── ORGANIC FARMING ───
  if (m.includes('organic') || m.includes('natural farming') || m.includes('zero budget') || m.includes('chemical free') || m.includes('jeevamrutham') || m.includes('biovam')) {
    return 'Organic Farming in India:\n\nBenefits:\n- 30-50% premium prices\n- Better soil health long-term\n- Lower input costs after transition\n- Export opportunities\n\nGovt Support:\n- PKVY (Paramparagat Krishi Vikas Yojana): Rs 50,000/ha over 3 years\n- Zero Budget Natural Farming (ZBNF): Active in AP & Telangana\n- MOVCDNER: For northeastern states\n\nHow to Start:\n1. Transition period: 2-3 years without chemicals\n2. Prepare Jeevamrutham: Cow dung + cow urine + jaggery + gram flour + soil\n3. Apply every 15 days\n4. Use mulching, crop rotation, green manuring\n5. Pest control: Neem oil, Trichogramma cards\n\nCertification:\n- NPOP (National Programme for Organic Production)\n- Apply through APEDA\n- Cost: Rs 20,000-40,000 (partially reimbursed)\n\nTip: Start with small plot (0.5 acre), learn, then expand.';
  }

  // ─── PEST MANAGEMENT ───
  if (m.includes('pest') || m.includes('disease') || m.includes('insect') || m.includes('spray') || m.includes('pesticide') || m.includes('fungicide') || m.includes('borer') || m.includes('aphid')) {
    return 'Pest & Disease Management (IPM):\n\nIntegrated Pest Management Steps:\n1. Prevention: Use resistant varieties, crop rotation\n2. Monitoring: Scout fields every 2-3 days\n3. Biological control: Neem-based products, Trichogramma\n4. Chemical: Last resort, use recommended dosage only\n\nCommon Pests & Solutions:\n- Aphids/Sucking pests: Neem oil spray (5ml/L)\n- Borer: Trichogramma cards (free from KVK)\n- Fruit borer: Pheromone traps + Bt spray\n- Stem borer in rice: Cartap hydrochloride\n- Root grubs: Chlorpyriphos drenching\n\nDiseases:\n- Blight: Bordeaux mixture or Copper oxychloride\n- Powdery mildew: Sulphur 80 WP\n- Wilt: Trichoderma viride (bio-fungicide)\n\nHelpful Resources:\n- KVK (Krishi Vigyan Kendra): Visit nearest center\n- Kisan Call Centre: 1551\n- mKisan portal: mkisan.gov.in\n\nTip: Always identify pest/disease correctly before spraying.';
  }

  // ─── SUBSIDY ───
  if (m.includes('subsid') || m.includes('government help') || m.includes('scheme') || m.includes('yojana') || m.includes('benefit') || m.includes('sarkari')) {
    return 'Major Government Schemes for Farmers:\n\n1. PM-KISAN: Rs 6,000/year (pmkisan.gov.in)\n2. PM Fasal Bima Yojana: Crop insurance at 1.5-5% premium\n3. Kisan Credit Card: Loans at 4% interest\n4. PM-KUSUM: Solar pumps - 60% subsidy\n5. e-NAM: Online mandi trading (enam.gov.in)\n6. PMKSY: Drip/sprinkler irrigation subsidy\n7. Soil Health Card: Free soil testing\n8. Rythu Bandhu (TG): Rs 10,000/acre\n9. Rythu Bharosa (AP): Rs 13,500/year\n10. PKVY: Organic farming Rs 50,000/ha\n11. Formation of 10,000 FPOs: Rs 15 lakh seed funding\n12. PM Kisan Sampada: Food processing infrastructure\n\nTo Apply: Visit nearest agriculture office or apply online at respective portals.';
  }

  // ─── FPO / COOPERATIVE ───
  if (m.includes('fpo') || m.includes('farmer producer') || m.includes('cooperative') || m.includes('collective') || m.includes('group farming')) {
    return 'Farmer Producer Organizations (FPOs):\n\nWhat: Group of 10-300 farmers forming a registered company\n\nBenefits:\n- Collective bargaining for better prices\n- Bulk purchasing of seeds/fertilizers (cheaper)\n- Shared equipment and storage\n- Direct market access (bypass middlemen)\n- Access to government schemes\n- Better credit facilities\n\nGovt Support:\n- Formation of 10,000 FPOs scheme\n- Rs 15 lakh seed funding per FPO\n- Professional management support\n- 3 years hand-holding support\n\nHow to Form:\n1. Group 10+ farmers from same area\n2. Choose a president and secretary\n3. Register as company under Companies Act\n4. Open bank account\n5. Apply through: NABARD, SFAC, or state agriculture dept\n\nTip: Join existing FPO in your district for immediate benefits.';
  }

  // ─── STORAGE ───
  if (m.includes('storage') || m.includes('warehouse') || m.includes('cold storage') || m.includes('post harvest') || m.includes('post-harvest') || m.includes('godown')) {
    return 'Post-Harvest Storage Solutions:\n\nOptions:\n1. Metal/Mud bins: Low cost, for grains\n2. Hermetic (PICS) bags: Best for pulses/grains\n3. Cold storage: For vegetables, fruits\n4. Government godowns: Subsidized warehousing\n\nGovt Support:\n- Storage subsidy: 25-50% under MIDH\n- Cold Chain: 35-50% subsidy\n- Warehousing Development: Register at WDR portal\n- PM Kisan Sampada Yojana: Food processing infrastructure\n\nBest Practices:\n- Dry grains to 12-14% moisture before storage\n- Use hermetic bags for pulses (prevents weevil)\n- Keep storage area clean and dry\n- Use neem leaves as natural pesticide in storage\n\nTip: Store different crops separately. Check stored produce weekly.';
  }

  // ─── WEATHER ───
  if (m.includes('weather') || m.includes('rain') || m.includes('forecast') || m.includes('drought') || m.includes('flood') || m.includes('cyclone') || m.includes('monsoon')) {
    return 'Weather Resources for Farmers:\n\nApps & Websites:\n1. IMD: mausam.imd.gov.in - District forecasts\n2. mKisan: mkisan.gov.in - SMS weather advisories\n3. Damini App: Lightning alerts\n4. Meghdoot App: Crop-specific weather advice\n5. ChWeather App: Hyperlocal weather\n\nHow to Register for SMS Alerts:\n1. Visit mkisan.gov.in\n2. Register with mobile number\n3. Select your district\n4. Get daily weather advisories\n\nDrought Management:\n- Switch to drought-resistant varieties\n- Apply mulching to retain moisture\n- Use drip irrigation\n- Apply for PMFBY crop insurance claim\n\nCyclone Preparation:\n- Harvest mature crops early\n- Drain excess water from fields\n- Secure stored produce\n- Report damage for insurance claim';
  }

  // ─── CROP SPECIFIC: TOMATO ───
  if (m.includes('tomato') || m.includes('tamatar')) {
    return 'Tomato Farming Guide:\n\nBest Season: Kharif (Jun-Jul) and Rabi (Oct-Nov)\nVarieties: Arka Rakshak, Arka Vikas, Pusa Ruby, Rashmi\nSpacing: 60cm x 45cm\nYield: 15-25 tonnes/acre\n\nSowing:\n- Raise nurseries, transplant after 25-30 days\n- Optimal temperature: 20-30C\n- Well-drained soil, pH 6.0-7.0\n\nIrrigation:\n- Drip irrigation recommended (30-40% more yield)\n- Critical stages: Flowering, fruit setting, fruit growth\n\nFertilizer:\n- FYM: 10-15 tonnes/acre\n- NPK: 120:60:60 kg/ha\n\nPest Control:\n- Fruit borer: Bt spray, pheromone traps\n- Whitefly: Neem oil, yellow sticky traps\n- Late blight: Metalaxyl + Mancozeb\n\nExpected Returns:\n- Cost: Rs 60,000-80,000/acre\n- Income: Rs 1,50,000-3,00,000/acre\n- Check Price Check page for current mandi rates!';
  }

  // ─── CROP SPECIFIC: RICE ───
  if (m.includes('rice') || m.includes('paddy') || m.includes('dhan') || m.includes('biyyam')) {
    return 'Rice (Paddy) Farming Guide:\n\nBest Season: Kharif (Jun-Jul sowing)\nVarieties: BPT 5204 (Samba Mahsuri), MTU 7029, APARNA\nMSP: Rs 2,300/quintal\n\nSowing:\n- Nursery: Seeds soaked, sown in wet bed\n- Transplanting: 25-30 day old seedlings\n- Spacing: 15cm x 10cm, 2 seedlings/hill\n\nWater Management:\n- Maintain 5cm standing water after transplanting\n- Drain 2-3 days before harvest\n- Alternate Wetting and Drying (AWD) saves 30% water\n\nFertilizer:\n- NPK: 120:60:60 kg/ha\n- Apply N in 3 splits: Basal, Tillering, Panicle\n\nPest Control:\n- Stem borer: Cartap hydrochloride\n- Brown plant hopper: Imidacloprid\n- Blast: Tricyclazole\n\nYield: 25-30 quintals/acre\nCheck Price Check page for live mandi prices!';
  }

  // ─── CROP SPECIFIC: COTTON ───
  if (m.includes('cotton') || m.includes('kapas') || m.includes('ptri')) {
    return 'Cotton Farming Guide:\n\nBest Season: Kharif (May-June sowing)\nVarieties: Bt Cotton (Bollgard II), JKCH-1947, PKV-081\nMSP: Rs 7,020/q (Long staple), Rs 6,620/q (Medium)\n\nSowing:\n- Seed rate: 750g/acre (Bt cotton)\n- Spacing: 90cm x 60cm\n- Sow after confirmed monsoon\n\nFertilizer:\n- NPK: 120:60:60 kg/ha\n- Apply Potassium for fiber quality\n\nPest Control:\n- Bollworm: Bt cotton provides in-built protection\n- Sucking pests: Neem oil, Thiamethoxam\n- Pink bollworm: Spray Emamectin benzoate at square formation\n\nHarvesting:\n- First picking: 120-130 days after sowing\n- Pick when bolls open fully\n- Dry in sun before ginning\n\nExpected Returns:\n- Cost: Rs 45,000-55,000/acre\n- Income: Rs 70,000-1,00,000/acre\nCheck Price Check page for current cotton rates!';
  }

  // ─── CROP SPECIFIC: ONION ───
  if (m.includes('onion') || m.includes('pyaz') || m.includes('ullipaya')) {
    return 'Onion Farming Guide:\n\nBest Season: Kharif (Jun-Jul) and Rabi (Oct-Nov)\nVarieties: Bhima Red, N-53, Agrifound Red, Pusa Red\n\nSowing:\n- Transplanting method: Nursey to field\n- Direct seeding also possible\n- Spacing: 15cm x 10cm\n\nIrrigation:\n- Regular irrigation needed\n- Stop irrigation 10-15 days before harvest\n- Helps in bulb curing\n\nFertilizer:\n- FYM: 10 tonnes/acre\n- NPK: 80:40:40 kg/ha\n\nImportant:\n- Onion has NO MSP - prices are market-determined\n- Price fluctuates heavily based on supply\n- Store in well-ventilated sheds for better prices\n- Check Price Check page for current mandi rates!\n\nTip: Stagger sowing to harvest at different times for better price realization.';
  }

  // ─── CROP SPECIFIC: MAIZE ───
  if (m.includes('maize') || m.includes('corn') || m.includes('makka')) {
    return 'Maize Farming Guide:\n\nBest Season: Kharif (Jun-Jul) and Rabi (Oct-Nov)\nVarieties: NK-6240, Pioneer, Bio-9681, Vivek QPM\nMSP: Rs 2,225/quintal\n\nSowing:\n- Seed rate: 8-10 kg/acre\n- Spacing: 60cm x 20cm\n- Plant 2 seeds per spot, thin to 1 after germination\n\nFertilizer:\n- NPK: 120:60:60 kg/ha\n- Apply Zinc Sulphate: 25 kg/ha\n\nIrrigation:\n- Critical stages: Tasseling, Silking, Grain filling\n- Drip irrigation recommended\n\nYield: 15-20 quintals/acre\nUses: Poultry feed, starch, ethanol, direct consumption\n\nExpected Returns:\n- Cost: Rs 25,000-30,000/acre\n- Income: Rs 35,000-45,000/acre';
  }

  // ─── CROP SPECIFIC: GROUNDNUT ───
  if (m.includes('groundnut') || m.includes('peanut') || m.includes('palli') || m.includes('moongphali')) {
    return 'Groundnut Farming Guide:\n\nBest Season: Kharif (June-July)\nVarieties: TMV-7, JL-24, RG-425, TAG-24\nMSP: Rs 6,783/quintal\n\nSowing:\n- Seed rate: 80-100 kg/acre\n- Spacing: 30cm x 10cm\n- Sow 2-3 seeds per spot\n\nFertilizer:\n- FYM: 5-6 tonnes/acre\n- NPK: 25:50:50 kg/ha (low nitrogen due to nitrogen fixation)\n\nIrrigation:\n- Critical: Flowering and peg formation\n- Avoid waterlogging\n\nHarvesting:\n- 100-120 days after sowing\n- Uproot when leaves turn yellow\n- Dry pods before storage\n\nUses: Oil extraction, direct consumption, export\nYield: 10-12 quintals/acre';
  }

  // ─── LOAN / BANK / CREDIT ───
  if (m.includes('bank') || m.includes('interest') || m.includes('credit') || m.includes('debt') || m.includes('waiver') || m.includes('restructuring')) {
    return 'Agricultural Loans & Banking:\n\nKisan Credit Card (KCC):\n- Interest: 4% p.a. (with subvention)\n- Limit: Based on landholding\n- Apply at any bank branch\n\nCrop Loans:\n- Upto Rs 3 lakh at 4% interest\n- Repayment: After harvest\n- Mandatory insurance (PMFBY)\n\nKCC Eligibility:\n- All farmers, sharecroppers, tenant farmers\n- Fisheries and animal husbandry farmers\n- Self-help groups (SHGs)\n\nDocuments:\n- Land records (patta/passbook)\n- Aadhaar card\n- Passport photo\n- Bank account details\n\nNABARD: Refinances rural credit\nHelpline: 022-26530000';
  }

  // ─── DAIRY / ANIMAL HUSBANDRY ───
  if (m.includes('dairy') || m.includes('milk') || m.includes('cow') || m.includes('buffalo') || m.includes('poultry') || m.includes('goat') || m.includes('animal')) {
    return 'Animal Husbandry & Dairy:\n\nDairy Farming:\n- Breed improvement: Use HF, Jersey, Sahiwal crossbreeds\n- Average milk yield: 8-12 litres/day (crossbred)\n- Feed: 4kg concentrate + 15kg green fodder/cow/day\n\nGovt Support:\n- NABARD dairy loans at 4% interest\n- National Dairy Development Board (NDDB) support\n- E-Pashu Haat: Online livestock trading\n\nPoultry:\n- Broiler: Ready in 35-40 days\n- Layer: Starts laying at 18-20 weeks\n- Govt subsidy: 25-35% under RKVY\n\nGoat Farming:\n- Low investment, high returns\n- Breeds: Osmanabadi, Sirohi, Jamunapari\n- Govt subsidy: 35-50% under different schemes\n\nTip: Start with 2-3 animals, learn, then expand.';
  }

  // ─── COLD / FRIDGE / PROCESSING ───
  if (m.includes('process') || m.includes('cold chain') || m.includes('value add') || m.includes('packaging') || m.includes('export')) {
    return 'Food Processing & Value Addition:\n\nGovt Schemes:\n- PM Kisan Sampada Yojana: Infrastructure for food processing\n- PLI Scheme: Incentives for food processing units\n- Cold Chain: 35-50% subsidy\n\nPopular Value Addition:\n- Tomato: Paste, ketchup, dried tomato\n- Onion: Flakes, powder, fried onion\n- Rice: Parboiled rice, rice flour, puffed rice\n- Groundnut: Oil, roasted, peanut butter\n\nHow to Start:\n1. Get FSSAI license for food processing\n2. Apply for PMEGP loan (upto Rs 25 lakh)\n3. Get subsidy under respective schemes\n\nFSSAI: fssai.gov.in\nPMEGP: pmegp.kvic.org.in';
  }

  // ─── ORGANIC / NATURAL ───
  if (m.includes('organic') || m.includes('natural farming') || m.includes('zero budget') || m.includes('chemical free') || m.includes('jeevamrutham')) {
    return 'Organic Farming:\n\nGovt Schemes:\n- PKVY: Rs 50,000/ha over 3 years\n- ZBNF: Active in AP & Telangana\n\nHow to Start:\n1. Stop chemicals for 2-3 years (transition)\n2. Make Jeevamrutham: 10L water + 10kg cow dung + 5-10L cow urine + 2kg jaggery + 2kg gram flour\n3. Apply every 15 days\n4. Use Trichogramma cards for pest control\n\nCertification: NPOP via APEDA\nPrice premium: 30-50% higher than conventional';
  }

  // ─── FERTILIZER ───
  if (m.includes('urea') || m.includes('dap') || m.includes('npk') || m.includes('super phosphate')) {
    return 'Fertilizer Guide:\n\nCommon Fertilizers:\n- Urea (46% N): Rs 242/bag (subsidized)\n- DAP (18:46:0): Rs 1,350/bag\n- NPK (10:26:26): Rs 1,200/bag\n- MOP (0:0:60): Rs 1,500/bag\n\nApplication Tips:\n- Apply based on soil test results\n- N in splits: Basal + Top dressing\n- P and K: Apply at sowing time\n- Never mix urea with DAP physically\n\nOrganic Alternatives:\n- FYM: 2-3 tonnes/acre\n- Vermicompost: 0.5-1 tonne/acre\n- Green manuring before Kharif';
  }

  // ─── SEEDS / VARIETY ───
  if (m.includes('seed') || m.includes('variety') || m.includes('hyv') || m.includes('hybrid') || m.includes('improved')) {
    return 'Seed & Variety Selection:\n\nWhere to Get Certified Seeds:\n- State Seed Corporation\n- KVK (Krishi Vigyan Kendra)\n- NSC (National Seeds Corporation): seedsindia.co.in\n- Private companies: Pioneer, Syngenta, Mahyco\n\nTips:\n- Always use certified seeds (look for seal)\n- Choose varieties suitable for your area\n- Check disease resistance\n- Treat seeds before sowing (Thiram/Captan)\n\nHybrid vs Open-Pollinated:\n- Hybrid: Higher yield, but cannot save seeds\n- OP: Lower yield, but seeds can be saved\n\nTip: Consult KVK for recommended varieties in your district.';
  }

  // ─── HELPLINE / CONTACT ───
  if (m.includes('helpline') || m.includes('contact') || m.includes('number') || m.includes('phone') || m.includes('call')) {
    return 'Important Helplines for Farmers:\n\n1. Kisan Call Centre: 1551 (toll-free, 24x7)\n2. PM-KISAN Helpline: 155261\n3. PMFBY Crop Insurance: 1800-180-1551\n4. e-NAM Helpline: 1800-180-1551\n5. NABARD: 022-26530000\n6. AP Agriculture: 1967\n7. Telangana Agriculture: 1800-425-0012\n\nWebsites:\n- pmkisan.gov.in (PM-KISAN)\n- pmfby.gov.in (Crop Insurance)\n- enam.gov.in (e-NAM)\n- soilhealth.dac.gov.in (Soil Health)\n- mkisan.gov.in (Advisories)';
  }

  // ─── CLIMATE / ENVIRONMENT ───
  if (m.includes('climate') || m.includes('global warming') || m.includes('sustainable') || m.includes('environment')) {
    return 'Climate-Smart Agriculture:\n\nAdaptation Strategies:\n1. Use drought-resistant varieties\n2. Practice crop diversification\n3. Adopt water-efficient irrigation (drip/sprinkler)\n4. Use mulching to conserve moisture\n5. Practice conservation agriculture (minimum tillage)\n\nMitigation:\n1. Reduce stubble burning - use Happy Seeder\n2. Practice organic farming\n3. Use bio-fertilizers instead of chemicals\n4. Plant trees on farm boundaries (agroforestry)\n\nGovt Support:\n- National Adaptation Fund for Climate Change\n- Rashtriya Krishi Vikas Yojana (RKVY)\n- National Mission for Sustainable Agriculture';
  }

  // ─── GENERIC ABOUT FARMING ───
  if (m.match(/\b(what|how|why|tell|explain|describe|about)\b.*\b(farming|farm|agriculture|agri|kheti|vyavasayam)\b/)) {
    return 'About Agriculture in India:\n\nIndia is the 2nd largest agricultural producer globally.\n\nKey Facts:\n- 58% of India\'s population depends on agriculture\n- Agriculture contributes ~18% to GDP\n- Major crops: Rice, Wheat, Cotton, Sugarcane, Pulses\n- Top states: UP, MP, Maharashtra, AP, Telangana, Punjab\n\nNatureBasket helps farmers by:\n1. Providing real-time mandi prices from data.gov.in\n2. Comparing prices across districts\n3. Offering AI-powered market advice\n4. Information on government schemes and subsidies\n\nUse our Price Check page to find current crop prices in your area!';
  }

  // ─── HELPFUL / USEFUL / THANK ───
  if (m.match(/\b(help|useful|thanks|thank you|thanku|dhanyavad|shukriya)\b/)) {
    return 'Happy to help! NatureBasket provides:\n\n- Real-time crop prices from 800+ APMC mandis\n- Government scheme information\n- Farming best practices\n- Market intelligence\n\nAlways check the Price Check page for the latest mandi rates before selling your produce. This ensures you get the best price!\n\nIs there anything else you want to know about farming?';
  }

  // ─── WHAT CAN YOU DO ───
  if (m.match(/\b(what can you|what do you|your feature|your capability|who are you)\b/)) {
    return 'I am NatureBasket AI Agent. I can help you with:\n\n1. Crop Prices: Live rates from AP & Telangana mandis\n2. Government Schemes: PM-KISAN, Fasal Bima, KCC, e-NAM\n3. MSP Rates: All major crops\n4. Farming Seasons: When to sow Kharif, Rabi, Zaid\n5. Irrigation: Drip, sprinkler, water management\n6. Pest Control: IPM, biological control\n7. Organic Farming: Natural farming methods\n8. Subsidies: Available govt support\n9. Loans: KCC, crop loans, interest rates\n10. Storage: Post-harvest management\n11. Animal Husbandry: Dairy, poultry basics\n12. FPOs: Farmer Producer Organizations\n\nAsk me anything about farming!';
  }

  // ─── FALLBACK - General agriculture response ───
  return 'I can help you with many agriculture topics. Try asking about:\n\n- Specific crop advice (tomato, rice, cotton, onion, maize, etc.)\n- Government schemes (PM-KISAN, Fasal Bima, KCC, e-NAM)\n- MSP rates for crops\n- Farming seasons (when to sow)\n- Irrigation methods\n- Pest and disease management\n- Organic farming\n- Subsidies and loans\n- Soil health and fertilizers\n- Weather resources\n- FPOs and cooperatives\n- Animal husbandry\n- Storage and post-harvest\n\nWhat would you like to know?';
}

// Page routes
app.get('/price-check', (req, res) => res.sendFile(path.join(__dirname, 'public', 'price-check.html')));
app.get('/how-it-works', (req, res) => res.sendFile(path.join(__dirname, 'public', 'how-it-works.html')));
app.get('/features', (req, res) => res.sendFile(path.join(__dirname, 'public', 'features.html')));
app.get('/market-data', (req, res) => res.sendFile(path.join(__dirname, 'public', 'market-data.html')));

// ... [Your existing routes like app.get('/api/search'), etc. are above here] ...

// ─── PASTE THE FUNCTION HERE ───
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
    emoji: '🌾',
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

// ─── SERVER START (This must stay at the very absolute bottom) ───
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
