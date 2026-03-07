import React, { useState, useEffect, useRef } from 'react';
import { Volume2, ChevronLeft, ChevronRight, RotateCcw, Shuffle, Upload, X, Check, XCircle, Eye, BarChart2, Trash2, Database, Download, FileSpreadsheet, FileText, Loader2, FileUp } from 'lucide-react';

// 預設內建的部分精選單字
const defaultWordsList = [
  "mitigate|[mɪtə͵get]|使緩和、減輕|v. make (sth) less severe, violent or painful; moderate|mitigate patients' suffering // mitigate the negative effects|",
  // "anomalous|[əˋnɑmələs]|反常的、不規則的 [類] aberrant, deviant, heteroclite, preternatural|adj. different from what is normal; irregular|the anomalous test results|",
  // "sanguine|[`sæŋgwɪn]|自信樂觀的 [類] confident, optimistic|adj (about sth/that...) hopeful; optimistic|Angela Merkel appears to have become more sanguine about a Grexit.|毀三觀之前（三觀：世界觀、人生觀、價值觀）是自信的",
  // "meticulous|[mə`tɪkjələs]|小心翼翼的、一絲不苟的|adj. giving or showing great precision and care; very attentive to detail|a meticulous researcher|",
  // "undermine|[ˏʌndɚ`maɪn]|削弱|v. make a hollow or tunnel beneath (sth); weaken at the base|undermine people's confidence|",
  // "innocuous|[ɪˋnɑkjʊəs]|（行為、言論）無害的|adj. causing no harm|It was an innocuous question.|innocence 無辜、清白"
];

const initialVocabulary = defaultWordsList.map(str => {
  const [word, pronunciation, meaning, englishDef, examplesStr, note] = str.split('|');
  return {
    word, pronunciation, meaning, englishDef,
    examples: examplesStr ? examplesStr.split('//').map(e => e.trim()).filter(Boolean) : [],
    note: note || ""
  };
});

