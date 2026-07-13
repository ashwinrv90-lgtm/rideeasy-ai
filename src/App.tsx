import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, Navigation, MapPin, Award, CheckCircle, AlertTriangle, 
  Database, Shield, Terminal, Send, HelpCircle, ArrowRight, Settings, 
  Map as MapIcon, ChevronRight, Share2, Compass, PhoneCall, RefreshCw, 
  Filter, Check, User, Code, FileText, Activity, Clock, LogIn, ExternalLink, Sparkles
} from 'lucide-react';

// Define Interface types
interface Message {
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  stage?: string;
  interactiveData?: any;
}

interface ParsedState {
  pickup: string | null;
  pickupId: string | null;
  pickupLat?: number | null;
  pickupLng?: number | null;
  dropoff: string | null;
  dropoffId: string | null;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  date: string | null;
  time: string | null;
  rideType: 'bike' | 'auto' | 'cab' | 'suv' | null;
  passengers: number | null;
}

interface RideQuote {
  id: string;
  provider: 'Uber' | 'Ola' | 'Rapido' | 'Namma Yatri';
  vehicle: string;
  category: 'bike' | 'auto' | 'cab' | 'suv';
  fare: number;
  etaMinutes: number;
  surge: boolean;
  surgeMultiplier: number;
  availability: 'High' | 'Medium' | 'Low';
  durationMinutes: number;
  rating: number;
  commissionFree: boolean;
  deepLink: string;
}

interface TelemetryLog {
  timestamp: string;
  source: 'Supabase' | 'PostHog' | 'Adapter' | 'Gemini';
  type: 'info' | 'success' | 'warn' | 'event';
  message: string;
  details?: any;
}

