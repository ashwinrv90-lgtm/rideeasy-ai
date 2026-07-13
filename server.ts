import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const PORT = 3000;

// Initialize Google Gen AI client safely
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
} else {
  console.warn("GEMINI_API_KEY not found in environment. Running with simulated fallback NLP parsing.");
}

// Simulated autocomplete place search database for Chennai & Bangalore (with coordinates &Place IDs)
const INDIA_PLACES_DB = [
  // Chennai
  { id: 'ch_ap', name: 'Chennai International Airport (MAA)', address: 'Meenambakkam, Chennai, Tamil Nadu 600027', lat: 12.9816, lng: 80.1643, category: 'Airport' },
  { id: 'ch_tn', name: 'T Nagar Bus Terminus', address: 'T Nagar, Chennai, Tamil Nadu 600017', lat: 13.0315, lng: 80.2312, category: 'Bus Station' },
  { id: 'ch_ph', name: 'Phoenix Marketcity Mall Chennai', address: 'Velachery Main Rd, Velachery, Chennai, Tamil Nadu 600042', lat: 12.9915, lng: 80.2170, category: 'Mall' },
  { id: 'ch_an', name: 'Anna Nagar West', address: 'Anna Nagar West, Chennai, Tamil Nadu 600040', lat: 13.0850, lng: 80.2010, category: 'Residential' },
  { id: 'ch_mc', name: 'Marina Beach', address: 'Kamabaraj Salai, Triplicane, Chennai, Tamil Nadu 600005', lat: 13.0500, lng: 80.2824, category: 'Landmark' },
  { id: 'ch_ct', name: 'Chennai Central Railway Station', address: 'Kannappar Thidal, Periyamet, Chennai, Tamil Nadu 600003', lat: 13.0822, lng: 80.2755, category: 'Railway' },
  { id: 'ch_dl', name: 'DLF IT Park Chennai', address: 'Mount Poonamallee Rd, Manapakkam, Chennai, Tamil Nadu 600125', lat: 13.0205, lng: 80.1654, category: 'Tech Park' },
  
  // Bangalore
  { id: 'bl_ap', name: 'Kempegowda International Airport (BLR)', address: 'Devanahalli, Bengaluru, Karnataka 560300', lat: 13.1986, lng: 77.7066, category: 'Airport' },
  { id: 'bl_mg', name: 'M.G. Road Metro Station', address: 'MG Road, Ashok Nagar, Bengaluru, Karnataka 560001', lat: 12.9754, lng: 77.6068, category: 'Metro Station' },
  { id: 'bl_or', name: 'Manyata Tech Park', address: 'Outer Ring Rd, Hebbal, Bengaluru, Karnataka 560045', lat: 13.0451, lng: 77.6266, category: 'Tech Park' },
  { id: 'bl_km', name: 'Koramangala 4th Block', address: 'Koramangala, Bengaluru, Karnataka 560034', lat: 12.9338, lng: 77.6244, category: 'Residential' },
  { id: 'bl_or_bellandur', name: 'Bellandur EcoSpace', address: 'Outer Ring Rd, Bellandur, Bengaluru, Karnataka 560103', lat: 12.9268, lng: 77.6762, category: 'Tech Park' },
  { id: 'bl_or_hsr', name: 'HSR Layout Sector 1', address: 'HSR Layout, Bengaluru, Karnataka 560102', lat: 12.9116, lng: 77.6410, category: 'Residential' },
  { id: 'bl_or_ub', name: 'UB City Mall', address: 'Vittal Mallya Rd, KG Halli, Bengaluru, Karnataka 560001', lat: 12.9722, lng: 77.5958, category: 'Mall' },
  { id: 'bl_or_ind', name: 'Indiranagar Double Road', address: 'Indiranagar, Bengaluru, Karnataka 560038', lat: 12.9719, lng: 77.6412, category: 'Residential' },
];

