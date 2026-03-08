import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Volume2, ChevronLeft, ChevronRight, RotateCcw, Shuffle, Upload, X, Database, Download, FileSpreadsheet, FileText, Loader2, FileUp, BrainCircuit, Star, Search, Flame, Gamepad2, CalendarCheck, BarChart2, Trash2, Eye, Check, XCircle, Sparkles } from 'lucide-react';

// 預設精選單字範例
const defaultWordsList = [
  "mitigate|[mɪtə͵get]|使緩和、減輕|v. make (sth) less severe, violent or painful; moderate|mitigate patients' suffering // mitigate the negative effects|",
  // "anomalous|[əˋnɑmələs]|反常的、不規則的|adj. different from what is normal; irregular|the anomalous test results|",
  // "sanguine|[`sæŋgwɪn]|自信樂觀的|adj (about sth/that...) hopeful; optimistic|Angela Merkel appears to have become more sanguine about a Grexit.|毀三觀之前是自信的",
  // "meticulous|[mə`tɪkjələs]|小心翼翼的、一絲不苟的|adj. giving or showing great precision and care; very attentive to detail|a meticulous researcher|",
  // "undermine|[ˏʌndɚ`maɪn]|削弱|v. make a hollow or tunnel beneath (sth); weaken at the base|undermine people's confidence|",
  // "innocuous|[ɪˋnɑkjʊəs]|無害的|adj. causing no harm|It was an innocuous question.|innocence 無辜、清白"
];

const initialVocabulary = defaultWordsList.map(str => {
  const [word, pronunciation, meaning, englishDef, examplesStr, note] = str.split('|');
  return {
    word, pronunciation, meaning, englishDef,
    examples: examplesStr ? examplesStr.split('//').map(e => e.trim()).filter(Boolean) : [], note: note || ""
  };
});

const getTodayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function App() {
  const [originalDeck, setOriginalDeck] = useState(() => {
    try { const saved = localStorage.getItem('mason-deck'); return saved ? JSON.parse(saved) : initialVocabulary; } catch (e) { return initialVocabulary; }
  });
  
  const [appMode, setAppMode] = useState(() => localStorage.getItem('mason-appMode') || 'study');
  
  const [indexes, setIndexes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mason-indexes')) || { study: 0, due: 0, quiz: 0, starred: 0 }; }
    catch { return { study: 0, due: 0, quiz: 0, starred: 0 }; }
  });

  const [isShuffled, setIsShuffled] = useState(() => localStorage.getItem('mason-isShuffled') === 'true');
  const [shuffledWords, setShuffledWords] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mason-shuffledWords')) || []; }
    catch { return []; }
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [isFlipped, setIsFlipped] = useState(false);

  const [quizOptions, setQuizOptions] = useState([]);
  const [quizResult, setQuizResult] = useState(null); 

  const [showDataModal, setShowDataModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [isPdfLoaded, setIsPdfLoaded] = useState(false);
  const [isParsing, setIsParsing] = useState(false);

  const [stats, setStats] = useState(() => {
    try { const saved = localStorage.getItem('mason-stats'); return saved ? JSON.parse(saved) : {}; } catch (e) { return {}; }
  });

  const [activity, setActivity] = useState(() => {
    try { const saved = localStorage.getItem('mason-activity'); return saved ? JSON.parse(saved) : {}; } catch (e) { return {}; }
  });

  const lastViewedRef = useRef(null);
  const pdfInputRef = useRef(null);
  const csvInputRef = useRef(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
      setIsPdfLoaded(true);
    };
    document.head.appendChild(script);
  }, []);

  useEffect(() => { localStorage.setItem('mason-deck', JSON.stringify(originalDeck)); }, [originalDeck]);
  useEffect(() => { localStorage.setItem('mason-stats', JSON.stringify(stats)); }, [stats]);
  useEffect(() => { localStorage.setItem('mason-activity', JSON.stringify(activity)); }, [activity]);
  useEffect(() => { localStorage.setItem('mason-appMode', appMode); }, [appMode]);
  useEffect(() => { localStorage.setItem('mason-indexes', JSON.stringify(indexes)); }, [indexes]);
  useEffect(() => { localStorage.setItem('mason-isShuffled', isShuffled); }, [isShuffled]);
  useEffect(() => { localStorage.setItem('mason-shuffledWords', JSON.stringify(shuffledWords)); }, [shuffledWords]);

  const currentIndex = indexes[appMode] || 0;

  const updateCurrentIndex = (updater) => {
    setIndexes(prev => {
      const currentVal = prev[appMode] || 0;
      const newVal = typeof updater === 'function' ? updater(currentVal) : updater;
      return { ...prev, [appMode]: newVal };
    });
  };

  const activeDeck = useMemo(() => {
    let filtered = originalDeck;
    if (searchQuery.trim()) {
      const sq = searchQuery.toLowerCase().trim();
      filtered = originalDeck.filter(c => 
        (c.word || '').toLowerCase().includes(sq) || 
        (c.meaning || '').includes(searchQuery)
      );
    } else if (appMode === 'due') {
      const now = Date.now();
      filtered = originalDeck.filter(c => stats[c.word]?.dueDate && stats[c.word].dueDate <= now);
      // 待複習模式：永遠優先出現「最過期」的單字
      filtered.sort((a, b) => (stats[a.word].dueDate || 0) - (stats[b.word].dueDate || 0));
    } else if (appMode === 'starred') {
      filtered = originalDeck.filter(c => stats[c.word]?.starred);
    }
    
    // 如果開啟了智慧排序
    if (isShuffled && appMode !== 'due' && !searchQuery && shuffledWords.length > 0) {
      const orderMap = new Map(shuffledWords.map((w, i) => [w, i]));
      filtered = [...filtered].sort((a, b) => {
        const indexA = orderMap.has(a.word) ? orderMap.get(a.word) : Infinity;
        const indexB = orderMap.has(b.word) ? orderMap.get(b.word) : Infinity;
        return indexA - indexB;
      });
    }
    return filtered;
  }, [originalDeck, appMode, searchQuery, isShuffled, shuffledWords, stats]);

  // 背景自動修正越界 index
  useEffect(() => {
    if (activeDeck.length > 0 && currentIndex >= activeDeck.length) {
      updateCurrentIndex(Math.max(0, activeDeck.length - 1));
    }
  }, [activeDeck.length, currentIndex, appMode]);

  // 使用 Reference 來記住目前的總長度，防止延遲閉包造成的換卡跳號 Bug
  const activeDeckLengthRef = useRef(activeDeck.length);
  useEffect(() => { activeDeckLengthRef.current = activeDeck.length; }, [activeDeck.length]);

  const safeIndex = activeDeck.length > 0 ? Math.min(currentIndex, activeDeck.length - 1) : 0;
  const currentCard = activeDeck[safeIndex];

  const logActivity = () => {
    const today = getTodayStr();
    setActivity(prev => ({ ...prev, [today]: (prev[today] || 0) + 1 }));
  };

  useEffect(() => {
    if (appMode === 'quiz' && currentCard) {
      setQuizResult(null);
      const wrongCards = [...originalDeck].filter(c => c.word !== currentCard.word).sort(() => 0.5 - Math.random()).slice(0, 3);
      const options = [currentCard, ...wrongCards].sort(() => 0.5 - Math.random());
      setQuizOptions(options);
    }
  }, [appMode, safeIndex, currentCard, originalDeck]);

  const handleQuizAnswer = (selectedWord) => {
    if (quizResult) return; 
    const isCorrect = selectedWord === currentCard.word;
    setQuizResult(isCorrect ? 'correct' : 'wrong');
    logActivity();
    handleSRS(isCorrect ? 3 : 0, true);
    setTimeout(() => { goNext(false); }, 1200);
  };

  const speak = (e, text, lang = 'en-US') => {
    e.stopPropagation(); 
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); 
      let cleanText = text;
      if (lang === 'en-US') cleanText = text.replace(/[\u4e00-\u9fa5（）( )、，。：；！]/g, ' ').trim();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = lang; utterance.rate = 0.85; 
      window.speechSynthesis.speak(utterance);
    }
  };

  // 🔥 強化版翻卡控制：解決跳號與邊界重算問題
  const goNext = (cardConsumed = false) => {
    setIsFlipped(false);
    setTimeout(() => {
      updateCurrentIndex((prev) => {
        const len = activeDeckLengthRef.current || 1;
        // 如果卡片在評分後被移除了（例如在待複習模式評分），原始陣列長度會縮減
        // 此時當前的 Index 其實就已經是指向下一個字了，所以不需要 +1
        if (cardConsumed) {
          return prev >= len - 1 ? 0 : prev; 
        }
        return (prev + 1) % len;
      });
    }, 150);
  };

  const goPrev = () => {
    setIsFlipped(false);
    setTimeout(() => {
      updateCurrentIndex((prev) => {
        const len = activeDeckLengthRef.current || 1;
        return (prev - 1 + len) % len;
      });
    }, 150);
  };

  const toggleStar = (e, word) => {
    e.stopPropagation();
    setStats(prev => ({ ...prev, [word]: { ...prev[word], starred: !prev[word]?.starred } }));
  };

  const handleSRS = (quality, fromQuiz = false) => {
    if (!currentCard) return;
    const word = currentCard.word;
    
    setStats(prev => {
      const s = prev[word] || { ease: 2.5, interval: 0, views: 0, remembered: 0, forgot: 0 };
      let newEase = s.ease || 2.5;
      let newInterval = s.interval || 0;
      let newRemembered = s.remembered || 0;
      let newForgot = s.forgot || 0;

      if (quality === 0) {
        newEase = Math.max(1.3, newEase - 0.2);
        newInterval = 0; 
      } else if (quality === 1) {
        newEase = Math.max(1.3, newEase - 0.15);
        newInterval = Math.max(1, newInterval * 1.2);
      } else if (quality === 2) {
        newInterval = newInterval === 0 ? 1 : newInterval * newEase;
      } else if (quality === 3) {
        newEase += 0.15;
        newInterval = newInterval === 0 ? 4 : newInterval * newEase * 1.3;
      }

      if (quality <= 1) newForgot += 1;
      else newRemembered += 1;

      const dueDate = new Date();
      if (newInterval > 0) dueDate.setDate(dueDate.getDate() + Math.round(newInterval));
      else dueDate.setMinutes(dueDate.getMinutes() + 10); 

      return { 
        ...prev, 
        [word]: { ...s, ease: newEase, interval: newInterval, dueDate: dueDate.getTime(), remembered: newRemembered, forgot: newForgot } 
      };
    });

    if (!fromQuiz) {
      logActivity();
      const isConsumed = (appMode === 'due'); // 在待複習模式評分後，單字會被移除
      goNext(isConsumed);
    }
  };

  const getStreak = () => {
    let streak = 0;
    let d = new Date();
    while (true) {
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (activity[dateStr]) streak++;
      else if (streak > 0 || dateStr !== getTodayStr()) break;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  };

  // 🔥 核心邏輯更新：智慧洗牌 (最少瀏覽優先 -> 最常忘記優先 -> 隨機)
  const toggleShuffle = () => {
    setIsFlipped(false);
    if (isShuffled) {
      setIsShuffled(false);
    } else {
      const newShuffledWords = [...originalDeck].sort((a, b) => {
        const statA = stats[a.word] || { views: 0, forgot: 0 };
        const statB = stats[b.word] || { views: 0, forgot: 0 };
        
        // 優先：把連看都沒看過 (views 越低) 的單字全部往前塞
        if (statA.views !== statB.views) return statA.views - statB.views;
        // 次要：如果都看過了，把最常忘記 (forgot 越高) 的單字往前塞
        if (statA.forgot !== statB.forgot) return statB.forgot - statA.forgot;
        // 最後：同條件下進行隨機打亂
        return Math.random() - 0.5;
      }).map(c => c.word);
      
      setShuffledWords(newShuffledWords);
      setIsShuffled(true);
    }
    updateCurrentIndex(0); 
    lastViewedRef.current = null;
  };

  useEffect(() => {
    if (activeDeck.length > 0 && currentCard) {
      const word = currentCard.word;
      if (lastViewedRef.current !== word) {
        setStats(prev => {
          const safePrev = prev || {};
          const currentStats = safePrev[word] || { views: 0, remembered: 0, forgot: 0 };
          return { ...safePrev, [word]: { ...currentStats, views: (Number(currentStats.views) || 0) + 1 } };
        });
        lastViewedRef.current = word;
      }
    }
  }, [safeIndex, activeDeck, currentCard]);

  const finalizeImport = (newCards) => {
    if (newCards.length > 0) {
      setOriginalDeck(newCards);
      setAppMode('study');
      setIndexes({ study: 0, due: 0, quiz: 0, starred: 0 });
      setSearchQuery('');
      setImportText('');
      alert(`🎉 完美解析！成功匯入 ${newCards.length} 個單字。`);
      setShowDataModal(false);
    } else alert("找不到可解析的單字，請確認文本格式。");
  };

  const parseRawText = (text) => {
    const lines = text.split('\n');
    let newCards = [], activeCard = null, currentTag = null;
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      if (!line) continue;
      if (line.includes('@gmail') || line.includes('Mason 1000') || /^\d+@/.test(line) || /^grey\.pan/.test(line) || line.includes('gmail.com')) continue;
      if (line.match(/^---.*PAGE.*---$/i)) continue;
      
      const wordMatch = line.match(/^(\d+)\s+([a-zA-Z-\s]+)$/);
      if (wordMatch) {
        if (activeCard && activeCard.word) newCards.push(activeCard);
        activeCard = { word: wordMatch[2].trim(), pronunciation: "", meaning: "", englishDef: "", examples: [], note: "" };
        currentTag = 'pron'; continue;
      }
      if (!activeCard) continue;

      if (line.startsWith('[義]')) { currentTag = 'meaning'; activeCard.meaning += line.substring(3).trim() + " "; } 
      else if (line.startsWith('[例]')) { currentTag = 'example'; activeCard.examples.push(line.substring(3).trim()); } 
      else if (line.startsWith('[英]')) { currentTag = 'english'; activeCard.englishDef += line.substring(3).trim() + " "; } 
      else if (line.startsWith('[記]')) { currentTag = 'note'; activeCard.note += line.substring(3).trim() + " "; } 
      else {
        if (currentTag === 'pron') activeCard.pronunciation += line;
        else if (currentTag === 'meaning') activeCard.meaning += line + " ";
        else if (currentTag === 'example') {
          if (activeCard.examples.length > 0) activeCard.examples[activeCard.examples.length - 1] += " " + line;
          else activeCard.examples.push(line);
        }
        else if (currentTag === 'english') activeCard.englishDef += line + " ";
        else if (currentTag === 'note') activeCard.note += line + " ";
      }
    }
    if (activeCard && activeCard.word) newCards.push(activeCard);

    newCards = newCards.map(c => {
      let cleanedExamples = [];
      c.examples.forEach(ex => { ex.split('//').forEach(part => { if (part.trim()) cleanedExamples.push(part.trim()); }); });
      return { ...c, examples: cleanedExamples, meaning: c.meaning.trim(), englishDef: c.englishDef.trim(), note: c.note.trim(), pronunciation: c.pronunciation.replace(/\s+/g, '') };
    });
    finalizeImport(newCards);
  };

  const handlePDFUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsParsing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        let pageText = '', lastY;
        for (const item of textContent.items) {
          if (lastY !== item.transform[5] && lastY !== undefined) pageText += '\n';
          pageText += item.str; lastY = item.transform[5];
        }
        fullText += `\n--- PAGE ${i} ---\n` + pageText;
      }
      parseRawText(fullText);
    } catch (error) { alert("PDF 解析失敗，請檢查檔案格式。"); } 
    finally { setIsParsing(false); e.target.value = null; }
  };

  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      const rows = [];
      let row = [], currentString = '', inQuotes = false;
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (inQuotes) {
          if (char === '"' && text[i + 1] === '"') { currentString += '"'; i++; } 
          else if (char === '"') { inQuotes = false; } 
          else { currentString += char; }
        } else {
          if (char === '"') { inQuotes = true; } 
          else if (char === ',') { row.push(currentString); currentString = ''; } 
          else if (char === '\n' || char === '\r') {
            if (char === '\r' && text[i + 1] === '\n') i++; 
            row.push(currentString); rows.push(row); row = []; currentString = '';
          } 
          else { currentString += char; }
        }
      }
      if (currentString || row.length > 0) { row.push(currentString); rows.push(row); }

      const newCards = [];
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (r.length >= 3 && r[0].trim() !== '') {
          newCards.push({
            word: r[0], pronunciation: r[1] || "", meaning: r[2] || "", englishDef: r[3] || "",
            examples: r[4] ? r[4].split('//').map(s=>s.trim()).filter(Boolean) : [], note: r[5] || ""
          });
        }
      }
      finalizeImport(newCards);
    };
    reader.readAsText(file); e.target.value = null; 
  };

  const exportToCSV = () => {
    let csvContent = "\uFEFF單字,音標,中文解釋,英英釋義,例句,記憶法\n";
    originalDeck.forEach(card => {
      const escapeCSV = (str) => `"${(str || '').replace(/"/g, '""')}"`;
      const row = [escapeCSV(card.word), escapeCSV(card.pronunciation), escapeCSV(card.meaning), escapeCSV(card.englishDef), escapeCSV(card.examples.join(" // ")), escapeCSV(card.note)].join(",");
      csvContent += row + "\n";
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob); link.download = 'Mason_1000_單字庫.csv';
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const getDueCount = () => {
    const now = Date.now();
    return originalDeck.filter(c => stats[c.word]?.dueDate && stats[c.word].dueDate <= now).length;
  };

  const clearStats = () => {
    if (window.confirm("確定要清除所有學習紀錄嗎？此動作無法復原。")) {
      setStats({});
      setActivity({});
      setIndexes({ study: 0, due: 0, quiz: 0, starred: 0 });
      localStorage.removeItem('mason-stats');
      localStorage.removeItem('mason-activity');
      localStorage.removeItem('mason-indexes');
      setShowStatsModal(false);
    }
  };

  const cardStats = stats[currentCard?.word] || { views: 0, remembered: 0, forgot: 0 };
  
  const getSafeTotal = (key) => {
    return Object.values(stats).reduce((acc, curr) => {
      if (typeof curr === 'object' && curr !== null && !isNaN(Number(curr[key]))) return acc + Number(curr[key]);
      return acc;
    }, 0);
  };

  const totalStudied = Object.keys(stats).length;
  const totalViews = getSafeTotal('views');
  const totalRemembered = getSafeTotal('remembered');
  const totalForgot = getSafeTotal('forgot');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      <style dangerouslySetInnerHTML={{__html: `
        .perspective-1000 { perspective: 1000px; }
        .transform-style-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}} />

      <div className="w-full max-w-md relative z-10">
        
        <div className="flex justify-between items-center mb-3 px-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-indigo-700 tracking-wider">M1K</h1>
            <div className="flex items-center gap-1 bg-orange-100 text-orange-600 px-2 py-1 rounded-full text-xs font-bold shadow-sm">
              <Flame size={14} className={getStreak() > 0 ? "text-orange-500 fill-orange-500" : ""} /> {getStreak()} 天
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowDataModal(true)} className="p-2 rounded-full text-slate-500 hover:bg-white hover:text-indigo-600 transition-colors shadow-sm bg-slate-100"><Database size={18} /></button>
            <button onClick={() => setShowStatsModal(true)} className="p-2 rounded-full text-slate-500 hover:bg-white hover:text-indigo-600 transition-colors shadow-sm bg-slate-100"><BarChart2 size={18} /></button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-2 mb-4">
          <div className="relative mb-2 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="搜尋中英文單字..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border-none rounded-xl py-2 pl-9 pr-4 text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
              />
            </div>
            {/* ✨ 智慧推題切換按鈕，支援在測驗或全部模式使用 */}
            <button 
              type="button" 
              onClick={(e) => { e.stopPropagation(); toggleShuffle(); }} 
              disabled={appMode === 'due'}
              className={`flex items-center justify-center px-3 rounded-xl text-xs font-bold transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${isShuffled ? 'bg-indigo-600 text-white shadow-md border-transparent' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100'}`}
              title={isShuffled ? '目前為智慧推題(優先出現未看過/易忘單字)。點擊切換為原始順序' : '切換為智慧推題(優先出現未看過/易忘單字)'}
            >
              {isShuffled ? <Sparkles size={14} className="mr-1" /> : <Shuffle size={14} className="mr-1" />}
              <span className="hidden sm:inline">{isShuffled ? '智慧推題' : '原始順序'}</span>
            </button>
          </div>
          
          <div className="flex gap-1">
            <button onClick={() => {setAppMode('study'); setSearchQuery('');}} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${appMode === 'study' && !searchQuery ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>📚 全部</button>
            <button onClick={() => {setAppMode('due'); setSearchQuery('');}} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors relative ${appMode === 'due' && !searchQuery ? 'bg-rose-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
              <CalendarCheck size={14} className="inline mr-1" /> 待複習
              {getDueCount() > 0 && <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center animate-bounce">{getDueCount()}</span>}
            </button>
            <button onClick={() => {setAppMode('quiz'); setSearchQuery('');}} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${appMode === 'quiz' && !searchQuery ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><Gamepad2 size={14} className="inline mr-1" /> 測驗</button>
            <button onClick={() => {setAppMode('starred'); setSearchQuery('');}} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${appMode === 'starred' && !searchQuery ? 'bg-amber-400 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><Star size={14} className="inline" /></button>
          </div>
        </div>

        {activeDeck.length === 0 ? (
          <div className="w-full h-[400px] bg-white rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
            <BrainCircuit size={48} className="mb-4 text-slate-200" />
            <p className="font-bold text-lg mb-2">這裡空空的</p>
            <p className="text-sm">找不到符合條件的單字。如果你正在「待複習」模式，恭喜你今天任務達成！</p>
          </div>
        ) : appMode === 'quiz' && !searchQuery ? (
          <div className="w-full bg-white rounded-3xl shadow-xl border border-emerald-100 p-6 flex flex-col relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-emerald-400"></div>
            
            <div className="absolute top-4 left-4 flex gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100" title="此單字記得次數"><Check size={10}/> {cardStats.remembered}</span>
              <span className="flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100" title="此單字忘記次數"><X size={10}/> {cardStats.forgot}</span>
            </div>

            <div className="text-center mb-6 mt-4">
              <span className="text-emerald-600 text-xs font-bold tracking-widest uppercase bg-emerald-50 px-3 py-1 rounded-full">選擇正確的意思</span>
              <h2 className="text-4xl font-extrabold text-slate-800 mt-4 mb-1">{currentCard.word}</h2>
              <button onClick={(e) => speak(e, currentCard.word)} className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-emerald-600 transition-colors"><Volume2 size={16}/> 聽發音</button>
            </div>
            
            <div className="space-y-3 flex-1 flex flex-col justify-center">
              {quizOptions.map((opt, i) => {
                let btnStyle = "bg-slate-50 border-slate-200 text-slate-700 hover:bg-emerald-50 hover:border-emerald-200";
                if (quizResult && opt.word === currentCard.word) btnStyle = "bg-emerald-500 border-emerald-600 text-white shadow-md shadow-emerald-200 scale-[1.02] z-10";
                else if (quizResult && opt.word !== currentCard.word) btnStyle = "bg-slate-50 border-slate-200 text-slate-300 opacity-50";

                return (
                  <button 
                    key={i} 
                    onClick={() => handleQuizAnswer(opt.word)}
                    disabled={quizResult !== null}
                    className={`w-full text-left px-5 py-4 rounded-2xl border-2 font-medium transition-all duration-300 ${btnStyle}`}
                  >
                    {opt.meaning}
                  </button>
                )
              })}
            </div>
            
            {quizResult && (
              <div className={`absolute top-4 right-4 text-2xl animate-in zoom-in ${quizResult === 'correct' ? 'text-emerald-500' : 'text-rose-500'}`}>
                {quizResult === 'correct' ? '✅' : '❌'}
              </div>
            )}
          </div>
        ) : (
          <div className="perspective-1000 w-full h-[450px] max-h-[65vh] mb-4 cursor-pointer group" onClick={() => setIsFlipped(!isFlipped)}>
            <div className={`w-full h-full duration-500 transform-style-3d relative transition-transform ${isFlipped ? 'rotate-y-180' : ''}`}>
              
              {/* 正面 */}
              <div className="absolute inset-0 backface-hidden bg-white rounded-3xl shadow-xl border border-slate-100 flex flex-col items-center justify-center p-8 text-center overflow-hidden">
                <button onClick={(e) => toggleStar(e, currentCard.word)} className={`absolute top-5 right-5 z-20 transition-all ${stats[currentCard.word]?.starred ? 'text-amber-400 fill-amber-400 drop-shadow-sm scale-110' : 'text-slate-300 hover:text-amber-300'}`}>
                  <Star size={24} />
                </button>
                <span className="absolute top-5 left-5 text-slate-300"><RotateCcw size={20} className="group-hover:text-indigo-400 transition-colors" /></span>
                
                <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-2">
                  <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded" title="瀏覽次數"><Eye size={10}/> {cardStats.views}</span>
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100" title="記得次數"><Check size={10}/> {cardStats.remembered}</span>
                  <span className="flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100" title="忘記次數"><X size={10}/> {cardStats.forgot}</span>
                </div>

                <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-800 mb-3 tracking-tight mt-4">{currentCard.word}</h2>
                <p className="text-lg text-slate-500 mb-8 font-mono">{currentCard.pronunciation}</p>
                
                <button onClick={(e) => speak(e, currentCard.word)} className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-2xl px-6 py-3 transition-transform hover:scale-105 active:scale-95 flex items-center gap-2 shadow-sm border border-indigo-100">
                  <Volume2 size={24} /> <span className="font-bold">發音</span>
                </button>
                
                {stats[currentCard.word]?.dueDate && (
                  <p className="absolute bottom-5 text-[11px] font-medium text-slate-400">
                    {stats[currentCard.word].dueDate < Date.now() ? <span className="text-rose-500">🔥 待複習</span> : `下次複習: ${new Date(stats[currentCard.word].dueDate).toLocaleDateString()}`}
                  </p>
                )}
              </div>

              {/* 背面 */}
              <div className="absolute inset-0 backface-hidden rotate-y-180 bg-white rounded-3xl shadow-xl border border-indigo-100 flex flex-col overflow-hidden">
                <div className="flex-1 p-6 pb-2 overflow-y-auto custom-scrollbar">
                  <div className="mb-4 pb-4 border-b border-slate-100 flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-2xl font-bold text-indigo-700 mb-2 flex items-center gap-2">
                        {currentCard.word}
                        {stats[currentCard.word]?.starred && <Star size={16} className="text-amber-400 fill-amber-400" />}
                      </h3>
                      <p className="text-[17px] font-medium text-slate-800 bg-indigo-50 inline-block px-3 py-1.5 rounded-lg border border-indigo-100">{currentCard.meaning}</p>
                    </div>
                    <button onClick={(e) => speak(e, currentCard.meaning, 'zh-TW')} className="mt-1 text-slate-400 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 rounded-full p-2"><Volume2 size={20} /></button>
                  </div>
                  {currentCard.note && (
                    <div className="mb-4 bg-amber-50 p-3 rounded-xl border border-amber-200 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-amber-400"></div>
                      <h4 className="text-[11px] uppercase tracking-wider text-amber-600 font-bold mb-1">💡 記憶法</h4>
                      <p className="text-sm text-amber-900 font-medium leading-relaxed pl-1">{currentCard.note}</p>
                    </div>
                  )}
                  {currentCard.englishDef && (
                    <div className="mb-4">
                      <h4 className="text-[11px] uppercase tracking-wider text-slate-400 font-bold mb-1 flex items-center gap-1">英英釋義 <button onClick={(e) => speak(e, currentCard.englishDef)} className="text-slate-300 hover:text-indigo-500"><Volume2 size={12} /></button></h4>
                      <p className="text-sm text-slate-600 italic leading-relaxed pl-2 border-l-2 border-indigo-200">{currentCard.englishDef}</p>
                    </div>
                  )}
                  <div>
                    <h4 className="text-[11px] uppercase tracking-wider text-slate-400 font-bold mb-1.5">情境例句</h4>
                    <div className="space-y-2">
                      {currentCard.examples.map((ex, idx) => (
                        <div key={idx} className="bg-slate-50 p-3 rounded-xl flex gap-2 items-start border border-slate-100">
                          <button onClick={(e) => speak(e, ex)} className="mt-0.5 text-indigo-400 hover:text-white hover:bg-indigo-500 rounded-full p-1"><Volume2 size={14} /></button>
                          <p className="text-sm text-slate-700 leading-relaxed font-medium">{ex}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                {/* SRS 評分列 */}
                <div className="bg-slate-50 p-2 border-t border-slate-100 flex gap-2 shrink-0">
                  <button onClick={(e) => handleSRS(0)} className="flex-1 flex flex-col items-center justify-center py-1.5 rounded-lg bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold text-sm shadow-sm active:scale-95">
                    重來 <span className="text-[10px] text-rose-400 font-normal">稍後</span>
                  </button>
                  <button onClick={(e) => handleSRS(1)} className="flex-1 flex flex-col items-center justify-center py-1.5 rounded-lg bg-white border border-amber-200 text-amber-600 hover:bg-amber-50 font-bold text-sm shadow-sm active:scale-95">
                    困難 <span className="text-[10px] text-amber-400 font-normal">{(stats[currentCard.word]?.interval || 0) * 1.2 >= 1 ? `${Math.round((stats[currentCard.word]?.interval || 0) * 1.2)}天` : '1天'}</span>
                  </button>
                  <button onClick={(e) => handleSRS(2)} className="flex-1 flex flex-col items-center justify-center py-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 font-bold text-sm shadow-sm shadow-emerald-200 active:scale-95">
                    熟悉 <span className="text-[10px] text-emerald-100 font-normal">{stats[currentCard.word]?.interval === 0 ? '1天' : `${Math.round(stats[currentCard.word]?.interval * (stats[currentCard.word]?.ease || 2.5))}天`}</span>
                  </button>
                  <button onClick={(e) => handleSRS(3)} className="flex-1 flex flex-col items-center justify-center py-1.5 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 font-bold text-sm shadow-sm shadow-indigo-200 active:scale-95">
                    簡單 <span className="text-[10px] text-indigo-200 font-normal">{stats[currentCard.word]?.interval === 0 ? '4天' : `${Math.round(stats[currentCard.word]?.interval * (stats[currentCard.word]?.ease || 2.5) * 1.3)}天`}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 底部導覽列 */}
        {activeDeck.length > 0 && (
          <div className="flex items-center justify-between bg-white rounded-2xl shadow-md p-2.5 border border-slate-100">
            <button onClick={() => goPrev()} className="p-2 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 rounded-xl transition-colors"><ChevronLeft size={20} /></button>
            <div className="text-center px-4 flex-1">
              <div className="text-xs font-bold text-slate-600 tracking-wider mb-1.5">{safeIndex + 1} / {activeDeck.length}</div>
              <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden relative">
                <div className={`absolute top-0 left-0 h-full transition-all duration-300 ${appMode === 'due' ? 'bg-rose-500' : appMode === 'quiz' ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${((safeIndex + 1) / activeDeck.length) * 100}%` }} />
              </div>
            </div>
            <button onClick={() => goNext()} className="p-2 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 rounded-xl transition-colors"><ChevronRight size={20} /></button>
          </div>
        )}
      </div>

      {/* 📊 遊戲化統計 Modal */}
      {showStatsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl flex flex-col border border-slate-100">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Flame size={22} className="text-orange-500 fill-orange-500" /> 學習歷程</h2>
              <button onClick={() => setShowStatsModal(false)} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded-full"><X size={20} /></button>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-orange-50 p-4 rounded-2xl flex flex-col items-center justify-center text-center border border-orange-100">
                <span className="text-3xl font-black text-orange-500 mb-1">{getStreak()}</span><span className="text-[11px] font-bold text-orange-400">連續打卡天數</span>
              </div>
              <div className="bg-indigo-50 p-4 rounded-2xl flex flex-col items-center justify-center text-center border border-indigo-100">
                <span className="text-3xl font-black text-indigo-600 mb-1">{activity[getTodayStr()] || 0}</span><span className="text-[11px] font-bold text-indigo-400">今日複習字數</span>
              </div>
            </div>

            <div className="mb-5">
              <h3 className="text-xs font-bold text-slate-400 mb-2">近 14 天活躍度</h3>
              <div className="flex gap-1.5 justify-center">
                {[...Array(14)].map((_, i) => {
                  const d = new Date(); d.setDate(d.getDate() - (13 - i));
                  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                  const count = activity[dateStr] || 0;
                  let color = "bg-slate-100";
                  if (count > 0 && count <= 20) color = "bg-emerald-200";
                  else if (count > 20 && count <= 50) color = "bg-emerald-400";
                  else if (count > 50) color = "bg-emerald-600 shadow-sm";
                  return <div key={i} title={`${dateStr}: ${count}字`} className={`w-5 h-5 rounded-md ${color} transition-colors cursor-help`}></div>
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 grid grid-cols-3 gap-2">
              <div className="text-center">
                <p className="text-lg font-black text-slate-700">{originalDeck.length}</p>
                <p className="text-[10px] font-bold text-slate-400">總字數</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-black text-emerald-500">{totalRemembered}</p>
                <p className="text-[10px] font-bold text-slate-400">總答對/熟悉</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-black text-rose-500">{totalForgot}</p>
                <p className="text-[10px] font-bold text-slate-400">總答錯/重來</p>
              </div>
            </div>
            
            <div className="pt-4 mt-2 border-t border-slate-100">
              <button onClick={clearStats} className="w-full flex justify-center gap-2 py-2.5 rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-600 font-medium transition-colors">
                <Trash2 size={18} /> 清除所有學習紀錄
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🗄️ 資料庫管理 Modal */}
      {showDataModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[90] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-2xl p-6 shadow-2xl flex flex-col h-[85vh] border border-slate-100 relative overflow-hidden">
            {isParsing && (
              <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
                <Loader2 className="text-indigo-600 animate-spin mb-4" size={48} />
                <p className="text-lg font-bold text-indigo-800">正在萃取 PDF 單字中...</p>
              </div>
            )}
            <div className="flex justify-between items-center mb-5 border-b border-slate-100 pb-4">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Database className="text-indigo-600" /> 資料庫管理</h2>
              <button onClick={() => setShowDataModal(false)} className="text-slate-400 hover:bg-slate-100 p-2 rounded-full"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-4 space-y-5">
              <div className="bg-indigo-50 rounded-2xl p-5 border border-indigo-100">
                <h3 className="font-bold text-indigo-800 mb-2 flex items-center gap-2"><FileText size={18} /> 1. 上傳 PDF 匯入</h3>
                <input type="file" accept="application/pdf" ref={pdfInputRef} className="hidden" onChange={handlePDFUpload} />
                <button onClick={() => pdfInputRef.current.click()} disabled={!isPdfLoaded || isParsing} className="w-full py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold shadow-sm transition-all text-sm flex justify-center items-center gap-2">
                  <FileUp size={18} /> {isPdfLoaded ? '選擇 PDF 檔案' : '載入引擎中...'}
                </button>
              </div>
              <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-100">
                <h3 className="font-bold text-emerald-800 mb-2 flex items-center gap-2"><FileSpreadsheet size={18} /> 2. CSV (Excel) 管理</h3>
                <div className="flex gap-2">
                  <button onClick={exportToCSV} className="flex-1 py-3 bg-white border border-emerald-500 text-emerald-600 rounded-xl hover:bg-emerald-50 font-bold text-sm flex justify-center items-center gap-2"><Download size={16} /> 下載 CSV</button>
                  <input type="file" accept=".csv" ref={csvInputRef} className="hidden" onChange={handleCSVUpload} />
                  <button onClick={() => csvInputRef.current.click()} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-bold text-sm shadow-sm flex justify-center items-center gap-2"><Upload size={16} /> 上傳 CSV</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}