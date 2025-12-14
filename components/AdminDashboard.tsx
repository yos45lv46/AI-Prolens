
import React, { useState, useEffect, useRef } from 'react';
import { TrashIcon, ShieldIcon, CheckIcon, DatabaseIcon, LockIcon, UserIcon, DownloadCloudIcon, UploadCloudIcon, MonitorIcon, HelpCircleIcon, MailIcon, XIcon, SmartphoneIcon, FileTextIcon } from './Icons';
import { Registration } from '../types';

// IndexedDB Helper
const DB_NAME = 'ProLensDB';
const STORE_NAME = 'materials';
const DB_VERSION = 2; // Bumped version

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

interface StudentProfile {
    name: string;
    phone: string;
}

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState({
    fileCount: 0,
    messageCount: 0,
    completedTopics: 0,
    estimatedSizeMB: 0
  });
  const [currentStudent, setCurrentStudent] = useState<StudentProfile | null>(null);
  
  // Announcement State
  const [announcement, setAnnouncement] = useState('');

  // Backup State
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [backupSizeMB, setBackupSizeMB] = useState<number | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File Checker State
  const [fileCheckResult, setFileCheckResult] = useState<{
      name: string;
      sizeMB: number;
      status: 'safe' | 'warning' | 'danger';
      message: string;
  } | null>(null);
  const checkInputRef = useRef<HTMLInputElement>(null);

  // Launcher URL State - Defaulting to the production URL provided by user
  const [launcherUrl, setLauncherUrl] = useState('https://rzbbfjh7mg-create.github.io/prolens2/');

  // Registration State
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [isAddingManual, setIsAddingManual] = useState(false);
  const [manualReg, setManualReg] = useState({ name: '', phone: '', email: '' });
  
  // Cloud Guide
  const [showCloudGuide, setShowCloudGuide] = useState(false);

  useEffect(() => {
    loadStats();
    
    // Optional: If we are actually ON the production site, update the URL to match exactly (in case of sub-paths)
    // But we prioritize the hardcoded production URL if we are in dev/preview modes to avoid generating broken local links
    if (typeof window !== 'undefined' && !window.location.href.includes('localhost') && !window.location.href.includes('googleusercontent') && !window.location.href.includes('aistudio')) {
        setLauncherUrl(window.location.href);
    }

    const saved = localStorage.getItem('prolens_announcement');
    if (saved) setAnnouncement(saved);

    const savedStudent = localStorage.getItem('prolens_student_profile');
    if (savedStudent) setCurrentStudent(JSON.parse(savedStudent));

    const savedRegs = localStorage.getItem('prolens_registrations');
    if (savedRegs) setRegistrations(JSON.parse(savedRegs));
  }, []);

  const loadStats = async () => {
    // LocalStorage stats
    const msgs = localStorage.getItem('prolens_messages');
    const topics = localStorage.getItem('prolens_completed_topics');
    
    let dbCount = 0;
    try {
        const db = await openDB();
        if (db.objectStoreNames.contains(STORE_NAME)) {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            
            // Get count
            const countReq = store.count();
            countReq.onsuccess = () => {
                dbCount = countReq.result;
                // Estimating localStorage size
                const lsSize = (msgs?.length || 0) + (topics?.length || 0) + 5000; // rough bytes
                const sizeInMB = lsSize / (1024 * 1024);

                setStats({
                    messageCount: msgs ? JSON.parse(msgs).length : 0,
                    completedTopics: topics ? JSON.parse(topics).length : 0,
                    fileCount: dbCount,
                    estimatedSizeMB: sizeInMB
                });
            };
        }
    } catch (e) {
        console.error("DB Error", e);
    }
  };

  // --- File Checker Logic ---
  const handleCheckFile = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const sizeMB = file.size / (1024 * 1024);
      let status: 'safe' | 'warning' | 'danger' = 'safe';
      let message = 'מעולה! הקובץ מתאים לשימוש (נשמר בדפדפן).';

      if (sizeMB > 25) {
          status = 'danger';
          message = 'הקובץ גדול מדי (מעל 25MB). זה עלול לתקוע את הדפדפן. עדיף להעלות ל-YouTube ולשלוח לינק.';
      } else if (sizeMB > 15) {
          status = 'warning';
          message = 'הקובץ כבד (15MB+). הגיבוי והטעינה יהיו איטיים.';
      }

      setFileCheckResult({
          name: file.name,
          sizeMB,
          status,
          message
      });
  };

  // --- Registration Handling ---
  const sendWelcomeEmail = (reg: Registration) => {
      const subject = "ברוך הבא לקורס הצילום ProLens!";
      const body = `שלום ${reg.fullName},%0D%0A%0D%0Aשמחים שהצטרפת לקורס הצילום שלנו.%0D%0Aמצורף למייל זה קובץ ההפעלה (Launcher) של הקורס.%0D%0Aאנא שמור אותו על שולחן העבודה שלך ולחץ עליו פעמיים כדי להתחיל ללמוד.%0D%0A%0D%0Aבהצלחה!%0D%0Aצוות ProLens`;
      
      // Mark as contacted locally
      const updatedRegs = registrations.map(r => r.id === reg.id ? {...r, status: 'contacted' as const} : r);
      setRegistrations(updatedRegs);
      localStorage.setItem('prolens_registrations', JSON.stringify(updatedRegs));

      window.open(`mailto:${reg.email}?subject=${subject}&body=${body}`);
  };

  const sendWelcomeWhatsApp = (reg: Registration) => {
      // Basic normalization of Israeli numbers
      let phone = reg.phone.replace(/\D/g, ''); // remove non-digits
      if (phone.startsWith('0')) {
          phone = '972' + phone.substring(1);
      }
      
      const message = `שלום ${reg.fullName}! כאן מנהל הקורס ProLens. שמח שהצטרפת אלינו! 📷\n\nכדי להתחיל ללמוד, שלחתי לך את קובץ ההפעלה כאן. שמור אותו במחשב ולחץ פעמיים כדי לפתוח. בהצלחה!`;
      
      // Mark as contacted
      const updatedRegs = registrations.map(r => r.id === reg.id ? {...r, status: 'contacted' as const} : r);
      setRegistrations(updatedRegs);
      localStorage.setItem('prolens_registrations', JSON.stringify(updatedRegs));
      
      const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
      
      alert("חלון הוואטסאפ נפתח. זכור לגרור את קובץ ה-Launcher לתוך הצ'אט כדי לשלוח אותו לתלמיד.");
  };

  const deleteRegistration = (id: string) => {
      if(window.confirm("למחוק נרשם זה?")) {
          const updatedRegs = registrations.filter(r => r.id !== id);
          setRegistrations(updatedRegs);
          localStorage.setItem('prolens_registrations', JSON.stringify(updatedRegs));
      }
  };

  const addManualRegistration = () => {
      if (!manualReg.name || !manualReg.phone) {
          alert('חובה להזין שם וטלפון');
          return;
      }
      const newReg: Registration = {
          id: Date.now().toString(),
          date: new Date().toLocaleDateString('he-IL'),
          fullName: manualReg.name,
          phone: manualReg.phone,
          email: manualReg.email,
          level: 'manual',
          status: 'pending'
      };
      
      const updatedRegs = [...registrations, newReg];
      setRegistrations(updatedRegs);
      localStorage.setItem('prolens_registrations', JSON.stringify(updatedRegs));
      setManualReg({ name: '', phone: '', email: '' });
      setIsAddingManual(false);
      alert('התלמיד נוסף בהצלחה!');
  };

  // --- Launcher Generator ---
  const handleDownloadLauncher = () => {
    // Use the user-defined URL or fallback to current location
    let url = launcherUrl || window.location.href;
    
    const htmlContent = `
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>פותח את קורס ProLens</title>
    <link rel="icon" href="https://cdn-icons-png.flaticon.com/512/3687/3687412.png">
    <style>
        body { 
            background-color: #0f172a; 
            color: white; 
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            justify-center: center; 
            min-height: 100vh; 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            text-align: center;
            margin: 0;
            padding: 20px;
        }
        h2 { margin-bottom: 10px; font-size: 28px; }
        p { color: #94a3b8; margin-bottom: 20px; max-width: 600px; line-height: 1.5; }
        .url-box {
            background: #1e293b;
            padding: 10px;
            border-radius: 8px;
            font-family: monospace;
            color: #38bdf8;
            margin-bottom: 30px;
            border: 1px solid #334155;
            word-break: break-all;
            direction: ltr;
        }
        .btn { 
            background: linear-gradient(135deg, #0891b2 0%, #2563eb 100%); 
            color: white; 
            padding: 20px 50px; 
            text-decoration: none; 
            border-radius: 12px; 
            font-weight: bold; 
            font-size: 20px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
            transition: transform 0.2s;
            display: inline-block;
        }
        .btn:hover { transform: scale(1.05); filter: brightness(1.1); }
        .loader {
            border: 4px solid #1e293b;
            border-top: 4px solid #06b6d4;
            border-radius: 50%;
            width: 50px;
            height: 50px;
            animation: spin 1s linear infinite;
            margin-bottom: 20px;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .help-text { font-size: 14px; margin-top: 40px; color: #64748b; }
    </style>
    <script>
        // Try automatic redirect
        setTimeout(function() {
            window.location.href = "${url}";
        }, 2000);
    </script>
</head>
<body>
    <div class="loader"></div>
    <h2>פותח את מערכת הלמידה...</h2>
    <p>המערכת מנסה להתחבר לכתובת הקורס באופן אוטומטי.</p>
    
    <div class="url-box">${url}</div>
    
    <a href="${url}" class="btn">לחץ כאן לכניסה ידנית לקורס</a>

    <div class="help-text">
        לא נפתח? ייתכן שהקובץ נחסם.<br>
        נסה לפתוח באמצעות דפדפן Google Chrome.<br>
        אם הכתובת למעלה שגויה, אנא צור קשר עם המדריך.
    </div>
</body>
</html>
    `;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'ProLens_Launcher.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Backup Functions ---
  const handleExportBackup = async () => {
      setIsBackingUp(true);
      setBackupSizeMB(null);
      try {
          // 1. Gather Data
          const backupData: any = {
              timestamp: new Date().toISOString(),
              announcement: localStorage.getItem('prolens_announcement'),
              messages: localStorage.getItem('prolens_messages'),
              completedTopics: localStorage.getItem('prolens_completed_topics'),
              registrations: JSON.parse(localStorage.getItem('prolens_registrations') || '[]'), // Fixed: Include registrations
              materials: []
          };

          const db = await openDB();
          if (db.objectStoreNames.contains(STORE_NAME)) {
              const tx = db.transaction(STORE_NAME, 'readonly');
              const store = tx.objectStore(STORE_NAME);
              const request = store.getAll();
              
              await new Promise<void>((resolve, reject) => {
                  request.onsuccess = () => {
                      backupData.materials = request.result;
                      resolve();
                  };
                  request.onerror = () => reject(request.error);
              });
          }

          const jsonString = JSON.stringify(backupData);
          const sizeBytes = new Blob([jsonString]).size;
          const sizeMB = sizeBytes / (1024 * 1024);
          setBackupSizeMB(sizeMB);

          const blob = new Blob([jsonString], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `prolens_backup_${new Date().toISOString().slice(0,10)}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
      } catch (e) {
          console.error("Backup failed", e);
          alert("שגיאה ביצירת הגיבוי.");
      } finally {
          setIsBackingUp(false);
      }
  };

  const handleImportBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      
      const fileSizeMB = file.size / (1024 * 1024);
      if (fileSizeMB > 100) {
          if(!window.confirm(`קובץ הגיבוי גדול מאוד (${fileSizeMB.toFixed(1)}MB) ועלול לגרום לדפדפן להיתקע זמנית (במיוחד בטלפונים). מומלץ להשתמש בקבצים קטנים יותר. האם להמשיך?`)) return;
      }

      setIsRestoring(true);
      const reader = new FileReader();
      
      reader.onerror = () => {
          alert("שגיאה בקריאת הקובץ");
          setIsRestoring(false);
      };

      reader.onload = async (e) => {
          try {
              const content = e.target?.result as string;
              const backupData = JSON.parse(content);

              if (backupData.announcement) localStorage.setItem('prolens_announcement', backupData.announcement);
              if (backupData.messages) localStorage.setItem('prolens_messages', backupData.messages);
              if (backupData.completedTopics) localStorage.setItem('prolens_completed_topics', backupData.completedTopics);
              if (backupData.registrations) {
                  localStorage.setItem('prolens_registrations', JSON.stringify(backupData.registrations)); // Fixed: Restore registrations
                  setRegistrations(backupData.registrations);
              }
              
              const db = await openDB();
              const tx = db.transaction(STORE_NAME, 'readwrite');
              const store = tx.objectStore(STORE_NAME);
              
              await new Promise<void>((resolve, reject) => {
                  const clearReq = store.clear();
                  clearReq.onsuccess = () => resolve();
                  clearReq.onerror = () => reject(clearReq.error);
              });

              if (backupData.materials && Array.isArray(backupData.materials)) {
                  for (const item of backupData.materials) {
                      store.put(item);
                  }
              }
              
              tx.oncomplete = () => {
                  alert("השחזור הושלם בהצלחה! הדף ירוענן כעת.");
                  window.location.reload();
              };

          } catch (err) {
              console.error("Restore failed", err);
              alert("קובץ הגיבוי אינו תקין או גדול מדי לזיכרון הדפדפן.");
              setIsRestoring(false);
          }
      };
      reader.readAsText(file);
  };

  return (
    <div className="flex flex-col gap-8 p-6 md:p-8 bg-slate-950 rounded-xl shadow-2xl h-full overflow-y-auto">
      <div className="flex flex-col md:flex-row items-center justify-between border-b border-slate-800 pb-6 gap-4">
        <div className="flex items-center gap-4">
            <div className="bg-purple-900/30 p-3 rounded-2xl border border-purple-500/20">
                <ShieldIcon className="w-8 h-8 text-purple-400" />
            </div>
            <div>
                <h1 className="text-3xl font-bold text-white tracking-tight">לוח בקרה</h1>
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <p>ניהול מערכת וגיבויים</p>
                    <span>•</span>
                    <button onClick={() => setShowCloudGuide(true)} className="text-amber-400 hover:text-amber-300 underline font-medium">
                        מדריך חיבור לענן (לסנכרון מלא)
                    </button>
                </div>
            </div>
        </div>
        
        <button 
            onClick={handleExportBackup}
            disabled={isBackingUp}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-emerald-900/20 transition-all flex items-center gap-2 text-sm w-full md:w-auto justify-center"
        >
             <DownloadCloudIcon className="w-5 h-5" />
             <span className="hidden sm:inline">גיבוי מהיר</span>
        </button>
      </div>

      {/* Stats Cards - Redesigned */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
           {[
               { label: 'קבצים', value: stats.fileCount, icon: FileTextIcon, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
               { label: 'נרשמים', value: registrations.length, icon: UserIcon, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
               { label: 'מחוברים', value: currentStudent ? 1 : 0, icon: MonitorIcon, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
               { label: 'שטח בשימוש', value: stats.estimatedSizeMB.toFixed(1) + ' MB', icon: DatabaseIcon, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' }
           ].map((stat, idx) => (
               <div key={idx} className={`relative overflow-hidden p-6 rounded-2xl border ${stat.border} ${stat.bg} backdrop-blur-sm transition-all hover:scale-[1.02]`}>
                   <div className="relative z-10">
                       <span className={`text-3xl font-bold text-white block mb-1`}>{stat.value}</span>
                       <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">{stat.label}</span>
                   </div>
                   <stat.icon className={`absolute -bottom-2 -left-2 w-20 h-20 ${stat.color} opacity-10`} />
               </div>
           ))}
      </div>

      {/* Registration Management */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl flex flex-col overflow-hidden">
          <div className="p-6 border-b border-slate-800 flex flex-wrap justify-between items-center bg-slate-900 gap-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-3">
                  <UserIcon className="w-6 h-6 text-cyan-400" />
                  ניהול נרשמים
              </h2>
              <div className="flex gap-2">
                <button 
                    onClick={() => setIsAddingManual(!isAddingManual)}
                    className={`text-sm px-4 py-2 rounded-lg transition-colors flex items-center gap-2 font-medium ${
                        isAddingManual 
                        ? 'bg-slate-800 text-slate-300 hover:text-white' 
                        : 'bg-cyan-600/10 text-cyan-400 hover:bg-cyan-600/20'
                    }`}
                >
                    {isAddingManual ? <XIcon className="w-4 h-4"/> : '+'}
                    {isAddingManual ? 'סגור הוספה' : 'הוספה ידנית'}
                </button>
              </div>
          </div>
          
          <div className={`transition-all duration-300 ease-in-out overflow-hidden bg-slate-800/50 ${isAddingManual ? 'max-h-96 opacity-100 border-b border-slate-700' : 'max-h-0 opacity-0'}`}>
              <form onSubmit={(e) => { e.preventDefault(); addManualRegistration(); }} className="p-6">
                  <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                      <SmartphoneIcon className="w-4 h-4" /> הוספת תלמיד חדש (מהודעה שהתקבלה)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1">
                          <label className="text-xs text-slate-500">שם מלא</label>
                          <input type="text" value={manualReg.name} onChange={e => setManualReg({...manualReg, name: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white text-sm focus:border-cyan-500 focus:outline-none transition-colors" placeholder="ישראל ישראלי" required />
                      </div>
                      <div className="space-y-1">
                          <label className="text-xs text-slate-500">טלפון</label>
                          <input type="text" value={manualReg.phone} onChange={e => setManualReg({...manualReg, phone: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white text-sm focus:border-cyan-500 focus:outline-none transition-colors" placeholder="050-0000000" required />
                      </div>
                      <div className="space-y-1">
                          <label className="text-xs text-slate-500">אימייל (אופציונלי)</label>
                          <input type="text" value={manualReg.email} onChange={e => setManualReg({...manualReg, email: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white text-sm focus:border-cyan-500 focus:outline-none transition-colors" placeholder="student@example.com" />
                      </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                       <button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-lg shadow-cyan-900/20">שמור תלמיד</button>
                  </div>
              </form>
          </div>
          
          <div className="w-full">
              {registrations.length === 0 ? (
                  <div className="p-12 text-center text-slate-500">
                      <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <UserIcon className="w-8 h-8 opacity-40" />
                      </div>
                      <h3 className="text-lg font-medium text-slate-400 mb-2">אין נרשמים עדיין</h3>
                      <p className="text-sm max-w-md mx-auto">האתר פועל ללא שרת. כאשר תלמיד שולח לך הודעת הרשמה ב-WhatsApp, עליך להוסיף אותו כאן ידנית.</p>
                  </div>
              ) : (
                  <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm text-right text-slate-300">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-950/50 border-b border-slate-800">
                                <tr>
                                    <th className="px-6 py-4 font-bold tracking-wider">שם מלא</th>
                                    <th className="px-6 py-4 font-bold tracking-wider">פרטי קשר</th>
                                    <th className="px-6 py-4 font-bold tracking-wider">תאריך</th>
                                    <th className="px-6 py-4 text-center font-bold tracking-wider">סטטוס</th>
                                    <th className="px-6 py-4 text-center font-bold tracking-wider">פעולות</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {registrations.map(reg => (
                                    <tr key={reg.id} className="hover:bg-slate-800/30 transition-colors">
                                        <td className="px-6 py-4 font-medium text-white">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center font-bold text-xs text-slate-300 border border-slate-600">
                                                    {reg.fullName.charAt(0)}
                                                </div>
                                                {reg.fullName}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1.5">
                                                <span className="flex items-center gap-2 text-slate-300"><SmartphoneIcon className="w-3.5 h-3.5 text-slate-500"/> {reg.phone}</span>
                                                {reg.email && <span className="flex items-center gap-2 text-slate-400 text-xs"><MailIcon className="w-3.5 h-3.5 text-slate-600"/> {reg.email}</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-400 text-xs">{reg.date}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                    reg.status === 'contacted' 
                                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]' 
                                                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]'
                                                }`}>
                                                    {reg.status === 'contacted' ? <CheckIcon className="w-3 h-3"/> : <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>}
                                                    {reg.status === 'contacted' ? 'טופל' : 'ממתין'}
                                                </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button onClick={() => sendWelcomeWhatsApp(reg)} className="p-2 bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded-lg transition-all" title="שלח WhatsApp"><SmartphoneIcon className="w-4 h-4"/></button>
                                                <button onClick={() => sendWelcomeEmail(reg)} className="p-2 bg-blue-600/10 text-blue-400 hover:bg-blue-600 hover:text-white rounded-lg transition-all" title="שלח Email"><MailIcon className="w-4 h-4"/></button>
                                                <div className="w-px h-4 bg-slate-700 mx-1"></div>
                                                <button onClick={() => deleteRegistration(reg.id)} className="p-2 bg-slate-800 text-slate-500 hover:bg-red-900/30 hover:text-red-400 rounded-lg transition-all" title="מחק"><TrashIcon className="w-4 h-4"/></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                  </div>
              )}
          </div>
      </div>

      {/* Control Center Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg hover:border-slate-700 transition-colors">
                  <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                      <FileTextIcon className="w-5 h-5 text-amber-400" />
                      בודק תאימות קבצים
                  </h2>
                  <p className="text-sm text-slate-400 mb-5">לפני העלאת קבצים כבדים (וידאו/אודיו), בדוק אם הם מתאימים לדפדפן.</p>
                  <div className="flex gap-3">
                        <button onClick={() => checkInputRef.current?.click()} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 rounded-xl font-medium border border-slate-700 transition-colors text-sm whitespace-nowrap">בחר קובץ לבדיקה</button>
                        <input type="file" ref={checkInputRef} onChange={handleCheckFile} className="hidden" />
                  </div>
                  {fileCheckResult && (
                      <div className={`mt-4 p-4 rounded-xl border flex items-start gap-4 w-full animate-fade-in ${fileCheckResult.status === 'safe' ? 'bg-emerald-950/30 border-emerald-500/30' : fileCheckResult.status === 'warning' ? 'bg-amber-950/30 border-amber-500/30' : 'bg-red-950/30 border-red-500/30'}`}>
                          <div className={`p-2 rounded-full shrink-0 ${fileCheckResult.status === 'safe' ? 'bg-emerald-500/20 text-emerald-400' : fileCheckResult.status === 'warning' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
                              {fileCheckResult.status === 'safe' ? <CheckIcon className="w-5 h-5" /> : <XIcon className="w-5 h-5" />}
                          </div>
                          <div>
                              <div className="font-bold text-white text-sm mb-1">{fileCheckResult.name} ({fileCheckResult.sizeMB.toFixed(1)} MB)</div>
                              <div className={`text-xs leading-relaxed ${fileCheckResult.status === 'safe' ? 'text-emerald-400' : fileCheckResult.status === 'warning' ? 'text-amber-400' : 'text-red-300'}`}>{fileCheckResult.message}</div>
                          </div>
                      </div>
                  )}
              </div>

              <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-800 p-6 rounded-2xl relative overflow-hidden group hover:border-emerald-500/30 transition-colors shadow-lg">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                  <div className="flex justify-between items-start mb-6 relative z-10">
                    <h2 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
                        <DatabaseIcon className="w-5 h-5" />
                        גיבוי ושחזור מערכת
                    </h2>
                    <button onClick={() => setShowHelpModal(true)} className="text-slate-500 hover:text-white transition-colors bg-slate-800/50 p-1.5 rounded-lg"><HelpCircleIcon className="w-5 h-5" /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-4 relative z-10">
                      <button onClick={handleExportBackup} disabled={isBackingUp} className="bg-slate-950/50 hover:bg-slate-900 text-emerald-300 border border-slate-700/50 hover:border-emerald-500/50 p-4 rounded-xl flex flex-col items-center justify-center gap-2 transition-all text-center group/btn">
                          {isBackingUp ? <span className="animate-pulse text-xs">מעבד...</span> : <><DownloadCloudIcon className="w-6 h-6 mb-1 group-hover/btn:scale-110 transition-transform" /><span className="font-bold text-sm">שמור גיבוי</span><span className="text-[10px] text-slate-500">Export</span></>}
                      </button>
                      <button onClick={() => fileInputRef.current?.click()} disabled={isRestoring} className="bg-slate-950/50 hover:bg-slate-900 text-blue-300 border border-slate-700/50 hover:border-blue-500/50 p-4 rounded-xl flex flex-col items-center justify-center gap-2 transition-all text-center group/btn">
                          {isRestoring ? <span className="animate-pulse text-xs">טוען...</span> : <><UploadCloudIcon className="w-6 h-6 mb-1 group-hover/btn:scale-110 transition-transform" /><span className="font-bold text-sm">טען גיבוי</span><span className="text-[10px] text-slate-500">Import</span></>}
                      </button>
                      <input type="file" accept=".json" ref={fileInputRef} onChange={handleImportBackup} className="hidden" />
                  </div>
              </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-lg flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
              <div>
                  <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2"><MonitorIcon className="w-6 h-6 text-indigo-400" /> קובץ כניסה לקורס (Launcher)</h2>
                  <p className="text-sm text-slate-400 mb-6 leading-relaxed">זהו הקובץ שאתה שולח לתלמידים. הקובץ מכיל "קיצור דרך" חכם שפותח את הדפדפן ישירות באתר שלך.</p>
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 mb-6 font-mono text-xs text-slate-300 break-all relative group">
                      <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1 block">כתובת יעד (URL)</label>
                      <input type="text" value={launcherUrl} onChange={(e) => setLauncherUrl(e.target.value)} className="bg-transparent border-none w-full text-indigo-300 focus:ring-0 p-0 font-mono text-sm" spellCheck={false}/>
                  </div>
              </div>
              <button onClick={handleDownloadLauncher} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-xl font-bold shadow-lg shadow-indigo-900/30 transition-all flex items-center justify-center gap-3 hover:translate-y-[-2px]">
                  <DownloadCloudIcon className="w-5 h-5" /> הורד קובץ HTML לשליחה
              </button>
          </div>
      </div>

      {/* Cloud Help Modal */}
      {showCloudGuide && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
              <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-8 shadow-2xl relative overflow-y-auto max-h-[90vh]">
                  <button onClick={() => setShowCloudGuide(false)} className="absolute top-4 left-4 text-slate-400 hover:text-white"><XIcon className="w-6 h-6" /></button>
                  <div className="text-center mb-6">
                      <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-500/20"><DatabaseIcon className="w-8 h-8 text-amber-400" /></div>
                      <h2 className="text-2xl font-bold text-white">חיבור המערכת לענן (Firebase)</h2>
                      <p className="text-slate-400 text-sm mt-2">כדי שכולם יראו את הקבצים שהמנהל מעלה, צריך להגדיר מפתחות גישה.</p>
                  </div>
                  <div className="space-y-4 text-right text-slate-300 text-sm">
                      <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                          <h3 className="font-bold text-white mb-2 text-base">שלב 1: יצירת פרויקט</h3>
                          <p>היכנס ל- <a href="https://console.firebase.google.com/" target="_blank" className="text-cyan-400 underline">Firebase Console</a> וצור פרויקט חדש.</p>
                      </div>
                      <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                          <h3 className="font-bold text-white mb-2 text-base">שלב 2: הגדרת Web App</h3>
                          <p>צור אפליקציית Web (סמל <code>&lt;/&gt;</code>). בסוף תקבל קוד <code>firebaseConfig</code>.</p>
                      </div>
                      <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                          <h3 className="font-bold text-white mb-2 text-base">שלב 3: הפעלת שירותים</h3>
                          <p>הפעל את <strong>Firestore Database</strong> ואת <strong>Storage</strong> במצב <strong>Test Mode</strong>.</p>
                      </div>
                      <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 border-l-4 border-l-cyan-500">
                          <h3 className="font-bold text-white mb-2 text-base">שלב 4: הדבקת הקוד</h3>
                          <p>פתח את הקובץ <code>services/firebase.ts</code> והדבק את המפתחות במקום המתאים.</p>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Help Modal */}
      {showHelpModal && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
              <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl max-w-lg w-full relative shadow-2xl">
                  <button onClick={() => setShowHelpModal(false)} className="absolute top-4 left-4 text-slate-400 hover:text-white transition-colors"><XIcon className="w-6 h-6" /></button>
                  <h3 className="text-2xl font-bold text-white mb-6">הנחיות לגבי גודל קבצים</h3>
                  <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
                      <p>האתר עובד בטכנולוגיית Client-Side (ללא שרת), ולכן כל הקבצים נשמרים בדפדפן המקומי.</p>
                      <ul className="space-y-2">
                          <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-2 shrink-0"></span><span><strong>תמונות:</strong> מומלץ עד 2MB לתמונה.</span></li>
                          <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-2 shrink-0"></span><span><strong>אודיו/וידאו:</strong> מומלץ עד 15MB לקובץ.</span></li>
                          <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-2 shrink-0"></span><span><strong>גיבוי מלא:</strong> מומלץ שסך כל הגיבוי לא יעלה על 50-100MB כדי להבטיח טעינה חלקה.</span></li>
                      </ul>
                      <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl mt-6">
                          <p className="text-amber-400 font-bold text-xs mb-1 uppercase tracking-wider">טיפ מקצועי</p>
                          <p className="text-xs text-amber-100/80">אם יש לך סרטונים ארוכים (מעל 15 מגה), העלה אותם ל-YouTube ושלח לתלמיד לינק בצ'אט, במקום להכביד על המערכת.</p>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default AdminDashboard;
