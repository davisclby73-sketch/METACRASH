import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Update imports from ./types
content = content.replace(
  "import { CrashRound, Spike50xRecord, AnalysisData, SingleSignal, SignalPlus, TelegramStatus, GatewayConfig } from './types';",
  "import { CrashRound, Spike50xRecord, AnalysisData, SingleSignal, SignalPlus, TelegramStatus, GatewayConfig, FailleCalculationResult } from './types';"
);

// 2. Add Calculator, Target, Brain icons from lucide-react if needed
if (!content.includes('Calculator,')) {
  content = content.replace(
    "  Sparkles,\n} from 'lucide-react';",
    "  Sparkles,\n  Calculator,\n  Target,\n  CheckCircle,\n} from 'lucide-react';"
  );
}

// 3. Update activeTab type and add faille state
const tabTarget = "const [activeTab, setActiveTab] = useState<'single' | 'plus'>('single');";
const tabReplacement = `const [activeTab, setActiveTab] = useState<'single' | 'plus' | 'faille'>('faille');
  const [failleTime, setFailleTime] = useState(() => {
    const d = new Date();
    const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
    return \`\${pad(d.getHours())}h\${pad(d.getMinutes())}\`;
  });
  const [failleResult, setFailleResult] = useState<FailleCalculationResult | null>(null);
  const [failleLoading, setFailleLoading] = useState(false);
  const [failleError, setFailleError] = useState<string | null>(null);`;

content = content.replace(tabTarget, tabReplacement);

// 4. Add loadFaille and handleBroadcastFaille functions
const fetchTarget = "  const loadData = useCallback(async (manual = false) => {";
const failleFetchFunctions = `  const loadFaille = useCallback(async (timeToCalc?: string) => {
    setFailleLoading(true);
    setFailleError(null);
    try {
      const q = timeToCalc || failleTime;
      const res = await fetch(\`/api/faille?time=\${encodeURIComponent(q)}\`);
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
  };\n\n` + fetchTarget;

content = content.replace(fetchTarget, failleFetchFunctions);

// 5. In useEffect, also load Faille on initial render
content = content.replace(
  "    loadData();\n  }, [loadData]);",
  "    loadData();\n    loadFaille();\n  }, [loadData, loadFaille]);"
);

// 6. Update Tabs switcher to include 🎯 SIGNAL FAILLE
const tabSwitcherTarget = `<div className="flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800">
              <button
                onClick={() => setActiveTab('single')}`;

const tabSwitcherReplacement = `<div className="flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800 gap-1">
              <button
                onClick={() => {
                  setActiveTab('faille');
                  if (!failleResult) loadFaille();
                }}
                className={\`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all \${
                  activeTab === 'faille'
                    ? 'bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 text-slate-950 shadow-md shadow-emerald-500/30'
                    : 'text-slate-400 hover:text-white'
                }\`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>🎯 SIGNAL FAILLE</span>
              </button>
              <button
                onClick={() => setActiveTab('single')}`;

content = content.replace(tabSwitcherTarget, tabSwitcherReplacement);

// 7. Update Copy button in preview to handle 'faille'
content = content.replace(
  `handleCopy(
                        activeTab === 'single'
                          ? singleSignal?.message || ''
                          : signalPlus?.message || '',
                        activeTab
                      )`,
  `handleCopy(
                        activeTab === 'faille'
                          ? failleResult?.formattedMessage || ''
                          : activeTab === 'single'
                          ? singleSignal?.message || ''
                          : signalPlus?.message || '',
                        activeTab
                      )`
);

// 8. Update preview text container
const previewTarget = `{activeTab === 'single' ? (
                  singleSignal?.message || (
                    <div className="text-slate-500 py-6 text-center">Génération du signal instantané...</div>
                  )
                ) : (
                  signalPlus?.message || (
                    <div className="text-slate-500 py-6 text-center">Génération des plages Signal +...</div>
                  )
                )}`;

const previewReplacement = `{activeTab === 'faille' ? (
                  failleResult?.formattedMessage || (
                    <div className="text-slate-500 py-6 text-center">Calcul du signal Faille en cours...</div>
                  )
                ) : activeTab === 'single' ? (
                  singleSignal?.message || (
                    <div className="text-slate-500 py-6 text-center">Génération du signal instantané...</div>
                  )
                ) : (
                  signalPlus?.message || (
                    <div className="text-slate-500 py-6 text-center">Génération des plages Signal +...</div>
                  )
                )}`;

