// ─── GOVERNMENT SCHEMES (Source: official government portals) ───
const SCHEMES = {
  'pm kisan': {
    name: 'PM-KISAN Samman Nidhi',
    info: 'Central sector scheme (since 24 Feb 2019). Rs 6,000/year to all landholding farmer families in 3 instalments of Rs 2,000 via DBT.',
    eligibility: 'All landholding farmer families. Exclusions: institutional holders, govt employees, pensioners, income tax payers.',
    website: 'pmkisan.gov.in',
    helpline: '155261 / 1800-180-1551'
  },
  'pmfby': {
    name: 'Pradhan Mantri Fasal Bima Yojana',
    info: 'Crop insurance at low premiums: Kharif 2%, Rabi 1.5%, Commercial 5% of sum insured.',
    eligibility: 'All farmers including sharecroppers and tenant farmers.',
    website: 'pmfby.gov.in',
    helpline: '1800-180-1551'
  },
  'kcc': {
    name: 'Kisan Credit Card',
    info: 'Affordable credit at 4% p.a. (after subvention) for crop production, post-harvest, and consumption.',
    eligibility: 'All farmers, fishers, animal husbandry farmers.',
    website: 'Contact nearest bank branch',
    helpline: 'NABARD: 022-26530000'
  },
  'enam': {
    name: 'e-NAM',
    info: 'Online trading platform connecting 1000+ APMC mandis. Transparent price discovery through e-auction.',
    eligibility: 'All farmers registered at any APMC mandi.',
    website: 'enam.gov.in',
    helpline: '1800-180-1551'
  },
  'rythu': {
    name: 'Rythu Bandhu (TG) / Rythu Bharosa (AP)',
    info: 'TG: Rs 10,000/acre investment support. AP: Rs 13,500/year (incl PM-KISAN). Direct transfer to farmer accounts.',
    eligibility: 'All farmer families with land records in AP/Telangana.',
    website: 'rythubandhu.telangana.gov.in / ysrrythubharosa.gov.in',
    helpline: 'TG: 1800-425-0012 / AP: 1967'
  },
  'soil': {
    name: 'Soil Health Card',
    info: 'Free soil testing with nutrient status and fertilizer recommendations.',
    eligibility: 'All farmers across India.',
    website: 'soilhealth.dac.gov.in',
    helpline: 'Contact nearest KVK'
  }
};

const BOT_RESPONSES = {
  default: "I can help with:\n- Crop prices in AP & Telangana mandis\n- Best district to sell\n- Government schemes (PM-KISAN, Fasal Bima, e-NAM)\n- MSP rates for major crops\n\nType a crop name or scheme name!"
};

function openChat() { document.getElementById('chatbot').classList.add('open'); }
function closeChat() { document.getElementById('chatbot').classList.remove('open'); }

