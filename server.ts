import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// In-memory configuration with user provided API headers and Telegram Bot Token
export interface AppConfig {
  apiUrl: string;
  customerId: string;
  sessionId: string;
  cookie: string;
  userAgent: string;
  origin: string;
  referer: string;
  telegramToken: string;
  promoCode: string;
  affiliateLink: string;
  telegramChannelId: string;
  autoBroadcast: boolean;
  pollIntervalSeconds: number;
}

const config: AppConfig = {
  apiUrl: 'https://crash-gateway-grm-cr.100hp.app/history',
  customerId: '077dee8d-c923-4c02-9bee-757573662e69',
  sessionId: 'c3726b1aebf6a416e3f3996f96398845e4c927cdba53f99bf301ddda33e3793deda9752a1b5b82341bd18e1c6dfe2278e653273234489b00e58ee6e124d5368ce68ca2a340bf7e1fa8c8bad1df110a91a412b7b6926468b5aa214b2728d8c8ff8804402f0a174fb35ee6b0895e8d1698e210267ed2a9e342b773de6e6742ee1aa88fb9cc0ff909fdd71fa0ec6b7912a6016c3bb4c710906abbda195751cd632ff31b8c38afa5dd51e95cbd233e.db6423a9840a77fe07e2dd2a9b13a34f.077dee8d-c923-4c02-9bee-757573662e69',
  cookie: '__cf_bm=OfnznCvAfBR7uEZQRodje5RIdx0r0Ius53y7WPcfFkY-1793110767.3276265-1.0.1.1-W.hebf1_kMwNRYJcmWHBfYIoGlfcBSI1SZERh15abUTzI5SrUstsO8hEPqBlCPdbDVndqF_TSbs9UU.e83MWxJrLsnCtP2atFozCiYw0YiZ0r1eddroGaPbgpW8Da4Ci',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36',
  origin: 'https://100hp.app',
  referer: 'https://100hp.app/',
  telegramToken: '8695809195:AAGjU-Pli_5PVNC_8sXoqfX4II2b-tvk1mQ',
  promoCode: 'DAVE67',
  affiliateLink: 'https://1wrrzr.com/?p=mm2g',
  telegramChannelId: '',
  autoBroadcast: false,
  pollIntervalSeconds: 6,
};

export interface CrashRound {
  id: string;
  finalValues: number[];
  rivalFinalValue: number | null;
  topCoefficient: number;
  affectedTopCoefficient: number | null;
  outcome: number;
  hash: string;
  salt: string;
  timestamp?: number;
}

export interface Spike50xRecord {
  id: string;
  topCoefficient: number;
  formattedMultiplier: string;
  dateTimeStr: string;
  date: string;
  time: string;
  timestamp: number;
  hash: string;
  salt: string;
}

export interface SpikesStorage {
  currentDay: string;
  todaySpikes: Spike50xRecord[];
  archive: { day: string; spikes: Spike50xRecord[] }[];
}

const SPIKES_FILE_PATH = path.join(__dirname, 'spikes_50x.json');

// Date & time helpers
function formatDateTime(d: Date): { dateTimeStr: string; date: string; time: string } {
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = String(d.getFullYear()).slice(-2);
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());

  const date = `${day}/${month}/${year}`;
  const time = `${hours}:${minutes}:${seconds}`;
  const dateTimeStr = `${date} ${time}`;
  return { dateTimeStr, date, time };
}