export default function App() {
  // 1. 載入原始單字庫
  const [originalDeck, setOriginalDeck] = useState(() => {
    try {
      const saved = localStorage.getItem('mason-flashcard-deck');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return initialVocabulary;
  });

  // 2. 載入當前使用中的卡牌陣列 (支援隨機打亂的狀態保存)
  const [deck, setDeck] = useState(() => {
    try {
      const savedSession = localStorage.getItem('mason-flashcard-session');
      if (savedSession) {
        const parsed = JSON.parse(savedSession);
        if (parsed.deck && parsed.deck.length > 0) return parsed.deck;
      }
    } catch (e) {}
    return originalDeck;
  });

  // 3. 載入上次的學習進度 (currentIndex)
  const [currentIndex, setCurrentIndex] = useState(() => {
    try {
      const savedSession = localStorage.getItem('mason-flashcard-session');
      if (savedSession) {
        const parsed = JSON.parse(savedSession);
        // 防呆：確保讀取的進度沒有超出當前單字庫的長度
        const maxIndex = parsed.deck ? parsed.deck.length - 1 : originalDeck.length - 1;
        if (parsed.currentIndex >= 0 && parsed.currentIndex <= maxIndex) {
          return parsed.currentIndex;
        }
      }
    } catch (e) {}
    return 0;
  });

  // 4. 載入隨機模式狀態
  const [isShuffled, setIsShuffled] = useState(() => {
    try {
      const savedSession = localStorage.getItem('mason-flashcard-session');
      if (savedSession) {
        return JSON.parse(savedSession).isShuffled || false;
      }
    } catch (e) {}
    return false;
  });

  const [isFlipped, setIsFlipped] = useState(false);
  
  // Modal 狀態
  const [showDataModal, setShowDataModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [isPdfLoaded, setIsPdfLoaded] = useState(false);
  const [isParsing, setIsParsing] = useState(false);

  // 載入學習統計
  const [stats, setStats] = useState(() => {
    try {
      const saved = localStorage.getItem('mason-flashcard-stats');
      const parsed = saved ? JSON.parse(saved) : {};
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed;
      }
      return {};
    } catch (e) { return {}; }
  });

  const currentCard = deck[currentIndex];
  const lastViewedRef = useRef(null);
  const csvInputRef = useRef(null);
  const pdfInputRef = useRef(null);

  // 初始化 PDF.js
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
      setIsPdfLoaded(true);
    };
    document.head.appendChild(script);
  }, []);

  // 【進度存檔】：只要進度、牌組、隨機狀態有變動，立刻自動儲存
  useEffect(() => {
    try {
      const sessionData = { currentIndex, isShuffled, deck };
      localStorage.setItem('mason-flashcard-session', JSON.stringify(sessionData));
    } catch (e) { console.error("無法儲存學習進度", e); }
  }, [currentIndex, isShuffled, deck]);

  // 單字庫存檔
  useEffect(() => {
    localStorage.setItem('mason-flashcard-deck', JSON.stringify(originalDeck));
  }, [originalDeck]);

  // 統計次數存檔
  useEffect(() => {
    localStorage.setItem('mason-flashcard-stats', JSON.stringify(stats));
  }, [stats]);

  // 記錄觀看次數
  useEffect(() => {
    if (deck.length > 0 && currentCard) {
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
  }, [currentIndex, deck, currentCard]);

  const speak = (e, text, lang = 'en-US') => {
    e.stopPropagation(); 
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); 
      let cleanText = text;
      if (lang === 'en-US') {
        cleanText = text.replace(/[\u4e00-\u9fa5（）( )、，。：；！]/g, ' ').trim();
      }
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = lang;
      utterance.rate = 0.85; 
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleNext = () => {
    setIsFlipped(false);
    setTimeout(() => setCurrentIndex((prev) => (prev + 1) % deck.length), 150);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setTimeout(() => setCurrentIndex((prev) => (prev - 1 + deck.length) % deck.length), 150);
  };

  const handleRecord = (e, type) => {
    e.stopPropagation(); 
    const word = currentCard.word;
    setStats(prev => {
      const safePrev = prev || {};
      const currentStats = safePrev[word] || { views: 1, remembered: 0, forgot: 0 };
      return { ...safePrev, [word]: { ...currentStats, [type]: (Number(currentStats[type]) || 0) + 1 } };
    });
    handleNext();
  };

  const toggleShuffle = () => {
    setIsFlipped(false);
    if (isShuffled) {
      setDeck([...originalDeck]);
      setCurrentIndex(0);
      setIsShuffled(false);
    } else {
      const shuffled = [...originalDeck].sort(() => Math.random() - 0.5);
      setDeck(shuffled);
      setCurrentIndex(0);
      setIsShuffled(true);
    }
    lastViewedRef.current = null;
  };

  const clearStats = () => {
    if (window.confirm("確定要清除所有學習紀錄嗎？此動作無法復原。")) {
      setStats({});
      localStorage.setItem('mason-flashcard-stats', JSON.stringify({}));
      setShowStatsModal(false);
    }
  };

  /* =========================================
     資料載入後，會重置進度 (因為匯入了新字庫)
     ========================================= */
  const finalizeImport = (newCards) => {
    if (newCards.length > 0) {
      setOriginalDeck(newCards);
      const newActiveDeck = isShuffled ? [...newCards].sort(() => Math.random() - 0.5) : newCards;
      setDeck(newActiveDeck);
      setCurrentIndex(0); // 匯入新單字庫時，從第1個字重新開始
      setImportText('');
      alert(`🎉 完美解析！成功匯入 ${newCards.length} 個單字。已為您儲存單字庫。`);
      setShowDataModal(false);
    } else {
      alert("找不到可解析的單字，請確認文本或檔案內容。");
    }
  };

  const parseRawText = (text) => {
    const lines = text.split('\n');
    let newCards = [];
    let activeCard = null;
    let currentTag = null;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      if (!line) continue;
      
      if (line.includes('@gmail') || line.includes('Mason 1000') || /^\d+@/.test(line) || /^grey\.pan/.test(line) || line.includes('gmail.com')) continue;
      if (line.match(/^---.*PAGE.*---$/i)) continue;

      const wordMatch = line.match(/^(\d+)\s+([a-zA-Z-\s]+)$/);
      if (wordMatch) {
        if (activeCard && activeCard.word) newCards.push(activeCard);
        activeCard = { word: wordMatch[2].trim(), pronunciation: "", meaning: "", englishDef: "", examples: [], note: "" };
        currentTag = 'pron';
        continue;
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
      return {
        ...c,
        examples: cleanedExamples,
        meaning: c.meaning.trim(),
        englishDef: c.englishDef.trim(),
        note: c.note.trim(),
        pronunciation: c.pronunciation.replace(/\s+/g, '') 
      };
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
        
        let pageText = '';
        let lastY;
        for (const item of textContent.items) {
          if (lastY !== item.transform[5] && lastY !== undefined) {
            pageText += '\n';
          }
          pageText += item.str;
          lastY = item.transform[5];
        }
        fullText += `\n--- PAGE ${i} ---\n` + pageText;
      }
      parseRawText(fullText);
    } catch (error) {
      console.error("PDF 解析失敗", error);
      alert("PDF 解析失敗，請檢查檔案格式。");
    } finally {
      setIsParsing(false);
      e.target.value = null;
    }
  };

  const exportToCSV = () => {
    let csvContent = "\uFEFF"; 
    csvContent += "單字,音標,中文解釋,英英釋義,例句,記憶法\n";

    originalDeck.forEach(card => {
      const escapeCSV = (str) => `"${(str || '').replace(/"/g, '""')}"`;
      const row = [
        escapeCSV(card.word),
        escapeCSV(card.pronunciation),
        escapeCSV(card.meaning),
        escapeCSV(card.englishDef),
        escapeCSV(card.examples.join(" // ")),
        escapeCSV(card.note)
      ].join(",");
      csvContent += row + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'Mason_1000_單字庫.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
            row.push(currentString); rows.push(row);
            row = []; currentString = '';
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
    reader.readAsText(file);
    e.target.value = null; 
  };

  const cardStats = stats[currentCard?.word] || { views: 0, remembered: 0, forgot: 0 };
  
  const getSafeTotal = (key) => {
    return Object.values(stats).reduce((acc, curr) => {
      if (typeof curr === 'object' && curr !== null && !isNaN(Number(curr[key]))) {
        return acc + Number(curr[key]);
      }
      return acc;
    }, 0);
  };

  const totalStudied = Object.keys(stats).length;
  const totalViews = getSafeTotal('views');
  const totalRemembered = getSafeTotal('remembered');
  const totalForgot = getSafeTotal('forgot');

  if (!currentCard) return <div className="p-8 text-center text-xl font-bold text-indigo-700 animate-pulse">單字載入中...</div>;

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
        {/* Header */}
        <div className="flex justify-between items-center mb-5 px-1">
          <h1 className="text-2xl font-black text-indigo-700 tracking-wider">Mason 1000</h1>
          <div className="flex gap-2">
            <button type="button" onClick={(e) => { e.stopPropagation(); setShowStatsModal(true); }} className="flex items-center justify-center w-9 h-9 sm:w-auto sm:px-3 rounded-full text-sm font-medium transition-colors bg-white text-indigo-600 shadow-sm hover:bg-indigo-50 border border-indigo-100 active:scale-95" title="統計">
              <BarChart2 size={18} /><span className="hidden sm:inline ml-1.5">統計</span>
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); setShowDataModal(true); }} className="flex items-center justify-center w-9 h-9 sm:w-auto sm:px-3 rounded-full text-sm font-medium transition-colors bg-white text-indigo-600 shadow-sm hover:bg-indigo-50 border border-indigo-100 active:scale-95" title="資料庫">
              <Database size={18} /><span className="hidden sm:inline ml-1.5">資料庫</span>
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); toggleShuffle(); }} className={`flex items-center justify-center w-9 h-9 sm:w-auto sm:px-3 rounded-full text-sm font-medium transition-colors active:scale-95 ${isShuffled ? 'bg-indigo-600 text-white shadow-md border-transparent' : 'bg-white text-slate-600 shadow-sm hover:bg-slate-100 border border-slate-200'}`}>
              <Shuffle size={18} /><span className="hidden sm:inline ml-1.5">{isShuffled ? '隨機' : '順序'}</span>
            </button>
          </div>
        </div>

        {/* 翻轉卡片區塊 */}
        <div className="perspective-1000 w-full h-[500px] max-h-[70vh] mb-6 cursor-pointer group" onClick={() => setIsFlipped(!isFlipped)}>
          <div className={`w-full h-full duration-500 transform-style-3d relative transition-transform ${isFlipped ? 'rotate-y-180' : ''}`}>
            
            {/* 正面 */}
            <div className="absolute inset-0 backface-hidden bg-white rounded-3xl shadow-xl border border-slate-100 flex flex-col items-center justify-center p-8 text-center overflow-hidden">
              <div className="absolute top-4 left-4 flex gap-2">
                <span className="flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-md" title="瀏覽次數"><Eye size={12}/> {cardStats.views}</span>
                <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100" title="記得次數"><Check size={12}/> {cardStats.remembered}</span>
                <span className="flex items-center gap-1 text-xs font-medium text-rose-600 bg-rose-50 px-2 py-1 rounded-md border border-rose-100" title="忘記次數"><X size={12}/> {cardStats.forgot}</span>
              </div>
              <span className="absolute top-4 right-4 text-slate-300"><RotateCcw size={22} className="group-hover:text-indigo-400 transition-colors" /></span>
              <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-800 mb-4 tracking-tight mt-6">{currentCard.word}</h2>
              <p className="text-lg text-slate-500 mb-10 font-mono tracking-wide">{currentCard.pronunciation}</p>
              <button onClick={(e) => speak(e, currentCard.word, 'en-US')} className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-2xl px-8 py-4 transition-transform hover:scale-105 active:scale-95 flex items-center gap-3 shadow-sm border border-indigo-100">
                <Volume2 size={28} /> <span className="font-bold text-lg">發音</span>
              </button>
            </div>

            {/* 背面 */}
            <div className="absolute inset-0 backface-hidden rotate-y-180 bg-white rounded-3xl shadow-xl border border-indigo-100 flex flex-col overflow-hidden">
              <div className="flex-1 p-6 pb-4 overflow-y-auto custom-scrollbar">
                <div className="mb-4 pb-4 border-b border-slate-100 flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-2xl font-bold text-indigo-700 mb-2">{currentCard.word}</h3>
                    <p className="text-lg font-medium text-slate-800 bg-indigo-50 inline-block px-3 py-1.5 rounded-lg border border-indigo-100">{currentCard.meaning}</p>
                  </div>
                  <button onClick={(e) => speak(e, currentCard.meaning, 'zh-TW')} className="mt-1 text-slate-400 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 rounded-full p-2 transition-colors flex-shrink-0"><Volume2 size={20} /></button>
                </div>
                {currentCard.note && (
                  <div className="mb-5 bg-amber-50 p-3.5 rounded-xl border border-amber-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-amber-400"></div>
                    <h4 className="text-xs uppercase tracking-wider text-amber-600 font-bold mb-1.5 flex items-center gap-1.5"><span className="text-base">💡</span> 記憶法</h4>
                    <p className="text-sm text-amber-900 font-medium leading-relaxed pl-1">{currentCard.note}</p>
                  </div>
                )}
                {currentCard.englishDef && (
                  <div className="mb-5">
                    <h4 className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-1.5 flex items-center gap-1">英英釋義 <button onClick={(e) => speak(e, currentCard.englishDef, 'en-US')} className="text-slate-300 hover:text-indigo-500 p-1"><Volume2 size={14} /></button></h4>
                    <p className="text-sm text-slate-600 italic leading-relaxed pl-2 border-l-2 border-indigo-200">{currentCard.englishDef}</p>
                  </div>
                )}
                <div>
                  <h4 className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-2">情境例句</h4>
                  <div className="space-y-3">
                    {currentCard.examples.map((example, idx) => (
                      <div key={idx} className="bg-slate-50 p-3.5 rounded-xl flex gap-3 items-start group relative border border-slate-100 shadow-sm">
                        <button onClick={(e) => speak(e, example, 'en-US')} className="mt-0.5 text-indigo-400 hover:text-white bg-white hover:bg-indigo-500 rounded-full p-1.5 shadow-sm transition-all hover:scale-110 active:scale-90 flex-shrink-0 border border-indigo-100"><Volume2 size={16} /></button>
                        <p className="text-sm text-slate-700 leading-relaxed font-medium">{example}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {/* 底部按鈕 */}
              <div className="bg-slate-50 p-4 border-t border-slate-100 flex gap-3 shrink-0">
                <button onClick={(e) => handleRecord(e, 'forgot')} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold shadow-sm transition-all active:scale-95"><XCircle size={20} /> 忘記</button>
                <button onClick={(e) => handleRecord(e, 'remembered')} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 font-bold shadow-sm shadow-emerald-200 transition-all active:scale-95"><Check size={20} /> 記得</button>
              </div>
            </div>
          </div>
        </div>

        {/* 控制列 */}
        <div className="flex items-center justify-between bg-white rounded-2xl shadow-md p-3 border border-slate-100">
          <button onClick={handlePrev} className="p-3 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-colors font-medium flex items-center gap-1"><ChevronLeft size={20} /></button>
          <div className="text-center px-4 flex-1">
            <div className="text-sm font-bold text-slate-700 tracking-wider">{currentIndex + 1} <span className="text-slate-300 font-normal mx-0.5">/</span> {deck.length}</div>
            <div className="w-full max-w-[120px] mx-auto h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden shadow-inner relative">
              <div className="absolute top-0 left-0 h-full bg-indigo-500 transition-all duration-300" style={{ width: `${((currentIndex + 1) / deck.length) * 100}%` }} />
            </div>
          </div>
          <button onClick={handleNext} className="p-3 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-colors font-medium flex items-center gap-1"><ChevronRight size={20} /></button>
        </div>
      </div>

      {/* 📊 學習統計 Modal */}
      {showStatsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl flex flex-col border border-slate-100">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><BarChart2 size={24} className="text-indigo-600" />整體學習統計</h2>
              <button onClick={() => setShowStatsModal(false)} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded-full transition-colors active:scale-90"><X size={20} /></button>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-indigo-50 p-4 rounded-xl flex flex-col items-center justify-center text-center">
                <span className="text-3xl font-black text-indigo-600 mb-1">{totalStudied}</span><span className="text-xs font-bold text-indigo-400">已看過單字數</span>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl flex flex-col items-center justify-center text-center">
                <span className="text-3xl font-black text-slate-600 mb-1">{totalViews}</span><span className="text-xs font-bold text-slate-400">總瀏覽次數</span>
              </div>
              <div className="bg-emerald-50 p-4 rounded-xl flex flex-col items-center justify-center text-center">
                <span className="text-3xl font-black text-emerald-600 mb-1">{totalRemembered}</span><span className="text-xs font-bold text-emerald-400">總記得次數</span>
              </div>
              <div className="bg-rose-50 p-4 rounded-xl flex flex-col items-center justify-center text-center">
                <span className="text-3xl font-black text-rose-600 mb-1">{totalForgot}</span><span className="text-xs font-bold text-rose-400">總忘記次數</span>
              </div>
            </div>
            <div className="pt-4 border-t border-slate-100">
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
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
                <Loader2 className="text-indigo-600 animate-spin mb-4" size={48} />
                <p className="text-lg font-bold text-indigo-800">正在萃取 PDF 單字中...</p>
                <p className="text-sm text-indigo-600 mt-2">請稍候，這可能需要幾秒鐘的時間</p>
              </div>
            )}

            <div className="flex justify-between items-center mb-5 border-b border-slate-100 pb-4">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Database className="text-indigo-600" /> 資料庫管理
              </h2>
              <button onClick={() => setShowDataModal(false)} className="text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-200 p-2 rounded-full"><X size={20} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-4 space-y-6">
              <div className="bg-indigo-50 rounded-2xl p-6 border-2 border-indigo-200 shadow-sm">
                <h3 className="text-lg font-bold text-indigo-800 mb-2 flex items-center gap-2">
                  <FileText className="text-indigo-600" size={20} />
                  1. 直接匯入你的 PDF 單字書
                </h3>
                <p className="text-sm text-indigo-600/80 mb-5 leading-relaxed font-medium">
                  不用再複製貼上了！直接點擊下方按鈕上傳你的 PDF 檔案。App 會在瀏覽器內自動將 1000 個單字萃取成字卡。
                </p>
                <input type="file" accept="application/pdf" ref={pdfInputRef} className="hidden" onChange={handlePDFUpload} />
                <button onClick={() => pdfInputRef.current.click()} disabled={!isPdfLoaded || isParsing} className="w-full flex items-center justify-center gap-3 px-5 py-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold shadow-md shadow-indigo-200 transition-all disabled:opacity-50 text-lg">
                  <FileUp size={24} /> {isPdfLoaded ? '選擇並上傳 PDF 檔案' : '載入 PDF 引擎中...'}
                </button>
              </div>

              <div className="bg-emerald-50 rounded-2xl p-6 border-2 border-emerald-200 shadow-sm">
                <h3 className="text-lg font-bold text-emerald-800 mb-2 flex items-center gap-2">
                  <FileSpreadsheet className="text-emerald-600" size={20} />
                  2. CSV (Excel) 匯出與擴充
                </h3>
                <p className="text-sm text-emerald-600/80 mb-5 leading-relaxed font-medium">
                  解析完 PDF 後，你可以點擊「下載 CSV」將單字表存入電腦備份。修改後也能透過「上傳 CSV」將自訂單字載入 App！
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button onClick={exportToCSV} className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-white border-2 border-emerald-500 text-emerald-600 rounded-xl hover:bg-emerald-50 font-bold transition-colors">
                    <Download size={18} /> 下載為 CSV (Excel)
                  </button>
                  <input type="file" accept=".csv" ref={csvInputRef} className="hidden" onChange={handleCSVUpload} />
                  <button onClick={() => csvInputRef.current.click()} className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-bold shadow-md shadow-emerald-200 transition-colors">
                    <Upload size={18} /> 上傳自訂 CSV
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                <h3 className="text-md font-bold text-slate-700 mb-2">備用方案：貼上純文字</h3>
                <textarea className="w-full bg-white border border-slate-200 rounded-xl p-3 resize-none h-24 focus:ring-2 focus:ring-indigo-500 custom-scrollbar font-mono text-xs" placeholder="若無法讀取 PDF，也可將文字貼在此處..." value={importText} onChange={(e) => setImportText(e.target.value)} />
                <button onClick={() => parseRawText(importText)} disabled={!importText.trim()} className="mt-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 font-medium disabled:opacity-50 text-sm">解析貼上之文字</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}