content = content.replace(previewTarget, previewReplacement);

// 9. Update broadcast button to support Faille
content = content.replace(
  `onClick={() => handleBroadcast(activeTab)}
                  disabled={isBroadcasting || (activeTab === 'single' ? !singleSignal : !signalPlus)}`,
  `onClick={() => (activeTab === 'faille' ? handleBroadcastFaille() : handleBroadcast(activeTab as 'single' | 'plus'))}
                  disabled={isBroadcasting || (activeTab === 'faille' ? !failleResult : activeTab === 'single' ? !singleSignal : !signalPlus)}`
);

// 10. Add the Faille Control Bar right under the tab bar when activeTab === 'faille'
const leadSelectorTarget = `{/* Lead Time & Preparation Selector Bar */}`;
const failleControlBar = `{/* Interactive Faille Input Bar when activeTab === 'faille' */}
          {activeTab === 'faille' && (
            <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-950 to-cyan-950/40 border border-emerald-500/30 flex flex-col md:flex-row items-center justify-between gap-4 text-xs shadow-lg">
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-white font-bold text-sm flex items-center gap-2">
                    <span>Heure d'entrée dans le jeu</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                      Algorithme de la Faille
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs">
                    Entrez votre heure (ex: 16h43, 12h34) pour sélectionner les 3 tours les plus proches de l'historique
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
                    const nowStr = \`\${pad(d.getHours())}h\${pad(d.getMinutes())}\`;
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

          {/* Lead Time & Preparation Selector Bar */}`;

content = content.replace(leadSelectorTarget, failleControlBar);

// 11. Add Faille Mathematical Audit card in Right Column when activeTab === 'faille'
const rightColTarget = `{/* Right Column: Algorithmic Breakdown & Risk Metrics */}`;
const failleRightCol = `{/* Faille Right Column: Full Mathematical Step-by-Step Breakdown */}
            {activeTab === 'faille' && failleResult && (
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-slate-950/80 border border-emerald-500/30 rounded-2xl p-5 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                    <div className="flex items-center gap-2">
                      <Calculator className="w-4 h-4 text-emerald-400" />
                      <h3 className="font-bold text-sm text-white">DÉTAIL MATHÉMATIQUE DE LA FAILLE</h3>
                    </div>
                    <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      100% Historique Réel
                    </span>
                  </div>

                  {/* Step 1: The 3 Closest Hours */}
                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                    <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
                      <span>1. Les 3 heures les plus proches :</span>
                      <span className="text-amber-400 font-mono text-[11px]">Réf: {failleResult.refTime}</span>
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

                  {/* Step 2: Minutes Addition & Rule */}
                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5 text-xs">
                    <div className="font-bold text-slate-300 flex items-center justify-between">
                      <span>2. Somme des minutes :</span>
                      <span className="text-emerald-300 font-mono font-bold">
                        {failleResult.spikesUsed.map((s) => s.minute).join(' + ')} = {failleResult.minuteSum}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Règle appliquée :{' '}
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

                  {/* Step 3: Key Hours */}
                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2 text-xs">
                    <div className="font-bold text-slate-300 flex items-center justify-between">
                      <span>3. Les 5 Heures Clés Futures :</span>
                      <span className="text-amber-400 font-mono">Heure suivante {failleResult.nextHour}</span>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5 font-mono text-center">
                      {failleResult.keyHours.map((h, idx) => (
                        <div key={idx} className="bg-slate-950 p-1.5 rounded border border-amber-500/30 text-amber-300 font-bold text-xs">
                          {h}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Step 4: Coefficients & Divisions */}
                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2 text-xs">
                    <div className="font-bold text-slate-300 flex items-center justify-between">
                      <span>4. Somme & Divisions Coefficients :</span>
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
              </div>
            )}

            {/* Right Column: Algorithmic Breakdown & Risk Metrics */}`;

content = content.replace(rightColTarget, failleRightCol);

// Only show the single/plus right column when activeTab is not 'faille'
content = content.replace(
  `<div className="lg:col-span-5 space-y-4">`,
  `{activeTab !== 'faille' && (<div className="lg:col-span-5 space-y-4">`
);
content = content.replace(
  `{/* End Right Column */}\n            </div>`,
  `{/* End Right Column */}\n            </div>)}`
);

fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('Successfully updated src/App.tsx with Faille calculator!');