// Autocomplete logic using OpenStreetMap (OSM) Nominatim API restricted to India
app.get('/api/autocomplete', async (req, res) => {
  const query = (req.query.q || '').toString().trim();
  if (!query) {
    return res.json([]);
  }
  
  try {
    // Fetch from OpenStreetMap Nominatim Search API, restricted to India
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ', India')}&format=json&countrycodes=in&addressdetails=1&limit=6`,
      {
        headers: {
          'User-Agent': 'RideEasy-Cab-Aggregator/1.0 (contact: ashwinrv90@gmail.com)'
        }
      }
    );
    const data = (await response.json()) as any[];
    
    if (data && data.length > 0) {
      const places = data.map((item: any) => {
        const parts = item.display_name.split(',');
        const name = parts[0].trim();
        const address = item.display_name;
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lon);
        return {
          id: `osm_${lat}_${lng}_${Buffer.from(name).toString('hex').slice(0, 8)}`,
          name: name,
          address: address,
          lat: lat,
          lng: lng,
          category: item.class ? item.class.replace(/\b\w/g, (c: string) => c.toUpperCase()) : 'Location'
        };
      });
      return res.json(places);
    }
  } catch (err) {
    console.error("OpenStreetMap Autocomplete Error:", err);
  }

  // Fallback: search pre-registered DB
  const matches = INDIA_PLACES_DB.filter(p => 
    p.name.toLowerCase().includes(query.toLowerCase()) || 
    p.address.toLowerCase().includes(query.toLowerCase()) ||
    p.category.toLowerCase().includes(query.toLowerCase())
  );
  
  if (matches.length > 0) {
    return res.json(matches);
  }

  // If no direct static matches, generate a dynamic India-wide custom location
  let lat = 20.5937;
  let lng = 78.9629;
  const lowerQuery = query.toLowerCase();
  
  if (lowerQuery.includes('delhi')) { lat = 28.7041; lng = 77.1025; }
  else if (lowerQuery.includes('mumbai') || lowerQuery.includes('bombay')) { lat = 19.0760; lng = 72.8777; }
  else if (lowerQuery.includes('kolkata') || lowerQuery.includes('calcutta')) { lat = 22.5726; lng = 88.3639; }
  else if (lowerQuery.includes('chennai') || lowerQuery.includes('madras')) { lat = 13.0827; lng = 80.2707; }
  else if (lowerQuery.includes('bangalore') || lowerQuery.includes('bengaluru')) { lat = 12.9716; lng = 77.5946; }
  else if (lowerQuery.includes('hyderabad')) { lat = 17.3850; lng = 78.4867; }
  else if (lowerQuery.includes('pune')) { lat = 18.5204; lng = 73.8567; }
  else if (lowerQuery.includes('ahmedabad')) { lat = 23.0225; lng = 72.5714; }
  else if (lowerQuery.includes('jaipur')) { lat = 26.9124; lng = 75.7873; }
  else if (lowerQuery.includes('goa')) { lat = 15.2993; lng = 74.1240; }
  else if (lowerQuery.includes('kochi') || lowerQuery.includes('cochin')) { lat = 9.9312; lng = 76.2673; }
  else if (lowerQuery.includes('gurgaon') || lowerQuery.includes('gurugram')) { lat = 28.4595; lng = 77.0266; }
  else if (lowerQuery.includes('noida')) { lat = 28.5355; lng = 77.3910; }
  else {
    const hash = query.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    lat = 11.0 + (hash % 16); 
    lng = 72.0 + (hash % 15);
  }

  res.json([{
    id: 'custom_' + Buffer.from(query).toString('hex').slice(0, 8),
    name: query.replace(/\b\w/g, c => c.toUpperCase()),
    address: `${query.replace(/\b\w/g, c => c.toUpperCase())}, India`,
    lat: parseFloat(lat.toFixed(4)),
    lng: parseFloat(lng.toFixed(4)),
    category: 'Custom Location'
  }]);
});

// Endpoint to resolve details for a specific selected place ID using OpenStreetMap
app.get('/api/place-details', async (req, res) => {
  const placeId = (req.query.placeId || '').toString();
  if (!placeId) {
    return res.status(400).json({ error: "placeId is required" });
  }

  // If it's a pre-registered ID
  const preRegistered = INDIA_PLACES_DB.find(p => p.id === placeId);
  if (preRegistered) {
    return res.json({
      name: preRegistered.name,
      address: preRegistered.address,
      lat: preRegistered.lat,
      lng: preRegistered.lng
    });
  }

  // If it's an OSM ID encoded with coordinates
  if (placeId.startsWith('osm_')) {
    const parts = placeId.split('_');
    if (parts.length >= 3) {
      const lat = parseFloat(parts[1]);
      const lng = parseFloat(parts[2]);
      let name = "Selected Location";
      if (parts[3]) {
        try {
          name = Buffer.from(parts[3], 'hex').toString('utf8');
        } catch (e) {}
      }
      return res.json({
        name: name,
        address: `${name}, India`,
        lat: lat,
        lng: lng
      });
    }
  }

  res.status(404).json({ error: "Place not found" });
});

// Helper function to resolve coordinates for any named place in India using OpenStreetMap
async function resolveCoordinates(placeName: string): Promise<{ lat: number, lng: number, formattedAddress: string } | null> {
  if (!placeName) return null;

  // Check pre-registered first
  const preRegistered = INDIA_PLACES_DB.find(p => 
    p.name.toLowerCase().includes(placeName.toLowerCase()) || 
    p.id === placeName ||
    placeName.toLowerCase().includes(p.name.toLowerCase())
  );
  if (preRegistered) {
    return {
      lat: preRegistered.lat,
      lng: preRegistered.lng,
      formattedAddress: preRegistered.name
    };
  }

  // OpenStreetMap Nominatim Search API
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(placeName + ', India')}&format=json&countrycodes=in&limit=1`,
      {
        headers: {
          'User-Agent': 'RideEasy-Cab-Aggregator/1.0 (contact: ashwinrv90@gmail.com)'
        }
      }
    );
    const data = (await response.json()) as any[];
    if (data && data[0]) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        formattedAddress: data[0].display_name
      };
    }
  } catch (err) {
    console.error("OpenStreetMap Geocoding Error for", placeName, err);
  }

  // Fallback high-fidelity smart offset estimation for cities in India
  let lat = 20.5937;
  let lng = 78.9629;
  const lowerName = placeName.toLowerCase();
  
  if (lowerName.includes('delhi')) { lat = 28.7041; lng = 77.1025; }
  else if (lowerName.includes('mumbai') || lowerName.includes('bombay')) { lat = 19.0760; lng = 72.8777; }
  else if (lowerName.includes('kolkata') || lowerName.includes('calcutta')) { lat = 22.5726; lng = 88.3639; }
  else if (lowerName.includes('chennai') || lowerName.includes('madras')) { lat = 13.0827; lng = 80.2707; }
  else if (lowerName.includes('bangalore') || lowerName.includes('bengaluru')) { lat = 12.9716; lng = 77.5946; }
  else if (lowerName.includes('hyderabad')) { lat = 17.3850; lng = 78.4867; }
  else if (lowerName.includes('pune')) { lat = 18.5204; lng = 73.8567; }
  else if (lowerName.includes('ahmedabad')) { lat = 23.0225; lng = 72.5714; }
  else if (lowerName.includes('jaipur')) { lat = 26.9124; lng = 75.7873; }
  else if (lowerName.includes('goa')) { lat = 15.2993; lng = 74.1240; }
  else if (lowerName.includes('kochi') || lowerName.includes('cochin')) { lat = 9.9312; lng = 76.2673; }
  else if (lowerName.includes('gurgaon') || lowerName.includes('gurugram')) { lat = 28.4595; lng = 77.0266; }
  else if (lowerName.includes('noida')) { lat = 28.5355; lng = 77.3910; }
  else {
    const hash = placeName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    lat = 11.0 + (hash % 16); 
    lng = 72.0 + (hash % 15);
  }

  return {
    lat: parseFloat(lat.toFixed(4)),
    lng: parseFloat(lng.toFixed(4)),
    formattedAddress: placeName.replace(/\b\w/g, c => c.toUpperCase())
  };
}