function formatMultiplierPill(num: number): string {
  const fixed = num.toFixed(2);
  const parts = fixed.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${parts.join('.')}x`;
}

// Initial storage state
let spikesStorage: SpikesStorage = {
  currentDay: new Date().toISOString().split('T')[0],
  todaySpikes: [],
  archive: [],
};

function loadSpikesFromDisk() {
  try {
    if (fs.existsSync(SPIKES_FILE_PATH)) {
      const content = fs.readFileSync(SPIKES_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed && Array.isArray(parsed.todaySpikes)) {
        // Strip any residual dummy seed IDs
        parsed.todaySpikes = parsed.todaySpikes.filter(
          (s: Spike50xRecord) =>
            !s.id.startsWith('a1198-') &&
            !s.id.startsWith('b924-') &&
            !s.id.startsWith('c622-') &&
            !s.id.startsWith('d544-') &&
            !s.id.startsWith('e514-') &&
            !s.id.startsWith('f441-')
        );
        spikesStorage = parsed;
        console.log(`[STORAGE] Loaded ${spikesStorage.todaySpikes.length} authentic 100hp spikes >= 50x from disk`);
        return;
      }
    }
    // Starts strictly clean for live 100hp harvesting
    spikesStorage.todaySpikes = [];
    saveSpikesToDisk();
  } catch (err: any) {
    console.error('[STORAGE] Error loading spikes:', err.message);
    spikesStorage.todaySpikes = [];
  }
}

function saveSpikesToDisk() {
  try {
    fs.writeFileSync(SPIKES_FILE_PATH, JSON.stringify(spikesStorage, null, 2), 'utf-8');
  } catch (err: any) {
    console.error('[STORAGE] Error saving spikes to disk:', err.message);
  }
}

// Midnight Reset check (00h00)
function checkAndPerformMidnightReset() {
  const now = new Date();
  const currentDayStr = now.toISOString().split('T')[0];

  if (spikesStorage.currentDay !== currentDayStr) {
    console.log(`[RESET 00H00] Midnight rollover detected: ${spikesStorage.currentDay} -> ${currentDayStr}`);
    if (spikesStorage.todaySpikes.length > 0) {
      spikesStorage.archive.unshift({
        day: spikesStorage.currentDay,
        spikes: [...spikesStorage.todaySpikes],
      });
      spikesStorage.archive = spikesStorage.archive.slice(0, 30);
    }
    spikesStorage.currentDay = currentDayStr;
    spikesStorage.todaySpikes = [];
    saveSpikesToDisk();
  }
}

// Harvest round >= 50x without duplicates
function harvestSpike(item: any, approxTimestamp: number) {
  checkAndPerformMidnightReset();

  const mult = Number(item.topCoefficient);
  if (isNaN(mult) || mult < 50.0) return false;

  // Deduplicate by round ID
  const alreadyExists =
    spikesStorage.todaySpikes.some((s) => s.id === item.id) ||
    spikesStorage.archive.some((a) => a.spikes.some((s) => s.id === item.id));

  if (alreadyExists) return false;

  const dateInfo = formatDateTime(new Date(approxTimestamp));
  const record: Spike50xRecord = {
    id: item.id,
    topCoefficient: mult,
    formattedMultiplier: formatMultiplierPill(mult),
    dateTimeStr: dateInfo.dateTimeStr,
    date: dateInfo.date,
    time: dateInfo.time,
    timestamp: approxTimestamp,
    hash: item.hash || '',
    salt: item.salt || '',
  };

  spikesStorage.todaySpikes.unshift(record);
  saveSpikesToDisk();
  console.log(`[HARVEST >= 50X] Cote détectée : ${record.formattedMultiplier} à ${record.dateTimeStr} (ID: ${record.id})`);
  return true;
}

// Initialize storage on module load
loadSpikesFromDisk();

// Rolling round history cache (deduplicated by id)
let cachedRounds: CrashRound[] = [];
let lastFetchTime: string = '';
let lastFetchStatus: number = 0;
let lastFetchLatency: number = 0;
let lastFetchError: string | null = null;
let telegramBotInfo: any = null;
let telegramPollingActive = false;
let telegramLastUpdateId = 0;
let telegramTotalMessagesHandled = 0;

// Fetch live history from 100hp Crash Gateway
async function fetch100hpHistory(): Promise<{ success: boolean; count: number; error?: string }> {
  const startTime = Date.now();
  try {
    const url = new URL(config.apiUrl);
    const headers: Record<string, string> = {
      'accept': 'application/json, text/plain, */*',
      'customer-id': config.customerId,
      'session-id': config.sessionId,
      'origin': config.origin,
      'referer': config.referer,
      'user-agent': config.userAgent,
    };
    if (config.cookie) {
      headers['cookie'] = config.cookie;
    }

    const response = await fetch(config.apiUrl, {
      method: 'GET',
      headers,
    });

    lastFetchLatency = Date.now() - startTime;
    lastFetchStatus = response.status;
    lastFetchTime = new Date().toISOString();

    // Auto update cookies if Cloudflare sends refreshed cf_bm
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      const match = setCookie.match(/__cf_bm=[^;]+/);
      if (match) {
        config.cookie = match[0];
      }
    }

    if (!response.ok) {
      const errText = await response.text();
      lastFetchError = `HTTP ${response.status}: ${errText.slice(0, 100)}`;
      return { success: false, count: cachedRounds.length, error: lastFetchError };
    }

    const data = await response.json();
    if (Array.isArray(data)) {
      // Check midnight reset
      checkAndPerformMidnightReset();

      // Merge unique rounds keeping history order
      const existingIds = new Set(cachedRounds.map((r) => r.id));
      const newItems: CrashRound[] = [];
      const now = Date.now();

      for (let i = 0; i < data.length; i++) {
        const item = data[i];
        if (item && item.id) {
          const roundTimestamp = now - i * 14000;
          // Harvest any >= 50x rounds into persistent storage
          if (Number(item.topCoefficient) >= 50.0) {
            harvestSpike(item, roundTimestamp);
          }

          if (!existingIds.has(item.id)) {
            newItems.push({
              ...item,
              timestamp: roundTimestamp,
            });
          }
        }
      }

      if (newItems.length > 0) {
        cachedRounds = [...newItems, ...cachedRounds].slice(0, 500);
      } else if (cachedRounds.length === 0) {
        cachedRounds = data.map((d: any, idx: number) => ({
          ...d,
          timestamp: now - idx * 14000,
        }));
      }

      lastFetchError = null;
      return { success: true, count: cachedRounds.length };
    }

    return { success: true, count: cachedRounds.length };
  } catch (err: any) {
    lastFetchLatency = Date.now() - startTime;
    lastFetchError = err.message || 'Fetch error';
    return { success: false, count: cachedRounds.length, error: lastFetchError || undefined };
  }
}

// Volatility, Rhythm Cycle and Crash Probability Analysis Engine
function analyzeHistory(rounds: CrashRound[]) {
  if (!rounds || rounds.length === 0) {
    return {
      totalAnalyzed: 0,
      volatilityIndex: 50,
      phase: 'STABLE',
      safeOddsRecommendation: 3.40,
      objectiveRecommendation: 7.10,
      winRateEstimate: 94.2,
      distribution: { cold: 0, safe: 0, high: 0, mega: 0 },
      streak: 0,
      streakType: 'none',
      recentMultipliers: [],
      averageMultiplier: 2.5,
      roundsSinceLastSpike: 0,
      lastSpikeMultiplier: 1.0,
      roundsSinceLastMegaSpike: 0,
      recommendedLeadMinutes: 3,
      rhythmState: 'NORMAL_CYCLE',
      cooldownReason: "Cycle normal : fenêtre optimale dans 3 minutes pour vous laisser le temps d'entrer en jeu.",
      oddsRange: '10X—15X',
      safeOddsRange: '4X—10X',
    };
  }

  const sample = rounds.slice(0, 50);
  const multipliers = sample.map((r) => Number(r.topCoefficient) || 1.0);

  let coldCount = 0; // < 2.00x
  let safeCount = 0; // 2.00x - 4.99x
  let highCount = 0; // 5.00x - 9.99x
  let megaCount = 0; // >= 10.00x

  multipliers.forEach((m) => {
    if (m < 2.0) coldCount++;
    else if (m < 5.0) safeCount++;
    else if (m < 10.0) highCount++;
    else megaCount++;
  });

  const sum = multipliers.reduce((acc, v) => acc + v, 0);
  const avg = Number((sum / multipliers.length).toFixed(2));

  // Current consecutive streak
  let streak = 0;
  const isFirstCold = multipliers[0] < 2.0;
  for (const m of multipliers) {
    if ((m < 2.0) === isFirstCold) {
      streak++;
    } else {
      break;
    }
  }

  // Find exact position of last spike >= 4.0x and mega spike >= 10.0x
  let roundsSinceLastSpike = 0;
  let lastSpikeMultiplier = multipliers[0];
  for (let i = 0; i < multipliers.length; i++) {
    if (multipliers[i] >= 4.0) {
      roundsSinceLastSpike = i;
      lastSpikeMultiplier = multipliers[i];
      break;
    }
  }

  let roundsSinceLastMegaSpike = 0;
  for (let i = 0; i < multipliers.length; i++) {
    if (multipliers[i] >= 10.0) {
      roundsSinceLastMegaSpike = i;
      break;
    }
  }

  const maxRecent = Math.max(...multipliers.slice(0, 30));

  // Volatility Calculation (Variance of logarithmic coefficients)
  const logVals = multipliers.map((m) => Math.log(Math.max(1.0, m)));
  const meanLog = logVals.reduce((a, b) => a + b, 0) / logVals.length;
  const variance = logVals.reduce((a, b) => a + Math.pow(b - meanLog, 2), 0) / logVals.length;
  const stdDev = Math.sqrt(variance);
  const volatilityIndex = Math.min(100, Math.max(15, Math.round(stdDev * 55 + (megaCount / multipliers.length) * 40)));

  // Fine-grained Lead Time & Rhythm Calibration
  let recommendedLeadMinutes = 3;
  let rhythmState: 'COOLDOWN_PROTECTION' | 'COMPRESSION_BREAKOUT' | 'NORMAL_CYCLE' = 'NORMAL_CYCLE';
  let cooldownReason = '';

  // 1. Protection post-spike : réservée aux pics massifs (>= 15.0x) qui vident la réserve
  if (roundsSinceLastSpike <= 1 && lastSpikeMultiplier >= 15.0) {
    recommendedLeadMinutes = 4;
    rhythmState = 'COOLDOWN_PROTECTION';
    cooldownReason = `Protection post-spike : Gros multiplicateur (${lastSpikeMultiplier}x) détecté il y a ${roundsSinceLastSpike} tour(s). Temporisation de 4 min pour éviter la série de crashs immédiats.`;
  }
  // 2. Cassure d'accumulation : après 4 tours ou plus de crashs (<2x), la vague montante arrive vite
  else if (roundsSinceLastSpike >= 4 || (streak >= 3 && isFirstCold)) {
    recommendedLeadMinutes = 2;
    rhythmState = 'COMPRESSION_BREAKOUT';
    cooldownReason = `Accumulation mature (${roundsSinceLastSpike} tours de compression sans gros pic) : Cassure haussière imminente dans 2 minutes !`;
  }
  // 3. Rythme standard régulier
  else {
    recommendedLeadMinutes = 3;
    rhythmState = 'NORMAL_CYCLE';
    cooldownReason = "Rythme harmonique standard : Signal programmé dans 3 minutes pour une préparation idéale.";
  }

  // Phase Detection
  let phase: 'ACCUMULATION' | 'EXPANSION' | 'CORRECTION' | 'STABLE' = 'STABLE';
  if (isFirstCold && streak >= 3) {
    phase = 'ACCUMULATION';
  } else if (!isFirstCold && multipliers.slice(0, 3).some((m) => m >= 5.0)) {
    phase = 'EXPANSION';
  } else if (coldCount / multipliers.length > 0.65) {
    phase = 'CORRECTION';
  }

  // Dynamic Safe & Objective Odds
  let safeOddsRecommendation = 3.40;
  let objectiveRecommendation = 7.10;

  if (phase === 'ACCUMULATION') {
    safeOddsRecommendation = Number((2.80 + (safeCount % 5) * 0.15).toFixed(2));
    objectiveRecommendation = Number((6.80 + (highCount % 4) * 0.4).toFixed(2));
  } else if (phase === 'EXPANSION') {
    safeOddsRecommendation = Number((3.20 + (megaCount % 3) * 0.3).toFixed(2));
    objectiveRecommendation = Number((8.20 + (megaCount % 4) * 0.6).toFixed(2));
  } else {
    safeOddsRecommendation = Number((2.50 + (safeCount % 4) * 0.2).toFixed(2));
    objectiveRecommendation = Number((6.20 + (highCount % 3) * 0.5).toFixed(2));
  }

  // Odds Range for Signal +
  let oddsRange = '10X—15X';
  if (maxRecent >= 60) {
    oddsRange = '10X—30X';
  } else if (maxRecent >= 30) {
    oddsRange = '10X—20X';
  } else {
    oddsRange = '10X—15X';
  }

  const winRateEstimate = Number((92 + (safeCount / multipliers.length) * 7).toFixed(1));

  return {
    totalAnalyzed: rounds.length,
    volatilityIndex,
    phase,
    safeOddsRecommendation,
    objectiveRecommendation,
    winRateEstimate,
    distribution: {
      cold: coldCount,
      safe: safeCount,
      high: highCount,
      mega: megaCount,
    },
    streak,
    streakType: isFirstCold ? 'crash' : 'win',
    recentMultipliers: multipliers.slice(0, 15),
    averageMultiplier: avg,
    roundsSinceLastSpike,
    lastSpikeMultiplier,
    roundsSinceLastMegaSpike,
    recommendedLeadMinutes,
    rhythmState,
    cooldownReason,
    oddsRange,
    safeOddsRange: '4X—10X',
  };
}

// Generate EXACT Single Signal template with 2, 3 or 4 minutes lead time
function generateSingleSignal(now = new Date(), leadMinutesOverride?: number): { message: string; data: any } {
  const analysis = analyzeHistory(cachedRounds);
  const leadMinutes = leadMinutesOverride && [2, 3, 4].includes(leadMinutesOverride)
    ? leadMinutesOverride
    : analysis.recommendedLeadMinutes;

  // Start in 2, 3 or 4 minutes
  const startTarget = new Date(now.getTime() + leadMinutes * 60 * 1000);
  const endTarget = new Date(startTarget.getTime() + 60 * 1000);

  const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
  const startStr = `${pad(startTarget.getHours())}:${pad(startTarget.getMinutes())}`;
  const endStr = `${pad(endTarget.getHours())}h${pad(endTarget.getMinutes())}`;
  const timeWindow = `${startStr}-${endStr}`;

  const objective = `${analysis.objectiveRecommendation.toFixed(2)}X+`;
  const safe = `${analysis.safeOddsRecommendation.toFixed(2)}X+`;

  const message = `┌───────────────\n⚡ 𝐌𝐄𝐓𝐀 𝐂𝐑𝐀𝐒𝐇 ⚡\n\n├ ⏰ 𝐇𝐄𝐔𝐑𝐄 : ${timeWindow} \n\n├ 🚀 𝐎𝐁𝐉𝐄𝐂𝐓𝐈𝐅 : ${objective}\n\n├ 🎯 𝐒𝐄𝐂𝐔𝐑𝐈𝐓𝐄́ : ${safe}\n\n└───────────────\n\n💎 𝙋𝙍𝙊𝙈𝙊 : ${config.promoCode}`;

  return {
    message,
    data: {
      timeWindow,
      leadMinutes,
      startTargetTime: startTarget.toISOString(),
      endTargetTime: endTarget.toISOString(),
      objective,
      safe,
      promoCode: config.promoCode,
      analysis,
      timestamp: now.toISOString(),
    },
  };
}

// Generate EXACT Signal + template with 7 multi-wave slots and cooling gap
function generateSignalPlus(now = new Date(), startLeadOverride?: number): { message: string; data: any } {
  const analysis = analyzeHistory(cachedRounds);

  // Start lead: at least 3 to 4 minutes ahead so user has time to prepare
  const startLead = startLeadOverride && [2, 3, 4, 5].includes(startLeadOverride)
    ? startLeadOverride
    : Math.max(3, analysis.recommendedLeadMinutes);

  // 7 slots representing 2 distinct high-probability wave clusters with a cooling inter-wave gap
  // Cluster 1 (3 slots): +0m, +3m, +6m
  // Inter-cluster breath pause (8m)
  // Cluster 2 (3 slots): +14m, +17m, +20m
  // Finale Slot (+5m): +25m
  const offsets = [
    startLead,
    startLead + 3,
    startLead + 6,
    startLead + 14,
    startLead + 17,
    startLead + 20,
    startLead + 25,
  ];

  const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
  const slots = offsets.map((gap) => {
    const d = new Date(now.getTime() + gap * 60 * 1000);
    return `${pad(d.getHours())}h${pad(d.getMinutes())}`;
  });

  const timeLines = slots.map((s) => `├ ⏰ 𝐇𝐄𝐔𝐑𝐄 : ${s}`).join('\n');
  const oddsRange = analysis.oddsRange || '10X—15X';
  const safeOddsRange = '4X—10X';

  const message = `┌───────────────\n⏳ 𝐌𝐄𝐓𝐀 𝐂𝐑𝐀𝐒𝐇 ⚡\n\n${timeLines}\n\n├ 🚀 𝐎𝐃𝐃𝐒 : ${oddsRange}\n├ 🎯 𝐒𝐀𝐅𝐄 𝐎𝐃𝐃𝐒 : ${safeOddsRange}\n\n└─────────────── ⤵️\n\n🇨🇮 ${config.affiliateLink}\n\n💎 𝙋𝙍𝙊𝙈𝙊 : ${config.promoCode}`;

  return {
    message,
    data: {
      slots,
      startLead,
      oddsRange,
      safeOddsRange,
      affiliateLink: config.affiliateLink,
      promoCode: config.promoCode,
      analysis,
      timestamp: now.toISOString(),
    },
  };
}

// Send message to Telegram

// ================= MÉTHODE COMPLÈTE DE PRÉDICTION : LA FAILLE =================
export interface FailleSpikeUsed {
  timeStr: string;
  hour: number;
  minute: number;
  coefficient: number;
  id?: string;
}

export interface FailleCalculationResult {
  refTime: string;
  refHour: number;
  refMinute: number;
  spikesUsed: FailleSpikeUsed[];
  minuteSum: number;
  minuteDigitsCount: number;
  predictionMinutes: string[];
  nextHour: string;
  keyHours: string[];
  coeffSum: number;
  coeffRule: '> 100' | '<= 100';
  div1: number;
  div2: number;
  div3: number;
  coteCible: number;
  assurance: number;
  fiabilite: number;
  formattedMessage: string;
  timestamp: string;
}

function calculateFaille(refTimeInput?: string): FailleCalculationResult {
  checkAndPerformMidnightReset();
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n);

  let refH: number;
  let refM: number;
  const match = (refTimeInput || '').match(/(\d{1,2})\s*[:hH]\s*(\d{2})/);
  if (match) {
    refH = parseInt(match[1], 10);
    refM = parseInt(match[2], 10);
  } else {
    const now = new Date();
    refH = now.getHours();
    refM = now.getMinutes();
  }

  refH = Math.max(0, Math.min(23, refH));
  refM = Math.max(0, Math.min(59, refM));
  const refTimeFormatted = `${pad(refH)}h${pad(refM)}`;
  const refMinutesTotal = refH * 60 + refM;

  // 1. Gather candidates STRICTLY from spikes >= 50x (Cotes d'Or only!)
  // Priority 1: spikes >= 50x from today
  // Priority 2: spikes >= 50x from archive (previous days)
  // NEVER use rounds < 50x in the Faille method!
  let candidateSpikes: { hour: number; minute: number; timeStr: string; coeff: number; id?: string }[] = [];

  for (const s of spikesStorage.todaySpikes) {
    if (s.topCoefficient >= 50.0) {
      const parts = (s.time || '').split(':');
      const h = parseInt(parts[0], 10) || 0;
      const m = parseInt(parts[1], 10) || 0;
      candidateSpikes.push({
        hour: h,
        minute: m,
        timeStr: `${pad(h)}h${pad(m)}`,
        coeff: Math.round(s.topCoefficient),
        id: s.id,
      });
    }
  }

  // If less than 3, add spikes >= 50x from archive
  if (candidateSpikes.length < 3) {
    for (const a of spikesStorage.archive) {
      for (const s of a.spikes) {
        if (s.topCoefficient >= 50.0) {
          const parts = (s.time || '').split(':');
          const h = parseInt(parts[0], 10) || 0;
          const m = parseInt(parts[1], 10) || 0;
          candidateSpikes.push({
            hour: h,
            minute: m,
            timeStr: `${pad(h)}h${pad(m)}`,
            coeff: Math.round(s.topCoefficient),
            id: s.id,
          });
        }
      }
    }
  }

  // Sort candidate spikes by distance in minutes to refTime
  candidateSpikes.sort((a, b) => {
    const ma = a.hour * 60 + a.minute;
    const mb = b.hour * 60 + b.minute;
    const diffA = Math.min(Math.abs(ma - refMinutesTotal), 1440 - Math.abs(ma - refMinutesTotal));
    const diffB = Math.min(Math.abs(mb - refMinutesTotal), 1440 - Math.abs(mb - refMinutesTotal));
    return diffA - diffB;
  });

  // Select 3 entries STRICTLY from the available cotes d'or (>= 50x)
  let selected3: { hour: number; minute: number; timeStr: string; coeff: number; id?: string }[] = [];
  if (candidateSpikes.length >= 3) {
    selected3 = candidateSpikes.slice(0, 3);
  } else if (candidateSpikes.length === 2) {
    // Exactly 2 cotes d'or available today: take both, and complete the 3 slots with the closest cote d'or
    selected3 = [candidateSpikes[0], candidateSpikes[1], candidateSpikes[0]];
  } else if (candidateSpikes.length === 1) {
    selected3 = [candidateSpikes[0], candidateSpikes[0], candidateSpikes[0]];
  } else {
    // If no cote >= 50x is yet recorded today or in archive, default to minimum golden cote 50x
    selected3 = [
      { hour: refH, minute: (refM + 50) % 60, timeStr: `${pad(refH)}h${pad((refM + 50) % 60)}`, coeff: 50 },
      { hour: (refH + 23) % 24, minute: (refM + 20) % 60, timeStr: `${pad((refH + 23) % 24)}h${pad((refM + 20) % 60)}`, coeff: 50 },
      { hour: (refH + 22) % 24, minute: (refM + 35) % 60, timeStr: `${pad((refH + 22) % 24)}h${pad((refM + 35) % 60)}`, coeff: 50 },
    ];
  }

  const spikesUsed: FailleSpikeUsed[] = selected3.map((s) => ({
    timeStr: s.timeStr,
    hour: s.hour,
    minute: s.minute,
    coefficient: s.coeff,
    id: s.id,
  }));

  // 3. Additionner les minutes des trois heures
  const m1 = spikesUsed[0]?.minute || 0;
  const m2 = spikesUsed[1]?.minute || 0;
  const m3 = spikesUsed[2]?.minute || 0;
  const minuteSum = m1 + m2 + m3;

  // Règle d'interprétation du total
  let predMinutes: string[] = [];
  const minuteDigitsCount = String(minuteSum).length;

  if (minuteSum >= 100) {
    // Si le total comporte trois chiffres (ex: 138)
    const units = minuteSum % 10;
    const firstTwo = Math.floor(minuteSum / 10);
    const div3 = Math.floor(minuteSum / 3);
    const div2 = Math.floor(div3 / 2);
    const sumDigits = String(minuteSum)
      .split('')
      .reduce((acc, c) => acc + parseInt(c, 10), 0);

    predMinutes = [
      pad(units % 60),
      pad(firstTwo % 60),
      pad(div3 % 60),
      pad(div2 % 60),
      pad(sumDigits % 60),
    ];
  } else {
    // Si le total comporte deux chiffres (ex: 72)
    const tens = Math.floor(minuteSum / 10);
    const units = minuteSum % 10;
    const sumDigits = tens + units;
    const div3 = Math.floor(minuteSum / 3);
    const div2 = Math.floor(div3 / 2);
    predMinutes = [
      pad(sumDigits % 60),
      pad(div3 % 60),
      pad(div2 % 60),
      pad(tens % 60),
      pad(units % 60),
    ];
  }

  // Next hour: H_ref + 1 mod 24
  const nextH = (refH + 1) % 24;
  const nextHourStr = `${pad(nextH)}h`;
  const keyHours = predMinutes.map((min) => `${pad(nextH)}h${min}`);

  // 5. Additionner les trois coefficients
  const c1 = spikesUsed[0]?.coefficient || 50;
  const c2 = spikesUsed[1]?.coefficient || 50;
  const c3 = spikesUsed[2]?.coefficient || 50;
  const coeffSum = c1 + c2 + c3;

  // 6. Appliquer les divisions selon le total
  let div1: number;
  let div2: number;
  let div3: number;
  const coeffRule: '> 100' | '<= 100' = coeffSum > 100 ? '> 100' : '<= 100';

  if (coeffSum > 100) {
    div1 = Math.floor(coeffSum / 4);
    div2 = Math.floor(div1 / 3);
    div3 = Math.floor(div2 / 2);
  } else {
    div1 = Math.floor(coeffSum / 3);
    div2 = Math.floor(div1 / 2);
    div3 = Math.floor(div2 / 2);
  }

  const coteCible = Math.max(1, div1);
  const assurance = Math.max(1, div2);
  const fiabilite = Math.max(1, div3);

  // 7. Format du signal strict
  const formattedMessage =
`┌───────────────\n⏳ 𝐒𝐈𝐆𝐍𝐀𝐋 𝐅𝐀𝐈𝐋𝐋𝐄 𝐌𝐄𝐓𝐀 𝐂𝐑𝐀𝐒𝐇 ⚡\n\n├ 🕒 𝐇𝐄𝐔𝐑𝐄 𝐂𝐎𝐍𝐒𝐈𝐃𝐄́𝐑𝐄́𝐄 : ${refTimeFormatted}\n├ 🔮 𝐇𝐄𝐔𝐑𝐄𝐒 𝐅𝐔𝐓𝐔𝐑𝐄𝐒 :\n\n├ ⏰ 𝐇𝐄𝐔𝐑𝐄 : ${keyHours[0]}\n├ ⏰ 𝐇𝐄𝐔𝐑𝐄 : ${keyHours[1]}\n├ ⏰ 𝐇𝐄𝐔𝐑𝐄 : ${keyHours[2]}\n├ ⏰ 𝐇𝐄𝐔𝐑𝐄 : ${keyHours[3]}\n├ ⏰ 𝐇𝐄𝐔𝐑𝐄 : ${keyHours[4]}\n\n├ 🚀 𝐂𝐎𝐓𝐄 𝐂𝐈𝐁𝐋𝐄 : ${coteCible}\n├ 🎯 𝐀𝐒𝐒𝐔𝐑𝐀𝐍𝐂𝐄 : ${assurance}\n├ 📊 𝐅𝐈𝐀𝐁𝐈𝐋𝐈𝐓𝐄́ : ${fiabilite}\n\n└───────────────\n\n💎 𝙋𝙍𝙊𝙈𝙊 : ${config.promoCode}`;

  return {
    refTime: refTimeFormatted,
    refHour: refH,
    refMinute: refM,
    spikesUsed,
    minuteSum,
    minuteDigitsCount,
    predictionMinutes: predMinutes,
    nextHour: nextHourStr,
    keyHours,
    coeffSum,
    coeffRule,
    div1,
    div2,
    div3,
    coteCible,
    assurance,
    fiabilite,
    formattedMessage,
    timestamp: new Date().toISOString(),
  };
}

async function sendTelegramMessage(chatId: string | number, text: string, replyMarkup?: any): Promise<any> {
  const token = config.telegramToken;
  if (!token) return { ok: false, error: 'No Telegram token provided' };

  try {
    const payload: any = {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    };
    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

// Telegram interactive keyboard markup
function getTelegramKeyboard() {
  return {
    keyboard: [
      [{ text: '⚡ SIGNAL' }, { text: '⏳ SIGNAL +' }],
      [{ text: '🎯 SIGNAL FAILLE' }, { text: '🏆 COTES ≥ 50X DU JOUR' }],
      [{ text: '📊 ANALYSE EN DIRECT' }, { text: '🔄 SYNCHRO HISTORIQUE' }],
      [{ text: '🎁 CODE PROMO & LIEN' }, { text: 'ℹ️ INFOS ALGO' }],
    ],
    resize_keyboard: true,
    persistent: true,
  };
}

// Telegram Polling Engine
async function startTelegramPolling() {
  if (telegramPollingActive) return;
  telegramPollingActive = true;

  // Retrieve bot info first
  try {
    const meRes = await fetch(`https://api.telegram.org/bot${config.telegramToken}/getMe`);
    const meData = await meRes.json();
    if (meData.ok) {
      telegramBotInfo = meData.result;
      console.log(`[TELEGRAM] Bot connected: @${telegramBotInfo.username}`);
    }
  } catch (e: any) {
    console.error('[TELEGRAM] Error fetching getMe:', e.message);
  }

  // Polling loop
  const poll = async () => {
    while (telegramPollingActive) {
      try {
        const url = `https://api.telegram.org/bot${config.telegramToken}/getUpdates?offset=${telegramLastUpdateId + 1}&timeout=20`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            telegramLastUpdateId = Math.max(telegramLastUpdateId, update.update_id);
            telegramTotalMessagesHandled++;

            const message = update.message;
            if (!message || !message.text) continue;

            const text = message.text.trim();
            const chatId = message.chat.id;
            const firstName = message.from?.first_name || 'Trader';

            if (text === '/start' || text === '/help') {
              const welcome = `<b>⚡ BIENVENUE SUR META CRASH PRO ⚡</b>\n\nBonjour <b>${firstName}</b>,\nCe bot est relié en temps réel à l'API d'historique de <b>100hp Crash</b> pour détecter les cycles de volatilité et récolter les cotes ≥ 50x.\n\nCliquez sur un bouton ci-dessous pour générer un signal instantané :`;
              await sendTelegramMessage(chatId, welcome, getTelegramKeyboard());
            } else if (text === '🎯 SIGNAL FAILLE' || text === '⚡ SIGNAL FAILLE' || text === '/faille') {
              const faille = calculateFaille();
              await sendTelegramMessage(chatId, faille.formattedMessage, getTelegramKeyboard());
              const hint = "💡 <i>Pour calculer la faille avec une heure précise, tapez simplement l'heure (ex: <code>16h43</code> ou <code>/faille 12:34</code>).</i>";
              await sendTelegramMessage(chatId, hint, getTelegramKeyboard());
            } else if (text.startsWith('/faille ') || /^\d{1,2}\s*[:hH]\s*\d{2}$/.test(text)) {
              const timeParam = text.replace(/^\/faille\s+/, '').trim();
              const faille = calculateFaille(timeParam);
              await sendTelegramMessage(chatId, faille.formattedMessage, getTelegramKeyboard());
            } else if (text === '⚡ SIGNAL' || text === '/signal') {
              const sig = generateSingleSignal();
              // Clean message only - no long paragraphs
              await sendTelegramMessage(chatId, sig.message, getTelegramKeyboard());
            } else if (text === '⏳ SIGNAL +' || text === '/signalplus') {
              const sigPlus = generateSignalPlus();
              // Clean message only - no long paragraphs
              await sendTelegramMessage(chatId, sigPlus.message, getTelegramKeyboard());
            } else if (text === '🏆 COTES ≥ 50X DU JOUR' || text === '/jackpots' || text === '🏆 JACKPOTS >= 50X') {
              checkAndPerformMidnightReset();
              const list = [...spikesStorage.todaySpikes].sort((a, b) => b.topCoefficient - a.topCoefficient);
              if (list.length === 0) {
                const emptyMsg = `🏆 <b>COTES ≥ 50X DU JOUR (100HP CRASH)</b>\n\nAucune cote ≥ 50x enregistrée pour le moment aujourd'hui.\nLe collecteur écoute le flux en direct.\n<i>Réinitialisation automatique à 00h00.</i>`;
                await sendTelegramMessage(chatId, emptyMsg, getTelegramKeyboard());
              } else {
                const lines = list.map((s) => `• <b>${s.formattedMultiplier}</b> — ⏰ ${s.time} (${s.date})`).join('\n');
                const jackpotsMsg = `🏆 <b>COTES ≥ 50X DU JOUR (100HP CRASH)</b>\n\n${lines}\n\n📊 <i>Total récolté aujourd'hui : ${list.length} cotes\n🔄 Réinitialisation automatique chaque jour à 00h00.</i>`;
                await sendTelegramMessage(chatId, jackpotsMsg, getTelegramKeyboard());
              }
            } else if (text === '📊 ANALYSE EN DIRECT' || text === '/stats') {
              const analysis = analyzeHistory(cachedRounds);
              const statsMsg = `<b>📊 ANALYSE DU MARCHÉ EN DIRECT (100HP)</b>\n\n` +
                `• <b>Tours analysés</b> : ${analysis.totalAnalyzed}\n` +
                `• <b>Index de Volatilité</b> : ${analysis.volatilityIndex}/100\n` +
                `• <b>Phase Actuelle</b> : <b>${analysis.phase}</b>\n` +
                `• <b>Série en cours</b> : ${analysis.streak} tours (${analysis.streakType})\n` +
                `• <b>Délai conseillé</b> : ${analysis.recommendedLeadMinutes} minutes\n` +
                `• <b>Cotes ≥ 50x récoltées aujourd'hui</b> : ${spikesStorage.todaySpikes.length}\n` +
                `• <b>Cote moyenne</b> : ${analysis.averageMultiplier}x\n` +
                `• <b>Dernières cotes</b> : ${analysis.recentMultipliers.slice(0, 8).map((m) => `${m}x`).join(' | ')}\n\n` +
                `🎯 <b>Sécurité conseillée</b> : ${analysis.safeOddsRecommendation}x\n` +
                `🚀 <b>Objectif conseillé</b> : ${analysis.objectiveRecommendation}x`;
              await sendTelegramMessage(chatId, statsMsg, getTelegramKeyboard());
            } else if (text === '🔄 SYNCHRO HISTORIQUE' || text === '/refresh') {
              const result = await fetch100hpHistory();
              const msg = result.success
                ? `✅ <b>Synchronisation réussie !</b>\n${result.count} tours dans la base de données active.\nLatence API : ${lastFetchLatency}ms\nCotes ≥ 50x du jour : ${spikesStorage.todaySpikes.length}`
                : `⚠️ <b>Erreur synchro</b> : ${result.error}`;
              await sendTelegramMessage(chatId, msg, getTelegramKeyboard());
            } else if (text === '🎁 CODE PROMO & LIEN' || text === '/promo') {
              const promoMsg = `💎 <b>OFFRE OFFICIELLE 1WIN & 100HP</b>\n\n` +
                `👉 Inscription : <a href="${config.affiliateLink}">${config.affiliateLink}</a>\n` +
                `👉 Code Promo VIP : <b>${config.promoCode}</b> (Bonus +500% sur vos dépôts)`;
              await sendTelegramMessage(chatId, promoMsg, getTelegramKeyboard());
            } else if (text.startsWith('/setsession')) {
              const parts = text.split(/\s+/);
              if (parts.length < 2) {
                await sendTelegramMessage(chatId, "⚠️ Usage : <code>/setsession VOTRE_NOUVELLE_SESSION_ID</code>", getTelegramKeyboard());
              } else {
                config.sessionId = parts[1].trim();
                const res = await fetch100hpHistory();
                if (res.success) {
                  await sendTelegramMessage(chatId, `✅ <b>Session 100hp mise à jour avec succès !</b>\nConnexion rétablie (Statut 200 OK, ${res.count} tours).`, getTelegramKeyboard());
                } else {
                  await sendTelegramMessage(chatId, `⚠️ <b>Session enregistrée mais erreur API :</b> ${res.error}`, getTelegramKeyboard());
                }
              }
            } else if (text === '/status' || text === '📡 STATUT SERVEUR') {
              const res = await fetch100hpHistory();
              const statusMsg = `📡 <b>STATUT TECHNIQUE DU SYSTÈME</b>\n\n` +
                `• <b>Passerelle 100hp</b> : ${res.success ? '🟢 200 OK EN LIGNE' : '🔴 ERREUR'}\n` +
                `• <b>Latence réseau</b> : ${lastFetchLatency}ms\n` +
                `• <b>Tours en mémoire</b> : ${cachedRounds.length}\n` +
                `• <b>Cotes ≥ 50x récoltées aujourd\'hui</b> : ${spikesStorage.todaySpikes.length}\n` +
                `• <b>Session active</b> : <code>${config.sessionId.slice(0, 16)}...</code>\n` +
                `• <b>Uptime serveur</b> : ${Math.floor(process.uptime() / 60)} minutes`;
              await sendTelegramMessage(chatId, statusMsg, getTelegramKeyboard());
            } else if (text === 'ℹ️ INFOS ALGO') {
              const algoMsg = `🧠 <b>FONCTIONNEMENT DE L'ALGORITHME META CRASH</b>\n\n` +
                `1. <b>Connexion directe Gateway</b> : Extraction continue des seeds, hashes SHA-256 et multiplicateurs 100hp.\n` +
                `2. <b>Récolte automatique ≥ 50x</b> : Détection et archivage instantané des méga cotes avec date et heure précises.\n` +
                `3. <b>Remise à zéro quotidienne</b> : Réinitialisation automatique à 00h00 chaque nuit pour repartir sur une nouvelle journée.\n` +
                `4. <b>Temporisation intelligente</b> : Calcul dynamique de 2 à 4 min de lead time selon les phases de compression.`;
              await sendTelegramMessage(chatId, algoMsg, getTelegramKeyboard());
            }
          }
        }
      } catch (err: any) {
        // Wait 3 seconds on error before retrying
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  };

  poll();
}

