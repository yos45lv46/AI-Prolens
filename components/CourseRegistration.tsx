
import React, { useState, useEffect, useRef } from 'react';
import { CheckIcon, CameraIcon, SunIcon, MountainIcon, LightbulbIcon, UploadIcon, FileTextIcon, TrashIcon, DownloadIcon, EyeIcon, XIcon } from './Icons';

interface PresentationDoc {
  id: string;
  name: string;
  type: string;
  date: string;
  content: string; // Base64
}

// --- IndexedDB Logic for Large Files ---
const DB_NAME = 'ProLensContentDB';
const STORE_NAME = 'presentations';
const DB_VERSION = 2; // Bumped version to fix schema sync issues

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

const saveToDB = async (doc: PresentationDoc) => {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(doc);
    return new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

const deleteFromDB = async (id: string) => {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    return new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

const getAllFromDB = async (): Promise<PresentationDoc[]> => {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result as PresentationDoc[]);
        request.onerror = () => reject(request.error);
    });
};

const CourseRegistration: React.FC = () => {
  const [presentations, setPresentations] = useState<PresentationDoc[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<PresentationDoc | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load saved presentations on mount from IndexedDB
  useEffect(() => {
    const loadData = async () => {
        try {
            const docs = await getAllFromDB();
            setPresentations(docs);
        } catch (e) {
            console.error("Failed to load presentations from DB", e);
        }
    };
    loadData();
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

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      alert("הקובץ גדול מדי (מקסימום 50MB למצגת)");
      return;
    }

    setIsUploading(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
          const content = e.target?.result as string;
          const newDoc: PresentationDoc = {
            id: Date.now().toString(),
            name: file.name,
            type: file.type,
            date: new Date().toLocaleDateString('he-IL'),
            content: content
          };
          
          await saveToDB(newDoc);
          setPresentations(prev => [...prev, newDoc]);
      } catch (err) {
          console.error("Error saving file", err);
          alert("שגיאה בשמירת הקובץ. ייתכן שהדיסק מלא.");
      } finally {
          setIsUploading(false);
      }
    };
    
    reader.onerror = () => {
        alert("שגיאה בקריאת הקובץ.");
        setIsUploading(false);
    };

    reader.readAsDataURL(file);
    
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("האם להסיר מצגת זו?")) {
      try {
          await deleteFromDB(id);
          setPresentations(prev => prev.filter(p => p.id !== id));
      } catch (e) {
          alert("שגיאה במחיקת הקובץ");
      }
    }
  };

  const canPreview = (mimeType: string) => {
      return mimeType.startsWith('image/') || mimeType === 'application/pdf';
  };

  return (
    <div className="flex flex-col gap-8 p-6 bg-slate-900 rounded-xl shadow-2xl h-full overflow-y-auto custom-scrollbar relative">
      
      {/* Course Intro Header */}
      <div className="text-center space-y-4 pb-8 border-b border-slate-800">
          <h1 className="text-4xl md:text-5xl font-bold text-white bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-400">
              ProLens Masterclass
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
              סילבוס הקורס המלא: תוכנית הלימודים המקיפה לצילום DSLR מקצועי.
          </p>
      </div>

      {/* Course Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-cyan-500 transition-colors group">
              <CameraIcon className="w-10 h-10 text-cyan-400 mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-lg font-bold text-white mb-2">מודול 1: יסודות החשיפה</h3>
              <p className="text-slate-400 text-sm">שליטה מלאה במצב ידני (Manual Mode): צמצם, תריס ו-ISO. תרגול בסימולטור ייחודי.</p>
          </div>
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-purple-500 transition-colors group">
              <MountainIcon className="w-10 h-10 text-purple-400 mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-lg font-bold text-white mb-2">מודול 2: קומפוזיציה</h3>
              <p className="text-slate-400 text-sm">חוק השלישים, הולכת עין, מסגור טבעי ושימוש בצבעים ליצירת תמונות עוצרות נשימה.</p>
          </div>
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-amber-500 transition-colors group">
              <SunIcon className="w-10 h-10 text-amber-400 mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-lg font-bold text-white mb-2">מודול 3: תאורה ואווירה</h3>
              <p className="text-slate-400 text-sm">הבנת האור הטבעי והמלאכותי. צילום בשעת הזהב, שימוש בפלאש ועיצוב תאורה דרמטי.</p>
          </div>
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-emerald-500 transition-colors group">
              <LightbulbIcon className="w-10 h-10 text-emerald-400 mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-lg font-bold text-white mb-2">מודול 4: פיתוח סגנון</h3>
              <p className="text-slate-400 text-sm">צילום פורטרטים, נופים, ומקרו. פיתוח שפה צילומית אישית וביקורת עבודות.</p>
          </div>
      </div>

      {/* Presentations & Syllabus Import Section */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <FileTextIcon className="w-6 h-6 text-indigo-400" />
                מצגות וחומרי העשרה
            </h2>
            <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded-full">
                {presentations.length} קבצים זמינים
            </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Upload Area */}
            <div 
                onClick={() => !isUploading && fileInputRef.current?.click()}
                className={`
                    border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all min-h-[200px] group
                    ${isUploading 
                        ? 'bg-slate-800 border-slate-600 cursor-wait' 
                        : 'bg-slate-800/50 border-slate-600 hover:border-indigo-500 hover:bg-slate-800'}
                `}
            >
                {isUploading ? (
                    <div className="flex flex-col items-center animate-pulse">
                        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                        <h3 className="font-bold text-white">מעלה קובץ...</h3>
                        <p className="text-slate-400 text-sm">אנא המתן, זה עשוי לקחת רגע</p>
                    </div>
                ) : (
                    <>
                        <div className="bg-slate-700 p-4 rounded-full mb-4 group-hover:bg-indigo-500/20 transition-colors">
                            <UploadIcon className="w-8 h-8 text-slate-400 group-hover:text-indigo-400" />
                        </div>
                        <h3 className="font-bold text-white text-lg mb-1">העלאת מצגת / סילבוס</h3>
                        <p className="text-slate-400 text-sm text-center">לחץ לבחירת קובץ PDF או תמונה<br/>(עד 50MB לקובץ)</p>
                    </>
                )}
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    accept=".pdf,.jpg,.jpeg,.png,.ppt,.pptx" 
                    disabled={isUploading}
                    className="hidden" 
                />
            </div>

            {/* Display Area */}
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {presentations.length === 0 ? (
                    <div className="col-span-full flex flex-col items-center justify-center text-slate-500 py-10 border border-slate-800 rounded-xl bg-slate-900/50">
                        <FileTextIcon className="w-12 h-12 mb-3 opacity-20" />
                        <p>טרם הועלו מצגות לקורס.</p>
                    </div>
                ) : (
                    presentations.map(doc => (
                        <div key={doc.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 hover:border-slate-600 flex flex-col justify-between group relative overflow-hidden">
                            <div className="flex items-start justify-between mb-3 relative z-10">
                                <div className="p-2 bg-indigo-500/10 rounded-lg">
                                    <FileTextIcon className="w-6 h-6 text-indigo-400" />
                                </div>
                                <div className="flex gap-1">
                                    {canPreview(doc.type) && (
                                        <button 
                                            onClick={() => setViewingDoc(doc)}
                                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                                            title="צפה בקובץ"
                                        >
                                            <EyeIcon className="w-4 h-4" />
                                        </button>
                                    )}
                                    <a 
                                        href={doc.content} 
                                        download={doc.name}
                                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                                        title="הורד קובץ"
                                    >
                                        <DownloadIcon className="w-4 h-4" />
                                    </a>
                                    <button 
                                        onClick={() => handleDelete(doc.id)}
                                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
                                        title="מחק (ניהול)"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            
                            <div className="relative z-10">
                                <h4 className="font-bold text-slate-200 text-sm truncate mb-1" title={doc.name}>{doc.name}</h4>
                                <div className="flex justify-between items-center text-xs text-slate-500">
                                    <span>{doc.date}</span>
                                    <span className="uppercase">{doc.type.split('/')[1] || 'FILE'}</span>
                                </div>
                            </div>

                            {/* Preview Background Effect */}
                            {doc.type.startsWith('image/') && (
                                <img src={doc.content} alt="" className="absolute inset-0 w-full h-full object-cover opacity-10 pointer-events-none group-hover:opacity-20 transition-opacity" />
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
      </div>

      {/* Benefits & Outcomes */}
      <div className="bg-slate-800/50 rounded-2xl p-8 border border-slate-700">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">מטרות הקורס</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                      <div className="bg-cyan-500/20 p-1 rounded mt-1"><CheckIcon className="w-4 h-4 text-cyan-400" /></div>
                      <span className="text-slate-300">הקניית ביטחון מלא בתפעול המצלמה בכל תנאי תאורה.</span>
                  </li>
                  <li className="flex items-start gap-3">
                      <div className="bg-cyan-500/20 p-1 rounded mt-1"><CheckIcon className="w-4 h-4 text-cyan-400" /></div>
                      <span className="text-slate-300">פיתוח יכולת ניתוח וביקורת עצמית מקצועית.</span>
                  </li>
                  <li className="flex items-start gap-3">
                      <div className="bg-cyan-500/20 p-1 rounded mt-1"><CheckIcon className="w-4 h-4 text-cyan-400" /></div>
                      <span className="text-slate-300">בניית תיק עבודות מגוון ומקצועי.</span>
                  </li>
                  <li className="flex items-start gap-3">
                      <div className="bg-cyan-500/20 p-1 rounded mt-1"><CheckIcon className="w-4 h-4 text-cyan-400" /></div>
                      <span className="text-slate-300">שימוש בכלי AI מתקדמים לשיפור הלמידה.</span>
                  </li>
              </ul>
              <div className="relative rounded-lg overflow-hidden h-48 md:h-64 border border-slate-700 shadow-lg">
                 <img src="https://picsum.photos/seed/camera/800/600" alt="Camera Lens" className="absolute inset-0 w-full h-full object-cover opacity-90" />
                 <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent"></div>
                 <div className="absolute bottom-4 right-4 text-white font-bold bg-black/50 px-3 py-1 rounded backdrop-blur-sm">למידה מעשית</div>
              </div>
          </div>
      </div>

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

export default CourseRegistration;
