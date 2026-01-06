import { useState, useEffect } from 'react';
import { SwarmVisualizer } from './components/SwarmVisualizer';
import * as api from './api';
import {
    BarChart3,
    Library,
    Settings,
    Zap,
    Search,
    CreditCard,
    Edit,
    X,
    ChevronRight,
    Target,
    FlaskConical,
    MessageSquareHeart
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { marked } from 'marked';

export default function App() {
    const [activeTab, setActiveTab] = useState<'keywords' | 'content' | 'logs'>('keywords');
    const [keywords, setKeywords] = useState<any[]>([]);
    const [content, setContent] = useState<any[]>([]);
    const [stats, setStats] = useState<any>({ totalKeywords: 0, publishedKeywords: 0, avgQualityScore: 0 });
    const [seedTopic, setSeedTopic] = useState('');
    const [trackingId, setTrackingId] = useState<number | null>(null);
    const [progress, setProgress] = useState({ percent: 0, step: 'Idle' });
    const [selectedArticle, setSelectedArticle] = useState<any>(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editBuffer, setEditBuffer] = useState<any>({});

    useEffect(() => {
        refreshAll();
        const interval = setInterval(refreshAll, 60000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        let poll: any;
        if (trackingId) {
            poll = setInterval(async () => {
                try {
                    const data = await api.fetchLogs(trackingId);
                    if (data.logs.length > 0) {
                        const last = data.logs[data.logs.length - 1];
                        setProgress({ percent: last.percent, step: last.step });
                        if (last.percent === 100 || last.percent < 0) {
                            setTrackingId(null);
                            refreshAll();
                        }
                    }
                } catch (e) { }
            }, 2000);
        }
        return () => clearInterval(poll);
    }, [trackingId]);

    const refreshAll = async () => {
        try {
            const [kw, ct, st] = await Promise.all([
                api.fetchKeywords(),
                api.fetchContent(),
                api.fetchStats()
            ]);
            setKeywords(kw.keywords);
            setContent(ct.records);
            setStats(st);

            const generating = kw.keywords.find((k: any) => k.status === 'generating');
            if (generating) setTrackingId(generating.id);
        } catch (e) { }
    };

    const handleLaunchResearch = async () => {
        if (!seedTopic) return;
        await api.seedTopic(seedTopic);
        setSeedTopic('');
        refreshAll();
    };

    const handleDeploySingle = async (id: number) => {
        await api.startGeneration(id);
        setTrackingId(id);
        refreshAll();
    };

    const handleSaveArticle = async () => {
        await api.updateContent(selectedArticle.id, editBuffer);
        setSelectedArticle({ ...selectedArticle, ...editBuffer });
        setIsEditMode(false);
        refreshAll();
    };

    return (
        <div className="max-container">
            {/* Header */}
            <header className="mb-6 flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="bg-brand text-white w-10 h-10 flex items-center justify-center rounded-xl font-black text-xl shadow-lg shadow-orange-500/20">Z</div>
                    <h1 className="text-xl font-black tracking-tighter text-slate-900 uppercase italic">Zappy <span className="text-brand">Engine</span></h1>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={() => api.startBatch().then(refreshAll)}
                        className="bg-brand text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-brand-dark transition-all shadow-xl shadow-orange-500/10 active:scale-95"
                    >
                        Deploy Batch
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                {/* Sidebar / Controls */}
                <aside className="space-y-6">
                    <div className="factory-card p-6">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Neural Entry Point</h3>
                        <div className="relative">
                            <input
                                value={seedTopic}
                                onChange={(e) => setSeedTopic(e.target.value)}
                                placeholder="Topic: e.g. Longevity Diet"
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-4 text-xs focus:ring-2 focus:ring-brand/10 focus:border-brand outline-none mb-3 transition-all"
                            />
                            <button
                                onClick={handleLaunchResearch}
                                className="w-full bg-slate-900 text-white font-black py-4 text-[10px] uppercase tracking-widest rounded-xl hover:bg-black transition-all shadow-xl shadow-slate-900/10 active:scale-95"
                            >
                                Launch Multi-Agent Research
                            </button>
                        </div>
                        <div className="mt-6 pt-6 border-t border-slate-50 flex flex-wrap gap-2">
                            <span className="agent-chip">Clinical</span>
                            <span className="agent-chip">SEO</span>
                            <span className="agent-chip">Editor</span>
                        </div>
                    </div>

                    <div className="factory-card p-6 bg-slate-900 text-white border-none relative overflow-hidden">
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <div className="text-3xl font-black text-white leading-none">{stats.totalKeywords}</div>
                                <div className="text-[9px] text-slate-400 font-black uppercase mt-2">Active Topics</div>
                            </div>
                            <div>
                                <div className="text-3xl font-black text-brand leading-none">{stats.publishedKeywords}</div>
                                <div className="text-[9px] text-slate-400 font-black uppercase mt-2">Published</div>
                            </div>
                            <div className="col-span-2 pt-2">
                                <div className="text-[9px] text-slate-400 font-black uppercase mb-2">Avg Quality Score</div>
                                <div className="text-xl font-black text-white">{stats.avgQualityScore > 0 ? `${stats.avgQualityScore}/10` : '--'}</div>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Main Content Area */}
                <main className="xl:col-span-3 space-y-6">
                    {/* Progress Card */}
                    <AnimatePresence>
                        {trackingId && (
                            <motion.div
                                initial={{ opacity: 0, y: -20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="factory-card p-6 border-brand/20 bg-brand/[0.02]"
                            >
                                <div className="flex justify-between items-center gap-8">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="bg-brand text-white text-[9px] px-2 py-0.5 rounded-full font-black uppercase animate-pulse">Neural Circuit Active</span>
                                            <h3 className="text-sm font-black text-slate-900 italic uppercase">Current Phase: {progress.step}</h3>
                                        </div>
                                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${progress.percent}%` }}
                                                className="h-full bg-brand rounded-full shadow-[0_0_12px_rgba(249,115,22,0.4)]"
                                            />
                                        </div>
                                    </div>
                                    <div className="text-5xl font-black text-brand italic">{progress.percent}%</div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Navigation Tabs */}
                    <div className="flex items-center gap-8 border-b border-slate-200 px-2">
                        {[
                            { id: 'keywords', label: 'Strategy Queue', icon: Target },
                            { id: 'content', label: 'Production Library', icon: Library },
                            { id: 'logs', label: 'Agent Reasoning', icon: FlaskConical }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`pb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id
                                        ? 'border-b-2 border-brand text-slate-900'
                                        : 'text-slate-400 hover:text-slate-600'
                                    }`}
                            >
                                <tab.icon size={14} className={activeTab === tab.id ? 'text-brand' : ''} />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <section>
                        {activeTab === 'keywords' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {keywords.length > 0 ? keywords.map(kw => (
                                    <div key={kw.id} className="factory-card p-5 group flex justify-between items-center transition-all hover:translate-x-1">
                                        <div className="overflow-hidden">
                                            <h4 className="font-bold text-slate-900 text-sm truncate">{kw.keyword}</h4>
                                            <div className="flex gap-2 mt-1">
                                                <span className="text-[9px] font-black text-slate-400 uppercase opacity-60">Priority: {kw.priority}</span>
                                                <span className="text-[9px] font-black text-slate-400 uppercase opacity-60">{kw.intent}</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className={`text-[9px] font-black uppercase mb-2 ${kw.status === 'generating' ? 'text-brand animate-pulse' :
                                                    kw.status === 'published' ? 'text-emerald-500' : 'text-slate-300'
                                                }`}>
                                                {kw.status}
                                            </div>
                                            {kw.status === 'queued' && (
                                                <button
                                                    onClick={() => handleDeploySingle(kw.id)}
                                                    className="bg-brand text-white text-[9px] font-black px-4 py-2 rounded-lg hover:bg-brand-dark transition-all uppercase tracking-widest shadow-lg shadow-orange-500/10"
                                                >
                                                    Deploy
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )) : (
                                    <div className="col-span-2 p-12 text-center text-slate-400 font-medium italic text-xs bg-white rounded-2xl border border-dashed border-slate-200">
                                        Strategy queue is empty. Initialize via focus topics.
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'content' && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {content.length > 0 ? content.map(item => (
                                    <div
                                        key={item.id}
                                        onClick={() => {
                                            setSelectedArticle(item);
                                            setEditBuffer(item);
                                        }}
                                        className="factory-card p-6 group cursor-pointer hover:border-brand/40"
                                    >
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex gap-2">
                                                <div className="text-[8px] font-black text-brand uppercase border border-brand/20 px-2 py-0.5 rounded-full">Score: {item.quality_score}</div>
                                                <div className="text-[8px] font-black text-slate-400 uppercase border border-slate-100 px-2 py-0.5 rounded-full">{(item.total_tokens || 0).toLocaleString()} tkn</div>
                                            </div>
                                            <div className="text-[8px] font-black text-slate-400">{new Date(item.created_at).toLocaleDateString()}</div>
                                        </div>
                                        <h5 className="font-black text-slate-900 text-xs leading-tight mb-3 line-clamp-2 group-hover:text-brand transition-colors">{item.title}</h5>
                                        <p className="text-[10px] text-slate-500 line-clamp-3 mb-6 leading-relaxed italic">{item.meta_description}</p>
                                        <div className="pt-4 border-t border-slate-50 flex justify-between items-center group-hover:translate-x-1 transition-transform">
                                            <span className="text-[9px] font-bold text-slate-300">/{item.slug}</span>
                                            <ChevronRight size={14} className="text-brand" />
                                        </div>
                                    </div>
                                )) : (
                                    <div className="col-span-3 p-20 text-center text-slate-400 italic text-xs">
                                        Production library is ready for deployment.
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'logs' && <SwarmVisualizer />}
                    </section>
                </main>
            </div>

            {/* Article Detail Modal */}
            <AnimatePresence>
                {selectedArticle && (
                    <div className="fixed inset-0 z-50 flex items-center justify-end overflow-hidden">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
                            onClick={() => setSelectedArticle(null)}
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="relative w-full max-w-4xl h-full bg-white shadow-2xl flex flex-col"
                        >
                            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white z-10">
                                <div className="flex items-center gap-4">
                                    <div className="bg-brand text-white w-8 h-8 flex items-center justify-center rounded-lg font-black italic shadow-lg shadow-orange-500/20">Z</div>
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Article Insight Preview</div>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setIsEditMode(!isEditMode)}
                                        className="flex items-center gap-2 px-5 py-2.5 border border-brand/20 text-brand text-[10px] font-black uppercase rounded-xl hover:bg-brand-light transition-all"
                                    >
                                        <Edit size={14} />
                                        {isEditMode ? 'View Insight' : 'Edit Insight'}
                                    </button>
                                    <button
                                        onClick={() => setSelectedArticle(null)}
                                        className="p-2.5 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-xl transition-all"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-12 lg:p-20">
                                <div className="max-w-2xl mx-auto">
                                    {!isEditMode ? (
                                        <div className="blog-content">
                                            <div className="text-[9px] font-black text-brand bg-brand-light px-3 py-1 rounded-full inline-block mb-10 uppercase tracking-widest">Medical Intelligence Report // {(selectedArticle.total_tokens || 0).toLocaleString()} Tokens</div>
                                            <h1 className="mb-6">{selectedArticle.title}</h1>
                                            <div className="mb-12 italic text-slate-400 text-lg border-l-8 border-brand pl-8 py-4 bg-brand/[0.03] rounded-r-3xl leading-relaxed">
                                                {selectedArticle.meta_description}
                                            </div>
                                            <div className="prose-container" dangerouslySetInnerHTML={{ __html: marked.parse(selectedArticle.body) }} />
                                        </div>
                                    ) : (
                                        <div className="space-y-10">
                                            <div>
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 block">Refined Title</label>
                                                <textarea
                                                    value={editBuffer.title}
                                                    onChange={(e) => setEditBuffer({ ...editBuffer, title: e.target.value })}
                                                    className="w-full text-4xl font-black text-slate-900 border-none focus:ring-0 outline-none p-0 resize-none leading-tight"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 block">Medical Abstract</label>
                                                <textarea
                                                    value={editBuffer.meta_description}
                                                    onChange={(e) => setEditBuffer({ ...editBuffer, meta_description: e.target.value })}
                                                    className="w-full italic text-slate-500 text-lg border-l-4 border-brand pl-6 py-2 bg-slate-50/50 rounded-r-xl outline-none resize-none min-h-[100px]"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 block">Insight Body (Markdown)</label>
                                                <textarea
                                                    value={editBuffer.body}
                                                    onChange={(e) => setEditBuffer({ ...editBuffer, body: e.target.value })}
                                                    className="w-full h-[600px] text-slate-700 font-mono text-sm border border-slate-100 rounded-2xl p-8 focus:border-brand/40 outline-none shadow-inner bg-slate-50/20"
                                                />
                                            </div>
                                            <div className="flex justify-end pt-10">
                                                <button
                                                    onClick={handleSaveArticle}
                                                    className="bg-brand text-white px-10 py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-orange-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                                                >
                                                    Commit Insight Changes
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
