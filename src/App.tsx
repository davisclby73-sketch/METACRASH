import React, { useState, useEffect, useCallback } from 'react';
import {
  Zap,
  Clock,
  Send,
  Copy,
  Check,
  RefreshCw,
  Activity,
  ShieldCheck,
  TrendingUp,
  Settings,
  Flame,
  Radio,
  ExternalLink,
  ChevronRight,
  Database,
  BarChart3,
  Hash,
  AlertCircle,
  Sliders,
  CheckCircle2,
  Terminal,
  Hourglass,
  Timer,
  Trophy,
  Calendar,
  ArrowUpDown,
  Sparkles,
  Calculator,
  Target,
} from 'lucide-react';
import { CrashRound, Spike50xRecord, AnalysisData, SingleSignal, SignalPlus, TelegramStatus, GatewayConfig, FailleCalculationResult } from './types';

export default function App() {
  const [rounds, setRounds] = useState<CrashRound[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [singleSignal, setSingleSignal] = useState<SingleSignal | null>(null);
  const [signalPlus, setSignalPlus] = useState<SignalPlus | null>(null);
  const [telegramStatus, setTelegramStatus] = useState<TelegramStatus | null>(null);
  const [config, setConfig] = useState<GatewayConfig | null>(null);

  // 50x+ Spikes system state
  const [spikes50x, setSpikes50x] = useState<Spike50xRecord[]>([]);
  const [spikesSort, setSpikesSort] = useState<'multiplier' | 'time'>('multiplier');
  const [spikesFilter, setSpikesFilter] = useState<'today' | 'all'>('today');
  const [totalSpikesToday, setTotalSpikesToday] = useState(0);
  const [maxSpikeToday, setMaxSpikeToday] = useState(0);
  const [expandedSpikeId, setExpandedSpikeId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'single' | 'plus' | 'faille'>('faille');
  const [failleTime, setFailleTime] = useState(() => {
    const d = new Date();
    const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
    return pad(d.getHours()) + 'h' + pad(d.getMinutes());
  });
  const [failleResult, setFailleResult] = useState<FailleCalculationResult | null>(null);
  const [failleLoading, setFailleLoading] = useState(false);
  const [failleError, setFailleError] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<number | 'auto'>('auto');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [broadcastFeedback, setBroadcastFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [expandedRoundId, setExpandedRoundId] = useState<string | null>(null);

  // Form states for config
  const [editCustomerId, setEditCustomerId] = useState('');
  const [editSessionId, setEditSessionId] = useState('');
  const [editCookie, setEditCookie] = useState('');
  const [editPromoCode, setEditPromoCode] = useState('DAVE67');
  const [editAffiliateLink, setEditAffiliateLink] = useState('https://1wrrzr.com/?p=mm2g');
  const [editChannelId, setEditChannelId] = useState('');
  const [editAutoBroadcast, setEditAutoBroadcast] = useState(false);

  // Real-time clock
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch 50x+ spikes
  const loadSpikes = useCallback(async (sort = spikesSort, filter = spikesFilter) => {
    try {
      const res = await fetch(`/api/spikes-50x?sort=${sort}&filter=${filter}`).then((r) => r.json());
      if (res.success && Array.isArray(res.spikes)) {
        setSpikes50x(res.spikes);
        setTotalSpikesToday(res.totalToday || res.spikes.length);
        setMaxSpikeToday(res.maxToday || 0);
      }
    } catch (e) {
      console.error('Error fetching 50x spikes', e);
    }
  }, [spikesSort, spikesFilter]);

  const loadFaille = useCallback(async (timeToCalc?: string) => {
    setFailleLoading(true);
    setFailleError(null);
    try {
      const q = timeToCalc || failleTime;
      const res = await fetch(`/api/faille?time=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.success) {
        setFailleResult(data.result);
      } else {
        setFailleError(data.error || 'Erreur lors du calcul de la faille');
      }
    } catch (err: any) {
      setFailleError(err.message || 'Erreur réseau');
    } finally {
      setFailleLoading(false);
    }
  }, [failleTime]);

  const handleBroadcastFaille = async () => {
    if (!failleResult) return;
    setIsBroadcasting(true);
    setBroadcastFeedback(null);
    try {
      const res = await fetch('/api/faille/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time: failleTime }),
      });
      const data = await res.json();
      if (data.success) {
        setBroadcastFeedback({
          type: 'success',
          text: 'Signal Faille envoyé avec succès à Telegram !',
        });
      } else {
        setBroadcastFeedback({
          type: 'error',
          text: data.error || "Erreur lors de l'envoi vers Telegram",
        });
      }
    } catch (err: any) {
      setBroadcastFeedback({
        type: 'error',
        text: err.message || "Erreur réseau lors de l'envoi",
      });
    } finally {
      setIsBroadcasting(false);
      setTimeout(() => setBroadcastFeedback(null), 4000);
    }
  };

  // Fetch signals with current lead time preference
  const loadSignals = useCallback(async (leadPref: number | 'auto') => {
    const leadQuery = leadPref !== 'auto' ? `?lead=${leadPref}` : '';
    try {
      const [singleRes, plusRes] = await Promise.all([
        fetch(`/api/signals/single${leadQuery}`).then((r) => r.json()),
        fetch(`/api/signals/plus${leadQuery}`).then((r) => r.json()),
      ]);
      if (singleRes.success) setSingleSignal(singleRes.signal);
      if (plusRes.success) setSignalPlus(plusRes.signal);
    } catch (e) {
      console.error('Error fetching signals', e);
    }
  }, []);

  // Fetch all initial data
  const loadData = useCallback(
    async (forceRefresh = false) => {
      setIsRefreshing(true);
      try {
        const leadQuery = selectedLead !== 'auto' ? `?lead=${selectedLead}` : '';
        const [historyRes, statsRes, singleRes, plusRes, teleRes, configRes, spikesRes] = await Promise.all([
          fetch(`/api/history${forceRefresh ? '?force=true' : ''}`).then((r) => r.json()),
          fetch('/api/stats').then((r) => r.json()),
          fetch(`/api/signals/single${leadQuery}`).then((r) => r.json()),
          fetch(`/api/signals/plus${leadQuery}`).then((r) => r.json()),
          fetch('/api/telegram/status').then((r) => r.json()),
          fetch('/api/config').then((r) => r.json()),
          fetch(`/api/spikes-50x?sort=${spikesSort}&filter=${spikesFilter}`).then((r) => r.json()),
        ]);

        if (historyRes.success && Array.isArray(historyRes.rounds)) {
          setRounds(historyRes.rounds);
        }
        if (statsRes.success) {
          setAnalysis(statsRes.analysis);
        }
        if (singleRes.success) {
          setSingleSignal(singleRes.signal);
        }
        if (plusRes.success) {
          setSignalPlus(plusRes.signal);
        }
        if (teleRes.success) {
          setTelegramStatus(teleRes);
        }
        if (configRes.success) {
          setConfig(configRes.config);
          setEditCustomerId(configRes.config.customerId || '');
          setEditSessionId(configRes.config.sessionId || '');
          setEditCookie(configRes.config.cookie || '');
          setEditPromoCode(configRes.config.promoCode || 'DAVE67');
          setEditAffiliateLink(configRes.config.affiliateLink || 'https://1wrrzr.com/?p=mm2g');
          setEditChannelId(configRes.config.telegramChannelId || '');
          setEditAutoBroadcast(Boolean(configRes.config.autoBroadcast));
        }
        if (spikesRes.success && Array.isArray(spikesRes.spikes)) {
          setSpikes50x(spikesRes.spikes);
          setTotalSpikesToday(spikesRes.totalToday || spikesRes.spikes.length);
          setMaxSpikeToday(spikesRes.maxToday || 0);
        }
      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        setIsRefreshing(false);
      }
    },
    [selectedLead, spikesSort, spikesFilter]
  );

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      loadData(false);
    }, 6000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Handle lead preference change
  const handleLeadChange = (val: number | 'auto') => {
    setSelectedLead(val);
    loadSignals(val);
  };

  // Copy to clipboard
  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(type);
    setTimeout(() => setCopyFeedback(null), 2500);
  };

  // Broadcast to Telegram
  const handleBroadcast = async (type: 'single' | 'plus') => {
    setIsBroadcasting(true);
    setBroadcastFeedback(null);
    try {
      const res = await fetch('/api/telegram/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageType: type,
          chatId: editChannelId || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setBroadcastFeedback({
          type: 'success',
          text: `Signal envoyé avec succès à Telegram (${editChannelId || 'Canal par défaut'}) !`,
        });
      } else {
        setBroadcastFeedback({
          type: 'error',
          text: data.error || "Erreur lors de l'envoi vers Telegram. Vérifiez l'identifiant du canal.",
        });
      }
    } catch (err: any) {
      setBroadcastFeedback({
        type: 'error',
        text: err.message || "Erreur réseau lors de l'envoi",
      });
    } finally {
      setIsBroadcasting(false);
      setTimeout(() => setBroadcastFeedback(null), 4000);
    }
  };

  // Save config
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: editCustomerId,
          sessionId: editSessionId,
          cookie: editCookie,
          promoCode: editPromoCode,
          affiliateLink: editAffiliateLink,
          telegramChannelId: editChannelId,
          autoBroadcast: editAutoBroadcast,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowConfigModal(false);
        loadData(true);
      }
    } catch (err) {
      console.error('Error saving config', err);
    }
  };

  // Helper formatting
  const formatTime = (d: Date) => {
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // Calculate live countdown until signal begins
  const getCountdownString = () => {
    if (!singleSignal?.data.startTargetTime) return null;
    const targetMs = new Date(singleSignal.data.startTargetTime).getTime();
    const currentMs = currentTime.getTime();
    const diff = targetMs - currentMs;

    if (diff > 0) {
      const totalSec = Math.floor(diff / 1000);
      const min = Math.floor(totalSec / 60);
      const sec = totalSec % 60;
      return `${min < 10 ? '0' + min : min}m ${sec < 10 ? '0' + sec : sec}s`;
    } else if (diff >= -60000) {
      return 'EN COURS (Placez votre mise !)';
    } else {
      return 'Terminé (Prochain calcul disponible)';
    }
  };

  // Multiplier badge color
  const getMultiplierStyle = (val: number) => {
    if (val < 2.0) {
      return 'bg-blue-950/70 text-blue-400 border border-blue-800/60';
    }
    if (val < 10.0) {
      return 'bg-emerald-950/70 text-emerald-400 border border-emerald-700/60 font-semibold shadow-sm shadow-emerald-900/30';
    }
    return 'bg-gradient-to-r from-purple-900/90 to-pink-900/90 text-pink-200 border border-pink-500/80 font-bold shadow-md shadow-pink-900/40 animate-pulse';
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Navigation & Status Bar */}
      <header className="border-b border-slate-800/80 bg-[#0b0e17]/95 backdrop-blur-md sticky top-0 z-40 px-4 lg:px-8 py-3.5 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 text-slate-950 font-black">
                <Zap className="w-6 h-6 fill-current" />
              </div>
              <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-amber-300">
                  META CRASH PRO
                </h1>
                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  v3.0 JACKPOT HARVEST
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Moteur Prédictif & Collecteur de Cotes ≥ 50x connecté à l'API 100hp
              </p>
            </div>
          </div>

          {/* Quick status pills */}
          <div className="flex items-center flex-wrap gap-2 text-xs">
            {/* 100hp API Status */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-slate-400">Gateway 100hp:</span>
              <span className="font-semibold text-emerald-400">200 OK</span>
              <span className="text-slate-500 text-[10px] font-mono">/history</span>
            </div>

            {/* Telegram Bot Status */}
            <a
              href="https://t.me/davev2JETBOT"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-950/50 hover:bg-blue-900/50 border border-blue-800/60 transition-colors text-blue-300 group"
              title="Ouvrir le bot Telegram @davev2JETBOT"
            >
              <Radio className="w-3.5 h-3.5 text-blue-400 group-hover:animate-spin" />
              <span className="text-slate-300">Bot:</span>
              <span className="font-semibold text-white">@davev2JETBOT</span>
              <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100" />
            </a>

            {/* Live Clock */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 font-mono text-amber-400">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatTime(currentTime)}</span>
            </div>

            {/* Sync button */}
            <button
              onClick={() => loadData(true)}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition disabled:opacity-50"
              title="Forcer la synchronisation avec l'API 100hp"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
              <span className="hidden md:inline">Actualiser</span>
            </button>

            {/* Settings button */}
            <button
              onClick={() => setShowConfigModal(true)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
              title="Configuration API & Bot"
            >
              <Sliders className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto w-full px-4 lg:px-8 py-6 space-y-6 flex-1">
        {/* Banner Alert Feedback */}
        {broadcastFeedback && (
          <div
            className={`p-3.5 rounded-xl border flex items-center gap-3 text-sm animate-fade-in ${
              broadcastFeedback.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                : 'bg-red-950/60 border-red-500/50 text-red-300'
            }`}
          >
            {broadcastFeedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <span>{broadcastFeedback.text}</span>
          </div>
        )}

        {/* ======================================================== */}
        {/* 🏆 DEDICATED REPERTORY: TABLE OF 50X+ ODDS (MATCHING SCREENSHOT) */}
        {/* ======================================================== */}
        <section className="bg-[#0f1118] border border-amber-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
          {/* Subtle golden ambient background glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

          {/* Table Header Bar matching image_92cb52b2.png */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-800">
            {/* Left Filter Dropdown: Multiplicador */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#181a24] border border-slate-800 text-xs font-semibold text-slate-200">
                <ArrowUpDown className="w-4 h-4 text-amber-400" />
                <span className="text-slate-400">Tri :</span>
                <select
                  value={spikesSort}
                  onChange={(e) => {
                    const val = e.target.value as 'multiplier' | 'time';
                    setSpikesSort(val);
                    loadSpikes(val, spikesFilter);
                  }}
                  className="bg-transparent text-amber-300 font-bold outline-none cursor-pointer"
                >
                  <option value="multiplier" className="bg-[#181a24] text-slate-200">
                    Multiplicador (Plus grand d'abord)
                  </option>
                  <option value="time" className="bg-[#181a24] text-slate-200">
                    Heure (Plus récent d'abord)
                  </option>
                </select>
              </div>

              {/* Stats pill */}
              <div className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold">
                <Trophy className="w-3.5 h-3.5" />
                <span>{totalSpikesToday} cotes ≥ 50x</span>
              </div>
            </div>

            {/* Right Filter: Día & Midnight Reset Badge */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <div className="flex items-center gap-1 p-1 rounded-xl bg-[#181a24] border border-slate-800 text-xs">
                <button
                  onClick={() => {
                    setSpikesFilter('today');
                    loadSpikes(spikesSort, 'today');
                  }}
                  className={`px-3 py-1.5 rounded-lg font-bold transition ${
                    spikesFilter === 'today'
                      ? 'bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Día (Aujourd'hui)
                </button>
                <button
                  onClick={() => {
                    setSpikesFilter('all');
                    loadSpikes(spikesSort, 'all');
                  }}
                  className={`px-3 py-1.5 rounded-lg font-medium transition ${
                    spikesFilter === 'all'
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-sm shadow-amber-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Archive
                </button>
              </div>

              <span className="text-[10px] text-slate-500 font-mono hidden lg:inline">
                🔄 Reset auto à 00h00
              </span>
            </div>
          </div>

          {/* List Rows matching image_92cb52b2.png */}
          <div className="space-y-2">
            {spikes50x.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
                <Hourglass className="w-6 h-6 text-slate-600 animate-spin" />
                <span>En écoute du flux 100hp... Aucune cote ≥ 50x détectée aujourd'hui pour le moment.</span>
                <span className="text-[11px] text-slate-600">Le système capture automatiquement chaque nouveau tour &ge; 50x dès sa sortie.</span>
              </div>
            ) : (
              spikes50x.map((item) => (
                <div key={item.id} className="space-y-1">
                  <div
                    onClick={() => setExpandedSpikeId(expandedSpikeId === item.id ? null : item.id)}
                    className="group bg-[#161821] hover:bg-[#1c1f2b] border border-[#272b39] hover:border-amber-500/40 rounded-xl px-4 py-3 flex items-center justify-between transition-all cursor-pointer shadow-sm hover:shadow-md"
                  >
                    {/* Left: Exact Date and Time with Seconds */}
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400/80 group-hover:bg-amber-400"></span>
                      <span className="font-mono text-xs sm:text-sm text-slate-300 font-medium tracking-wide">
                        {item.dateTimeStr}
                      </span>
                    </div>

                    {/* Right: Golden Pill Badge exactly as in screenshot */}
                    <div className="flex items-center gap-3">
                      <div className="bg-gradient-to-r from-[#ffe072] via-[#ffd043] to-[#e5a812] text-slate-950 font-black text-xs sm:text-sm px-4 py-1.5 rounded-full shadow-md shadow-amber-500/30 font-mono tracking-tight flex items-center gap-1 group-hover:scale-105 transition-transform">
                        <span>{item.formattedMultiplier}</span>
                      </div>
                    </div>
                  </div>

                  {/* Expanded cryptographic proof */}
                  {expandedSpikeId === item.id && (
                    <div className="p-3 bg-black/60 border border-slate-800 rounded-xl text-[11px] font-mono text-slate-400 space-y-1 animate-fade-in mx-2">
                      <div className="flex justify-between text-amber-400 font-semibold">
                        <span>Preuve Cryptographique 100hp</span>
                        <span>ID: {item.id}</span>
                      </div>
                      <div className="truncate">Hash SHA-256: <span className="text-slate-300">{item.hash || 'N/A'}</span></div>
                      <div className="truncate">Salt: <span className="text-slate-300">{item.salt || 'N/A'}</span></div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer note */}
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
            <div className="flex items-center gap-1.5 text-amber-400/90 font-medium text-[11px]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Collecte permanente en direct sans doublon • Réinitialisation quotidienne à 00h00</span>
            </div>
            <div className="text-[11px] font-mono">
              Plus gros multiplicateur du jour :{' '}
              <span className="text-amber-300 font-bold">{maxSpikeToday ? `${maxSpikeToday.toFixed(2)}x` : 'N/A'}</span>
            </div>
          </div>
        </section>

        {/* Real-time Ticker of the Crash Multipliers from Real 100hp API */}
        <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                Flux Historique 100hp Crash (Tous les Tours)
              </h2>
              <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                {rounds.length} tours chargés
              </span>
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-500/80"></span> &lt; 2.0x
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/80"></span> 2x - 10x
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-pink-500/80"></span> &ge; 10.0x
              </span>
            </div>
          </div>

          {/* Multiplier tape */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-700">
            {rounds.slice(0, 24).map((round, idx) => (
              <button
                key={round.id || idx}
                onClick={() => setExpandedRoundId(expandedRoundId === round.id ? null : round.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs flex flex-col items-center gap-0.5 transition-all transform hover:scale-105 active:scale-95 ${getMultiplierStyle(
                  round.topCoefficient
                )}`}
              >
                <span className="font-mono text-sm tracking-tight">
                  {Number(round.topCoefficient || 1.0).toFixed(2)}x
                </span>
                <span className="text-[9px] opacity-70">
                  {idx === 0 ? 'Dernier' : `-${idx}`}
                </span>
              </button>
            ))}
          </div>

          {/* Expanded inspect card if user clicked a round */}
          {expandedRoundId && (
            <div className="mt-3 p-3 bg-slate-950/90 border border-slate-800 rounded-xl text-xs space-y-1.5 font-mono animate-fade-in">
              {(() => {
                const r = rounds.find((x) => x.id === expandedRoundId);
                if (!r) return null;
                return (
                  <>
                    <div className="flex justify-between items-center text-slate-400 border-b border-slate-800/80 pb-1">
                      <span className="text-amber-400 font-semibold flex items-center gap-1">
                        <Hash className="w-3.5 h-3.5" /> Détail Tour 100hp
                      </span>
                      <span>ID: {r.id}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-slate-300 pt-1">
                      <div>
                        <span className="text-slate-500">Cote Finale:</span>{' '}
                        <span className="font-bold text-amber-300">{r.topCoefficient}x</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Outcome:</span> {r.outcome}
                      </div>
                      <div className="col-span-1 md:col-span-2 truncate">
                        <span className="text-slate-500">Hash SHA-256:</span>{' '}
                        <span className="text-slate-400 text-[11px]">{r.hash}</span>
                      </div>
                      <div className="col-span-1 md:col-span-2 truncate">
                        <span className="text-slate-500">Salt:</span>{' '}
                        <span className="text-slate-400 text-[11px]">{r.salt}</span>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </section>

        {/* Central Signal Studio (The Core Deliverable) */}
        <section className="bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800/90 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
          {/* Decorative ambient background glows */}
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none"></div>

          {/* Section Header with Tabs */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-5 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-amber-400" />
                <h2 className="text-lg font-black text-white tracking-wide">
                  GÉNÉRATEUR DE SIGNAUX & DIFFUSION TELEGRAM
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Calcul précis selon l'historique 100hp avec temporisation intelligente (2 à 4 min)
              </p>
            </div>

            {/* Signal Tabs switcher */}
            <div className="flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800">
              <button
                onClick={() => { setActiveTab('faille'); if (!failleResult) loadFaille(); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'faille'
                    ? 'bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 text-slate-950 shadow-md shadow-emerald-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>🎯 SIGNAL FAILLE</span>
              </button>
              <button
                onClick={() => setActiveTab('single')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'single'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>⚡ SIGNAL</span>
              </button>
              <button
                onClick={() => setActiveTab('plus')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'plus'
                    ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>⏳ SIGNAL +</span>
              </button>
            </div>
          </div>

          {activeTab === 'faille' && (
            <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-950 to-cyan-950/40 border border-emerald-500/30 flex flex-col md:flex-row items-center justify-between gap-4 text-xs shadow-lg">
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-white font-bold text-sm flex items-center gap-2">
                    <span>Heure d'entrée dans le jeu</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30 font-mono">
                      MÉTHODE DE LA FAILLE
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs">
                    Sélectionne automatiquement les 3 heures de cotes les plus proches de l'historique 100hp
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                <input
                  type="text"
                  value={failleTime}
                  onChange={(e) => setFailleTime(e.target.value)}
                  placeholder="16h43"
                  className="w-28 px-3 py-2 bg-slate-900 border border-slate-700 focus:border-emerald-400 rounded-xl text-emerald-300 font-mono font-bold text-center text-sm outline-none shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
                    const nowStr = pad(d.getHours()) + 'h' + pad(d.getMinutes());
                    setFailleTime(nowStr);
                    loadFaille(nowStr);
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
                >
                  Maintenant
                </button>
                <button
                  type="button"
                  onClick={() => loadFaille(failleTime)}
                  disabled={failleLoading}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-slate-950 font-black text-xs transition-all shadow-md shadow-emerald-500/30 flex items-center gap-1.5"
                >
                  {failleLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>Calculer</span>
                </button>
              </div>
            </div>
          )}

          {/* Lead Time & Preparation Selector Bar */}
          <div className="mb-6 p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <Hourglass className="w-4 h-4 text-amber-400" />
              <span className="font-semibold">Délai avant le début du signal :</span>
              <span className="text-slate-500 text-[11px]">(Temps de préparation mise)</span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleLeadChange('auto')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  selectedLead === 'auto'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                🤖 Auto ({analysis?.recommendedLeadMinutes ?? 2} min)
              </button>
              <button
                onClick={() => handleLeadChange(2)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                  selectedLead === 2
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                2 min
              </button>
              <button
                onClick={() => handleLeadChange(3)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                  selectedLead === 3
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                3 min
              </button>
              <button
                onClick={() => handleLeadChange(4)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                  selectedLead === 4
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                4 min
              </button>
            </div>
          </div>

          {/* Signal Cards Display */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Formatted Monospace Output Box (What is sent to Telegram) */}
            <div className="lg:col-span-7 bg-[#05070c] border border-amber-500/30 rounded-2xl p-5 shadow-inner relative group">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
                <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span>FORMAT EXACT TELEGRAM BOT</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      handleCopy(
                        activeTab === 'faille' ? failleResult?.formattedMessage || '' : activeTab === 'single' ? singleSignal?.message || '' : signalPlus?.message || '',
                        activeTab
                      )
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
                  >
                    {copyFeedback === activeTab ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copié !</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copier</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Message Render Preview */}
              <div className="p-4 rounded-xl bg-[#090c14] border border-slate-800/60 font-mono text-sm sm:text-base leading-relaxed text-amber-100 whitespace-pre overflow-x-auto shadow-inner selection:bg-amber-500/40">
                {activeTab === 'faille' ? (failleResult?.formattedMessage || (<div className="text-slate-500 py-6 text-center">Calcul de la Faille en cours...</div>)) : activeTab === 'single' ? (singleSignal?.message || (<div className="text-slate-500 py-6 text-center">Génération du signal instantané...</div>)) : (signalPlus?.message || (<div className="text-slate-500 py-6 text-center">Génération des plages Signal +...</div>))}
              </div>

              {/* Countdown and preparation status */}
              {activeTab === 'single' && (
                <div className="mt-4 p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Timer className="w-4 h-4 text-amber-400" />
                    <span>Début de la fenêtre de pari :</span>
                  </div>
                  <div className="font-mono font-bold text-amber-300">
                    {getCountdownString() || 'Prêt'}
                  </div>
                </div>
              )}

              {/* Explanatory note */}
              <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    {activeTab === 'single'
                      ? `Fenêtre calculée avec +${singleSignal?.data.leadMinutes ?? 2} min d'anticipation`
                      : '7 plages horaires divisées en 2 vagues avec pause anti-crash'}
                  </span>
                </div>
                <span className="text-slate-500">
                  {activeTab === 'single' ? 'Prédiction 1 minute' : 'Cycle complet'}
                </span>
              </div>
            </div>

            {/* Right Column: Signal Execution Controls & Telegram Remote Dispatch */}
            <div className="lg:col-span-5 space-y-4">
              {/* Audit Mathématique de la Faille */}
              {activeTab === 'faille' && failleResult && (
                <div className="bg-slate-950/90 border border-emerald-500/40 rounded-2xl p-5 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                    <div className="flex items-center gap-2">
                      <Calculator className="w-4 h-4 text-emerald-400" />
                      <h3 className="font-bold text-sm text-white">AUDIT MATHÉMATIQUE DE LA FAILLE</h3>
                    </div>
                    <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      100% Historique Réel
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                    <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
                      <span>1. Les 3 heures les plus proches :</span>
                      <span className="text-amber-400 font-mono text-[11px]">Entrée : {failleResult.refTime}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center font-mono">
                      {failleResult.spikesUsed.map((s, idx) => (
                        <div key={idx} className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                          <div className="text-xs text-emerald-300 font-bold">{s.timeStr}</div>
                          <div className="text-[11px] text-amber-400 font-bold mt-0.5">{s.coefficient}x</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5 text-xs">
                    <div className="font-bold text-slate-300 flex items-center justify-between">
                      <span>2. Addition des minutes :</span>
                      <span className="text-emerald-300 font-mono font-bold">
                        {failleResult.spikesUsed.map((s) => s.minute).join(' + ')} = {failleResult.minuteSum}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Règle :{' '}
                      <span className="text-cyan-300 font-medium">
                        {failleResult.minuteDigitsCount === 3
                          ? 'Total à 3 chiffres (unités, 2 premiers chiffres, ÷3, ÷2, somme)'
                          : 'Total à 2 chiffres (somme, ÷3, ÷2, dizaines, unités)'}
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {failleResult.predictionMinutes.map((m, idx) => (
                        <span key={idx} className="px-2 py-1 rounded bg-slate-950 border border-slate-800 font-mono text-cyan-300 font-bold text-xs">
                          {m}m
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2 text-xs">
                    <div className="font-bold text-slate-300 flex items-center justify-between">
                      <span>3. Les 5 Heures Clés Futures :</span>
                      <span className="text-amber-400 font-mono">Heure suivante {failleResult.nextHour}</span>
                    </div>
                    <div className="grid grid-cols-5 gap-1 font-mono text-center">
                      {failleResult.keyHours.map((h, idx) => (
                        <div key={idx} className="bg-slate-950 p-1.5 rounded border border-amber-500/30 text-amber-300 font-bold text-xs">
                          {h}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2 text-xs">
                    <div className="font-bold text-slate-300 flex items-center justify-between">
                      <span>4. Coefficients & Divisions :</span>
                      <span className="text-amber-300 font-mono font-bold">
                        Total = {failleResult.coeffSum} ({failleResult.coeffRule})
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center font-mono">
                      <div className="p-2 rounded-lg bg-slate-950 border border-purple-500/30">
                        <div className="text-[10px] text-slate-400">COTE CIBLE</div>
                        <div className="text-base text-purple-400 font-black">{failleResult.coteCible}x</div>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-950 border border-cyan-500/30">
                        <div className="text-[10px] text-slate-400">ASSURANCE</div>
                        <div className="text-base text-cyan-400 font-black">{failleResult.assurance}x</div>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-950 border border-emerald-500/30">
                        <div className="text-[10px] text-slate-400">FIABILITÉ</div>
                        <div className="text-base text-emerald-400 font-black">{failleResult.fiabilite}x</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {/* Dispatch Action Card */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Diffuser sur Telegram
                  </h3>
                </div>

                <p className="text-xs text-slate-400 leading-normal">
                  Envoyez ce format pur directement sur votre canal Telegram ou testez-le avec le bot{' '}
                  <span className="text-blue-300 font-semibold">@davev2JETBOT</span>.
                </p>

                {/* Target Channel input */}
                <div>
                  <label className="block text-[11px] uppercase font-semibold text-slate-400 mb-1.5">
                    Canal / Groupe Cible (ou ID de Chat)
                  </label>
                  <input
                    type="text"
                    value={editChannelId}
                    onChange={(e) => setEditChannelId(e.target.value)}
                    placeholder="ex: @MonCanalCrash ou -100123456789"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none text-xs font-mono text-slate-200 placeholder-slate-600"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    * Assurez-vous que @davev2JETBOT est administrateur de votre canal.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 pt-2">
                  <button
                    onClick={() => (activeTab === 'faille' ? handleBroadcastFaille() : handleBroadcast(activeTab as 'single' | 'plus'))}
                    disabled={isBroadcasting || (activeTab === 'faille' ? !failleResult : activeTab === 'single' ? !singleSignal : !signalPlus)}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs tracking-wider uppercase transition shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Send className={`w-4 h-4 ${isBroadcasting ? 'animate-bounce' : ''}`} />
                    <span>
                      {isBroadcasting
                        ? 'Envoi en cours...'
                        : `Publier le ${activeTab === 'single' ? 'SIGNAL' : 'SIGNAL +'} sur Telegram`}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      loadData(true);
                      loadSignals(selectedLead);
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition flex items-center justify-center gap-2 border border-slate-700"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Recalculer les heures & cotes</span>
                  </button>
                </div>
              </div>

              {/* Bot Info & Interactive Keyboard Preview */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-semibold">BOT TELEGRAM ACTIF</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[10px] font-bold">
                    POLLING ACTIF
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs bg-slate-950/80 p-3 rounded-xl border border-slate-800/80">
                  <div>
                    <div className="font-bold text-white">AV2 JET</div>
                    <div className="text-blue-400 font-mono text-[11px]">@davev2JETBOT</div>
                  </div>
                  <a
                    href="https://t.me/davev2JETBOT"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1 transition"
                  >
                    <span>Lancer</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </a>
                </div>

                <div className="text-[11px] text-slate-400 space-y-1">
                  <p>
                    <span className="text-amber-400 font-semibold">Boutons interactifs configurés :</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="px-2 py-1 bg-slate-800 rounded text-slate-300 font-mono text-[10px]">
                      ⚡ SIGNAL
                    </span>
                    <span className="px-2 py-1 bg-slate-800 rounded text-slate-300 font-mono text-[10px]">
                      ⏳ SIGNAL +
                    </span>
                    <span className="px-2 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded font-mono text-[10px] font-bold">
                      🏆 COTES ≥ 50X DU JOUR
                    </span>
                    <span className="px-2 py-1 bg-slate-800 rounded text-slate-300 font-mono text-[10px]">
                      📊 STATS
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* API Configuration Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">
                  Configuration API 100hp & Paramètres Bot
                </h3>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold uppercase mb-1">
                  API Request URL
                </label>
                <input
                  type="text"
                  disabled
                  value="https://crash-gateway-grm-cr.100hp.app/history"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 font-mono cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold uppercase mb-1">
                  Customer-ID (Header)
                </label>
                <input
                  type="text"
                  value={editCustomerId}
                  onChange={(e) => setEditCustomerId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:border-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold uppercase mb-1">
                  Session-ID (Header complet)
                </label>
                <textarea
                  rows={3}
                  value={editSessionId}
                  onChange={(e) => setEditSessionId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono text-[11px] focus:border-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold uppercase mb-1">
                  Cookie (__cf_bm Cloudflare)
                </label>
                <textarea
                  rows={2}
                  value={editCookie}
                  onChange={(e) => setEditCookie(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono text-[11px] focus:border-amber-500 outline-none"
                />
                <span className="text-[10px] text-slate-500">
                  * Le serveur met à jour automatiquement ce cookie à chaque réponse Cloudflare.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-semibold uppercase mb-1">
                    Code Promo
                  </label>
                  <input
                    type="text"
                    value={editPromoCode}
                    onChange={(e) => setEditPromoCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-amber-300 font-bold font-mono focus:border-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold uppercase mb-1">
                    Lien d'Affiliation
                  </label>
                  <input
                    type="text"
                    value={editAffiliateLink}
                    onChange={(e) => setEditAffiliateLink(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:border-amber-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold uppercase mb-1">
                  Canal Telegram de Diffusion
                </label>
                <input
                  type="text"
                  value={editChannelId}
                  onChange={(e) => setEditChannelId(e.target.value)}
                  placeholder="@NomDeVotreCanal ou -100xxxx"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:border-cyan-500 outline-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="autoBroadcast"
                  checked={editAutoBroadcast}
                  onChange={(e) => setEditAutoBroadcast(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-0 bg-slate-950 border-slate-800"
                />
                <label htmlFor="autoBroadcast" className="text-slate-300 cursor-pointer">
                  Activer la diffusion automatique sur le canal lors des phases de compression
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition shadow-lg shadow-amber-500/20"
                >
                  Sauvegarder les Paramètres
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-[#080a11] py-5 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Connecté à la Passerelle 100hp Crash • Bot @davev2JETBOT</span>
          </div>
          <div>Code Promo Actif : <span className="text-amber-400 font-bold">{config?.promoCode || 'DAVE67'}</span></div>
        </div>
      </footer>
    </div>
  );
}
