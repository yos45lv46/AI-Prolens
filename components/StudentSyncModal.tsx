
import React, { useState, useRef } from 'react';
import { DownloadCloudIcon, UploadCloudIcon, XIcon, RefreshCwIcon, SmartphoneIcon, MonitorIcon } from './Icons';

interface StudentSyncModalProps {
  onClose: () => void;
}

// IndexedDB Helper (duplicated here to keep component self-contained)
const DB_NAME = 'ProLensDB';
const STORE_NAME = 'materials';
const DB_VERSION = 2;

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

const StudentSyncModal: React.FC<StudentSyncModalProps> = ({ onClose }) => {
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setIsBackingUp(true);
    try {
        const syncData: any = {
            timestamp: new Date().toISOString(),
            profile: localStorage.getItem('prolens_student_profile'),
            messages: localStorage.getItem('prolens_messages'),
            completedTopics: localStorage.getItem('prolens_completed_topics'),
            // We export local registration data if exists
            myRegistration: localStorage.getItem('prolens_my_registration'),
            materials: []
        };

        const db = await openDB();
        if (db.objectStoreNames.contains(STORE_NAME)) {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.getAll();
            
            await new Promise<void>((resolve, reject) => {
                request.onsuccess = () => {
                    syncData.materials = request.result;
                    resolve();
                };
                request.onerror = () => reject(request.error);
            });
        }

        const jsonString = JSON.stringify(syncData);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `prolens_sync_${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        alert("הקובץ ירד בהצלחה!\nכעת שלח אותו לעצמך (בוואטסאפ או במייל) ופתח אותו במכשיר השני.");
    } catch (e) {
        console.error("Backup failed", e);
        alert("שגיאה ביצירת קובץ הסנכרון.");
    } finally {
        setIsBackingUp(false);
    }
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if(!window.confirm("שים לב: פעולה זו תדרוס את הנתונים הנוכחיים במכשיר זה ותחליף אותם בנתונים מהקובץ. האם להמשיך?")) {
        return;
    }

    setIsRestoring(true);
    const reader = new FileReader();
    
    reader.onload = async (e) => {
        try {
            const content = e.target?.result as string;
            const syncData = JSON.parse(content);

            if (syncData.profile) localStorage.setItem('prolens_student_profile', syncData.profile);
            if (syncData.messages) localStorage.setItem('prolens_messages', syncData.messages);
            if (syncData.completedTopics) localStorage.setItem('prolens_completed_topics', syncData.completedTopics);
            if (syncData.myRegistration) localStorage.setItem('prolens_my_registration', syncData.myRegistration);
            
            // Also restore role to student if missing
            localStorage.setItem('prolens_user_role', 'student');

            const db = await openDB();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            
            await new Promise<void>((resolve, reject) => {
                const clearReq = store.clear();
                clearReq.onsuccess = () => resolve();
                clearReq.onerror = () => reject(clearReq.error);
            });

            if (syncData.materials && Array.isArray(syncData.materials)) {
                for (const item of syncData.materials) {
                    store.put(item);
                }
            }
            
            tx.oncomplete = () => {
                alert("הסנכרון הושלם בהצלחה! הדף ירוענן כעת.");
                window.location.reload();
            };

        } catch (err) {
            console.error("Restore failed", err);
            alert("קובץ הסנכרון אינו תקין.");
            setIsRestoring(false);
        }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-lg w-full relative overflow-hidden">
        <button onClick={onClose} className="absolute top-4 left-4 text-slate-400 hover:text-white transition-colors z-10">
            <XIcon className="w-6 h-6" />
        </button>

        <div className="p-8 text-center">
            <div className="w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <RefreshCwIcon className="w-8 h-8 text-cyan-400" />
            </div>
            
            <h2 className="text-2xl font-bold text-white mb-2">סנכרון בין מכשירים</h2>
            <p className="text-slate-400 text-sm mb-8 leading-relaxed max-w-sm mx-auto">
                האתר שומר את הלמידה שלך בדפדפן. כדי לעבור בין מחשב לטלפון, הורד את הקובץ כאן וטען אותו במכשיר השני.
            </p>

            <div className="grid grid-cols-1 gap-4">
                {/* Export Button */}
                <button 
                    onClick={handleExport}
                    disabled={isBackingUp}
                    className="group relative bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-cyan-500 p-4 rounded-xl flex items-center gap-4 transition-all text-right"
                >
                    <div className="bg-cyan-500/10 p-3 rounded-lg group-hover:bg-cyan-500/20">
                        <MonitorIcon className="w-6 h-6 text-cyan-400" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-bold text-white mb-0.5">אני עוזב מכשיר זה</h3>
                        <p className="text-xs text-slate-400">הורד קובץ גיבוי ושמור אותו</p>
                    </div>
                    <DownloadCloudIcon className="w-5 h-5 text-slate-500 group-hover:text-white" />
                </button>

                {/* Import Button */}
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isRestoring}
                    className="group relative bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-purple-500 p-4 rounded-xl flex items-center gap-4 transition-all text-right"
                >
                    <div className="bg-purple-500/10 p-3 rounded-lg group-hover:bg-purple-500/20">
                        <SmartphoneIcon className="w-6 h-6 text-purple-400" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-bold text-white mb-0.5">הגעתי למכשיר חדש</h3>
                        <p className="text-xs text-slate-400">טען את הקובץ ששמרת</p>
                    </div>
                    <UploadCloudIcon className="w-5 h-5 text-slate-500 group-hover:text-white" />
                </button>
            </div>

            <input 
                type="file" 
                accept=".json" 
                ref={fileInputRef}
                onChange={handleImport}
                className="hidden" 
            />
            
            <p className="text-[10px] text-slate-500 mt-6">
                טיפ: שלח את הקובץ לעצמך בוואטסאפ כדי לפתוח אותו בקלות בטלפון.
            </p>
        </div>
      </div>
    </div>
  );
};

export default StudentSyncModal;