// Background poller for 100hp history
setInterval(() => {
  fetch100hpHistory().catch(() => {});
}, config.pollIntervalSeconds * 1000);

// Auto-broadcast scheduler if enabled
setInterval(async () => {
  if (config.autoBroadcast && config.telegramChannelId) {
    const analysis = analyzeHistory(cachedRounds);
    // Auto broadcast when in high probability accumulation phase or breakout
    if (analysis.phase === 'ACCUMULATION' || analysis.volatilityIndex > 65) {
      const sig = generateSingleSignal();
      await sendTelegramMessage(config.telegramChannelId, sig.message);
    }
  }
}, 3 * 60 * 1000); // Check every 3 mins

// Initial fetch & start telegram
fetch100hpHistory().then(() => {
  startTelegramPolling();
});

// ================= API ROUTES =================

// 1. Get current round history
app.get('/api/history', async (req, res) => {
  const force = req.query.force === 'true';
  if (force || cachedRounds.length === 0) {
    await fetch100hpHistory();
  }
  res.json({
    success: true,
    count: cachedRounds.length,
    rounds: cachedRounds,
    lastFetchTime,
    lastFetchStatus,
    lastFetchLatency,
    lastFetchError,
  });
});

// 2. Statistical analysis
app.get('/api/stats', (req, res) => {
  const analysis = analyzeHistory(cachedRounds);
  res.json({
    success: true,
    analysis,
    lastFetchTime,
    lastFetchLatency,
  });
});

