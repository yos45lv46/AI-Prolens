
import React, { useState, useEffect } from 'react';
import { UserIcon, ShieldIcon, LockIcon, CameraIcon, CheckIcon, ClipboardIcon, ArrowRightIcon, StarIcon, LightbulbIcon, SmartphoneIcon, MailIcon, EyeIcon, FileTextIcon, DownloadIcon, XIcon } from './Icons';
import { Registration } from '../types';

interface LoginScreenProps {
  onLogin: (role: 'student' | 'admin', studentData?: { name: string; phone: string }) => void;
}

interface PresentationDoc {
  id: string;
  name: string;
  type: string;
  date: string;
  content: string; // Base64
}

// --- IndexedDB Logic (Reading Only for Landing Page) ---
const DB_NAME = 'ProLensContentDB';
const STORE_NAME = 'presentations';
const DB_VERSION = 2; // Bumped version to fix schema sync issues

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    // Added onupgradeneeded to ensure the store is created even if Landing Page initializes the DB first
    request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
    };
  });
};

const getAllFromDB = async (): Promise<PresentationDoc[]> => {
    try {
        const db = await openDB();
        // Defensive check, though onupgradeneeded should solve it
        if (!db.objectStoreNames.contains(STORE_NAME)) return [];
        
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();
        return new Promise((resolve) => {
            request.onsuccess = () => resolve(request.result as PresentationDoc[]);
            request.onerror = () => resolve([]);
        });
    } catch (e) {
        return [];
    }
};