// Main chat route that uses Gemini to parse WhatsApp Conversational Intents
app.post('/api/chat', async (req, res) => {
  const { message, chatHistory = [], userPreferences = {}, parsedState = {} } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  // Intercept pure greetings or start triggers to present the introduction and clear state
  const cleanMsg = message.trim().toLowerCase();
  const greetings = ['hi', 'hello', 'hey', 'yo', 'start', 'begin', 'help', 'hii', 'hiii', 'hallo', 'reset', 'hi rideeasy', 'hi rideeasy!', 'hi!'];
  if (greetings.includes(cleanMsg) || cleanMsg === 'hi!') {
    const clearedState = {
      pickup: null,
      pickupId: null,
      pickupLat: null,
      pickupLng: null,
      dropoff: null,
      dropoffId: null,
      dropoffLat: null,
      dropoffLng: null,
      date: null,
      time: null,
      rideType: 'cab', // Default start with cab/auto
      passengers: null
    };
    return res.json({
      reply: "👋 *Welcome to RideEasy!* One stop for all your rides.\n\nI compare prices across *Uber, Ola, Rapido, and Namma Yatri* to find you the cheapest and fastest option instantly!\n\n*Next Step:* Where are we starting from today? (Please type your pickup location)",
      parsedState: clearedState,
      stage: "need_pickup"
    });
  }

  // Fallback NLP parser if Gemini is not configured
  const runFallbackNLP = async (msg: string, prevParsed: any) => {
    const text = msg.toLowerCase();
    const parsed = { ...prevParsed };
    
    // Simple state-dependent or direct extraction
    // If we've got nothing, check if the input specifies "X to Y"
    const toFromRegex = /(?:from\s+)?(.+?)\s+to\s+(.+)/i;
    const match = text.match(toFromRegex);
    if (match) {
      parsed.pickup = match[1].trim();
      parsed.dropoff = match[2].trim();
    } else {
      // Step-by-step user input parsing
      if (!parsed.pickup) {
        // If message is not empty and we need pickup, treat message as pickup
        parsed.pickup = msg.trim();
      } else if (!parsed.dropoff) {
        parsed.dropoff = msg.trim();
      } else if (parsed.passengers === null) {
        // Extract numbers from message
        const numMatch = text.match(/\b([1-9])\b/);
        if (numMatch) {
          parsed.passengers = parseInt(numMatch[1]);
        } else if (text.includes('one') || text.includes('single') || text.includes('myself') || text.includes('just me')) {
          parsed.passengers = 1;
        } else if (text.includes('two') || text.includes('couple') || text.includes('both')) {
          parsed.passengers = 2;
        } else if (text.includes('three') || text.includes('triple')) {
          parsed.passengers = 3;
        } else if (text.includes('four') || text.includes('group') || text.includes('family')) {
          parsed.passengers = 4;
        }
      } else if (!parsed.date) {
        // Advanced date/time extraction supporting IST format (AM/PM)
        let extractedDate: string | null = null;
        let extractedTime: string | null = null;

        if (text.includes('today')) {
          extractedDate = 'Today';
        } else if (text.includes('tomorrow')) {
          extractedDate = 'Tomorrow';
        } else {
          const dateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})([\/\-]\d{2,4})?/);
          if (dateMatch) {
            extractedDate = dateMatch[0];
          }
        }

        const timeMatch = text.match(/(\d{1,2})([\s:]*(\d{2}))?\s*(am|pm)/i);
        if (timeMatch) {
          const hh = timeMatch[1].padStart(2, '0');
          const mm = timeMatch[3] ? timeMatch[3] : '00';
          const period = timeMatch[4].toUpperCase();
          extractedTime = `${hh}:${mm} ${period}`;
        }

        if (extractedDate && extractedTime) {
          parsed.date = extractedDate;
          parsed.time = extractedTime;
        } else if (extractedDate && !extractedTime) {
          parsed.date = extractedDate;
          parsed.time = '10:00 AM'; // Default fallback time if only date specified
        } else if (!extractedDate && extractedTime) {
          parsed.date = 'Today';
          parsed.time = extractedTime;
        } else {
          if (text.includes('now') || text.includes('immediate') || text.includes('current')) {
            parsed.date = 'Today';
            parsed.time = 'Now';
          } else if (text.includes('later') || text.includes('schedule')) {
            // Keep them null so we prompt for IST date and time
            parsed.date = null;
            parsed.time = null;
          }
        }
      }
    }

    // Saved places fallback
    if (text.includes('home')) {
      parsed.pickup = userPreferences.home || 'Home (Anna Nagar West)';
      parsed.pickupId = 'ch_an';
    }
    if (text.includes('office')) {
      parsed.dropoff = userPreferences.office || 'Office (DLF IT Park)';
      parsed.dropoffId = 'ch_dl';
    }
    
    // Auto-decide mode based on passenger count if passengers entered
    if (parsed.passengers !== null) {
      if (parsed.passengers === 1) {
        // Start with taxi or auto mode as default even for 1 person, but bike is allowed
        parsed.rideType = 'cab';
      } else if (parsed.passengers <= 3) {
        parsed.rideType = 'cab'; // auto or cab, default cab
      } else {
        parsed.rideType = 'suv';
      }
    } else if (text.includes('auto')) {
      parsed.rideType = 'auto';
    } else if (text.includes('bike')) {
      parsed.rideType = 'bike';
    } else if (text.includes('suv')) {
      parsed.rideType = 'suv';
    } else if (text.includes('cab') || text.includes('car') || text.includes('taxi')) {
      parsed.rideType = 'cab';
    }

    // Geocode what we can
    if (parsed.pickup && !parsed.pickupLat) {
      const pCoords = await resolveCoordinates(parsed.pickup);
      if (pCoords) {
        parsed.pickup = pCoords.formattedAddress;
        parsed.pickupLat = pCoords.lat;
        parsed.pickupLng = pCoords.lng;
      }
    }
    if (parsed.dropoff && !parsed.dropoffLat) {
      const dCoords = await resolveCoordinates(parsed.dropoff);
      if (dCoords) {
        parsed.dropoff = dCoords.formattedAddress;
        parsed.dropoffLat = dCoords.lat;
        parsed.dropoffLng = dCoords.lng;
      }
    }
    
    let reply = "";
    let stage = "need_pickup";
    
    if (!parsed.pickup) {
      reply = "👋 Welcome to RideEasy! I compare prices across *Uber, Ola, Rapido, and Namma Yatri*.\n\nWhere are we starting from today?";
      stage = "need_pickup";
    } else if (!parsed.dropoff) {
      reply = `Got your starting point at *${parsed.pickup}*. Where is your dropoff destination?`;
      stage = "need_dropoff";
    } else if (parsed.passengers === null) {
      reply = `Perfect! Pickup: *${parsed.pickup}* ➔ Dropoff: *${parsed.dropoff}*.\n\n*How many members* (passengers) will be traveling?`;
      stage = "need_passengers";
    } else if (!parsed.date) {
      const modeRec = parsed.rideType === 'bike' ? '🏍️ BIKE TAXI' : (parsed.rideType === 'suv' ? '🚙 SUV' : '🚗 CAB/AUTO');
      if (text.includes('later') || text.includes('schedule')) {
        reply = `Got it! Let's schedule your ride. 📅\n\nPlease enter your travel date (e.g. *Today*, *Tomorrow*, or any date) and time in IST format with *AM/PM* option (e.g. *10:30 AM* or *05:15 PM*) to schedule.`;
      } else {
        reply = `Noted: *${parsed.passengers} travelers* (Recommended mode: *${modeRec}*).\n\nWould you like to travel *now* or *schedule for later*?`;
      }
      stage = "need_datetime";
    } else {
      stage = "quoting";
      reply = `Perfect! Calculating price options for *${parsed.passengers} traveler(s)* from *${parsed.pickup}* to *${parsed.dropoff}* (Preferred Mode: *${parsed.rideType?.toUpperCase()}*, Schedule: *${parsed.date} ${parsed.time || 'Now'}*)...\n\nSee the comparison matrix on the right! 🚗`;
    }

    return { reply, parsedState: parsed, stage };
  };

  if (!ai) {
    const result = await runFallbackNLP(message, parsedState);
    return res.json(result);
  }

  try {
    const historyString = chatHistory
      .slice(-6)
      .map((h: any) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.text}`)
      .join('\n');

    const systemPrompt = `You are the backend AI brain of "RideEasy", a WhatsApp-based Cab Aggregator for India.
Your task is to parse raw natural language messages from users in India and maintain the trip state.

CRITICAL DIRECTIVE:
You MUST support ANY location, landmark, city, hotel, tech park, address, or station anywhere in India.
Extract the user's starting point (pickup) and destination (dropoff) names.

CRITICAL OBJECTIVE:
We must guide the user step-by-step in a friendly conversational manner, ONE BY ONE:
1. Pickup location (From)
2. Dropoff location (To)
3. Number of passengers (How many members?)
   - Based on passengers, decide the recommended mode:
     - If 1: recommend "cab" or "auto" as default, but "bike" option is allowed/available.
     - If 2 or 3: recommend "cab" or "auto" (default "cab") - NO bike option.
     - If more (4+): recommend "suv" (big vehicle) - NO bike option.
4. Travel Schedule (Now or Later?):
   - If they specify "now", set "date" to "Today" and "time" to "Now".
   - If they specify "later" or "schedule", but have NOT provided a specific date and time:
     - Keep "date" and "time" as null in parsedState (so the stage remains "need_datetime").
     - Your reply MUST ask for the date and time in IST format with AM/PM (e.g. "Please provide your travel date (e.g., *Today*, *Tomorrow*, or any date) and time in IST format with *AM/PM* option (e.g., *10:30 AM* or *05:15 PM*) to schedule. 📅").
   - If they provide a date and time (e.g. "tomorrow 10:30 AM" or "today 5 PM" or "15/07/2026 at 9:00 PM"), extract them cleanly (e.g. date: "Tomorrow" or "15/07/2026", time: "10:30 AM" or "09:00 PM" with AM/PM option).

Keep conversational replies highly concise, Indian WhatsApp-style, using bold markdown for emphasis (e.g. *Mumbai Airport*). Always request ONLY the next missing item in the sequence. If the user overrides or changes any previous information, support that modification dynamically!

User Preferences:
- Home Saved Place: ${userPreferences.home || 'Anna Nagar West'}
- Office Saved Place: ${userPreferences.office || 'DLF IT Park'}
- Preferred Ride Mode: ${userPreferences.rideType || 'Any (Auto/Bike/Cab)'}

Current Trip Parameters state:
${JSON.stringify(parsedState, null, 2)}

Identify matching destinations from our registered location database if applicable:
- "Chennai International Airport (MAA)" -> id "ch_ap"
- "T Nagar Bus Terminus" -> id "ch_tn"
- "Phoenix Marketcity Mall Chennai" -> id "ch_ph"
- "Anna Nagar West" -> id "ch_an"
- "Marina Beach" -> id "ch_mc"
- "Chennai Central Railway Station" -> id "ch_ct"
- "DLF IT Park Chennai" -> id "ch_dl"
- "Kempegowda International Airport (BLR)" -> id "bl_ap"
- "M.G. Road Metro Station" -> id "bl_mg"
- "Manyata Tech Park" -> id "bl_or"
- "Koramangala 4th Block" -> id "bl_km"
- "Bellandur EcoSpace" -> id "bl_or_bellandur"
- "HSR Layout Sector 1" -> id "bl_or_hsr"
- "UB City Mall" -> id "bl_or_ub"
- "Indiranagar Double Road" -> id "bl_or_ind"

Respond strictly with a JSON object. Do not output markdown code blocks other than the raw JSON itself, conforming to the following JSON structure:
{
  "reply": "Clear, friendly, short message under 150 characters to send to WhatsApp, asking ONLY for the next missing detail in the sequence, OR confirming that fares are being calculated.",
  "parsedState": {
    "pickup": "Extracted pickup name (string or null)",
    "pickupId": "One of the matched registered location IDs (or null for other places in India)",
    "dropoff": "Extracted dropoff name (string or null)",
    "dropoffId": "One of the matched registered location IDs (or null for other places in India)",
    "date": "Extracted date (e.g. 'Today', 'Tomorrow', '2026-07-14') or null",
    "time": "Extracted time (e.g. '8:00 AM', 'now') or null",
    "rideType": "bike | auto | cab | suv or null",
    "passengers": 1-6 or null
  },
  "stage": "need_pickup | need_dropoff | need_passengers | need_datetime | quoting"
}

Ensure the "stage" matches the first missing item in the sequence:
- "need_pickup" if pickup is missing.
- "need_dropoff" if pickup is present but dropoff is missing.
- "need_passengers" if pickup and dropoff are present but passengers is missing.
- "need_datetime" if pickup, dropoff, and passengers are present but date/time schedule is missing.
- "quoting" if all 4 are present.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        { role: 'user', parts: [{ text: `Conversational History:\n${historyString}\n\nLatest User Message: "${message}"` }] }
      ],
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["reply", "parsedState", "stage"],
          properties: {
            reply: { type: Type.STRING },
            stage: { type: Type.STRING },
            parsedState: {
              type: Type.OBJECT,
              properties: {
                pickup: { type: Type.STRING },
                pickupId: { type: Type.STRING },
                dropoff: { type: Type.STRING },
                dropoffId: { type: Type.STRING },
                date: { type: Type.STRING },
                time: { type: Type.STRING },
                rideType: { type: Type.STRING },
                passengers: { type: Type.INTEGER }
              }
            }
          }
        }
      }
    });

    const text = response.text || "{}";
    const parsedJson = JSON.parse(text.trim());

    // Resolve exact geocoded coordinates for any custom location
    if (parsedJson.parsedState?.pickup) {
      const pCoords = await resolveCoordinates(parsedJson.parsedState.pickup);
      if (pCoords) {
        parsedJson.parsedState.pickup = pCoords.formattedAddress;
        parsedJson.parsedState.pickupLat = pCoords.lat;
        parsedJson.parsedState.pickupLng = pCoords.lng;
      }
    }
    if (parsedJson.parsedState?.dropoff) {
      const dCoords = await resolveCoordinates(parsedJson.parsedState.dropoff);
      if (dCoords) {
        parsedJson.parsedState.dropoff = dCoords.formattedAddress;
        parsedJson.parsedState.dropoffLat = dCoords.lat;
        parsedJson.parsedState.dropoffLng = dCoords.lng;
      }
    }

    res.json(parsedJson);

  } catch (err: any) {
    console.error("Gemini Parse Error:", err);
    // Return graceful fallback
    const fallbackResult = await runFallbackNLP(message, parsedState);
    res.json(fallbackResult);
  }
});

// Configure Vite middleware in development or serve static assets in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist/index.html'));
  });
} else {
  // We load Vite dynamically to avoid server side bundle issues during production compile
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`RideEasy Server booting on port ${PORT}...`);
});