export default function App() {
  // Navigation & Interactive Tabs
  const [activeTab, setActiveTab] = useState<'docs' | 'sandbox'>('sandbox');
  const [activePhase, setActivePhase] = useState<number>(1);
  const [activeConsoleTab, setActiveConsoleTab] = useState<'supabase' | 'posthog' | 'architecture'>('supabase');

  // Simulator States
  const [messageInput, setMessageInput] = useState('');
  const [chatHistory, setChatHistory] = useState<Message[]>([
    {
      sender: 'bot',
      text: '👋 *Welcome to RideEasy!* One stop for all your rides.\n\nI compare prices across *Uber, Ola, Rapido, and Namma Yatri* to find you the cheapest and fastest option instantly!\n\nSimply type your destination (e.g., *\"Airport to T Nagar now\"*) or just say *\"Hi\"* to start our guided setup!',
      timestamp: '09:28 AM',
      stage: 'need_pickup'
    }
  ]);
  const [parsedState, setParsedState] = useState<ParsedState>({
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
    rideType: null,
    passengers: null,
  });
  const [stage, setStage] = useState<string>('need_pickup');
  const [isTyping, setIsTyping] = useState(false);
  const [activeQuotes, setActiveQuotes] = useState<RideQuote[]>([]);
  const [filterCategory, setFilterCategory] = useState<'all' | 'bike' | 'auto' | 'cab' | 'suv'>('all');
  const [sortBy, setSortBy] = useState<'price' | 'eta' | 'value'>('price');
  
  // Real-time Logs Console
  const [logs, setLogs] = useState<TelemetryLog[]>([
    { timestamp: '09:28:50', source: 'Supabase', type: 'info', message: 'Client initialized session. Connected to Supabase Realtime.' },
    { timestamp: '09:28:51', source: 'PostHog', type: 'event', message: 'PostHog tracked: session_started', details: { platform: 'whatsapp_web', region: 'IN' } }
  ]);

  // Saved Places Preferences
  const [userPreferences, setUserPreferences] = useState({
    home: 'Anna Nagar West, Chennai',
    office: 'DLF IT Park Chennai',
    preferredType: 'cab',
    isAcRequired: true,
    preferredProviders: ['Uber', 'Namma Yatri'],
  });

  // Interactive Guided Stepper States
  const [pickupInput, setPickupInput] = useState('');
  const [dropoffInput, setDropoffInput] = useState('');
  const [pickupSuggestions, setPickupSuggestions] = useState<any[]>([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState<any[]>([]);
  const [isSearchingPickup, setIsSearchingPickup] = useState(false);
  const [isSearchingDropoff, setIsSearchingDropoff] = useState(false);
  
  // Track which parameters are actively being edited manually in the UI
  const [editingField, setEditingField] = useState<'pickup' | 'dropoff' | 'passengers' | 'schedule' | null>(null);
  
  // State for Custom IST Scheduler
  const [isSchedulingCustom, setIsSchedulingCustom] = useState(false);
  const [selectedDate, setSelectedDate] = useState('Tomorrow'); // 'Today', 'Tomorrow', 'Custom'
  const [selectedHour, setSelectedHour] = useState('10');
  const [selectedMinute, setSelectedMinute] = useState('00');
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>('AM');
  const [customDateInput, setCustomDateInput] = useState('');

  // Custom expandable billing breakdown details state for selected quote card
  const [expandedQuoteId, setExpandedQuoteId] = useState<string | null>(null);

  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [chatHistory, isTyping]);

  useEffect(() => {
    if (parsedState.passengers !== null && parsedState.passengers > 1 && filterCategory === 'bike') {
      setFilterCategory('all');
    }
  }, [parsedState.passengers, filterCategory]);

  // Standard Coordinates DB for Distance/Fare Matrix Calculations
  const COORDINATES_DB: Record<string, { lat: number; lng: number; name: string }> = {
    'ch_ap': { lat: 12.9816, lng: 80.1643, name: 'Chennai International Airport (MAA)' },
    'ch_tn': { lat: 13.0315, lng: 80.2312, name: 'T Nagar Bus Terminus' },
    'ch_ph': { lat: 12.9915, lng: 80.2170, name: 'Phoenix Marketcity Mall' },
    'ch_an': { lat: 13.0850, lng: 80.2010, name: 'Anna Nagar West' },
    'ch_mc': { lat: 13.0500, lng: 80.2824, name: 'Marina Beach' },
    'ch_ct': { lat: 13.0822, lng: 80.2755, name: 'Chennai Central Station' },
    'ch_dl': { lat: 13.0205, lng: 80.1654, name: 'DLF IT Park Chennai' },
    'bl_ap': { lat: 13.1986, lng: 77.7066, name: 'Kempegowda Int Airport (BLR)' },
    'bl_mg': { lat: 12.9754, lng: 77.6068, name: 'M.G. Road Metro Station' },
    'bl_or': { lat: 13.0451, lng: 77.6266, name: 'Manyata Tech Park' },
    'bl_km': { lat: 12.9338, lng: 77.6244, name: 'Koramangala 4th Block' },
    'bl_or_bellandur': { lat: 12.9268, lng: 77.6762, name: 'Bellandur EcoSpace' },
    'bl_or_hsr': { lat: 12.9116, lng: 77.6410, name: 'HSR Layout Sector 1' },
    'bl_or_ub': { lat: 12.9722, lng: 77.5958, name: 'UB City Mall' },
    'bl_or_ind': { lat: 12.9719, lng: 77.6412, name: 'Indiranagar Double Road' }
  };

  // Autocomplete fetch for Pickup
  useEffect(() => {
    if (!pickupInput.trim() || pickupInput.length < 3) {
      setPickupSuggestions([]);
      return;
    }
    const delayDebounce = setTimeout(() => {
      setIsSearchingPickup(true);
      fetch(`/api/autocomplete?q=${encodeURIComponent(pickupInput)}`)
        .then(res => res.json())
        .then(data => {
          // Map API results to unified structure
          const apiMatches = (data || []).map((item: any) => ({
            id: item.id,
            display_name: item.address || item.name || item.display_name,
            lat: item.lat,
            lng: item.lng !== undefined ? item.lng : item.lon
          }));

          // Add standard coordinates to results if applicable
          const localMatches = Object.entries(COORDINATES_DB)
            .filter(([_, loc]) => loc.name.toLowerCase().includes(pickupInput.toLowerCase()))
            .map(([id, loc]) => ({
              id,
              display_name: loc.name,
              lat: loc.lat,
              lng: loc.lng
            }));
          
          setPickupSuggestions([...localMatches, ...apiMatches]);
          setIsSearchingPickup(false);
        })
        .catch(err => {
          console.error(err);
          setIsSearchingPickup(false);
        });
    }, 400);
    return () => clearTimeout(delayDebounce);
  }, [pickupInput]);

  // Autocomplete fetch for Dropoff
  useEffect(() => {
    if (!dropoffInput.trim() || dropoffInput.length < 3) {
      setDropoffSuggestions([]);
      return;
    }
    const delayDebounce = setTimeout(() => {
      setIsSearchingDropoff(true);
      fetch(`/api/autocomplete?q=${encodeURIComponent(dropoffInput)}`)
        .then(res => res.json())
        .then(data => {
          // Map API results to unified structure
          const apiMatches = (data || []).map((item: any) => ({
            id: item.id,
            display_name: item.address || item.name || item.display_name,
            lat: item.lat,
            lng: item.lng !== undefined ? item.lng : item.lon
          }));

          const localMatches = Object.entries(COORDINATES_DB)
            .filter(([_, loc]) => loc.name.toLowerCase().includes(dropoffInput.toLowerCase()))
            .map(([id, loc]) => ({
              id,
              display_name: loc.name,
              lat: loc.lat,
              lng: loc.lng
            }));

          setDropoffSuggestions([...localMatches, ...apiMatches]);
          setIsSearchingDropoff(false);
        })
        .catch(err => {
          console.error(err);
          setIsSearchingDropoff(false);
        });
    }, 400);
    return () => clearTimeout(delayDebounce);
  }, [dropoffInput]);

  // Handler: Wizard select pickup location
  const selectPickupLocation = (name: string, lat: number | null = null, lng: number | null = null, id: string | null = null) => {
    const updated = {
      ...parsedState,
      pickup: name,
      pickupId: id,
      pickupLat: lat,
      pickupLng: lng
    };
    setParsedState(updated);
    setPickupInput('');
    setPickupSuggestions([]);
    setEditingField(null);

    // Simulate WhatsApp Message logs
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: Message = { sender: 'user', text: `From: ${name}`, timestamp };
    setChatHistory(prev => [...prev, userMsg]);
    setIsTyping(true);

    addLog('PostHog', 'event', 'Wizard: pickup_selected', { name });

    setTimeout(() => {
      setIsTyping(false);
      let reply = "";
      let nextStage = "need_dropoff";

      if (!updated.dropoff) {
        reply = `Starting point updated to *${name}*! Where is your destination dropoff?`;
        nextStage = "need_dropoff";
      } else if (updated.passengers === null) {
        reply = `Starting point updated! Now, *how many members* will be traveling with you?`;
        nextStage = "need_passengers";
      } else if (!updated.date) {
        reply = `Pickup changed! Let me know if we should travel *now* or *schedule later*.`;
        nextStage = "need_datetime";
      } else {
        reply = `Pickup updated! Recalculating cab quote options... 🚗`;
        nextStage = "quoting";
        calculateAdapterQuotes(updated);
      }

      setStage(nextStage);
      setChatHistory(prev => [...prev, { sender: 'bot', text: reply, timestamp, stage: nextStage }]);
    }, 600);
  };

  // Handler: Wizard select dropoff location
  const selectDropoffLocation = (name: string, lat: number | null = null, lng: number | null = null, id: string | null = null) => {
    const updated = {
      ...parsedState,
      dropoff: name,
      dropoffId: id,
      dropoffLat: lat,
      dropoffLng: lng
    };
    setParsedState(updated);
    setDropoffInput('');
    setDropoffSuggestions([]);
    setEditingField(null);

    // Simulate WhatsApp Message logs
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: Message = { sender: 'user', text: `To: ${name}`, timestamp };
    setChatHistory(prev => [...prev, userMsg]);
    setIsTyping(true);

    addLog('PostHog', 'event', 'Wizard: dropoff_selected', { name });

    setTimeout(() => {
      setIsTyping(false);
      let reply = "";
      let nextStage = "need_passengers";

      if (updated.passengers === null) {
        reply = `Destination set to *${name}*! Perfect.\n\n*How many members* (passengers) are traveling?`;
        nextStage = "need_passengers";
      } else if (!updated.date) {
        reply = `Destination updated! Let me know if we should travel *now* or *schedule later*.`;
        nextStage = "need_datetime";
      } else {
        reply = `Destination updated! Recalculating cab quote options... 🚗`;
        nextStage = "quoting";
        calculateAdapterQuotes(updated);
      }

      setStage(nextStage);
      setChatHistory(prev => [...prev, { sender: 'bot', text: reply, timestamp, stage: nextStage }]);
    }, 600);
  };

  // Handler: Wizard select passengers count (with automatic ride mode recommendation)
  const selectPassengersCount = (num: number) => {
    // Mode recommendation:
    // If 1: Default to taxi ('cab' / 'auto') while keeping bike available as an option
    // If 2 or 3: cab (or auto, default cab)
    // If more (>3): suv (big vehicle)
    let recommendedMode: 'bike' | 'auto' | 'cab' | 'suv' = 'cab';
    if (num === 1) {
      recommendedMode = 'cab';
    } else if (num <= 3) {
      recommendedMode = 'cab';
    } else {
      recommendedMode = 'suv';
    }

    const updated = {
      ...parsedState,
      passengers: num,
      rideType: recommendedMode
    };
    setParsedState(updated);
    setEditingField(null);

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: Message = { sender: 'user', text: `Members: ${num}`, timestamp };
    setChatHistory(prev => [...prev, userMsg]);
    setIsTyping(true);

    addLog('PostHog', 'event', 'Wizard: passengers_selected', { count: num, recommendedMode });

    setTimeout(() => {
      setIsTyping(false);
      let reply = "";
      let nextStage = "need_datetime";

      const modeRecName = (recommendedMode as string) === 'bike' ? '🏍️ BIKE TAXI' : (recommendedMode === 'suv' ? '🚙 SUV' : '🚗 CAB / AUTO');
      if (!updated.date) {
        reply = `Understood, *${num} traveler(s)*.\n\nBased on your group size, I have selected the best category: *${modeRecName}*!\n\nWould you like to travel *now* or *schedule for later*?`;
        nextStage = "need_datetime";
      } else {
        reply = `Passengers set to *${num}* (Class: *${modeRecName}*). Recalculating cab quote options... 🚗`;
        nextStage = "quoting";
        calculateAdapterQuotes(updated);
      }

      setStage(nextStage);
      setChatHistory(prev => [...prev, { sender: 'bot', text: reply, timestamp, stage: nextStage }]);
    }, 600);
  };

  // Handler: Wizard select schedule
  const selectSchedule = (type: 'now' | 'later', dateVal: string = 'Today', timeVal: string = 'Now') => {
    const updated = {
      ...parsedState,
      date: dateVal,
      time: timeVal
    };
    setParsedState(updated);
    setEditingField(null);

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const scheduleLabel = type === 'now' ? 'Travel Now' : `Schedule Later (${dateVal} at ${timeVal})`;
    const userMsg: Message = { sender: 'user', text: scheduleLabel, timestamp };
    setChatHistory(prev => [...prev, userMsg]);
    setIsTyping(true);

    addLog('PostHog', 'event', 'Wizard: schedule_selected', { type, dateVal, timeVal });

    setTimeout(() => {
      setIsTyping(false);
      const nextStage = "quoting";
      const reply = `Wonderful! Everything is set.\n\nFrom: *${updated.pickup}*\nTo: *${updated.dropoff}*\nPassengers: *${updated.passengers}* (Class: *${updated.rideType?.toUpperCase()}*)\nSchedule: *${dateVal} ${timeVal}*\n\nFetching and comparing real-time fares from our adapters... 🚀`;

      setStage(nextStage);
      setChatHistory(prev => [...prev, { sender: 'bot', text: reply, timestamp, stage: nextStage }]);
      calculateAdapterQuotes(updated);
    }, 600);
  };

  // Helper: Haversine distance in km
  const getDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of earth
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return parseFloat((R * c).toFixed(1));
  };

  // Helper to add logs
  const addLog = (source: 'Supabase' | 'PostHog' | 'Adapter' | 'Gemini', type: 'info' | 'success' | 'warn' | 'event', message: string, details?: any) => {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    setLogs(prev => [
      { timestamp: timeStr, source, type, message, details },
      ...prev
    ]);
  };

  // Quick preset triggers
  const handlePresetMessage = (msgText: string) => {
    setMessageInput(msgText);
    sendMessage(msgText);
  };

  // Message Sender Logic
  const sendMessage = async (textToSend?: string) => {
    const messageText = textToSend || messageInput;
    if (!messageText.trim()) return;

    // Add user message to history
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: Message = { sender: 'user', text: messageText, timestamp: timeString };
    
    setChatHistory(prev => [...prev, userMsg]);
    setMessageInput('');
    setIsTyping(true);

    addLog('PostHog', 'event', 'PostHog tracked: message_sent', { length: messageText.length });
    addLog('Supabase', 'info', 'Saved user conversation block to Supabase chat_history', { message: messageText });

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          chatHistory: chatHistory.concat(userMsg).map(h => ({ role: h.sender === 'user' ? 'user' : 'model', text: h.text })),
          userPreferences: {
            home: userPreferences.home,
            office: userPreferences.office,
            rideType: userPreferences.preferredType
          },
          parsedState: parsedState
        })
      });

      const data = await response.json();
      setIsTyping(false);

      if (data) {
        addLog('Gemini', 'success', 'Gemini successfully parsed conversational intent', data);
        
        // Update travel details
        const updatedState = {
          pickup: data.parsedState?.pickup !== undefined ? data.parsedState.pickup : parsedState.pickup,
          pickupId: data.parsedState?.pickupId !== undefined ? data.parsedState.pickupId : parsedState.pickupId,
          pickupLat: data.parsedState?.pickupLat !== undefined ? data.parsedState.pickupLat : parsedState.pickupLat,
          pickupLng: data.parsedState?.pickupLng !== undefined ? data.parsedState.pickupLng : parsedState.pickupLng,
          dropoff: data.parsedState?.dropoff !== undefined ? data.parsedState.dropoff : parsedState.dropoff,
          dropoffId: data.parsedState?.dropoffId !== undefined ? data.parsedState.dropoffId : parsedState.dropoffId,
          dropoffLat: data.parsedState?.dropoffLat !== undefined ? data.parsedState.dropoffLat : parsedState.dropoffLat,
          dropoffLng: data.parsedState?.dropoffLng !== undefined ? data.parsedState.dropoffLng : parsedState.dropoffLng,
          date: data.parsedState?.date !== undefined ? data.parsedState.date : parsedState.date,
          time: data.parsedState?.time !== undefined ? data.parsedState.time : parsedState.time,
          rideType: data.parsedState?.rideType !== undefined ? data.parsedState.rideType : parsedState.rideType,
          passengers: data.parsedState?.passengers !== undefined ? data.parsedState.passengers : parsedState.passengers,
        };

        if (updatedState.pickup === null) {
          setPickupInput('');
          setPickupSuggestions([]);
        }
        if (updatedState.dropoff === null) {
          setDropoffInput('');
          setDropoffSuggestions([]);
        }
        if (data.stage === 'need_pickup') {
          setIsSchedulingCustom(false);
        }

        setParsedState(updatedState);
        setStage(data.stage);

        // Add Bot reply
        setChatHistory(prev => [...prev, {
          sender: 'bot',
          text: data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          stage: data.stage
        }]);

        addLog('Supabase', 'info', `Updated active_trip state row: ${updatedState.pickup || 'null'} -> ${updatedState.dropoff || 'null'}`);

        // If stage is quoting, calculate simulated quotes across adapters
        if (data.stage === 'quoting') {
          calculateAdapterQuotes(updatedState);
        }
      }
    } catch (err: any) {
      console.error(err);
      setIsTyping(false);
      addLog('Gemini', 'warn', 'Failed connecting to Gemini backend. Running localized NLP matching rules.');
      
      // Fallback local calculations
      setTimeout(() => {
        const text = messageText.toLowerCase();
        let updated = { ...parsedState };
        
        if (text.includes('airport')) {
          updated.dropoff = 'Chennai International Airport (MAA)';
          updated.dropoffId = 'ch_ap';
        }
        if (text.includes('t nagar')) {
          updated.pickup = 'T Nagar Bus Terminus';
          updated.pickupId = 'ch_tn';
        }
        if (text.includes('phoenix')) {
          updated.pickup = 'Phoenix Marketcity Mall';
          updated.pickupId = 'ch_ph';
        }
        if (text.includes('home')) {
          updated.pickup = userPreferences.home;
          updated.pickupId = 'ch_an';
        }
        if (text.includes('office')) {
          updated.dropoff = userPreferences.office;
          updated.dropoffId = 'ch_dl';
        }
        if (text.includes('auto')) updated.rideType = 'auto';
        else if (text.includes('bike')) updated.rideType = 'bike';
        else if (text.includes('suv')) updated.rideType = 'suv';
        else if (text.includes('cab')) updated.rideType = 'cab';

        if (text.includes('tomorrow')) updated.date = 'Tomorrow';

        setParsedState(updated);
        
        let reply = "";
        let nextStage = "need_pickup";
        if (!updated.pickup) {
          reply = "Understood! Where should I pick you up from?";
          nextStage = "need_pickup";
        } else if (!updated.dropoff) {
          reply = `Got your starting point at *${updated.pickup}*. Where is your dropoff destination?`;
          nextStage = "need_dropoff";
        } else {
          reply = `🚗 Perfect! Connecting RideEasy adapters to calculate price options from *${updated.pickup}* to *${updated.dropoff}*...`;
          nextStage = "quoting";
          calculateAdapterQuotes(updated);
        }

        setStage(nextStage);
        setChatHistory(prev => [...prev, {
          sender: 'bot',
          text: reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          stage: nextStage
        }]);
      }, 800);
    }
  };

  // Adapter Pattern Price Calculation Simulation
  const calculateAdapterQuotes = (trip: ParsedState) => {
    addLog('Adapter', 'info', 'Invoking registered provider adapters: Uber, Ola, Rapido, Namma Yatri...');
    
    // Pick dynamic coordinates if resolved by backend, or standard coordinates, or default
    const startLoc = {
      lat: trip.pickupLat || (trip.pickupId ? COORDINATES_DB[trip.pickupId]?.lat : null) || COORDINATES_DB['ch_an'].lat,
      lng: trip.pickupLng || (trip.pickupId ? COORDINATES_DB[trip.pickupId]?.lng : null) || COORDINATES_DB['ch_an'].lng,
      name: trip.pickup || 'Pickup'
    };
    
    const endLoc = {
      lat: trip.dropoffLat || (trip.dropoffId ? COORDINATES_DB[trip.dropoffId]?.lat : null) || COORDINATES_DB['ch_ap'].lat,
      lng: trip.dropoffLng || (trip.dropoffId ? COORDINATES_DB[trip.dropoffId]?.lng : null) || COORDINATES_DB['ch_ap'].lng,
      name: trip.dropoff || 'Dropoff'
    };

    const distance = getDistanceKm(startLoc.lat, startLoc.lng, endLoc.lat, endLoc.lng);
    const duration = Math.round(distance * 2.5); // 2.5 minutes per km avg in city traffic

    addLog('Adapter', 'success', `Distance Matrix resolved: ${distance} km. Est. travel duration: ${duration} mins.`);

    // Simulate adapters computing quotes according to their individual pricing models
    const uberQuotes: RideQuote[] = [
      {
        id: 'ub_go_' + Date.now(),
        provider: 'Uber',
        vehicle: 'Uber Go (Hatchback)',
        category: 'cab',
        fare: Math.round(60 + distance * 15 * 1.15),
        etaMinutes: 4,
        surge: true,
        surgeMultiplier: 1.15,
        availability: 'High',
        durationMinutes: duration,
        rating: 4.6,
        commissionFree: false,
        deepLink: `uber://?action=setPickup&pickup[latitude]=${startLoc.lat}&pickup[longitude]=${startLoc.lng}&dropoff[latitude]=${endLoc.lat}&dropoff[longitude]=${endLoc.lng}`
      },
      {
        id: 'ub_auto_' + Date.now(),
        provider: 'Uber',
        vehicle: 'Uber Auto',
        category: 'auto',
        fare: Math.round(45 + distance * 12),
        etaMinutes: 6,
        surge: false,
        surgeMultiplier: 1.0,
        availability: 'Medium',
        durationMinutes: duration,
        rating: 4.2,
        commissionFree: false,
        deepLink: `uber://?action=setPickup&pickup[latitude]=${startLoc.lat}&pickup[longitude]=${startLoc.lng}&dropoff[latitude]=${endLoc.lat}&dropoff[longitude]=${endLoc.lng}`
      },
      {
        id: 'ub_suv_' + Date.now(),
        provider: 'Uber',
        vehicle: 'Uber XL (SUV)',
        category: 'suv',
        fare: Math.round(120 + distance * 22),
        etaMinutes: 8,
        surge: false,
        surgeMultiplier: 1.0,
        availability: 'Medium',
        durationMinutes: duration,
        rating: 4.8,
        commissionFree: false,
        deepLink: `uber://?action=setPickup&pickup[latitude]=${startLoc.lat}&pickup[longitude]=${startLoc.lng}&dropoff[latitude]=${endLoc.lat}&dropoff[longitude]=${endLoc.lng}`
      }
    ];

    const olaQuotes: RideQuote[] = [
      {
        id: 'ola_mini_' + Date.now(),
        provider: 'Ola',
        vehicle: 'Ola Mini (Budget)',
        category: 'cab',
        fare: Math.round(55 + distance * 14.5),
        etaMinutes: 3,
        surge: false,
        surgeMultiplier: 1.0,
        availability: 'High',
        durationMinutes: duration,
        rating: 4.5,
        commissionFree: false,
        deepLink: `olacabs://app/launch?pickup_lat=${startLoc.lat}&pickup_lng=${startLoc.lng}&drop_lat=${endLoc.lat}&drop_lng=${endLoc.lng}`
      },
      {
        id: 'ola_auto_' + Date.now(),
        provider: 'Ola',
        vehicle: 'Ola Auto',
        category: 'auto',
        fare: Math.round(40 + distance * 11.5),
        etaMinutes: 5,
        surge: false,
        surgeMultiplier: 1.0,
        availability: 'High',
        durationMinutes: duration,
        rating: 4.3,
        commissionFree: false,
        deepLink: `olacabs://app/launch?pickup_lat=${startLoc.lat}&pickup_lng=${startLoc.lng}&drop_lat=${endLoc.lat}&drop_lng=${endLoc.lng}`
      }
    ];

    const rapidoQuotes: RideQuote[] = [
      {
        id: 'rap_bike_' + Date.now(),
        provider: 'Rapido',
        vehicle: 'Rapido Bike Taxi',
        category: 'bike',
        fare: Math.round(25 + distance * 8),
        etaMinutes: 2,
        surge: false,
        surgeMultiplier: 1.0,
        availability: 'High',
        durationMinutes: Math.round(duration * 0.8), // Bike is faster in traffic
        rating: 4.7,
        commissionFree: false,
        deepLink: `rapido://booking?pickup_lat=${startLoc.lat}&pickup_lng=${startLoc.lng}&drop_lat=${endLoc.lat}&drop_lng=${endLoc.lng}`
      },
      {
        id: 'rap_auto_' + Date.now(),
        provider: 'Rapido',
        vehicle: 'Rapido Auto',
        category: 'auto',
        fare: Math.round(42 + distance * 11.8),
        etaMinutes: 5,
        surge: true,
        surgeMultiplier: 1.1,
        availability: 'Medium',
        durationMinutes: duration,
        rating: 4.4,
        commissionFree: false,
        deepLink: `rapido://booking?pickup_lat=${startLoc.lat}&pickup_lng=${startLoc.lng}&drop_lat=${endLoc.lat}&drop_lng=${endLoc.lng}`
      }
    ];

    const nammaYatriQuotes: RideQuote[] = [
      {
        id: 'ny_auto_' + Date.now(),
        provider: 'Namma Yatri',
        vehicle: 'Namma Yatri Auto (Direct)',
        category: 'auto',
        fare: Math.round(40 + distance * 11.2), // Lower cost due to commission-free
        etaMinutes: 4,
        surge: false,
        surgeMultiplier: 1.0,
        availability: 'High',
        durationMinutes: duration,
        rating: 4.9,
        commissionFree: true, // Special USP
        deepLink: `nammayatri://booking?pickup_lat=${startLoc.lat}&pickup_lng=${startLoc.lng}&drop_lat=${endLoc.lat}&drop_lng=${endLoc.lng}`
      },
      {
        id: 'ny_cab_' + Date.now(),
        provider: 'Namma Yatri',
        vehicle: 'Yatri Cab (AC Mini)',
        category: 'cab',
        fare: Math.round(50 + distance * 13.5),
        etaMinutes: 5,
        surge: false,
        surgeMultiplier: 1.0,
        availability: 'High',
        durationMinutes: duration,
        rating: 4.8,
        commissionFree: true,
        deepLink: `nammayatri://booking?pickup_lat=${startLoc.lat}&pickup_lng=${startLoc.lng}&drop_lat=${endLoc.lat}&drop_lng=${endLoc.lng}`
      }
    ];

    // Combine and sort quotes
    let allQuotes = [...uberQuotes, ...olaQuotes, ...rapidoQuotes, ...nammaYatriQuotes];
    if (trip.passengers !== null && trip.passengers > 1) {
      allQuotes = allQuotes.filter(q => q.category !== 'bike');
    }
    setActiveQuotes(allQuotes);

    addLog('PostHog', 'event', 'PostHog tracked: quotes_calculated', { distance, numQuotes: allQuotes.length });
    addLog('Supabase', 'info', `Wrote ${allQuotes.length} active ride_quotes rows to Supabase linked with trip_id.`, { trip_id: 'trip_' + Date.now().toString().slice(-4) });
  };

  // Reset entire flow
  const handleReset = () => {
    setParsedState({
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
      rideType: null,
      passengers: null,
    });
    setStage('need_pickup');
    setActiveQuotes([]);
    setChatHistory([
      {
        sender: 'bot',
        text: '👋 *Flow Reset!* Let us start fresh. Where are we starting from today?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        stage: 'need_pickup'
      }
    ]);
    addLog('Supabase', 'info', 'Cleared active trip context. Reset session stage to need_pickup.');
  };

  // Click Deep link redirect
  const handleRedirect = (quote: RideQuote) => {
    addLog('PostHog', 'event', 'PostHog tracked: provider_chosen', { provider: quote.provider, category: quote.category, fare: quote.fare });
    addLog('Supabase', 'info', `Audit log recorded: User redirected to ${quote.provider} application schema.`, { deepLink: quote.deepLink });
    
    // Simulating deep linking trigger alert in iframe sandbox
    alert(`⚡ [RideEasy Redirection] ⚡\n\nDeep-linking your phone to the official ${quote.provider} App!\n\nProtocol Schema: ${quote.deepLink}\n\nPre-populated parameters: Latitude, Longitude, and Product category.`);
  };

  // Sort & Filter logic
  const getSortedAndFilteredQuotes = () => {
    let list = [...activeQuotes];
    if (filterCategory !== 'all') {
      list = list.filter(q => q.category === filterCategory);
    }
    
    if (sortBy === 'price') {
      list.sort((a, b) => a.fare - b.fare);
    } else if (sortBy === 'eta') {
      list.sort((a, b) => a.etaMinutes - b.etaMinutes);
    } else if (sortBy === 'value') {
      // Custom algorithm: weight rating heavily, and prioritize zero commission Namma Yatri
      list.sort((a, b) => {
        const scoreA = (a.rating * 20) - (a.fare / 10) + (a.commissionFree ? 15 : 0);
        const scoreB = (b.rating * 20) - (b.fare / 10) + (b.commissionFree ? 15 : 0);
        return scoreB - scoreA;
      });
    }
    return list;
  };

  const processedQuotes = getSortedAndFilteredQuotes();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Upper Navigation / Hero Header */}
      <header className="bg-slate-900/80 border-b border-slate-800 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-emerald-600 p-2 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-900/30">
            <MessageSquare className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-black tracking-tight">
                <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">RideEasy</span>
              </h1>
              <span className="bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 text-[10px] px-2 py-0.5 rounded-full font-medium">India</span>
            </div>
            <p className="text-xs text-slate-300 font-medium">One stop for all your rides</p>
          </div>
        </div>
        
        {/* Toggle between interactive workspace and documentation */}
        <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button 
            id="btn_view_sandbox"
            onClick={() => setActiveTab('sandbox')}
            className={`flex items-center space-x-2 px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${activeTab === 'sandbox' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Interactive Simulator</span>
          </button>
          <button 
            id="btn_view_docs"
            onClick={() => setActiveTab('docs')}
            className={`flex items-center space-x-2 px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${activeTab === 'docs' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Architect Blueprints (16 Phases)</span>
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        
        {/* SANDBOX MODE: Real-time simulator & developer logs */}
        {activeTab === 'sandbox' && (
          <>
            {/* Left Sandbox Sidebar: Active state & presets */}
            <div className="lg:col-span-4 bg-slate-900/40 border-r border-slate-800 p-6 overflow-y-auto flex flex-col space-y-6">
              
              {/* Interactive Step-by-Step Guided Booking Assistant */}
              <div className="bg-slate-900/95 rounded-xl border border-slate-800 p-4 shadow-xl space-y-4">
                
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
                    <h3 className="font-bold text-xs tracking-wider uppercase text-slate-200">Interactive Assistant</h3>
                  </div>
                  <button 
                    onClick={handleReset}
                    className="text-[10px] text-slate-400 hover:text-white flex items-center space-x-1 border border-slate-800 hover:border-slate-700 bg-slate-950 px-2 py-1 rounded transition"
                  >
                    <RefreshCw className="w-2.5 h-2.5" />
                    <span>Reset</span>
                  </button>
                </div>

                {/* Progress Stepper Bar */}
                <div className="flex items-center justify-between text-[9px] text-slate-500 font-bold px-1 border-b border-slate-800/60 pb-2.5">
                  <button 
                    onClick={() => parsedState.pickup && setEditingField('pickup')}
                    className={`flex items-center space-x-1 transition hover:text-white ${parsedState.pickup ? 'text-emerald-400' : 'text-slate-200'}`}
                    disabled={!parsedState.pickup}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] ${parsedState.pickup ? 'bg-emerald-950 border border-emerald-500/50' : 'border border-slate-600'}`}>1</span>
                    <span>From</span>
                  </button>
                  <ChevronRight className="w-2.5 h-2.5 text-slate-700" />
                  <button 
                    onClick={() => parsedState.dropoff && setEditingField('dropoff')}
                    className={`flex items-center space-x-1 transition hover:text-white ${parsedState.dropoff ? 'text-emerald-400' : (parsedState.pickup ? 'text-slate-200 font-semibold' : 'text-slate-600')}`}
                    disabled={!parsedState.dropoff}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] ${parsedState.dropoff ? 'bg-emerald-950 border border-emerald-500/50' : 'border border-slate-700'}`}>2</span>
                    <span>To</span>
                  </button>
                  <ChevronRight className="w-2.5 h-2.5 text-slate-700" />
                  <button 
                    onClick={() => parsedState.passengers !== null && setEditingField('passengers')}
                    className={`flex items-center space-x-1 transition hover:text-white ${parsedState.passengers !== null ? 'text-emerald-400' : (parsedState.pickup && parsedState.dropoff ? 'text-slate-200 font-semibold' : 'text-slate-600')}`}
                    disabled={parsedState.passengers === null}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] ${parsedState.passengers !== null ? 'bg-emerald-950 border border-emerald-500/50' : 'border border-slate-700'}`}>3</span>
                    <span>Members</span>
                  </button>
                  <ChevronRight className="w-2.5 h-2.5 text-slate-700" />
                  <button 
                    onClick={() => parsedState.date && setEditingField('schedule')}
                    className={`flex items-center space-x-1 transition hover:text-white ${parsedState.date ? 'text-emerald-400' : (parsedState.pickup && parsedState.dropoff && parsedState.passengers !== null ? 'text-slate-200 font-semibold' : 'text-slate-600')}`}
                    disabled={!parsedState.date}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] ${parsedState.date ? 'bg-emerald-950 border border-emerald-500/50' : 'border border-slate-700'}`}>4</span>
                    <span>When</span>
                  </button>
                </div>

                {/* ACTIVE STEP CARD CONTENT */}
                <div className="space-y-3">
                  
                  {/* STEP 1: PICKUP (From) */}
                  {(!parsedState.pickup || editingField === 'pickup') && (
                    <div className="space-y-2.5 animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 flex items-center space-x-1">
                          <span className="text-emerald-400">Step 1:</span>
                          <span>Where are we starting from?</span>
                        </label>
                        {editingField === 'pickup' && parsedState.pickup && (
                          <button 
                            onClick={() => setEditingField(null)}
                            className="text-[9px] text-slate-400 hover:text-white border border-slate-800 px-1.5 py-0.5 rounded"
                          >
                            Cancel
                          </button>
                        )}
                      </div>

                      {/* Autocomplete Input Search */}
                      <div className="relative">
                        <MapPin className="absolute left-2.5 top-2.5 w-4 h-4 text-emerald-400" />
                        <input 
                          type="text" 
                          value={pickupInput}
                          onChange={(e) => setPickupInput(e.target.value)}
                          placeholder="Search landmark, hotel, or city..."
                          className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition"
                        />
                        {isSearchingPickup && (
                          <span className="absolute right-3 top-2.5 text-[9px] text-emerald-500 animate-pulse font-mono">Searching...</span>
                        )}
                      </div>

                      {/* Search Suggestions */}
                      {pickupSuggestions.length > 0 && (
                        <div className="bg-slate-950 border border-slate-800 rounded-lg max-h-40 overflow-y-auto divide-y divide-slate-900 shadow-xl z-55 relative">
                          {pickupSuggestions.map((sug, sIdx) => (
                            <button
                              key={sIdx}
                              onClick={() => selectPickupLocation(sug.display_name, sug.lat !== undefined && sug.lat !== null ? parseFloat(String(sug.lat)) : null, sug.lng !== undefined && sug.lng !== null ? parseFloat(String(sug.lng)) : null, sug.id || null)}
                              className="w-full text-left px-3 py-2 text-[11px] text-slate-200 hover:bg-slate-800 flex items-start space-x-2 transition"
                            >
                              <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                              <span className="truncate">{sug.display_name}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Quick select presets */}
                      <div className="space-y-1.5 pt-1.5">
                        <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500 block">Or Quick Select Presets:</span>
                        <div className="grid grid-cols-2 gap-1.5">
                          {[
                            { name: 'Anna Nagar West, Chennai', id: 'ch_an', icon: '🏠' },
                            { name: 'Chennai Central Station', id: 'ch_ct', icon: '🚉' },
                            { name: 'Kempegowda Int Airport (BLR)', id: 'bl_ap', icon: '🛫' },
                            { name: 'Koramangala 4th Block', id: 'bl_km', icon: '📍' }
                          ].map((p, pIdx) => (
                            <button
                              key={pIdx}
                              onClick={() => {
                                const resolved = COORDINATES_DB[p.id];
                                selectPickupLocation(p.name, resolved?.lat || null, resolved?.lng || null, p.id);
                              }}
                              className="bg-slate-950 hover:bg-slate-855 text-left p-2 rounded border border-slate-800 hover:border-slate-700 transition"
                            >
                              <span className="text-[10px] block font-bold text-slate-300 truncate">{p.icon} {p.name.split(',')[0]}</span>
                              <span className="text-[8px] text-slate-500 truncate block">Bengaluru/Chennai</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STEP 2: DROPOFF (To) */}
                  {parsedState.pickup && (!parsedState.dropoff || editingField === 'dropoff') && editingField !== 'pickup' && (
                    <div className="space-y-2.5 animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 flex items-center space-x-1">
                          <span className="text-amber-400">Step 2:</span>
                          <span>Where are we dropping off?</span>
                        </label>
                        {editingField === 'dropoff' && parsedState.dropoff && (
                          <button 
                            onClick={() => setEditingField(null)}
                            className="text-[9px] text-slate-400 hover:text-white border border-slate-800 px-1.5 py-0.5 rounded"
                          >
                            Cancel
                          </button>
                        )}
                      </div>

                      {/* Autocomplete Input Search */}
                      <div className="relative">
                        <Compass className="absolute left-2.5 top-2.5 w-4 h-4 text-amber-400" />
                        <input 
                          type="text" 
                          value={dropoffInput}
                          onChange={(e) => setDropoffInput(e.target.value)}
                          placeholder="Search dropoff destination..."
                          className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition"
                        />
                        {isSearchingDropoff && (
                          <span className="absolute right-3 top-2.5 text-[9px] text-amber-500 animate-pulse font-mono">Searching...</span>
                        )}
                      </div>

                      {/* Suggestions list */}
                      {dropoffSuggestions.length > 0 && (
                        <div className="bg-slate-950 border border-slate-800 rounded-lg max-h-40 overflow-y-auto divide-y divide-slate-900 shadow-xl z-55 relative">
                          {dropoffSuggestions.map((sug, sIdx) => (
                            <button
                              key={sIdx}
                              onClick={() => selectDropoffLocation(sug.display_name, sug.lat !== undefined && sug.lat !== null ? parseFloat(String(sug.lat)) : null, sug.lng !== undefined && sug.lng !== null ? parseFloat(String(sug.lng)) : null, sug.id || null)}
                              className="w-full text-left px-3 py-2 text-[11px] text-slate-200 hover:bg-slate-800 flex items-start space-x-2 transition"
                            >
                              <Compass className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                              <span className="truncate">{sug.display_name}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Quick select presets */}
                      <div className="space-y-1.5 pt-1.5">
                        <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500 block">Or Quick Select Presets:</span>
                        <div className="grid grid-cols-2 gap-1.5">
                          {[
                            { name: 'DLF IT Park Chennai', id: 'ch_dl', icon: '💼' },
                            { name: 'Chennai International Airport (MAA)', id: 'ch_ap', icon: '🛫' },
                            { name: 'Manyata Tech Park', id: 'bl_or', icon: '🏢' },
                            { name: 'Marina Beach, Chennai', id: 'ch_mc', icon: '🏖️' }
                          ].map((p, pIdx) => (
                            <button
                              key={pIdx}
                              onClick={() => {
                                const resolved = COORDINATES_DB[p.id];
                                selectDropoffLocation(p.name, resolved?.lat || null, resolved?.lng || null, p.id);
                              }}
                              className="bg-slate-950 hover:bg-slate-855 text-left p-2 rounded border border-slate-800 hover:border-slate-700 transition"
                            >
                              <span className="text-[10px] block font-bold text-slate-300 truncate">{p.icon} {p.name.split(',')[0]}</span>
                              <span className="text-[8px] text-slate-500 truncate block">Chennai/Bangalore</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STEP 3: MEMBERS (How many passengers?) */}
                  {parsedState.pickup && parsedState.dropoff && (parsedState.passengers === null || editingField === 'passengers') && editingField !== 'pickup' && editingField !== 'dropoff' && (
                    <div className="space-y-2.5 animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 flex items-center space-x-1">
                          <span className="text-emerald-400">Step 3:</span>
                          <span>How many members are traveling?</span>
                        </label>
                        {editingField === 'passengers' && parsedState.passengers !== null && (
                          <button 
                            onClick={() => setEditingField(null)}
                            className="text-[9px] text-slate-400 hover:text-white border border-slate-800 px-1.5 py-0.5 rounded"
                          >
                            Cancel
                          </button>
                        )}
                      </div>

                      {/* Passenger count selector button grid */}
                      <div className="grid grid-cols-3 gap-2">
                        {[1, 2, 3, 4, 5, 6].map((num) => {
                          const isRecommended = parsedState.passengers === num;
                          return (
                            <button
                              key={num}
                              onClick={() => selectPassengersCount(num)}
                              className={`p-3 rounded-lg text-center border transition flex flex-col items-center justify-center space-y-1 ${
                                isRecommended 
                                  ? 'bg-emerald-950 border-emerald-500 text-white shadow-lg' 
                                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                              }`}
                            >
                              <span className="text-sm font-black">{num}</span>
                              <span className="text-[8px] uppercase tracking-wider text-slate-400">
                                {num === 1 ? 'Member' : 'Members'}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Dynamic Rule Explainer based on hover/default */}
                      <div className="bg-slate-950 border border-slate-850 p-2.5 rounded-lg text-[10px] text-slate-400 space-y-1.5 leading-normal">
                        <span className="text-emerald-400 font-bold uppercase tracking-wider text-[8px] block">Smart Category Decision Rules:</span>
                        <div className="space-y-1">
                          <p className="flex items-center space-x-1.5">
                            <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full" />
                            <span><strong>1 traveler:</strong> Defaults to <strong>Cab / Auto</strong> (Bike option is also available!)</span>
                          </p>
                          <p className="flex items-center space-x-1.5">
                            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                            <span><strong>2-3 travelers:</strong> Selected <strong>Auto/Cab</strong> (Uber Auto, Mini, Yatri)</span>
                          </p>
                          <p className="flex items-center space-x-1.5">
                            <span className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
                            <span><strong>4+ travelers:</strong> Selected <strong>Big SUV</strong> (Uber XL/Prime SUV)</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STEP 4: TIMING SCHEDULE (Now vs Later) */}
                  {parsedState.pickup && parsedState.dropoff && parsedState.passengers !== null && (!parsedState.date || editingField === 'schedule') && editingField !== 'pickup' && editingField !== 'dropoff' && editingField !== 'passengers' && (
                    <div className="space-y-3 animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 flex items-center space-x-1">
                          <span className="text-indigo-400">Step 4:</span>
                          <span>When would you like to travel?</span>
                        </label>
                        {editingField === 'schedule' && parsedState.date && (
                          <button 
                            onClick={() => setEditingField(null)}
                            className="text-[9px] text-slate-400 hover:text-white border border-slate-800 px-1.5 py-0.5 rounded"
                          >
                            Cancel
                          </button>
                        )}
                      </div>

                      {/* Travel Now / Custom IST Scheduler */}
                      {!isSchedulingCustom ? (
                        <>
                          <div className="grid grid-cols-2 gap-2.5">
                            <button
                              onClick={() => {
                                setIsSchedulingCustom(false);
                                selectSchedule('now', 'Today', 'Now');
                              }}
                              className="bg-slate-950 hover:bg-slate-855 border border-slate-800 hover:border-slate-700 rounded-lg p-3 text-center transition flex flex-col items-center justify-center space-y-1 group cursor-pointer"
                            >
                              <Clock className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition" />
                              <span className="text-xs font-bold text-white">Travel Now</span>
                              <span className="text-[8px] text-slate-500 uppercase tracking-wider">Immediate pickup</span>
                            </button>
                            
                            <button
                              onClick={() => {
                                setIsSchedulingCustom(true);
                              }}
                              className="bg-slate-950 hover:bg-slate-855 border border-indigo-900/60 hover:border-indigo-700/80 rounded-lg p-3 text-center transition flex flex-col items-center justify-center space-y-1 group cursor-pointer shadow-indigo-950/20 shadow-md"
                            >
                              <Clock className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition" />
                              <span className="text-xs font-bold text-white">Schedule Later</span>
                              <span className="text-[8px] text-indigo-400 font-medium uppercase tracking-wider animate-pulse">Set Date & Time IST ▾</span>
                            </button>
                          </div>

                          {/* Custom Schedule Helper presets */}
                          <div className="space-y-1">
                            <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500 block">Or Quick Presets:</span>
                            <div className="grid grid-cols-2 gap-1.5">
                              <button 
                                onClick={() => {
                                  setIsSchedulingCustom(false);
                                  selectSchedule('later', 'Tomorrow', '08:00 AM');
                                }}
                                className="bg-slate-950 hover:bg-slate-800 text-[10px] text-slate-300 py-1.5 px-2 rounded border border-slate-800 text-left transition cursor-pointer"
                              >
                                🌅 Tomorrow 8:00 AM IST
                              </button>
                              <button 
                                onClick={() => {
                                  setIsSchedulingCustom(false);
                                  selectSchedule('later', 'Tomorrow', '06:30 PM');
                                }}
                                className="bg-slate-950 hover:bg-slate-800 text-[10px] text-slate-300 py-1.5 px-2 rounded border border-slate-800 text-left transition cursor-pointer"
                              >
                                🌇 Tomorrow 6:30 PM IST
                              </button>
                            </div>
                          </div>
                        </>
                      ) : (
                        /* Custom IST Date and Time Scheduler Form */
                        <div className="bg-slate-950 border border-indigo-900/40 rounded-xl p-3.5 space-y-3.5 animate-fadeIn">
                          <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                            <span className="text-xs font-bold text-indigo-400 flex items-center space-x-1">
                              <span>📅</span>
                              <span>Configure Custom IST Schedule</span>
                            </span>
                            <span className="text-[8px] bg-indigo-950 text-indigo-300 border border-indigo-900/60 rounded px-1.5 py-0.5 uppercase tracking-wider font-bold">
                              🇮🇳 IST Timezone
                            </span>
                          </div>

                          {/* Date Selection tabs */}
                          <div className="space-y-1.5">
                            <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500 block">1. Choose Date:</span>
                            <div className="grid grid-cols-3 gap-1.5">
                              {['Today', 'Tomorrow', 'Custom'].map(dOpt => (
                                <button
                                  key={dOpt}
                                  type="button"
                                  onClick={() => {
                                    setSelectedDate(dOpt);
                                    if (dOpt !== 'Custom') {
                                      setCustomDateInput('');
                                    } else {
                                      // Default to tomorrow's date string YYYY-MM-DD
                                      const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
                                      setCustomDateInput(tomorrowStr);
                                    }
                                  }}
                                  className={`py-1 rounded text-xs transition cursor-pointer text-center font-semibold ${
                                    selectedDate === dOpt 
                                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/30' 
                                      : 'bg-slate-900 hover:bg-slate-850 text-slate-400 border border-slate-800/80'
                                  }`}
                                >
                                  {dOpt}
                                </button>
                              ))}
                            </div>

                            {/* Custom Date Picker (if Custom is selected) */}
                            {selectedDate === 'Custom' && (
                              <input
                                type="date"
                                value={customDateInput}
                                onChange={(e) => setCustomDateInput(e.target.value)}
                                min={new Date().toISOString().split('T')[0]}
                                className="w-full bg-slate-900 border border-slate-850 hover:border-slate-700 text-white text-xs rounded p-1.5 focus:outline-none focus:border-indigo-500 transition text-center"
                              />
                            )}
                          </div>

                          {/* Time Selection Form (IST format with AM and PM options) */}
                          <div className="space-y-1.5">
                            <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500 block">2. Select IST Time (HH:MM):</span>
                            <div className="flex items-center justify-between gap-1.5">
                              {/* Hour Dropdown */}
                              <div className="flex-1 space-y-1">
                                <span className="text-[8px] text-slate-500 uppercase block">Hour</span>
                                <select
                                  value={selectedHour}
                                  onChange={(e) => setSelectedHour(e.target.value)}
                                  className="w-full bg-slate-900 border border-slate-850 text-white rounded p-1.5 text-xs focus:outline-none focus:border-indigo-500 transition cursor-pointer text-center"
                                >
                                  {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(h => (
                                    <option key={h} value={h}>{h}</option>
                                  ))}
                                </select>
                              </div>

                              <span className="text-slate-600 font-bold self-end pb-1.5">:</span>

                              {/* Minute Dropdown */}
                              <div className="flex-1 space-y-1">
                                <span className="text-[8px] text-slate-500 uppercase block">Minute</span>
                                <select
                                  value={selectedMinute}
                                  onChange={(e) => setSelectedMinute(e.target.value)}
                                  className="w-full bg-slate-900 border border-slate-850 text-white rounded p-1.5 text-xs focus:outline-none focus:border-indigo-500 transition cursor-pointer text-center"
                                >
                                  {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map(m => (
                                    <option key={m} value={m}>{m}</option>
                                  ))}
                                </select>
                              </div>

                              {/* AM/PM Options Toggle Buttons */}
                              <div className="flex flex-col gap-1 self-end">
                                <span className="text-[8px] text-slate-500 uppercase text-center block">Period</span>
                                <div className="flex bg-slate-900 rounded p-0.5 border border-slate-800">
                                  {['AM', 'PM'].map(pOpt => (
                                    <button
                                      key={pOpt}
                                      type="button"
                                      onClick={() => setSelectedPeriod(pOpt as any)}
                                      className={`px-2 py-1 text-[10px] font-bold rounded transition cursor-pointer ${
                                        selectedPeriod === pOpt 
                                          ? 'bg-indigo-600 text-white' 
                                          : 'text-slate-400 hover:text-white'
                                      }`}
                                    >
                                      {pOpt}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Form Control Actions */}
                          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-900">
                            <button
                              type="button"
                              onClick={() => {
                                setIsSchedulingCustom(false);
                              }}
                              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white text-[10px] font-semibold rounded border border-slate-800 cursor-pointer transition"
                            >
                              Back
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                let dateVal = selectedDate;
                                if (selectedDate === 'Custom') {
                                  if (customDateInput) {
                                    const d = new Date(customDateInput);
                                    dateVal = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
                                  } else {
                                    dateVal = 'Tomorrow';
                                  }
                                }
                                const timeVal = `${selectedHour}:${selectedMinute} ${selectedPeriod}`;
                                setIsSchedulingCustom(false);
                                selectSchedule('later', dateVal, timeVal);
                              }}
                              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-extrabold rounded shadow-md shadow-indigo-900/40 cursor-pointer transition flex items-center space-x-1"
                            >
                              <span>Confirm IST Schedule</span>
                              <span>➔</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* SUMMARY REVIEW PANEL (All fields completed!) */}
                  {parsedState.pickup && parsedState.dropoff && parsedState.passengers !== null && parsedState.date && !editingField && (
                    <div className="space-y-3.5 animate-fadeIn">
                      <div className="bg-emerald-950/40 border border-emerald-900/60 rounded-lg p-3 flex items-center space-x-2.5">
                        <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <div>
                          <span className="text-xs font-bold text-emerald-400 block">Assistant Ready!</span>
                          <span className="text-[9px] text-slate-300 leading-tight block">All details parsed successfully. Rates are compared on the right panel.</span>
                        </div>
                      </div>

                      {/* Interactive summaries list */}
                      <div className="space-y-2 border-y border-slate-850 py-3 text-xs">
                        
                        {/* Pickup */}
                        <div className="flex items-center justify-between group">
                          <div className="flex items-center space-x-2 text-slate-300">
                            <MapPin className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                            <div className="truncate max-w-[150px]">
                              <span className="text-[9px] text-slate-500 uppercase tracking-wider block">Pickup From</span>
                              <span className="font-medium text-slate-200 truncate block">{parsedState.pickup}</span>
                            </div>
                          </div>
                          <button 
                            onClick={() => setEditingField('pickup')}
                            className="text-[10px] text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 px-2 py-0.5 rounded flex items-center space-x-1 transition"
                          >
                            <span>Edit</span>
                          </button>
                        </div>

                        {/* Dropoff */}
                        <div className="flex items-center justify-between group pt-1.5 border-t border-slate-850/40">
                          <div className="flex items-center space-x-2 text-slate-300">
                            <Compass className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                            <div className="truncate max-w-[150px]">
                              <span className="text-[9px] text-slate-500 uppercase tracking-wider block">Dropoff To</span>
                              <span className="font-medium text-slate-200 truncate block">{parsedState.dropoff}</span>
                            </div>
                          </div>
                          <button 
                            onClick={() => setEditingField('dropoff')}
                            className="text-[10px] text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 px-2 py-0.5 rounded flex items-center space-x-1 transition"
                          >
                            <span>Edit</span>
                          </button>
                        </div>

                        {/* Members */}
                        <div className="flex items-center justify-between group pt-1.5 border-t border-slate-850/40">
                          <div className="flex items-center space-x-2 text-slate-300">
                            <User className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                            <div>
                              <span className="text-[9px] text-slate-500 uppercase tracking-wider block">Traveling Members</span>
                              <span className="font-medium text-slate-200 block">
                                {parsedState.passengers} traveler(s) (Class: <strong className="uppercase text-emerald-400">{parsedState.rideType}</strong>)
                              </span>
                            </div>
                          </div>
                          <button 
                            onClick={() => setEditingField('passengers')}
                            className="text-[10px] text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 px-2 py-0.5 rounded flex items-center space-x-1 transition"
                          >
                            <span>Edit</span>
                          </button>
                        </div>

                        {/* Schedule */}
                        <div className="flex items-center justify-between group pt-1.5 border-t border-slate-850/40">
                          <div className="flex items-center space-x-2 text-slate-300">
                            <Clock className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                            <div>
                              <span className="text-[9px] text-slate-500 uppercase tracking-wider block">Schedule Time</span>
                              <span className="font-medium text-slate-200 block">
                                {parsedState.date} ({parsedState.time || 'Now'})
                              </span>
                            </div>
                          </div>
                          <button 
                            onClick={() => setEditingField('schedule')}
                            className="text-[10px] text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 px-2 py-0.5 rounded flex items-center space-x-1 transition"
                          >
                            <span>Edit</span>
                          </button>
                        </div>

                      </div>

                      {/* Recalculate CTA */}
                      <button 
                        onClick={() => calculateAdapterQuotes(parsedState)}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-4 rounded-lg text-xs transition shadow-lg shadow-emerald-900/40 active:scale-95 flex items-center justify-center space-x-2 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Compare Fares Again</span>
                      </button>
                    </div>
                  )}

                </div>
              </div>

              {/* Saved Place Quick Links & User Preference Modifiers */}
              <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                  <div className="flex items-center space-x-2">
                    <Settings className="w-4 h-4 text-emerald-400" />
                    <h3 className="font-semibold text-xs tracking-wider uppercase text-slate-300">Saved Places & Prefs</h3>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Saved Place presets */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">Your Saved Locations</span>
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => handlePresetMessage(`Use ${userPreferences.home} as my pickup`)}
                        className="bg-slate-950 hover:bg-slate-800 text-left p-2 rounded border border-slate-800 hover:border-slate-700 transition"
                      >
                        <span className="font-semibold block text-[10px] text-white">🏠 Home</span>
                        <span className="text-[9px] text-slate-400 truncate block">Anna Nagar West</span>
                      </button>
                      <button 
                        onClick={() => handlePresetMessage(`Set DLF IT Park Chennai as my dropoff`)}
                        className="bg-slate-950 hover:bg-slate-800 text-left p-2 rounded border border-slate-800 hover:border-slate-700 transition"
                      >
                        <span className="font-semibold block text-[10px] text-white">💼 Office</span>
                        <span className="text-[9px] text-slate-400 truncate block">DLF IT Park</span>
                      </button>
                    </div>
                  </div>

                  {/* Preferences selectors */}
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">Default Ride Preferences</span>
                    <div className="grid grid-cols-3 gap-1">
                      {['bike', 'auto', 'cab'].map((type) => (
                        <button
                          key={type}
                          onClick={() => {
                            setUserPreferences(prev => ({ ...prev, preferredType: type }));
                            addLog('Supabase', 'success', `Saved updated preference: preferred_mode = ${type}`);
                          }}
                          className={`p-1.5 rounded text-center capitalize text-[10px] border transition ${userPreferences.preferredType === type ? 'bg-emerald-600 border-emerald-500 text-white font-bold' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'}`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Simulation Quick Messages Templates */}
              <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-4 shadow-xl">
                <div className="flex items-center space-x-2 border-b border-slate-800 pb-3 mb-3">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <h3 className="font-semibold text-xs tracking-wider uppercase text-slate-300">Quick Sandbox Triggers</h3>
                </div>
                
                <p className="text-[11px] text-slate-400 mb-2">Click any typical Indian user query to test natural language extraction:</p>
                
                <div className="space-y-1.5">
                  <button 
                    onClick={() => handlePresetMessage("Hi")}
                    className="w-full text-left bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-800/60 text-emerald-300 p-2.5 rounded text-xs font-bold transition flex items-center justify-between shadow-sm"
                  >
                    <span className="flex items-center space-x-1.5">
                      <span>👋</span>
                      <span>Reset & Start Guided Setup ("Hi")</span>
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-emerald-400" />
                  </button>
                  <button 
                    onClick={() => handlePresetMessage("Home to DLF IT Park Chennai tomorrow")}
                    className="w-full text-left bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 p-2 rounded text-xs transition flex items-center justify-between"
                  >
                    <span>"Home to DLF IT Park Chennai"</span>
                    <ChevronRight className="w-3 h-3 text-slate-500" />
                  </button>
                  <button 
                    onClick={() => handlePresetMessage("Need auto from Koramangala to Indiranagar Bangalore")}
                    className="w-full text-left bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 p-2 rounded text-xs transition flex items-center justify-between"
                  >
                    <span>"Koramangala to Indiranagar"</span>
                    <ChevronRight className="w-3 h-3 text-slate-500" />
                  </button>
                  <button 
                    onClick={() => handlePresetMessage("Mumbai Airport to Marine Drive now")}
                    className="w-full text-left bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 p-2 rounded text-xs transition flex items-center justify-between"
                  >
                    <span>"Mumbai Airport to Marine Drive"</span>
                    <ChevronRight className="w-3 h-3 text-slate-500" />
                  </button>
                  <button 
                    onClick={() => handlePresetMessage("Need SUV for 6 from Delhi Airport to Noida Sector 62")}
                    className="w-full text-left bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 p-2 rounded text-xs transition flex items-center justify-between"
                  >
                    <span>"Delhi Airport to Noida"</span>
                    <ChevronRight className="w-3 h-3 text-slate-500" />
                  </button>
                </div>
              </div>

            </div>

            {/* Central Simulator Panel: WhatsApp simulated chat screen */}
            <div className="lg:col-span-4 bg-slate-950 flex flex-col border-r border-slate-800 relative">
              
              {/* Simulated Mobile Device Frame Header */}
              <div className="bg-emerald-800 text-white px-4 py-3 flex items-center justify-between shadow-md">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="w-9 h-9 bg-emerald-600 rounded-full flex items-center justify-center text-white font-bold text-sm border-2 border-emerald-500/50">
                      RE
                    </div>
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 border-2 border-emerald-800 rounded-full" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm flex items-center">
                      RideEasy AI Assistant
                    </h4>
                    <span className="text-[10px] text-emerald-200">Verified Business Account</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2 text-emerald-100">
                  <PhoneCall className="w-4 h-4 cursor-pointer hover:text-white" />
                  <Settings className="w-4 h-4 cursor-pointer hover:text-white" />
                </div>
              </div>

              {/* Chat Message Scrollable Region */}
              <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 bg-[#0c141a] space-y-4 relative" style={{ backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)', backgroundSize: '16px 16px' }}>
                
                {/* Chat items */}
                {chatHistory.map((chat, idx) => (
                  <div 
                    key={idx} 
                    className={`flex ${chat.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div 
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-xs shadow-md leading-relaxed whitespace-pre-line ${
                        chat.sender === 'user' 
                          ? 'bg-[#005c4b] text-[#e9edef] rounded-tr-none' 
                          : 'bg-[#202c33] text-[#e9edef] rounded-tl-none border border-slate-800/40'
                      }`}
                    >
                      {/* Bold converter helper for simulated WhatsApp style (*bold* to <strong>) */}
                      {chat.text.split('*').map((chunk, cIdx) => 
                        cIdx % 2 === 1 ? <strong key={cIdx} className="font-bold text-emerald-300">{chunk}</strong> : chunk
                      )}
                      
                      <div className="text-[9px] text-[#8696a0] text-right mt-1.5 font-mono">
                        {chat.timestamp}
                      </div>
                    </div>
                  </div>
                ))}

                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-[#202c33] text-slate-300 rounded-lg px-4 py-3 text-xs shadow-md rounded-tl-none border border-slate-800 flex items-center space-x-2">
                      <span className="text-[10px] text-emerald-400 animate-pulse">RideEasy is processing...</span>
                      <div className="flex space-x-1">
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input Bar */}
              <div className="bg-[#1f2c34] p-3 flex items-center space-x-2 border-t border-slate-800">
                <input 
                  type="text" 
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Type message on WhatsApp..." 
                  className="flex-1 bg-[#2a3942] border border-transparent focus:border-emerald-600 rounded-lg px-4 py-2 text-xs text-white focus:outline-none"
                />
                <button 
                  id="btn_send_message"
                  onClick={() => sendMessage()}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white p-2.5 rounded-full shadow-md transition flex items-center justify-center cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

            </div>

            {/* Right Sandbox Panel: Calculated Quotes & live dev logs */}
            <div className="lg:col-span-4 bg-slate-950 flex flex-col border-slate-800 overflow-hidden">
              
              {/* Aggregator Results comparison view */}
              <div className="h-2/3 border-b border-slate-800 flex flex-col overflow-hidden">
                <div className="bg-slate-900/80 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Filter className="w-4 h-4 text-emerald-400" />
                    <h3 className="font-bold text-xs tracking-wider uppercase text-slate-300">Ride Comparison Matrix</h3>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {processedQuotes.length} active quotes
                  </span>
                </div>

                {/* Filters & Sorters */}
                <div className="p-3 bg-slate-900/20 border-b border-slate-800 flex flex-col space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-medium">Category Filter</span>
                    <div className="flex bg-slate-950 rounded p-0.5 border border-slate-800">
                      {['all', ...(parsedState.passengers === null || parsedState.passengers === 1 ? ['bike'] : []), 'auto', 'cab', 'suv'].map(cat => (
                        <button
                          key={cat}
                          onClick={() => setFilterCategory(cat as any)}
                          className={`px-2 py-0.5 rounded text-[9px] capitalize font-semibold transition ${filterCategory === cat ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-medium">Sort By</span>
                    <div className="flex bg-slate-950 rounded p-0.5 border border-slate-800">
                      {[
                        { key: 'price', label: '💰 Lowest Fare' },
                        { key: 'eta', label: '⚡ Best ETA' },
                        { key: 'value', label: '⭐ Value Match' }
                      ].map(opt => (
                        <button
                          key={opt.key}
                          onClick={() => setSortBy(opt.key as any)}
                          className={`px-2 py-0.5 rounded text-[9px] font-semibold transition ${sortBy === opt.key ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Compared Quotes list */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                  {processedQuotes.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
                      <MapIcon className="w-10 h-10 text-slate-700 animate-pulse" />
                      <p className="text-xs">No active ride comparison.</p>
                      <p className="text-[10px] text-slate-600">Simulate a trip by messaging the WhatsApp bot with pickup and dropoff points.</p>
                    </div>
                  ) : (
                    processedQuotes.map((quote) => {
                      // Establish recommendation badge
                      let isBestPrice = quote.fare === Math.min(...processedQuotes.map(q => q.fare));
                      let isFastest = quote.etaMinutes === Math.min(...processedQuotes.map(q => q.etaMinutes));

                      // Calculate receipt charges breakdown details dynamically
                      const isAirport = !!(parsedState.pickup?.toLowerCase().includes('airport') || parsedState.dropoff?.toLowerCase().includes('airport'));
                      const airportFee = isAirport ? 100 : 0;
                      
                      let platformFee = 15;
                      if (quote.provider === 'Namma Yatri') platformFee = 0;
                      else if (quote.provider === 'Rapido') platformFee = 10;
                      else if (quote.provider === 'Ola') platformFee = 20;

                      const gst = Math.round(quote.fare * 0.0476); // 5% GST of subtotal
                      
                      let baseFee = 30;
                      if (quote.category === 'bike') baseFee = 15;
                      else if (quote.category === 'auto') baseFee = 25;
                      else if (quote.category === 'suv') baseFee = 60;

                      const distanceCharge = Math.max(0, quote.fare - airportFee - platformFee - gst - baseFee);
                      const isExpanded = expandedQuoteId === quote.id;
                      
                      return (
                        <div 
                          key={quote.id}
                          className="bg-slate-900 border border-slate-800/80 rounded-xl p-3 shadow-md hover:border-slate-700 transition space-y-2"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-2.5">
                              {/* Provider Icon/Badge */}
                              <div className={`px-2 py-1.5 rounded-lg text-center font-bold text-xs ${
                                quote.provider === 'Uber' ? 'bg-black text-white border border-slate-700' :
                                quote.provider === 'Ola' ? 'bg-lime-500 text-slate-950 font-black' :
                                quote.provider === 'Rapido' ? 'bg-amber-400 text-black font-extrabold' :
                                'bg-[#ff5a00] text-white' // Namma Yatri
                              }`}>
                                {quote.provider.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <h4 className="font-bold text-xs text-white">{quote.vehicle}</h4>
                                <div className="flex items-center space-x-1.5 mt-0.5 text-[10px]">
                                  <span className="text-slate-400">{quote.provider}</span>
                                  <span className="text-slate-600">•</span>
                                  <span className="text-emerald-400 flex items-center">⭐ {quote.rating}</span>
                                  {quote.commissionFree && (
                                    <>
                                      <span className="text-slate-600">•</span>
                                      <span className="text-emerald-500 font-bold bg-emerald-950/80 px-1.5 py-0.2 rounded text-[8px] uppercase tracking-wider border border-emerald-800/60">Commission Free</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            {/* Fare and Surge indicator */}
                            <div className="text-right">
                              <span className="text-lg font-black text-white">₹{quote.fare}</span>
                              {quote.surge && (
                                <span className="block text-[8px] text-amber-400 font-semibold bg-amber-950/80 border border-amber-800/60 rounded px-1 mt-0.5">
                                  ⚡ Surge {quote.surgeMultiplier}x
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Details Row & Badges */}
                          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px]">
                            <div className="flex items-center space-x-2">
                              <span className="text-slate-400">ETA: <strong className="text-white">{quote.etaMinutes} mins</strong></span>
                              <span className="text-slate-600">|</span>
                              <span className="text-slate-400">Ride: <strong className="text-white">{quote.durationMinutes} mins</strong></span>
                            </div>
                            
                            <div className="flex items-center space-x-1.5">
                              <button
                                onClick={() => setExpandedQuoteId(isExpanded ? null : quote.id)}
                                className="text-slate-400 hover:text-white underline text-[9px] mr-1 cursor-pointer"
                              >
                                {isExpanded ? 'Hide Charges ▴' : 'View Charges ▾'}
                              </button>
                              {isBestPrice && (
                                <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider">
                                  Best Price
                                </span>
                              )}
                              {isFastest && (
                                <span className="bg-blue-950 text-blue-400 border border-blue-800 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider">
                                  Fastest
                                </span>
                              )}
                              <button 
                                onClick={() => handleRedirect(quote)}
                                className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold px-3 py-1 rounded transition flex items-center space-x-1 cursor-pointer"
                              >
                                <span>Book</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {/* Expanded Detailed Charges Breakdown Receipt */}
                          {isExpanded && (
                            <div className="mt-2.5 p-3 bg-slate-950 rounded-lg border border-slate-850 space-y-1.5 text-[10px] animate-fadeIn">
                              <span className="text-[8px] uppercase tracking-wider font-extrabold text-slate-500 block mb-1">Fare Breakdown Summary (GST Incl.)</span>
                              <div className="flex justify-between text-slate-400">
                                <span>Base Flag-down Fee</span>
                                <span>₹{baseFee}</span>
                              </div>
                              <div className="flex justify-between text-slate-400">
                                <span>Distance-based rate</span>
                                <span>₹{distanceCharge}</span>
                              </div>
                              {airportFee > 0 && (
                                <div className="flex justify-between text-slate-400">
                                  <span>Airport Parking & Access fee</span>
                                  <span>₹{airportFee}</span>
                                </div>
                              )}
                              <div className="flex justify-between text-slate-400">
                                <span>Platform Svc Booking Fee</span>
                                <span className={quote.provider === 'Namma Yatri' ? 'text-emerald-400 font-bold' : ''}>
                                  {quote.provider === 'Namma Yatri' ? '₹0 (Direct to Driver!)' : `₹${platformFee}`}
                                </span>
                              </div>
                              <div className="flex justify-between text-slate-400">
                                <span>Government GST Tax (5%)</span>
                                <span>₹{gst}</span>
                              </div>
                              <div className="border-t border-slate-800 pt-1.5 flex justify-between font-bold text-white text-[11px]">
                                <span>Total Estimated Fare</span>
                                <span className="text-emerald-400">₹{quote.fare}</span>
                              </div>
                              {quote.provider === 'Namma Yatri' && (
                                <p className="text-[9px] text-emerald-400/90 leading-normal mt-1 bg-emerald-950/20 p-1.5 rounded border border-emerald-900/30">
                                  ❤️ <strong>Zero Commisson Model:</strong> Your entire payment goes directly to the driver's bank account with zero platform cuts.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Console/Logs Realtime Feed (Live Telemetry Engine) */}
              <div className="h-1/3 flex flex-col overflow-hidden bg-slate-950">
                <div className="bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex">
                    <button 
                      onClick={() => setActiveConsoleTab('supabase')}
                      className={`px-4 py-2 text-[10px] font-bold tracking-wider uppercase border-b-2 transition ${activeConsoleTab === 'supabase' ? 'border-emerald-500 text-emerald-400 bg-slate-950' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                    >
                      Supabase Row State
                    </button>
                    <button 
                      onClick={() => setActiveConsoleTab('posthog')}
                      className={`px-4 py-2 text-[10px] font-bold tracking-wider uppercase border-b-2 transition ${activeConsoleTab === 'posthog' ? 'border-emerald-500 text-emerald-400 bg-slate-950' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                    >
                      PostHog Events Stream
                    </button>
                  </div>
                  <div className="px-3">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block align-middle mr-1.5" />
                    <span className="text-[9px] text-emerald-500 font-mono inline-block align-middle">LIVE CONSOLE</span>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 font-mono text-[10px] space-y-1 bg-[#020617] text-emerald-400/90">
                  {activeConsoleTab === 'supabase' && (
                    <>
                      <div className="text-slate-500 border-b border-slate-900 pb-1.5 mb-1.5 flex justify-between items-center">
                        <span>Database context: 12 tables mapped (Simulated local engine)</span>
                        <Database className="w-3.5 h-3.5" />
                      </div>
                      <div className="text-slate-400 font-bold mb-1">[POSTGRES DDL ROW VALUES ACTIVE]</div>
                      
                      {/* Dynamic user preference representation */}
                      <div className="text-emerald-500/80">
                        {`{ "table": "users", "row": { "email": "user_whatsapp@india.in", "preferences": ${JSON.stringify(userPreferences)} } }`}
                      </div>

                      {/* Dynamic active trip representation */}
                      {parsedState.pickup && (
                        <div className="text-blue-400/90 mt-1">
                          {`{ "table": "trips", "status": "active_parsing", "row": { "pickup_address": "${parsedState.pickup}", "dropoff_address": "${parsedState.dropoff || 'null'}", "schedule": "${parsedState.date || 'now'}" } }`}
                        </div>
                      )}

                      {/* Render active quote listings in Supabase style */}
                      {activeQuotes.length > 0 && (
                        <div className="text-emerald-300 mt-1 font-semibold">
                          {`{ "table": "ride_quotes", "action": "INSERT", "rows_added": ${activeQuotes.length} }`}
                        </div>
                      )}

                      {logs.filter(l => l.source === 'Supabase').slice(0, 10).map((log, lIdx) => (
                        <div key={lIdx} className="text-slate-400">
                          <span className="text-slate-600">[{log.timestamp}]</span> {log.message}
                        </div>
                      ))}
                    </>
                  )}

                  {activeConsoleTab === 'posthog' && (
                    <>
                      <div className="text-slate-500 border-b border-slate-900 pb-1.5 mb-1.5 flex justify-between items-center">
                        <span>Telemetry: PostHog stream connected</span>
                        <Activity className="w-3.5 h-3.5" />
                      </div>
                      {logs.filter(l => l.source === 'PostHog').slice(0, 15).map((log, lIdx) => (
                        <div key={lIdx} className="text-emerald-400/90">
                          <span className="text-slate-600">[{log.timestamp}]</span> <span className="text-amber-400 font-semibold">{log.message}</span>
                          {log.details && (
                            <span className="text-slate-500 text-[9px] block pl-14">
                              Payload: {JSON.stringify(log.details)}
                            </span>
                          )}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>

            </div>
          </>
        )}

        {/* BLUEPRINTS ENGINE MODE: Meticulous rendering of all 16 requested phases */}
        {activeTab === 'docs' && (
          <div className="lg:col-span-12 bg-slate-950 flex overflow-hidden h-full">
            
            {/* Sidebar of 16 phases */}
            <div className="w-80 bg-slate-900/40 border-r border-slate-800 flex flex-col h-full overflow-y-auto">
              <div className="p-4 border-b border-slate-800 bg-slate-900/60 sticky top-0 z-10">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Technical Deliverables</span>
                <h3 className="font-extrabold text-sm text-white mt-1">RideEasy Core Spec</h3>
              </div>
              <div className="flex-1 py-2 divide-y divide-slate-800/40">
                {[
                  { id: 1, name: "Phase 1: PRD Blueprint" },
                  { id: 2, name: "Phase 2: Competitive Analysis" },
                  { id: 3, name: "Phase 3: Feasibility Matrix" },
                  { id: 4, name: "Phase 4: Technical Architecture" },
                  { id: 5, name: "Phase 5: OpenStreetMap Platform" },
                  { id: 6, name: "Phase 6: Provider Integrations" },
                  { id: 7, name: "Phase 7: Complete DB Schema" },
                  { id: 8, name: "Phase 8: Express Backend Layout" },
                  { id: 9, name: "Phase 9: Conversational UX" },
                  { id: 10, name: "Phase 10: Rest API Design" },
                  { id: 11, name: "Phase 11: Supabase Implementation" },
                  { id: 12, name: "Phase 12: Deployment & Serverless" },
                  { id: 13, name: "Phase 13: PostHog Analytics" },
                  { id: 14, name: "Phase 14: Security & Compliance" },
                  { id: 15, name: "Phase 15: Testing Strategy" },
                  { id: 16, name: "Phase 16: Future Roadmap" }
                ].map((phase) => (
                  <button
                    key={phase.id}
                    onClick={() => setActivePhase(phase.id)}
                    className={`w-full text-left px-4 py-3 text-xs flex items-center justify-between transition-colors ${activePhase === phase.id ? 'bg-slate-900 text-emerald-400 font-extrabold border-l-4 border-emerald-500' : 'text-slate-300 hover:bg-slate-900/60'}`}
                  >
                    <span>{phase.name}</span>
                    <ChevronRight className={`w-3.5 h-3.5 transition-transform ${activePhase === phase.id ? 'text-emerald-400 transform translate-x-1' : 'text-slate-600'}`} />
                  </button>
                ))}
              </div>
            </div>

            {/* Content view with rich text layouts */}
            <div className="flex-1 bg-slate-950 p-8 overflow-y-auto h-full text-slate-300 leading-relaxed max-w-4xl">
              
              {/* Phase 1 CONTENT */}
              {activePhase === 1 && (
                <div className="space-y-6">
                  <div className="border-b border-slate-800 pb-4">
                    <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider font-mono">Deliverable Phase 1</span>
                    <h2 className="text-2xl font-extrabold text-white mt-1">Product Requirements Document (PRD)</h2>
                  </div>

                  <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800 space-y-2">
                    <h3 className="font-bold text-sm text-white">1.1 Core Platform Objective</h3>
                    <p className="text-xs text-slate-400">
                      The core objective of *RideEasy* is to consolidate and simplify price and ETA comparison of on-demand transportation (cabs, autos, and bike taxis) in India. Utilizing WhatsApp as the primary user interface, users avoid downloading multiple heavy apps, logging into multiple panels, and repetitively entering coordinates.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-bold text-sm text-white border-l-2 border-emerald-500 pl-2">1.2 Out of Scope Boundaries (Crucial)</h3>
                    <p className="text-xs">
                      To prevent liability, billing issues, and credential violations under provider terms of service, the assistant **DOES NOT execute bookings, authorize ride payments, or interact directly with ride dispatch loops**. 
                    </p>
                    <ul className="list-disc pl-5 text-xs text-slate-400 space-y-1.5">
                      <li><strong>No Ride Dispatch:</strong> We never call dispatch endpoints; we only display estimations.</li>
                      <li><strong>No Payment Processing:</strong> We do not hold user wallets or request cards.</li>
                      <li><strong>No Credential Scraping:</strong> No simulated browser logins using user passwords to scrape fares. All routes depend on official deep linking configurations.</li>
                    </ul>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-bold text-sm text-white border-l-2 border-emerald-500 pl-2">1.3 Target Personas (India Market)</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-900/40 p-3 rounded border border-slate-800">
                        <span className="font-semibold block text-xs text-white">👥 Daily Office Commuter</span>
                        <span className="text-[11px] text-slate-400 block mt-1">
                          Commutes between suburbs and tech hubs (e.g. Koramangala to Manyata). Highly price and ETA sensitive. Wants quick comparisons in under 15 seconds.
                        </span>
                      </div>
                      <div className="bg-slate-900/40 p-3 rounded border border-slate-800">
                        <span className="font-semibold block text-xs text-white">✈️ Airport Travelers</span>
                        <span className="text-[11px] text-slate-400 block mt-1">
                          Travelers heading to Bangalore or Chennai Airport from deep within city limits. Focuses heavily on car category reliability (SUV, Sedan) and pre-arranged schedule estimates.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Phase 2 CONTENT */}
              {activePhase === 2 && (
                <div className="space-y-6">
                  <div className="border-b border-slate-800 pb-4">
                    <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider font-mono">Deliverable Phase 2</span>
                    <h2 className="text-2xl font-extrabold text-white mt-1">Competitive Analysis</h2>
                  </div>

                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/40 text-slate-400">
                        <th className="p-3">Feature Set</th>
                        <th className="p-3">Manual Search</th>
                        <th className="p-3">Traditional Aggregators</th>
                        <th className="p-3 text-emerald-400">RideEasy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900">
                      <tr>
                        <td className="p-3 font-semibold">User Effort</td>
                        <td className="p-3 text-slate-400">High (Opens 4 separate apps)</td>
                        <td className="p-3 text-slate-400">Medium (Needs dedicated app install)</td>
                        <td className="p-3 text-emerald-400 font-semibold">Ultra-Low (One WhatsApp message)</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-semibold">App Load Time</td>
                        <td className="p-3 text-slate-400">45 - 60s total</td>
                        <td className="p-3 text-slate-400">10 - 15s</td>
                        <td className="p-3 text-emerald-400 font-semibold">&lt; 3 seconds</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-semibold">Offline Access</td>
                        <td className="p-3 text-slate-400">No</td>
                        <td className="p-3 text-slate-400">No</td>
                        <td className="p-3 text-emerald-400 font-semibold">Yes (via WhatsApp SMS/cellular fallback)</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-semibold">Commission Gaps</td>
                        <td className="p-3 text-slate-400">Varies</td>
                        <td className="p-3 text-slate-400">Charge platform fee</td>
                        <td className="p-3 text-emerald-400 font-semibold">Free / Promotes direct ONDC booking</td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="bg-emerald-950/20 border border-emerald-900/60 p-4 rounded-xl space-y-1.5">
                    <h3 className="font-bold text-xs text-emerald-400">USP Checklist:</h3>
                    <p className="text-xs text-slate-300">
                      Zero app installation footprint, instant comparisons powered by lightweight Gemini entity extraction, and direct ONDC driver connection patterns (via Namma Yatri and Open Transit specifications).
                    </p>
                  </div>
                </div>
              )}

              {/* Phase 3 CONTENT */}
              {activePhase === 3 && (
                <div className="space-y-6">
                  <div className="border-b border-slate-800 pb-4">
                    <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider font-mono">Deliverable Phase 3</span>
                    <h2 className="text-2xl font-extrabold text-white mt-1">Feasibility Analysis</h2>
                  </div>

                  <p className="text-xs text-slate-400">
                    To maintain strict technical rigor, we break down each Indian on-demand transit provider regarding official technical support. We explicitly categorise feasibility into official statuses:
                  </p>

                  <div className="space-y-4">
                    <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/30">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-white">🚗 Uber India Platform</span>
                        <span className="bg-blue-950 text-blue-400 text-[10px] px-2 py-0.5 rounded font-mono">Officially Supported & Partner APIs</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-2">
                        Uber provides a rich sandbox and official ride estimation APIs. However, fetching precise live prices for third-party apps requires official *Developer Credentials*. Standard deep links using geographical query strings to open the pre-populated booking flow in the client app are **Fully Supported and compliant**.
                      </p>
                    </div>

                    <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/30">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-white">🚲 Rapido Platform</span>
                        <span className="bg-amber-950 text-amber-400 text-[10px] px-2 py-0.5 rounded font-mono">Alternative Solution / Intralinks</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-2">
                        Rapido has closed corporate ecosystem APIs. Third-party direct programmatic integrations are currently *Not Publicly Possible* without manual partnership agreements. Standard deep linking to launch the Rapido Android/iOS app with latitude and longitude is the safest compliant pathway.
                      </p>
                    </div>

                    <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/30">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-white">🏎️ Namma Yatri (ONDC Network)</span>
                        <span className="bg-emerald-950 text-emerald-400 text-[10px] px-2 py-0.5 rounded font-mono">Fully Open Data Initiative</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-2">
                        Namma Yatri participates actively in the *Open Network for Digital Commerce (ONDC)* protocols. Direct public telemetry APIs are **Possible via ONDC gateway requests**. This gives RideEasy the cleanest live feed for autos and cabs in Bangalore and Chennai.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Phase 4 CONTENT */}
              {activePhase === 4 && (
                <div className="space-y-6">
                  <div className="border-b border-slate-800 pb-4">
                    <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider font-mono">Deliverable Phase 4</span>
                    <h2 className="text-2xl font-extrabold text-white mt-1">Technical Architecture</h2>
                  </div>

                  <p className="text-xs text-slate-400">
                    We propose an **Adapter Pattern** to isolate each ride-hailing provider. This guarantees that adding future ride-hailing networks requires zero edits to the core pricing orchestrator or NLP parsing pipelines.
                  </p>

                  <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 space-y-3">
                    <span className="font-mono text-[11px] text-emerald-400 block">TypeScript Adapter Pattern Specification</span>
                    <pre className="text-[10px] text-slate-300 overflow-x-auto leading-relaxed bg-slate-950 p-3 rounded">
{`interface RideProviderAdapter {
  getQuote(
    pickupLat: number, 
    pickupLng: number, 
    dropoffLat: number, 
    dropoffLng: number, 
    category?: string
  ): Promise<ProviderRideQuote[]>;
}

class NammaYatriAdapter implements RideProviderAdapter {
  async getQuote(...) {
    // 1. Fetch from open ONDC network endpoint
    // 2. Map payload back to unified schema
    return [{
      fare: computedFare,
      eta: estimatedTime,
      category: 'auto'
    }];
  }
}`}
                    </pre>
                  </div>
                </div>
              )}

              {/* Phase 5 CONTENT */}
              {activePhase === 5 && (
                <div className="space-y-6">
                  <div className="border-b border-slate-800 pb-4">
                    <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider font-mono">Deliverable Phase 5</span>
                    <h2 className="text-2xl font-extrabold text-white mt-1">OpenStreetMap Integration</h2>
                  </div>

                  <div className="space-y-4">
                    <p className="text-xs">
                      The location experience replicates professional ride-hailing systems using free, open-source services. When a user sends raw landmark queries via WhatsApp, the backend performs the following pipeline sequence:
                    </p>

                    <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                      <div className="bg-slate-900 border border-slate-800 p-2 rounded">
                        <span className="font-bold block text-white">1. OSM Nominatim Search</span>
                        <span className="text-slate-400">Matches user strings to locations in India in real time.</span>
                      </div>
                      <div className="bg-slate-900 border border-slate-800 p-2 rounded">
                        <span className="font-bold block text-white">2. Direct Resolution</span>
                        <span className="text-slate-400">Retrieves absolute Lat/Lng coordinates directly with no extra API cost.</span>
                      </div>
                      <div className="bg-slate-900 border border-slate-800 p-2 rounded">
                        <span className="font-bold block text-white">3. Haversine Matrix</span>
                        <span className="text-slate-400">Calculates exact aerial-route distances & estimated durations in traffic.</span>
                      </div>
                    </div>

                    <div className="bg-emerald-950/40 text-emerald-400 border border-emerald-800/50 p-3 rounded-lg text-xs flex items-start space-x-2">
                      <AlertTriangle className="w-5 h-5 flex-shrink-0 text-emerald-400" />
                      <div>
                        <strong>Cost-Free Production Strategy:</strong> We use OpenStreetMap's Nominatim search API with coordinate-embedded unique IDs (`osm_lat_lng_hash`). This completely bypasses expensive enterprise-tier map APIs, perfect for production and portfolio projects.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Phase 6 CONTENT */}
              {activePhase === 6 && (
                <div className="space-y-6">
                  <div className="border-b border-slate-800 pb-4">
                    <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider font-mono">Deliverable Phase 6</span>
                    <h2 className="text-2xl font-extrabold text-white mt-1">Provider Integration Research</h2>
                  </div>

                  <p className="text-xs">
                    Here is the definitive deep-linking URL schemas mapped for native smartphone app redirection:
                  </p>

                  <div className="space-y-3 font-mono text-[10px]">
                    <div className="bg-slate-900 p-3 rounded border border-slate-800">
                      <span className="text-white block font-bold text-xs font-sans mb-1">Uber URL Schema (Pre-population)</span>
                      <span className="text-slate-400 select-all block">
                        uber://?action=setPickup&amp;pickup[latitude]=&lt;lat&gt;&amp;pickup[longitude]=&lt;lng&gt;&amp;dropoff[latitude]=&lt;lat&gt;&amp;dropoff[longitude]=&lt;lng&gt;
                      </span>
                    </div>

                    <div className="bg-slate-900 p-3 rounded border border-slate-800">
                      <span className="text-white block font-bold text-xs font-sans mb-1">Ola URL Schema</span>
                      <span className="text-slate-400 select-all block">
                        olacabs://app/launch?pickup_lat=&lt;lat&gt;&amp;pickup_lng=&lt;lng&gt;&amp;drop_lat=&lt;lat&gt;&amp;drop_lng=&lt;lng&gt;
                      </span>
                    </div>

                    <div className="bg-slate-900 p-3 rounded border border-slate-800">
                      <span className="text-white block font-bold text-xs font-sans mb-1">Namma Yatri (ONDC URI Web Integration)</span>
                      <span className="text-slate-400 select-all block">
                        nammayatri://booking?pickup_lat=&lt;lat&gt;&amp;pickup_lng=&lt;lng&gt;&amp;drop_lat=&lt;lat&gt;&amp;drop_lng=&lt;lng&gt;
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Phase 7 CONTENT */}
              {activePhase === 7 && (
                <div className="space-y-6">
                  <div className="border-b border-slate-800 pb-4">
                    <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider font-mono">Deliverable Phase 7</span>
                    <h2 className="text-2xl font-extrabold text-white mt-1">Complete PostgreSQL Database Schema</h2>
                  </div>

                  <p className="text-xs text-slate-400">
                    A comprehensive Postgres schema designed for Supabase. Includes core users, sessions, geographical saved places, ride estimates, and analytics tables.
                  </p>

                  <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
                    <pre className="text-[10px] text-slate-300 overflow-x-auto leading-relaxed bg-slate-950 p-3 rounded">
{`-- Core Users Table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(15) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Preferences Table
CREATE TABLE user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  preferred_mode VARCHAR(10) DEFAULT 'cab', -- bike, auto, cab, suv
  preferred_providers VARCHAR(20)[] DEFAULT ARRAY['Uber', 'Ola'],
  ac_required BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Saved Places
CREATE TABLE saved_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  label VARCHAR(50) NOT NULL, -- 'Home', 'Office', etc.
  address VARCHAR(512) NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  osm_place_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trips Table (Tracks active & historical searches)
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  pickup_name VARCHAR(255) NOT NULL,
  pickup_lat DOUBLE PRECISION NOT NULL,
  pickup_lng DOUBLE PRECISION NOT NULL,
  dropoff_name VARCHAR(255) NOT NULL,
  dropoff_lat DOUBLE PRECISION NOT NULL,
  dropoff_lng DOUBLE PRECISION NOT NULL,
  scheduled_for TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ride Quotes Table
CREATE TABLE ride_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  provider VARCHAR(30) NOT NULL, -- 'Uber', 'Ola', etc.
  vehicle_type VARCHAR(50) NOT NULL,
  fare NUMERIC(10, 2) NOT NULL,
  eta_minutes INTEGER NOT NULL,
  surge_multiplier NUMERIC(3, 2) DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);`}
                    </pre>
                  </div>
                </div>
              )}

              {/* Phase 8 CONTENT */}
              {activePhase === 8 && (
                <div className="space-y-6">
                  <div className="border-b border-slate-800 pb-4">
                    <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider font-mono">Deliverable Phase 8</span>
                    <h2 className="text-2xl font-extrabold text-white mt-1">Node.js Express Backend Structure</h2>
                  </div>

                  <p className="text-xs text-slate-400">
                    A clean, modular layout that segregates concern paths cleanly, adhering to senior-architect design patterns.
                  </p>

                  <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 text-xs space-y-2">
                    <span className="font-bold text-white block">Project Folder Structure Layout:</span>
                    <div className="font-mono text-[10.5px] leading-relaxed text-slate-300">
                      <div>📁 <strong className="text-emerald-400">src/</strong></div>
                      <div className="pl-4">📁 <strong>adapters/</strong> - Interfacing with Uber, Ola, Rapido, & Namma Yatri APIs</div>
                      <div className="pl-4">📁 <strong>controllers/</strong> - Express route endpoints (Webhook, Chat, Auth)</div>
                      <div className="pl-4">📁 <strong>middleware/</strong> - Express validation schemas, security headers, CORS</div>
                      <div className="pl-4">📁 <strong>services/</strong> - Gemini NLP parser, OpenStreetMap geocoder, DB Client</div>
                      <div className="pl-4">📁 <strong>types/</strong> - Shared TypeScript schemas & matrices</div>
                      <div className="pl-4">📄 <strong>app.ts</strong> - Express server app instantiation</div>
                      <div className="pl-4">📄 <strong>server.ts</strong> - Server listening entry point</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Phase 9 CONTENT */}
              {activePhase === 9 && (
                <div className="space-y-6">
                  <div className="border-b border-slate-800 pb-4">
                    <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider font-mono">Deliverable Phase 9</span>
                    <h2 className="text-2xl font-extrabold text-white mt-1">WhatsApp Conversational UX</h2>
                  </div>

                  <div className="space-y-4">
                    <p className="text-xs">
                      The core conversational model is optimized for minimal user friction. Instead of typing lengthy forms, the assistant asks exactly one target question at a time.
                    </p>

                    <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/30 text-xs space-y-2">
                      <span className="font-bold text-emerald-400 block">💬 Conversational UX Tree Scenario:</span>
                      <div className="space-y-2 font-mono text-[11px]">
                        <div>👤 <strong>User:</strong> "Need cab to Chennai Airport tomorrow morning"</div>
                        <div className="text-slate-400">👉 <em>(Gemini extracts Dropoff = Chennai Airport, Date = Tomorrow, Type = Cab. Missing = Pickup)</em></div>
                        <div>🤖 <strong>RideEasy:</strong> "Got it! Comparing cabs to *Chennai Airport* for tomorrow. 🚗 Where should I pick you up from?"</div>
                        <div>👤 <strong>User:</strong> "Phoenix Mall"</div>
                        <div className="text-slate-400">👉 <em>(All parameters resolved. Fetching pricing adapters...)</em></div>
                        <div>🤖 <strong>RideEasy:</strong> "Perfect! Fares compared successfully for *Phoenix Mall* ➔ *Chennai Airport*."</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Phase 10 CONTENT */}
              {activePhase === 10 && (
                <div className="space-y-6">
                  <div className="border-b border-slate-800 pb-4">
                    <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider font-mono">Deliverable Phase 10</span>
                    <h2 className="text-2xl font-extrabold text-white mt-1">REST API Design Documentation</h2>
                  </div>

                  <div className="space-y-4 text-xs">
                    <div className="bg-slate-900 border border-slate-800 p-3 rounded">
                      <div className="flex items-center justify-between">
                        <strong className="text-emerald-400">POST /api/v1/whatsapp/webhook</strong>
                        <span className="text-slate-400 bg-slate-950 px-2 py-0.5 rounded text-[10px] font-mono">WhatsApp Webhook</span>
                      </div>
                      <p className="text-slate-400 mt-1.5 text-[11px]">Receives raw payloads from Meta Business cloud servers. Responds in &lt; 2 seconds with 200 OK.</p>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 p-3 rounded">
                      <div className="flex items-center justify-between">
                        <strong className="text-emerald-400">GET /api/v1/rides/compare</strong>
                        <span className="text-slate-400 bg-slate-950 px-2 py-0.5 rounded text-[10px] font-mono">Quotes Endpoint</span>
                      </div>
                      <p className="text-slate-400 mt-1.5 text-[11px]">Query params: `pickup_lat`, `pickup_lng`, `dropoff_lat`, `dropoff_lng`, `category`.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Phase 11 CONTENT */}
              {activePhase === 11 && (
                <div className="space-y-6">
                  <div className="border-b border-slate-800 pb-4">
                    <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider font-mono">Deliverable Phase 11</span>
                    <h2 className="text-2xl font-extrabold text-white mt-1">Supabase Security (Row Level Security)</h2>
                  </div>

                  <div className="space-y-4">
                    <p className="text-xs text-slate-400">
                      Security is paramount for user locations. We configure precise Row Level Security (RLS) policies inside Supabase to guarantee users can never query coordinates outside their authenticated session.
                    </p>

                    <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
                      <pre className="text-[10px] text-slate-300 overflow-x-auto leading-relaxed bg-slate-950 p-3 rounded">
{`-- Enable Row Level Security
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

-- Create policy so users can only view their own trips
CREATE POLICY trips_security_policy ON trips
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy to only insert trips for themselves
CREATE POLICY insert_own_trips ON trips
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);`}
                      </pre>
                    </div>
                  </div>
                </div>
              )}

              {/* Phase 12 CONTENT */}
              {activePhase === 12 && (
                <div className="space-y-6">
                  <div className="border-b border-slate-800 pb-4">
                    <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider font-mono">Deliverable Phase 12</span>
                    <h2 className="text-2xl font-extrabold text-white mt-1">Deployment on Vercel</h2>
                  </div>

                  <div className="space-y-4">
                    <p className="text-xs">
                      Deploying our Express backend structure as serverless functions on Vercel. Since WhatsApp requires webhooks to respond **within 10 seconds** to prevent retries (which create infinite message loops), we implement:
                    </p>

                    <ul className="list-disc pl-5 text-xs text-slate-400 space-y-1">
                      <li><strong>Immediate Acknowledge:</strong> Webhook answers WhatsApp with `200 OK` instantly, then triggers background execution.</li>
                      <li><strong>Vercel Serverless Configurations:</strong> Customize `vercel.json` with a 15-second timeout limit.</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Phase 13 CONTENT */}
              {activePhase === 13 && (
                <div className="space-y-6">
                  <div className="border-b border-slate-800 pb-4">
                    <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider font-mono">Deliverable Phase 13</span>
                    <h2 className="text-2xl font-extrabold text-white mt-1">PostHog Analytics</h2>
                  </div>

                  <div className="space-y-4">
                    <p className="text-xs text-slate-400">
                      To optimize conversational conversion and detect dropping phases, we track the complete funnel sequentially using PostHog custom telemetry events.
                    </p>

                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-xs font-mono space-y-2">
                      <div className="text-white">Telemetry Conversion Funnel Tracked:</div>
                      <div className="text-slate-400 text-[11px]">
                        <div>1. `Search Started` - Triggered on first message arrival.</div>
                        <div>2. `Location Selected` - OpenStreetMap coordinates resolved.</div>
                        <div>3. `Quote Requested` - Adapter pipeline triggered.</div>
                        <div>4. `Comparison Viewed` - Comparison matrix returned to chat.</div>
                        <div>5. `Redirect Clicked` - User clicked deep-link to book.</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Phase 14 CONTENT */}
              {activePhase === 14 && (
                <div className="space-y-6">
                  <div className="border-b border-slate-800 pb-4">
                    <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider font-mono">Deliverable Phase 14</span>
                    <h2 className="text-2xl font-extrabold text-white mt-1">Security & Compliance</h2>
                  </div>

                  <div className="space-y-4 text-xs text-slate-400">
                    <p>
                      In compliance with India's *Digital Personal Data Protection (DPDP) Act*, we strictly enforce location anonymity.
                    </p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li><strong>No Plaintext Coordinates:</strong> Exact coordinates are never linked directly to phone numbers inside logs.</li>
                      <li><strong>Auto-Purge History:</strong> Raw conversation logs are auto-deleted or anonymized after 72 hours.</li>
                      <li><strong>Zero Credential Storage:</strong> No passwords or OTPs for third-party ride-hailing are ever stored or requested, completely adhering to security directives.</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Phase 15 CONTENT */}
              {activePhase === 15 && (
                <div className="space-y-6">
                  <div className="border-b border-slate-800 pb-4">
                    <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider font-mono">Deliverable Phase 15</span>
                    <h2 className="text-2xl font-extrabold text-white mt-1">Testing Strategy</h2>
                  </div>

                  <p className="text-xs text-slate-400">
                    Our rigorous testing methodology checks individual provider adapter responses using mock geolocations around major airports and tech parks in Bangalore and Chennai.
                  </p>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-slate-900 border border-slate-800 p-3 rounded">
                      <strong className="text-white block mb-1">1. Mocking Adapters</strong>
                      <p className="text-[11px] text-slate-400">Use Jest to mock Uber and Ola network payloads. Ensure adapter mapping remains correct even when provider APIs update payload formats.</p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-3 rounded">
                      <strong className="text-white block mb-1">2. Latency Benchmarks</strong>
                      <p className="text-[11px] text-slate-400">Benchmark distance calculations to ensure overall response stays under 200ms per database query loop.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Phase 16 CONTENT */}
              {activePhase === 16 && (
                <div className="space-y-6">
                  <div className="border-b border-slate-800 pb-4">
                    <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider font-mono">Deliverable Phase 16</span>
                    <h2 className="text-2xl font-extrabold text-white mt-1">Future Product Roadmap</h2>
                  </div>

                  <div className="space-y-4">
                    <p className="text-xs">
                      The core vision of RideEasy extends to smart urban intelligence. The upcoming releases target:
                    </p>

                    <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 space-y-3">
                      <div>
                        <strong className="text-white block text-xs">📈 Predictive Surge Analytics</strong>
                        <p className="text-[11px] text-slate-400 mt-0.5">Use simple client-side ML to predict price surges around office hours at DLF IT Park and advise users to book 15 minutes early.</p>
                      </div>
                      <div>
                        <strong className="text-white block text-xs">🚇 Chennai / Bangalore Metro fares</strong>
                        <p className="text-[11px] text-slate-400 mt-0.5">Include metropolitan train schedules as an alternative route when cab prices exceed peak surge thresholds.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

      </main>
      
      {/* Footer Banner */}
      <footer className="bg-slate-950 border-t border-slate-900 px-6 py-3 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500">
        <div>
          <span>Powered by Express Backend, Gemini 3.5 Flash & OpenStreetMap</span>
        </div>
        <div className="flex items-center space-x-4 mt-2 sm:mt-0">
          <span>Country: India only</span>
          <span>© 2026 RideEasy. Under strict adapter protocol constraints.</span>
        </div>
      </footer>
      
    </div>
  );
}
