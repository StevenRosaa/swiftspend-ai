"use client";

import { useState, useMemo, useEffect } from "react";
import { 
  UploadCloud, 
  DollarSign, 
  Loader2, 
  AlertCircle, 
  FileText, 
  Search, 
  Download, 
  ChevronDown, 
  ArrowUp, 
  ArrowDown,
  Github,
  Linkedin
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

// --- CONFIG ---
const CATEGORY_COLORS: Record<string, string> = {
  "Groceries": "#3b82f6", 
  "Dining": "#10b981",    
  "Transport": "#f59e0b", 
  "Utilities": "#6366f1", 
  "Entertainment": "#8b5cf6", 
  "Health": "#ec4899",    
  "Transfers": "#06b6d4", 
  "Other": "#94a3b8"     
};

const CATEGORIES = ["Groceries", "Dining", "Transport", "Utilities", "Entertainment", "Health", "Transfers", "Other"];

// Phrases for the loading animation
const LOADING_PHRASES = [
  "Uploading document...",
  "Scanning PDF text...",
  "Identifying transactions...",
  "Categorizing expenses...",
  "Calculating totals...",
  "Finalizing dashboard..."
];

// --- TYPES ---
interface Transaction {
  data: string;       
  descrizione: string;
  importo: number;    
  categoria: string;  
}

interface AnalysisResult {
  status: string;
  data: Transaction[];
}

export default function Home() {
  // --- STATE ---
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingPhrase, setLoadingPhrase] = useState(LOADING_PHRASES[0]);
  
  const [result, setResult] = useState<Transaction[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filters & Sort
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortConfig, setSortConfig] = useState<{ key: keyof Transaction; direction: 'asc' | 'desc' } | null>(null);

  // --- EFFECTS ---
  
  // This function cycles through phrases every 1000ms while loading
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      let i = 0;
      interval = setInterval(() => {
        i = (i + 1) % LOADING_PHRASES.length;
        setLoadingPhrase(LOADING_PHRASES[i]);
      }, 1000); 
    } else {
      setLoadingPhrase(LOADING_PHRASES[0]);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  // --- HANDLERS ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("http://127.0.0.1:8000/api/analyze", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Analysis failed. Please try again.");

      const data: AnalysisResult = await response.json();
      setResult(data.data);
    } catch (err) {
      setError("Could not connect to the AI backend. Is it running?");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // --- LOGIC: FILTERING & SORTING ---
  const filteredTransactions = useMemo(() => {
    if (!result) return [];
    
    return result.filter(t => {
      const matchesSearch = 
        t.descrizione.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.importo.toString().includes(searchTerm);
      
      const matchesCategory = selectedCategory === "All" || t.categoria === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [result, searchTerm, selectedCategory]);

  const sortedTransactions = useMemo(() => {
    let data = [...filteredTransactions];
    
    if (sortConfig) {
      data.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        if (sortConfig.key === 'data') {
           const [d1, m1, y1] = (aValue as string).split('/').map(Number);
           const [d2, m2, y2] = (bValue as string).split('/').map(Number);
           aValue = new Date(y1, m1 - 1, d1).getTime();
           bValue = new Date(y2, m2 - 1, d2).getTime();
        }

        if (typeof aValue === 'string') {
          aValue = aValue.toLowerCase();
          bValue = (bValue as string).toLowerCase();
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return data;
  }, [filteredTransactions, sortConfig]);

  const categoryData = Object.values(filteredTransactions.reduce((acc: any, curr) => {
    let cat = curr.categoria || "Other";
    // Supporting both Italian and English keys from backend
    const map:Record<string, string> = { "Spesa": "Groceries", "Ristoranti": "Dining", "Trasporti": "Transport", "Utenze": "Utilities", "Svago": "Entertainment", "Salute": "Health", "Bonifici": "Transfers", "Altro": "Other" };
    cat = map[cat] || cat;

    if (!acc[cat]) acc[cat] = { name: cat, value: 0 };
    if (curr.importo < 0) acc[cat].value += Math.abs(curr.importo);
    return acc;
  }, {}));

  const requestSort = (key: keyof Transaction) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleExport = () => {
    if (!sortedTransactions.length) return;
    const headers = ["Date", "Description", "Category", "Amount"];
    const rows = sortedTransactions.map(t => 
      `${t.data},"${t.descrizione.replace(/"/g, '""')}",${t.categoria},${t.importo}`
    );
    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `expenses_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalSpent = filteredTransactions.reduce((acc, curr) => acc + (curr.importo < 0 ? curr.importo : 0), 0);

  // --- RENDER ---
  return (
    <div className="h-screen flex flex-col bg-slate-50 font-sans text-slate-900 overflow-hidden selection:bg-blue-100">
      
      {!result ? (
        <main className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-xl animate-in fade-in zoom-in duration-700">
            <header className="mb-8 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white shadow-sm border border-slate-100 text-blue-600 mb-4">
                <DollarSign className="w-8 h-8" />
              </div>
              <h1 className="text-4xl font-extrabold text-slate-900 mb-2 tracking-tight">SwiftSpend AI</h1>
              <p className="text-slate-500 text-lg">Turn your messy bank PDF into clear insights.</p>
            </header>

            <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden">
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-12 flex flex-col items-center gap-4 bg-slate-50/50 hover:bg-slate-50 transition-colors relative group cursor-pointer">
                <div className="p-4 bg-white rounded-full shadow-sm group-hover:scale-110 transition-transform duration-300">
                  <UploadCloud className="w-8 h-8 text-blue-500" />
                </div>
                <div className="text-center">
                  <h2 className="text-lg font-semibold text-slate-700 group-hover:text-blue-600 transition-colors">Drag & Drop PDF</h2>
                  <p className="text-sm text-slate-400 mt-1">or click to browse</p>
                </div>
                <input 
                  type="file" 
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                />
              </div>

              {file && (
                <div className="mt-4 flex items-center gap-3 p-3 bg-blue-50/50 border border-blue-100 text-blue-700 rounded-xl text-sm font-medium animate-in slide-in-from-top-2">
                  <FileText className="w-4 h-4" />
                  {file.name}
                </div>
              )}

              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl flex items-center gap-2 text-sm animate-in slide-in-from-top-2">
                  <AlertCircle className="w-4 h-4" /> {error}
                </div>
              )}

              <button
                onClick={handleAnalyze}
                disabled={!file || isLoading}
                className="mt-6 w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg hover:shadow-xl active:scale-[0.98]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin w-5 h-5 text-blue-400" />
                    <span className="animate-pulse">{loadingPhrase}</span>
                  </>
                ) : (
                  <>
                    Analyze Statement <DollarSign className="w-4 h-4 opacity-50" />
                  </>
                )} 
              </button>
            </div>
            
            <p className="mt-8 text-xs text-center text-slate-400 font-medium">
              Powered by Gemini 2.0 Flash • Privacy First
            </p>
          </div>
        </main>
      ) : (
        <main className="flex-1 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-700">
          <nav className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-20">
            <div className="flex items-center gap-2 font-bold text-xl text-slate-900 tracking-tight">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                <DollarSign className="w-5 h-5" />
              </div>
              SwiftSpend AI
            </div>
            <button 
              onClick={() => { setResult(null); setFile(null); setSearchTerm(""); setSelectedCategory("All"); }}
              className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-lg"
            >
              New Analysis
            </button>
          </nav>

          <div className="flex-1 overflow-hidden p-4 lg:p-6 bg-slate-50">
            <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto">
              
              <div className="lg:col-span-4 flex flex-col gap-6 h-full overflow-y-auto lg:overflow-visible scrollbar-hide">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 shrink-0">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Outflow</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-extrabold text-slate-900 tracking-tight">
                      {Math.abs(totalSpent).toLocaleString('en-US', { style: 'currency', currency: 'EUR' })}
                    </span>
                  </div>
                  <div className="mt-4 flex gap-2">
                     <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-600">
                       {filteredTransactions.length} transactions
                     </span>
                     {selectedCategory !== 'All' && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                           Filtered: {selectedCategory}
                        </span>
                     )}
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col flex-1 min-h-[350px]">
                  <h3 className="text-lg font-bold text-slate-800 mb-6">Category Breakdown</h3>
                  <div className="flex-1 w-full min-h-0 relative"> 
                    {categoryData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={categoryData}
                            cx="50%"
                            cy="50%"
                            innerRadius={70}
                            outerRadius={90}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {/* @ts-ignore */}
                            {categoryData.map((entry: any, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={CATEGORY_COLORS[entry.name] || "#94a3b8"} 
                                strokeWidth={0} 
                              />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value: any) => [`€${Number(value).toFixed(2)}`, "Amount"]} 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                            itemStyle={{ color: '#1e293b', fontWeight: 600 }}
                          />
                          <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm gap-2">
                        <div className="p-3 bg-slate-50 rounded-full">
                           <Search className="w-6 h-6 opacity-50" />
                        </div>
                        No data matches your filters
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
                <div className="p-4 border-b border-slate-100 shrink-0 flex flex-col sm:flex-row gap-4 justify-between items-center bg-white z-10">
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative w-full sm:w-64 group">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                      <input 
                        type="text" 
                        placeholder="Search merchant or amount..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      />
                    </div>
                    
                    <div className="relative w-full sm:w-48">
                       <select 
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="w-full pl-4 pr-10 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none cursor-pointer transition-all hover:bg-slate-100"
                       >
                         <option value="All">All Categories</option>
                         {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                       </select>
                       <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  <button 
                    onClick={handleExport}
                    className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-blue-600 transition-colors px-4 py-2.5 rounded-xl hover:bg-blue-50 border border-transparent hover:border-blue-100"
                  >
                    <Download className="w-4 h-4" /> Export CSV
                  </button>
                </div>
                
                <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50/80 backdrop-blur-sm text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-100 sticky top-0 z-10">
                  <div className="col-span-3 cursor-pointer hover:text-blue-600 flex items-center gap-1 transition-colors" onClick={() => requestSort('data')}>
                    Date {sortConfig?.key === 'data' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3"/> : <ArrowDown className="w-3 h-3"/>)}
                  </div>
                  <div className="col-span-4 cursor-pointer hover:text-blue-600 flex items-center gap-1 transition-colors" onClick={() => requestSort('descrizione')}>
                    Description {sortConfig?.key === 'descrizione' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3"/> : <ArrowDown className="w-3 h-3"/>)}
                  </div>
                  <div className="col-span-3 cursor-pointer hover:text-blue-600 flex items-center gap-1 transition-colors" onClick={() => requestSort('categoria')}>
                    Category {sortConfig?.key === 'categoria' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3"/> : <ArrowDown className="w-3 h-3"/>)}
                  </div>
                  <div className="col-span-2 text-right cursor-pointer hover:text-blue-600 flex items-center justify-end gap-1 transition-colors" onClick={() => requestSort('importo')}>
                    Amount {sortConfig?.key === 'importo' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3"/> : <ArrowDown className="w-3 h-3"/>)}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200">
                   {sortedTransactions.length === 0 ? (
                     <div className="p-10 text-center text-slate-400 flex flex-col items-center">
                       <FileText className="w-10 h-10 mb-2 opacity-20" />
                       No transactions found.
                     </div>
                   ) : (
                     <div className="divide-y divide-slate-100">
                       {sortedTransactions.map((tx, i) => (
                         <div key={i} className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-slate-50 transition-colors text-sm items-center group">
                           <div className="col-span-3 font-medium text-slate-500">{tx.data}</div>
                           <div className="col-span-4 text-slate-900 font-medium truncate" title={tx.descrizione}>{tx.descrizione}</div>
                           <div className="col-span-3">
                             <span 
                                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                                style={{ 
                                  backgroundColor: `${CATEGORY_COLORS[tx.categoria] || '#94a3b8'}20`, 
                                  color: CATEGORY_COLORS[tx.categoria] || '#64748b'
                                }}
                             >
                               {tx.categoria || "Other"}
                             </span>
                           </div>
                           <div className={`col-span-2 text-right font-bold font-mono ${tx.importo < 0 ? 'text-slate-900' : 'text-emerald-600'}`}>
                             {tx.importo < 0 ? "" : "+"}{tx.importo.toFixed(2)} €
                           </div>
                         </div>
                       ))}
                     </div>
                   )}
                </div>
              </div>

            </div>
          </div>
          
          <footer className="bg-white border-t border-slate-200 py-4 px-6 shrink-0 z-20">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center text-xs text-slate-400 gap-2">
               <p>© {new Date().getFullYear()} SwiftSpend AI. Portfolio Project.</p>
               <div className="flex items-center gap-4">
                  <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-slate-600 transition-colors"><Github className="w-3 h-3" /> GitHub</a>
                  <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-slate-600 transition-colors"><Linkedin className="w-3 h-3" /> Contact</a>
               </div>
            </div>
          </footer>

        </main>
      )}
    </div>
  );
}