// 3. Generate Single Signal
app.get('/api/signals/single', (req, res) => {
  const lead = req.query.lead ? parseInt(req.query.lead as string, 10) : undefined;
  const signal = generateSingleSignal(new Date(), lead);
  res.json({ success: true, signal });
});

// 4. Generate Signal Plus
app.get('/api/signals/plus', (req, res) => {
  const lead = req.query.lead ? parseInt(req.query.lead as string, 10) : undefined;
  const signal = generateSignalPlus(new Date(), lead);
  res.json({ success: true, signal });
});

// 4b. Get Collected 50x+ Spikes
app.get('/api/spikes-50x', (req, res) => {
  checkAndPerformMidnightReset();
  const sort = (req.query.sort as string) || 'multiplier'; // 'multiplier' or 'time'
  const filter = (req.query.filter as string) || 'today'; // 'today' or 'all'

  let list = filter === 'all'
    ? [...spikesStorage.todaySpikes, ...spikesStorage.archive.flatMap((a) => a.spikes)]
    : [...spikesStorage.todaySpikes];

  if (sort === 'time') {
    list.sort((a, b) => b.timestamp - a.timestamp);
  } else {
    // default: highest multiplier first (exactly as shown in screenshot)
    list.sort((a, b) => b.topCoefficient - a.topCoefficient);
  }

  const maxToday = spikesStorage.todaySpikes.length > 0
    ? Math.max(...spikesStorage.todaySpikes.map((s) => s.topCoefficient))
    : 0;

  res.json({
    success: true,
    currentDay: spikesStorage.currentDay,
    totalToday: spikesStorage.todaySpikes.length,
    maxToday,
    spikes: list,
    archive: spikesStorage.archive,
  });
});

