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

export interface SpikesApiResponse {
  success: boolean;
  currentDay: string;
  totalToday: number;
  maxToday: number;
  spikes: Spike50xRecord[];
  archive?: { day: string; spikes: Spike50xRecord[] }[];
}

export interface AnalysisData {
  totalAnalyzed: number;
  volatilityIndex: number;
  phase: 'ACCUMULATION' | 'EXPANSION' | 'CORRECTION' | 'STABLE';
  safeOddsRecommendation: number;
  objectiveRecommendation: number;
  winRateEstimate: number;
  distribution: {
    cold: number;
    safe: number;
    high: number;
    mega: number;
  };
  streak: number;
  streakType: 'crash' | 'win' | 'none';
  recentMultipliers: number[];
  averageMultiplier: number;
  roundsSinceLastSpike: number;
  lastSpikeMultiplier: number;
  roundsSinceLastMegaSpike: number;
  recommendedLeadMinutes: number;
  rhythmState: 'COOLDOWN_PROTECTION' | 'COMPRESSION_BREAKOUT' | 'NORMAL_CYCLE';
  cooldownReason: string;
  oddsRange: string;
  safeOddsRange: string;
}

export interface SingleSignal {
  message: string;
  data: {
    timeWindow: string;
    leadMinutes: number;
    startTargetTime: string;
    endTargetTime: string;
    objective: string;
    safe: string;
    promoCode: string;
    analysis: AnalysisData;
    timestamp: string;
  };
}

export interface SignalPlus {
  message: string;
  data: {
    slots: string[];
    startLead: number;
    oddsRange: string;
    safeOddsRange: string;
    affiliateLink: string;
    promoCode: string;
    analysis: AnalysisData;
    timestamp: string;
  };
}

export interface TelegramStatus {
  success: boolean;
  bot: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username: string;
  } | null;
  pollingActive: boolean;
  totalMessagesHandled: number;
  lastUpdateId: number;
  tokenConfigured: boolean;
}

export interface GatewayConfig {
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