const MASTER_CODE = "admin1234"; // קוד מאסטר קבוע לשחזור גישה

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [view, setView] = useState<'landing' | 'login' | 'admin' | 'register'>('landing');
  
  // Registration State
  const [regData, setRegData] = useState({
    fullName: '',
    email: '',
    phone: '',
    level: 'beginner'
  });
  const [regSubmitted, setRegSubmitted] = useState(false);

  // Student Login State
  const [studentName, setStudentName] = useState('');
  const [studentPhone, setStudentPhone] = useState('');

  // Admin Login State
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSetupMode, setIsSetupMode] = useState(false);

  // Presentations for Landing Page
  const [presentations, setPresentations] = useState<PresentationDoc[]>([]);
  const [viewingDoc, setViewingDoc] = useState<PresentationDoc | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    try {
        const stored = localStorage.getItem('prolens_admin_password');
        setIsSetupMode(!stored);
    } catch (e) {
        setIsSetupMode(true);
    }

    // Load presentations for the landing page showcase
    const loadPresentations = async () => {
        const docs = await getAllFromDB();
        setPresentations(docs);
    };
    loadPresentations();
  }, []);

  // Convert Base64 PDF to Blob URL when viewingDoc changes
  useEffect(() => {
    if (viewingDoc && viewingDoc.type === 'application/pdf') {
        try {
            const base64Part = viewingDoc.content.split(',')[1];
            const binaryString = window.atob(base64Part);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            setPdfBlobUrl(url);
        } catch (e) {
            console.error("Error creating blob from PDF", e);
            setPdfBlobUrl(null);
        }
    } else {
        setPdfBlobUrl(null);
    }

    // Cleanup function
    return () => {
        if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    };
  }, [viewingDoc]);

  const handleRegistration = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newReg: Registration = {
        id: Date.now().toString(),
        date: new Date().toLocaleDateString('he-IL'),
        fullName: regData.fullName,
        email: regData.email,
        phone: regData.phone,
        level: regData.level,
        status: 'pending'
    };
    
    // 1. Save locally for the user UX
    try {
        localStorage.setItem('prolens_my_registration', JSON.stringify(newReg));
    } catch (e) {}

    // 2. AUTOMATIC ADDITION: Add to the main registration list (Admin view)
    try {
        const existingRegsStr = localStorage.getItem('prolens_registrations');
        const existingRegs: Registration[] = existingRegsStr ? JSON.parse(existingRegsStr) : [];
        
        // Prevent duplicates based on phone
        if (!existingRegs.some(r => r.phone === newReg.phone)) {
            const updatedRegs = [...existingRegs, newReg];
            localStorage.setItem('prolens_registrations', JSON.stringify(updatedRegs));
        }
    } catch (e) {
        console.error("Failed to auto-save registration", e);
    }

    setRegSubmitted(true);
  };

  const openWhatsApp = () => {
      const message = `שלום, נרשמתי לקורס ProLens! 📷\n\nשם מלא: ${regData.fullName}\nטלפון: ${regData.phone}\nמייל: ${regData.email}\nרמה: ${regData.level === 'beginner' ? 'מתחיל' : 'מתקדם'}`;
      const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
  };

  const openEmail = () => {
      const message = `שלום, נרשמתי לקורס ProLens! 📷\n\nשם מלא: ${regData.fullName}\nטלפון: ${regData.phone}\nמייל: ${regData.email}\nרמה: ${regData.level === 'beginner' ? 'מתחיל' : 'מתקדם'}`;
      const subject = "הרשמה לקורס ProLens";
      window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`, '_blank');
  };

  const handleStudentLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (studentName.trim().length < 2) {
        setError('אנא הזן שם מלא תקין');
        return;
    }
    onLogin('student', { name: studentName, phone: studentPhone });
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
        // 1. Reset Command
        if (password === 'reset' || password === 'creator') {
            localStorage.removeItem('prolens_admin_password');
            setIsSetupMode(true);
            setError('מצב איפוס הופעל. אנא צור סיסמה חדשה.');
            setPassword('');
            return;
        }

        // 2. Master Code Check (Always works)
        if (password === MASTER_CODE) {
            localStorage.setItem('prolens_admin_password', MASTER_CODE); // Sync local storage
            onLogin('admin');
            return;
        }

        // 3. Standard Login Flow
        if (isSetupMode) {
            if (password.length < 4) {
                setError('הסיסמה חייבת להכיל לפחות 4 תווים');
                return;
            }
            localStorage.setItem('prolens_admin_password', password);
            onLogin('admin');
        } else {
            const stored = localStorage.getItem('prolens_admin_password');
            if (password === stored) {
                onLogin('admin');
            } else {
                setError('סיסמה שגויה.');
            }
        }
    } catch (e) {
        setError('שגיאה בהתחברות.');
    }
  };

  const canPreview = (mimeType: string) => {
      return mimeType.startsWith('image/') || mimeType === 'application/pdf';
  };

  // --- VIEWS ---

  if (view === 'login') {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
             <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl shadow-2xl max-w-md w-full animate-fade-in">
                 <button onClick={() => setView('landing')} className="text-slate-400 text-sm mb-4 hover:text-white transition-colors">← חזרה לדף הראשי</button>
                 <h2 className="text-2xl font-bold text-white mb-6 text-center">כניסת תלמידים רשומים</h2>
                 <form onSubmit={handleStudentLogin} className="space-y-4">
                    <div>
                        <label className="text-slate-300 text-sm">שם מלא</label>
                        <input type="text" value={studentName} onChange={e => setStudentName(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white focus:border-cyan-500 outline-none" required />
                    </div>
                    <div>
                        <label className="text-slate-300 text-sm">טלפון</label>
                        <input type="tel" value={studentPhone} onChange={e => setStudentPhone(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white focus:border-cyan-500 outline-none" required />
                    </div>
                    {error && <p className="text-red-400 text-sm">{error}</p>}
                    <button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded-lg transition-colors shadow-lg">התחבר</button>
                 </form>
             </div>
        </div>
      );
  }

  if (view === 'admin') {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
             <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl shadow-2xl max-w-md w-full animate-fade-in">
                 <button onClick={() => setView('landing')} className="text-slate-400 text-sm mb-4 hover:text-white transition-colors">← חזרה לדף הראשי</button>
                 
                 <div className="flex flex-col items-center mb-6">
                     <div className="p-3 bg-purple-600/20 rounded-full mb-3">
                         <ShieldIcon className="w-8 h-8 text-purple-400" />
                     </div>
                     <h2 className="text-2xl font-bold text-white">כניסת מנהל האתר</h2>
                     <p className="text-slate-400 text-xs mt-1">גישה לניהול תכנים, נרשמים וגיבויים</p>
                 </div>

                 <form onSubmit={handleAdminLogin} className="space-y-4">
                    <div>
                        <label className="text-slate-300 text-sm mb-1 block">
                            {isSetupMode ? 'הגדר סיסמה חדשה למכשיר זה' : 'הזן סיסמה או קוד מאסטר'}
                        </label>
                        <div className="relative">
                            <input 
                                type={showPassword ? "text" : "password"} 
                                value={password} 
                                onChange={e => setPassword(e.target.value)} 
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 pl-10 text-white focus:border-purple-500 outline-none transition-all" 
                                placeholder={isSetupMode ? "לדוגמה: 123456" : "****"}
                                required 
                            />
                            <button 
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                            >
                                <EyeIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                    
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded p-2 flex items-start gap-2">
                            <span className="text-red-400 text-xs font-medium">{error}</span>
                        </div>
                    )}
                    
                    <button type="submit" className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3 rounded-lg transition-all shadow-lg hover:shadow-purple-500/20">
                        {isSetupMode ? 'שמור וכנס' : 'התחבר למערכת'}
                    </button>
                 </form>
                 
                 {!isSetupMode && (
                     <div className="mt-6 pt-6 border-t border-slate-800 text-center">
                         <p className="text-xs text-slate-500">
                             שכחת סיסמה? נסה את קוד המאסטר: <span className="font-mono text-purple-400 select-all cursor-pointer" onClick={() => setPassword(MASTER_CODE)}>{MASTER_CODE}</span>
                             <br/>
                             או הקלד <span className="font-mono text-slate-300">reset</span> לאיפוס.
                         </p>
                     </div>
                 )}
             </div>
        </div>
      );
  }

  if (view === 'register') {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
             <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl shadow-2xl max-w-lg w-full animate-fade-in relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
                 
                 <button onClick={() => setView('landing')} className="text-slate-400 text-sm mb-4 hover:text-white transition-colors relative z-10">← חזרה לדף הראשי</button>
                 
                 {regSubmitted ? (
                     <div className="text-center py-6 animate-fade-in">
                         <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                             <CheckIcon className="w-8 h-8 text-emerald-400" />
                         </div>
                         <h3 className="text-xl font-bold text-white mb-2">נרשמת בהצלחה!</h3>
                         <p className="text-slate-300 mb-6 text-sm">
                             הפרטים שלך נשמרו במערכת המקומית.
                             <br/>
                             כדי להשלים את התהליך ולוודא שהמנהל קיבל את בקשתך (במידה ואינכם באותו מקום), מומלץ לשלוח הודעה:
                         </p>
                         
                         <div className="flex flex-col gap-3 mb-6">
                             <button onClick={openWhatsApp} className="flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white py-3 rounded-lg font-bold transition-colors shadow-lg">
                                 <SmartphoneIcon className="w-5 h-5" />
                                 שלח אישור ב-WhatsApp
                             </button>
                             <button onClick={openEmail} className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg font-bold transition-colors">
                                 <MailIcon className="w-5 h-5" />
                                 שלח אישור ב-Email
                             </button>
                         </div>

                         <button onClick={() => setView('landing')} className="text-slate-500 text-sm hover:text-slate-300 underline">
                             חזרה לדף הבית
                         </button>
                     </div>
                 ) : (
                     <form onSubmit={handleRegistration} className="space-y-4 relative z-10" dir="rtl">
                         <h2 className="text-3xl font-bold text-white mb-2 text-center">הרשמה לקורס</h2>
                         <p className="text-slate-400 text-center mb-6">הצטרף למאות תלמידים שלומדים צילום מקצועי</p>
                         
                         <div>
                             <label className="text-slate-400 text-sm">שם מלא</label>
                             <input type="text" required value={regData.fullName} onChange={e => setRegData({...regData, fullName: e.target.value})} className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none transition-colors" />
                         </div>
                         <div>
                             <label className="text-slate-400 text-sm">אימייל</label>
                             <input type="email" required value={regData.email} onChange={e => setRegData({...regData, email: e.target.value})} className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none transition-colors" />
                         </div>
                         <div>
                             <label className="text-slate-400 text-sm">טלפון</label>
                             <input type="tel" required value={regData.phone} onChange={e => setRegData({...regData, phone: e.target.value})} className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none transition-colors" />
                         </div>
                         <div>
                             <label className="text-slate-400 text-sm">רמת ידע</label>
                             <select value={regData.level} onChange={e => setRegData({...regData, level: e.target.value})} className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none transition-colors">
                                 <option value="beginner">מתחיל</option>
                                 <option value="intermediate">מתקדם</option>
                             </select>
                         </div>
                         <button type="submit" className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-4 rounded-lg shadow-lg mt-4 transition-transform hover:scale-[1.02]">
                             שמור הרשמה והמשך
                         </button>
                     </form>
                 )}
             </div>
        </div>
      );
  }

  // LANDING PAGE
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans overflow-x-hidden">
       {/* Nav */}
       <nav className="p-4 md:px-8 flex items-center justify-between sticky top-0 bg-slate-950/80 backdrop-blur-md z-50 border-b border-slate-800">
           <div className="flex items-center gap-2">
               <CameraIcon className="w-6 h-6 text-cyan-400" />
               <span className="font-bold text-xl tracking-wide">ProLens</span>
           </div>
           <div className="flex gap-4">
               <button onClick={() => setView('login')} className="text-slate-300 hover:text-white font-medium text-sm transition-colors">התחברות תלמידים</button>
               <button onClick={() => setView('register')} className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-full font-bold text-sm transition-all shadow-lg hover:shadow-cyan-500/20">הירשם לקורס</button>
           </div>
       </nav>

       {/* Hero */}
       <header className="relative py-20 px-4 text-center overflow-hidden min-h-[60vh] flex flex-col justify-center">
           <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-cyan-900/20 rounded-full blur-[100px] pointer-events-none"></div>
           <h1 className="text-5xl md:text-7xl font-bold mb-6 relative z-10 leading-tight">
               למד צילום מקצועי <br/>
               <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">עם המורה האישי שלך ב-AI</span>
           </h1>
           <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 relative z-10 leading-relaxed">
               הקורס המקיף לצילום DSLR המשלב תאוריה, סימולטורים מתקדמים, ומשוב בזמן אמת על התמונות שלך.
           </p>
           <div className="relative z-10">
                <button onClick={() => setView('register')} className="inline-flex items-center gap-2 bg-white text-slate-900 px-8 py-4 rounded-full font-bold text-lg hover:scale-105 transition-transform shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                    התחל ללמוד עכשיו <ArrowRightIcon className="w-5 h-5 rotate-180" />
                </button>
           </div>
       </header>

       {/* NEW SECTION: Course Showcase (Presentations) */}
       {presentations.length > 0 && (
           <section className="py-16 px-4 bg-slate-900/50 border-y border-slate-800">
               <div className="max-w-6xl mx-auto">
                   <div className="text-center mb-10">
                       <h2 className="text-3xl font-bold text-white mb-2 flex items-center justify-center gap-2">
                           <FileTextIcon className="w-8 h-8 text-indigo-400" />
                           טעימה מהקורס: מצגות וסילבוס
                       </h2>
                       <p className="text-slate-400">חומרי לימוד לדוגמה שהועלו על ידי צוות הקורס</p>
                   </div>
                   
                   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                       {presentations.map(doc => (
                           <div key={doc.id} className="bg-slate-800 p-5 rounded-xl border border-slate-700 hover:border-indigo-500/50 transition-all hover:translate-y-[-4px] shadow-lg group">
                               <div className="flex items-start justify-between mb-4">
                                   <div className="p-3 bg-indigo-500/10 rounded-lg">
                                       <FileTextIcon className="w-6 h-6 text-indigo-400" />
                                   </div>
                                   <div className="flex gap-1">
                                        {canPreview(doc.type) && (
                                            <button 
                                                onClick={() => setViewingDoc(doc)}
                                                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                                                title="צפה בקובץ"
                                            >
                                                <EyeIcon className="w-5 h-5" />
                                            </button>
                                        )}
                                        <a 
                                            href={doc.content} 
                                            download={doc.name}
                                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                                            title="הורד קובץ"
                                        >
                                            <DownloadIcon className="w-5 h-5" />
                                        </a>
                                   </div>
                               </div>
                               <h3 className="font-bold text-slate-100 mb-1 truncate" title={doc.name}>{doc.name}</h3>
                               <div className="flex justify-between items-center text-xs text-slate-500">
                                   <span>{doc.date}</span>
                                   <span className="uppercase bg-slate-900 px-2 py-0.5 rounded text-[10px] tracking-wide">{doc.type.split('/')[1] || 'FILE'}</span>
                               </div>
                           </div>
                       ))}
                   </div>
               </div>
           </section>
       )}

       {/* Features */}
       <section className="py-20 px-4 max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10 bg-slate-950">
           <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 hover:border-cyan-500/50 transition-colors group">
               <CameraIcon className="w-12 h-12 text-cyan-400 mb-6 group-hover:scale-110 transition-transform" />
               <h3 className="text-xl font-bold mb-3 text-white">סימולטור חשיפה</h3>
               <p className="text-slate-400 leading-relaxed">תרגל שליטה בצמצם, תריס ו-ISO בסביבה וירטואלית בטוחה לפני שאתה יוצא לשטח.</p>
           </div>
           <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 hover:border-purple-500/50 transition-colors group">
               <StarIcon className="w-12 h-12 text-purple-400 mb-6 group-hover:scale-110 transition-transform" />
               <h3 className="text-xl font-bold mb-3 text-white">משוב AI מיידי</h3>
               <p className="text-slate-400 leading-relaxed">העלה את התמונות שלך וקבל ניתוח מקצועי וביקורת בונה מהבינה המלאכותית שלנו.</p>
           </div>
           <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 hover:border-emerald-500/50 transition-colors group">
               <LightbulbIcon className="w-12 h-12 text-emerald-400 mb-6 group-hover:scale-110 transition-transform" />
               <h3 className="text-xl font-bold mb-3 text-white">למידה מותאמת אישית</h3>
               <p className="text-slate-400 leading-relaxed">מערכת שמתאימה את עצמה לקצב שלך, עם נושאים מובנים ומעקב התקדמות.</p>
           </div>
       </section>

       <footer className="py-8 text-center text-slate-600 text-sm border-t border-slate-900 mt-10">
           <p>© 2024 ProLens AI Tutor</p>
           <button onClick={() => setView('admin')} className="mt-4 hover:text-slate-400 flex items-center gap-1 mx-auto transition-colors">
               <LockIcon className="w-3 h-3" /> כניסת מנהל
           </button>
       </footer>

       {/* DOCUMENT PREVIEW MODAL */}
      {viewingDoc && (
          <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
              <div className="bg-slate-900 border border-slate-700 w-full h-full md:w-[90vw] md:h-[90vh] rounded-xl shadow-2xl flex flex-col relative overflow-hidden">
                  {/* Modal Header */}
                  <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center z-10">
                      <h3 className="text-lg font-bold text-white truncate max-w-[70%]">{viewingDoc.name}</h3>
                      <div className="flex gap-2">
                           <a 
                                href={viewingDoc.content} 
                                download={viewingDoc.name}
                                className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 transition-colors"
                            >
                                <DownloadIcon className="w-4 h-4" />
                                <span className="hidden sm:inline">הורד</span>
                            </a>
                           <button 
                                onClick={() => setViewingDoc(null)} 
                                className="bg-slate-700 hover:bg-red-500/80 text-white p-1.5 rounded-lg transition-colors"
                            >
                               <XIcon className="w-6 h-6" />
                           </button>
                      </div>
                  </div>
                  
                  {/* Modal Content */}
                  <div className="flex-1 bg-slate-950 relative overflow-hidden flex items-center justify-center">
                      {viewingDoc.type.startsWith('image/') ? (
                          <img src={viewingDoc.content} alt={viewingDoc.name} className="max-w-full max-h-full object-contain" />
                      ) : viewingDoc.type === 'application/pdf' ? (
                          pdfBlobUrl ? (
                              <object data={pdfBlobUrl} type="application/pdf" className="w-full h-full">
                                  <div className="flex flex-col items-center justify-center h-full text-slate-300 p-8 text-center">
                                      <FileTextIcon className="w-16 h-16 mb-4 text-slate-600" />
                                      <p className="text-lg font-bold mb-2">לא ניתן להציג את התצוגה המקדימה</p>
                                      <p className="text-sm mb-6 text-slate-400">הדפדפן שלך אינו תומך בהצגת PDF מוטמעת, או שהקובץ מוגן.</p>
                                      <a 
                                          href={viewingDoc.content} 
                                          download={viewingDoc.name} 
                                          className="bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-2 rounded-lg transition-colors"
                                      >
                                          לחץ כאן להורדת הקובץ
                                      </a>
                                  </div>
                              </object>
                          ) : (
                              <div className="flex flex-col items-center justify-center">
                                  <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                                  <p className="text-slate-400">מכין תצוגה מקדימה...</p>
                              </div>
                          )
                      ) : (
                          <div className="text-center p-8">
                              <p className="text-slate-400 mb-4">תצוגה מקדימה לא זמינה לסוג קובץ זה.</p>
                              <a href={viewingDoc.content} download={viewingDoc.name} className="text-cyan-400 underline">לחץ להורדה</a>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default LoginScreen;