// 4c. Keepalive & Health check endpoint (for external cron/pinger like UptimeRobot)
app.get('/api/health', async (req, res) => {
  checkAndPerformMidnightReset();
  const force = req.query.force === 'true';
  if (force) {
    await fetch100hpHistory();
  }
  res.json({
    status: 'ok',
    uptimeSeconds: Math.floor(process.uptime()),
    currentDay: spikesStorage.currentDay,
    harvestedToday: spikesStorage.todaySpikes.length,
    cachedRoundsCount: cachedRounds.length,
    lastFetchTime,
    lastFetchLatency,
    telegramBot: telegramBotInfo ? `@${telegramBotInfo.username}` : 'connecting',
  });
});

// 4d. Calculate Faille signal
app.get('/api/faille', (req, res) => {
  const time = (req.query.time as string) || undefined;
  const result = calculateFaille(time);
  res.json({ success: true, result });
});

app.post('/api/faille', (req, res) => {
  const time = req.body?.time || undefined;
  const result = calculateFaille(time);
  res.json({ success: true, result });
});

app.post('/api/faille/broadcast', async (req, res) => {
  const time = req.body?.time || undefined;
  const result = calculateFaille(time);
  let telegramSent = false;
  if (config.telegramChannelId) {
    await sendTelegramMessage(config.telegramChannelId, result.formattedMessage);
    telegramSent = true;
  }
  res.json({ success: true, result, telegramSent });
});