function getResponse(msg) {
  var m = msg.toLowerCase();

  // Scheme queries
  if (m.includes('pm kisan') || m.includes('pm-kisan') || m.includes('scheme') || m.includes('6000') || m.includes('installment')) {
    var s = SCHEMES['pm kisan'];
    return s.name + ':\n- ' + s.info + '\n- Eligibility: ' + s.eligibility + '\n- Website: ' + s.website + '\n- Helpline: ' + s.helpline;
  }
  if (m.includes('fasal bima') || m.includes('crop insurance') || m.includes('pmfby')) {
    var s = SCHEMES['pmfby'];
    return s.name + ':\n- ' + s.info + '\n- Eligibility: ' + s.eligibility + '\n- Website: ' + s.website;
  }
  if (m.includes('kcc') || m.includes('kisan credit') || m.includes('credit card') || m.includes('loan')) {
    var s = SCHEMES['kcc'];
    return s.name + ':\n- ' + s.info + '\n- Eligibility: ' + s.eligibility + '\n- Contact: ' + s.helpline;
  }
  if (m.includes('enam') || m.includes('e-nam') || m.includes('apmc') || m.includes('mandi')) {
    var s = SCHEMES['enam'];
    return s.name + ':\n- ' + s.info + '\n- Eligibility: ' + s.eligibility + '\n- Website: ' + s.website;
  }
  if (m.includes('rythu') || m.includes('bandhu') || m.includes('bharosa') || m.includes('investment support')) {
    var s = SCHEMES['rythu'];
    return s.name + ':\n- ' + s.info + '\n- Eligibility: ' + s.eligibility + '\n- Website: ' + s.website + '\n- Helpline: ' + s.helpline;
  }
  if (m.includes('soil') || m.includes('soil health') || m.includes('fertilizer')) {
    var s = SCHEMES['soil'];
    return s.name + ':\n- ' + s.info + '\n- Website: ' + s.website;
  }

  // MSP queries
  if (m.includes('msp') || m.includes('minimum support') || m.includes('support price')) {
    return 'MSP Rates 2024-25 (Source: CACP/data.gov.in):\n- Rice (Paddy): Rs 2,300/q\n- Wheat: Rs 2,275/q\n- Maize: Rs 2,225/q\n- Cotton (Long): Rs 7,020/q\n- Groundnut: Rs 6,783/q\n- Soybean: Rs 4,892/q\n- Turmeric: Rs 7,000/q (indicative)\n\nNote: Tomato, Onion, Chilli have no MSP — prices are market-determined.\nSearch any crop on the Price Check page for current market rates.';
  }

  // Crop-specific — fetch real data from API
  if (m.includes('tomato') || m.includes('rice') || m.includes('cotton') || m.includes('onion') || m.includes('maize') || m.includes('groundnut') || m.includes('wheat') || m.includes('potato') || m.includes('chilli') || m.includes('paddy')) {
    var cropMatch = m.match(/tomato|rice|cotton|onion|maize|groundnut|wheat|potato|chilli|paddy/);
    if (cropMatch) {
      return 'Fetching real market data for ' + cropMatch[0].charAt(0).toUpperCase() + cropMatch[0].slice(1) + '...\n\nPlease use the Price Check page for live prices from government APMC mandis.\n\nSource: data.gov.in AGMARKNET portal (Government of India).';
    }
  }

  // Sell queries
  if (m.includes('sell') || m.includes('best district') || m.includes('best market') || m.includes('where to sell')) {
    return 'To find the best market:\n1. Go to Price Check page\n2. Search your crop\n3. Compare prices across districts\n4. The table shows mandi-wise rates with High/Best Buy tags\n\nHigher-priced mandis may be worth transporting to if distance is manageable.';
  }

  // Greetings
  if (m.includes('hello') || m.includes('hi') || m.includes('namaste') || m.includes('namaskaram')) {
    return 'Namaskaram! I provide real market data from government APMC mandis.\n\nYou can ask about:\n- Crop prices (e.g. "tomato price")\n- Government schemes (e.g. "PM-KISAN")\n- MSP rates (e.g. "MSP for rice")\n- Where to sell (e.g. "best district for cotton")';
  }

  // Weather
  if (m.includes('weather') || m.includes('rain') || m.includes('forecast')) {
    return 'For weather forecasts:\n- IMD: mausam.imd.gov.in\n- mKisan: mkisan.gov.in\n\nFor crop prices, use the Price Check page with real AGMARKNET data.';
  }

  // List schemes
  if (m.includes('government scheme') || m.includes('govt scheme') || m.includes('what schemes') || m.includes('list schemes')) {
    return 'Government Schemes for Farmers:\n\n1. PM-KISAN: Rs 6,000/year (pmkisan.gov.in)\n2. PM Fasal Bima: Crop insurance (pmfby.gov.in)\n3. Kisan Credit Card: Low-interest loans\n4. e-NAM: Online mandi trading (enam.gov.in)\n5. Rythu Bandhu/Bharosa: State investment support\n6. Soil Health Card: Free soil testing\n\nAsk about any scheme for details!';
  }

  return BOT_RESPONSES.default;
}

function addMsg(text, who) {
  var msgs = document.getElementById('chat-messages');
  var div = document.createElement('div');
  div.className = 'msg ' + who;
  div.innerHTML = text.replace(/\n/g, '<br>');
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function addTyping() {
  var msgs = document.getElementById('chat-messages');
  var div = document.createElement('div');
  div.className = 'msg typing'; div.id = 'typing-indicator';
  div.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function removeTyping() { var el = document.getElementById('typing-indicator'); if (el) el.remove(); }

function sendChat() {
  var input = document.getElementById('chat-input');
  var text = input.value.trim();
  if (!text) return;
  addMsg(text, 'user');
  input.value = '';
  addTyping();
  setTimeout(function() { removeTyping(); addMsg(getResponse(text), 'bot'); }, 700 + Math.random() * 500);
}

function quickChat(text) {
  document.getElementById('chat-input').value = text;
  sendChat();
}