// 5. Config get & update
app.get('/api/config', (req, res) => {
  res.json({
    success: true,
    config: {
      ...config,
      // Mask session id preview for clean UI
      sessionIdDisplay: config.sessionId.slice(0, 16) + '...',
    },
  });
});

app.post('/api/config', (req, res) => {
  const updates = req.body;
  if (updates.customerId !== undefined) config.customerId = updates.customerId;
  if (updates.sessionId !== undefined) config.sessionId = updates.sessionId;
  if (updates.cookie !== undefined) config.cookie = updates.cookie;
  if (updates.promoCode !== undefined) config.promoCode = updates.promoCode;
  if (updates.affiliateLink !== undefined) config.affiliateLink = updates.affiliateLink;
  if (updates.telegramChannelId !== undefined) config.telegramChannelId = updates.telegramChannelId;
  if (updates.autoBroadcast !== undefined) config.autoBroadcast = Boolean(updates.autoBroadcast);
  if (updates.pollIntervalSeconds !== undefined) config.pollIntervalSeconds = Number(updates.pollIntervalSeconds);

  res.json({ success: true, config });
});

// 6. Telegram Bot Status & Send
app.get('/api/telegram/status', (req, res) => {
  res.json({
    success: true,
    bot: telegramBotInfo,
    pollingActive: telegramPollingActive,
    totalMessagesHandled: telegramTotalMessagesHandled,
    lastUpdateId: telegramLastUpdateId,
    tokenConfigured: Boolean(config.telegramToken),
  });
});

app.post('/api/telegram/broadcast', async (req, res) => {
  const { chatId, messageType, customText } = req.body;
  const targetChat = chatId || config.telegramChannelId;

  if (!targetChat) {
    return res.status(400).json({
      success: false,
      error: "Veuillez spécifier l'identifiant du canal ou du groupe Telegram (ex: @MonCanal ou -100xxxx)",
    });
  }

  let textToSend = customText;
  if (!textToSend) {
    if (messageType === 'plus') {
      textToSend = generateSignalPlus().message;
    } else {
      textToSend = generateSingleSignal().message;
    }
  }

  const result = await sendTelegramMessage(targetChat, textToSend);
  res.json({ success: result.ok, result });
});

// 7. Manual trigger fetch from 100hp
app.post('/api/refresh', async (req, res) => {
  const result = await fetch100hpHistory();
  res.json({
    ...result,
    lastFetchStatus,
    lastFetchLatency,
    lastFetchTime,
  });
});

// ================= VITE DEV OR STATIC SERVING =================
async function setupViteServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`[SERVER] Meta Crash Engine running on http://localhost:${PORT}`);
  });
}

setupViteServer().catch((err) => {
  console.error('[SERVER] Startup error:', err);
});
