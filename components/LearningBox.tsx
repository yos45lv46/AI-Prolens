
import React, { useState, useRef, useEffect } from 'react';
import { LearningMaterial, Message, QuizQuestion } from '../types';
import { analyzeLearningMaterials, generateQuizQuestion } from '../services/geminiService';
import { 
    isFirebaseConfigured, 
    subscribeToMaterials, 
    uploadFileToCloud, 
    addMaterialToCloud, 
    deleteMaterialFromCloud, 
    updateMaterialAnalysis 
} from '../services/firebase';
import { UploadIcon, TrashIcon, BookIcon, SendIcon, FileTextIcon, ImageIcon, UserIcon, MountainIcon, SunIcon, BuildingIcon, FlowerIcon, CheckIcon, HeadphonesIcon, VideoIcon, InfoIcon, EyeIcon, XIcon, TypeIcon, PaletteIcon, CameraIcon, SparklesIcon, RefreshCwIcon, DatabaseIcon, ShieldIcon } from './Icons';

// --- IndexedDB Fallback Logic (For when Cloud is OFF) ---
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

const saveMaterialToLocalDB = async (material: LearningMaterial): Promise<void> => {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(material);
    return new Promise((resolve) => { tx.oncomplete = () => resolve(); });
};

const deleteMaterialFromLocalDB = async (id: string): Promise<void> => {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    return new Promise((resolve) => { tx.oncomplete = () => resolve(); });
};
// ---------------------------------------------------------

const SimpleFormat = ({ text }: { text: string }) => {
  const parts = text.split(/(\*\*.*?\*\*)/);
  return (
    <div className="whitespace-pre-wrap" dir="auto">
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={index} className="font-bold text-purple-300">{part.slice(2, -2)}</strong>;
        }
        return part;
      })}
    </div>
  );
};

// Reader formatted component that respects themes
const ReaderContent = ({ text, theme }: { text: string, theme: 'dark' | 'light' | 'sepia' }) => {
  const parts = text.split(/(\*\*.*?\*\*)/);
  const boldColor = theme === 'dark' ? 'text-purple-300' : theme === 'sepia' ? 'text-amber-900 font-extrabold' : 'text-purple-700';
  
  return (
    <div className="whitespace-pre-wrap leading-relaxed" dir="auto">
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={index} className={`font-bold ${boldColor}`}>{part.slice(2, -2)}</strong>;
        }
        return part;
      })}
    </div>
  );
};

const TOPICS = [
  {
    id: 'dslr-structure',
    title: 'מבנה המצלמה',
    description: 'חיישן, מראה, תריס ועינית אופטית.',
    icon: CameraIcon,
    color: 'bg-indigo-500',
    textColor: 'text-indigo-400',
    prompt: 'אנא למד אותי על המבנה הפנימי של מצלמת DSLR. הסבר על מסלול האור מהעדשה לחיישן, תפקיד המראה והפריזמה, וכיצד עובד התריס המכני. השווה בקצרה למצלמות Mirrorless.',
    assignmentPrompt: 'אני מעלה תמונה של המצלמה שלי או שרטוט. אנא עזור לי לזהות את החלקים השונים (ביונט, מראה, חיישן, עינית).',
    quizPrompt: 'צור שאלת ידע אחת בסגנון אמריקאי על מבנה מצלמת DSLR (למשל על תפקיד המראה או התריס).'
  },
  {
    id: 'portrait',
    title: 'צילום פורטרטים',
    description: 'טכניקות לתאורה, העמדה, ועדשות.',
    icon: UserIcon,
    color: 'bg-pink-500',
    textColor: 'text-pink-400',
    prompt: 'אנא למד אותי על צילום פורטרטים. התייחס לבחירת עדשה (אורך מוקד), שליטה בעומק שדה, סוגי תאורה (רכה/קשה), וכיצד להחמיא למצולם.',
    assignmentPrompt: 'אלו תמונות הפורטרט שצילמתי למטלה. אנא תן לי משוב על התאורה, זווית הצילום והבעת המצולם.',
    quizPrompt: 'צור שאלת ידע אחת בסגנון אמריקאי על צילום פורטרטים (למשל על אורך מוקד מומלץ או מיקום פוקוס).'
  },
  {
    id: 'landscape',
    title: 'צילום נופים',
    description: 'קומפוזיציה, שעת הזהב ושימוש בפילטרים.',
    icon: MountainIcon,
    color: 'bg-emerald-500',
    textColor: 'text-emerald-400',
    prompt: 'אנא למד אותי על צילום נופים. התייחס לשימוש בצמצם סגור לעומק שדה רחב, חשיבות החצובה, שעת הזהב/הכחולה, וקומפוזיציה.',
    assignmentPrompt: 'אלו תמונות הנוף שצילמתי. אנא בדוק את הקומפוזיציה, החשיפה והשימוש בעומק שדה.',
    quizPrompt: 'צור שאלת ידע אחת בסגנון אמריקאי על צילום נופים (למשל על חוק השלישים או שימוש בחצובה).'
  },
  {
    id: 'lighting',
    title: 'שימוש בתאורה',
    description: 'תאורה טבעית, מלאכותית וכיווניות.',
    icon: SunIcon,
    color: 'bg-amber-500',
    textColor: 'text-amber-400',
    prompt: 'אנא למד אותי על עקרונות התאורה בצילום. התייחס לכיוון האור, איכות האור (רך/קשה), טמפרטורת צבע, ושימוש במודיפיירים בסיסיים.',
    assignmentPrompt: 'הנה תרגול התאורה שלי. האם הצלחתי ליצור את האווירה הרצויה? איך השימוש בצללים?',
    quizPrompt: 'צור שאלת ידע אחת בסגנון אמריקאי על תאורה בצילום (למשל על ההבדל בין אור רך לאור קשה).'
  },
  {
    id: 'architecture',
    title: 'צילום ארכיטקטורה',
    description: 'קווים ישרים, פרספקטיבה ואור.',
    icon: BuildingIcon,
    color: 'bg-blue-500',
    textColor: 'text-blue-400',
    prompt: 'אנא למד אותי על צילום ארכיטקטורה. התייחס ליישור קווים אנכיים, שימוש בעדשות רחבות, מציאת זוויות מעניינות, והתמודדות עם טווח דינמי גבוה.',
    assignmentPrompt: 'אלו צילומי הארכיטקטורה שלי. אנא בדוק אם הקווים ישרים ואם הפרספקטיבה מחמיאה למבנה.',
    quizPrompt: 'צור שאלת ידע אחת בסגנון אמריקאי על צילום ארכיטקטורה (למשל על עיוותי פרספקטיבה).'
  },
  {
    id: 'macro',
    title: 'צילום מקרו',
    description: 'העולם הקטן: פוקוס, חדות והגדלה.',
    icon: FlowerIcon,
    color: 'bg-teal-500',
    textColor: 'text-teal-400',
    prompt: 'אנא למד אותי על צילום מקרו. התייחס לציוד נדרש (עדשות/טבעות הארכה), אתגרי הפוקוס ועומק השדה הרדוד, ושימוש בתאורה מלאכותית במקרו.',
    assignmentPrompt: 'הנה צילומי המקרו שלי. האם הפוקוס מדויק? האם הרקע מבודד מספיק?',
    quizPrompt: 'צור שאלת ידע אחת בסגנון אמריקאי על צילום מקרו (למשל על עומק שדה רדוד).'
  }
];

const DEFAULT_MESSAGE: Message = { 
  id: '1', 
  role: 'model', 
  text: 'שלום! זוהי תיבת הלמידה. כאן תוכל ללמוד נושאים חדשים, להעלות קבצי השראה, או להגיש מטלות צילום לבדיקה.' 
};

interface LearningBoxProps {
    userRole: 'student' | 'admin' | null;
}

const LearningBox: React.FC<LearningBoxProps> = ({ userRole }) => {
  const [materials, setMaterials] = useState<LearningMaterial[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<'library' | 'chat'>('library');

  // Status for saving process
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Reader Mode State
  const [readingMaterial, setReadingMaterial] = useState<LearningMaterial | null>(null);
  const [readerFontSize, setReaderFontSize] = useState<'sm' | 'base' | 'lg' | 'xl'>('base');
  const [readerTheme, setReaderTheme] = useState<'dark' | 'light' | 'sepia'>('dark');

  // Quiz State
  const [activeQuiz, setActiveQuiz] = useState<{ topicId: string, question: QuizQuestion } | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizFeedback, setQuizFeedback] = useState<'correct' | 'incorrect' | null>(null);

  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === 'undefined') return [DEFAULT_MESSAGE];
    try {
      const saved = localStorage.getItem('prolens_messages');
      return saved ? JSON.parse(saved) : [DEFAULT_MESSAGE];
    } catch (e) { return [DEFAULT_MESSAGE]; }
  });

  const [completedTopics, setCompletedTopics] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem('prolens_completed_topics');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeAssignmentTopic, setActiveAssignmentTopic] = useState<string | null>(null);
  const [isCloudConfigured, setIsCloudConfigured] = useState(false);
  const [showCloudHelp, setShowCloudHelp] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const assignmentInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Load materials
  useEffect(() => {
    const configured = isFirebaseConfigured();
    setIsCloudConfigured(configured);

    if (configured) {
        // Cloud Mode: Subscribe to real-time updates
        const unsubscribe = subscribeToMaterials((fetchedMaterials) => {
            setMaterials(fetchedMaterials);
        });
        return () => unsubscribe();
    } else {
        // Local Mode: Load from IndexedDB
        const loadLocalMaterials = async () => {
             try {
                 const db = await openDB();
                 const tx = db.transaction(STORE_NAME, 'readonly');
                 const store = tx.objectStore(STORE_NAME);
                 const request = store.getAll();
                 request.onsuccess = () => {
                     setMaterials(request.result as LearningMaterial[]);
                 };
             } catch (e) { console.error("DB load error", e); }
        };
        loadLocalMaterials();
    }
  }, []);

  // Save messages to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem('prolens_messages', JSON.stringify(messages));
    } catch (e) {
      console.error("Storage full - messages", e);
    }
  }, [messages]);

  // Save topics to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem('prolens_completed_topics', JSON.stringify(completedTopics));
    } catch (e) {
      console.error("Storage full - topics", e);
    }
  }, [completedTopics]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeTab]);

  const markMaterialsAsAnalyzed = async (materialsToMark: LearningMaterial[]) => {
      if (isCloudConfigured) {
          for (const m of materialsToMark) {
              if (!m.isAnalyzed) await updateMaterialAnalysis(m.id, true);
          }
      } else {
          // Local mode - update in state and DB
          const updated = materials.map(m => {
              if (materialsToMark.some(tm => tm.id === m.id)) return { ...m, isAnalyzed: true };
              return m;
          });
          setMaterials(updated);
          for (const m of materialsToMark) {
              await saveMaterialToLocalDB({...m, isAnalyzed: true});
          }
      }
  };

  const handleResetProgress = async () => {
    if (window.confirm("פעולה זו תמחק את היסטוריית הצ'אט שלך.")) {
      localStorage.removeItem('prolens_messages');
      localStorage.removeItem('prolens_completed_topics');
      setMessages([DEFAULT_MESSAGE]);
      setCompletedTopics([]);
      
      // If local mode, also offer to clear files
      if (!isCloudConfigured && window.confirm("האם למחוק גם את כל הקבצים המקומיים?")) {
          const db = await openDB();
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).clear();
          setMaterials([]);
      }
    }
  };

  const toggleTopicCompletion = (id: string) => {
    setCompletedTopics(prev => 
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  // Helper to read file as Base64 (for Local Mode)
  const readFileAsBase64 = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
      });
  };

  const processFiles = async (files: File[], isAssignment = false) => {
    setSaveStatus('saving');
    let hasError = false;
    const newMaterials: LearningMaterial[] = [];

    for (const file of files) {
      try {
        let materialData: any;

        if (isCloudConfigured) {
            // Cloud Upload
            const downloadURL = await uploadFileToCloud(file);
            materialData = {
                name: file.name,
                type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio' : file.type.startsWith('video/') ? 'video' : 'text',
                content: downloadURL,
                mimeType: file.type,
                isAnalyzed: false
            };
            await addMaterialToCloud(materialData);
            newMaterials.push({ ...materialData, id: 'temp_' + Date.now() });
        } else {
            // Local Save
            if (file.size > 15 * 1024 * 1024) {
                alert(`הקובץ ${file.name} גדול מדי לשמירה מקומית (מקסימום 15MB). חבר ענן להעלאת קבצים גדולים.`);
                continue;
            }
            const base64Content = await readFileAsBase64(file);
            materialData = {
                id: Date.now().toString() + Math.random(),
                name: file.name,
                type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio' : file.type.startsWith('video/') ? 'video' : 'text',
                content: base64Content,
                mimeType: file.type,
                isAnalyzed: false
            };
            await saveMaterialToLocalDB(materialData);
            setMaterials(prev => [materialData, ...prev]);
            newMaterials.push(materialData);
        }

      } catch (e) {
        console.error("Error saving file", e);
        hasError = true;
      }
    }

    if (hasError) {
        setSaveStatus('error');
    } else {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 3000);
    }

    if (isAssignment && activeAssignmentTopic) {
      const topic = TOPICS.find(t => t.id === activeAssignmentTopic);
      if (topic) {
          handleAssignmentSubmission(topic, newMaterials);
      }
      setActiveAssignmentTopic(null);
    }
    
    if (window.innerWidth < 768) {
        setActiveTab('library');
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>, isAssignment = false) => {
    if (event.target.files) {
      const files = Array.from(event.target.files) as File[];
      await processFiles(files, isAssignment);

      if (fileInputRef.current) fileInputRef.current.value = '';
      if (assignmentInputRef.current) assignmentInputRef.current.value = '';
      if (audioInputRef.current) audioInputRef.current.value = '';
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files) as File[];
      await processFiles(files, false);
    }
  };

  const removeMaterial = async (id: string, contentUrl: string) => {
    if (window.confirm("האם למחוק קובץ זה?")) {
        try {
            if (isCloudConfigured) {
                await deleteMaterialFromCloud(id, contentUrl);
            } else {
                await deleteMaterialFromLocalDB(id);
                setMaterials(prev => prev.filter(m => m.id !== id));
            }
        } catch (e) {
            console.error("Failed to delete", e);
            alert("שגיאה במחיקת הקובץ");
        }
    }
  };

  const handleAssignmentSubmission = async (topic: typeof TOPICS[0], currentMaterials: LearningMaterial[]) => {
    setActiveTab('chat');
    const prompt = `[הגשת מטלה: ${topic.title}] ${topic.assignmentPrompt}`;
    
    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: prompt };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    const loadingMsg: Message = { id: 'loading', role: 'model', text: 'מנתח את המטלה שלך...', isLoading: true };
    setMessages(prev => [...prev, loadingMsg]);

    const responseText = await analyzeLearningMaterials(currentMaterials, userMsg.text, messages);
    
    setMessages(prev => prev.filter(msg => msg.id !== 'loading').concat({
      id: (Date.now() + 1).toString(),
      role: 'model',
      text: responseText
    }));
    
    await markMaterialsAsAnalyzed(currentMaterials); 
    setLoading(false);
  }

  const handleSend = async (manualText?: string) => {
    const textToSend = manualText || input;
    if (!textToSend.trim() || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: textToSend };
    setMessages(prev => [...prev, userMsg]);
    if (!manualText) setInput('');
    setLoading(true);

    const loadingMsg: Message = { id: 'loading', role: 'model', text: '...', isLoading: true };
    setMessages(prev => [...prev, loadingMsg]);

    const responseText = await analyzeLearningMaterials(materials, userMsg.text, messages);
    
    setMessages(prev => prev.filter(msg => msg.id !== 'loading').concat({
      id: (Date.now() + 1).toString(),
      role: 'model',
      text: responseText
    }));

    await markMaterialsAsAnalyzed(materials); 
    setLoading(false);
  };

  const handleTopicLearn = async (topic: typeof TOPICS[0]) => {
    setActiveTab('chat');
    const prompt = `אני רוצה ללמוד לעומק על נושא: ${topic.title}. ${topic.prompt}`;
    
    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: prompt };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    const loadingMsg: Message = { id: 'loading', role: 'model', text: 'מכין מערך שיעור מהיר...', isLoading: true };
    setMessages(prev => [...prev, loadingMsg]);

    // Filter only text materials to send for context
    const lightMaterials = materials.filter(m => m.type === 'text');
    
    const responseText = await analyzeLearningMaterials(lightMaterials, userMsg.text, messages);

    setMessages(prev => prev.filter(msg => msg.id !== 'loading').concat({
      id: (Date.now() + 1).toString(),
      role: 'model',
      text: responseText
    }));
    
    await markMaterialsAsAnalyzed(lightMaterials); 
    setLoading(false);

    setTimeout(() => {
        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'model',
            text: `**סיימת ללמוד את הנושא?**\nכדי לסמן את הנושא כ"הושלם" ✅, עליך לעבור בהצלחה מבחן קצר.\nלחץ על כפתור "בחן את עצמך" בכרטיס הנושא כדי להתחיל.`
        }]);
    }, 800);
  };

  const handleTopicAssignment = (topicId: string) => {
    setActiveAssignmentTopic(topicId);
    assignmentInputRef.current?.click();
  };

  const startQuiz = async (topicId: string) => {
      const topic = TOPICS.find(t => t.id === topicId);
      if(!topic || !topic.quizPrompt) return;

      setQuizLoading(true);
      setActiveQuiz({ topicId, question: { question: 'טוען שאלה...', options: [], correctAnswerIndex: 0, explanation: '' } });
      setQuizFeedback(null);

      try {
          const quizData = await generateQuizQuestion(topic.quizPrompt);
          setActiveQuiz({ topicId, question: quizData });
      } catch (e) {
          console.error("Failed to generate quiz", e);
          setActiveQuiz(null); // Close on error
          alert("לא הצלחתי ליצור חידון כרגע. נסה שוב.");
      } finally {
          setQuizLoading(false);
      }
  };

  const handleQuizAnswer = (index: number) => {
      if (!activeQuiz) return;
      if (index === activeQuiz.question.correctAnswerIndex) {
          setQuizFeedback('correct');
          setTimeout(() => {
              if (!completedTopics.includes(activeQuiz.topicId)) {
                  toggleTopicCompletion(activeQuiz.topicId);
              }
          }, 1000);
      } else {
          setQuizFeedback('incorrect');
      }
  };

  const closeQuiz = () => {
      setActiveQuiz(null);
      setQuizFeedback(null);
  };

  // --- Reader Mode Logic ---
  const toggleReaderMode = (material: LearningMaterial) => {
    if (material.type === 'text') {
      setReadingMaterial(material);
    }
  };

  const closeReaderMode = () => {
    setReadingMaterial(null);
  };

  const getReaderClasses = () => {
    let base = "fixed inset-0 z-50 overflow-y-auto flex flex-col ";
    if (readerTheme === 'dark') base += "bg-slate-950 text-slate-100";
    if (readerTheme === 'light') base += "bg-white text-gray-900";
    if (readerTheme === 'sepia') base += "bg-amber-50 text-amber-900";
    return base;
  };

  return (
    <>
      <div className="flex flex-col h-full max-h-[calc(100vh-4rem)] bg-slate-900 rounded-lg border border-slate-700 overflow-hidden shadow-xl">
        {/* Header */}
        <div className="bg-slate-800 p-4 border-b border-slate-700 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center">
             <BookIcon className="w-6 h-6 text-purple-400 ml-3" />
             <h2 className="text-lg font-bold text-white">תיבת למידה (Learning Box)</h2>
          </div>
          
          <div className="flex items-center gap-2 md:gap-3 ml-auto">
              {!isCloudConfigured ? (
                 <button 
                    onClick={() => userRole === 'admin' && setShowCloudHelp(true)}
                    className="bg-amber-500/10 border border-amber-500/30 text-amber-400 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 hover:bg-amber-500/20 transition-colors"
                    title={userRole === 'admin' ? "לחץ לחיבור הענן" : "פנה למנהל האתר"}
                 >
                     <DatabaseIcon className="w-4 h-4" />
                     מצב מקומי (ללא סנכרון)
                 </button>
              ) : (
                 <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2">
                     <DatabaseIcon className="w-4 h-4" />
                     מחובר לענן
                 </div>
              )}

              <div className="hidden md:block h-4 w-px bg-slate-600 mx-1"></div>
            
            {/* Save Status Indicators */}
            {saveStatus === 'saving' && (
               <span className="text-xs text-amber-400 font-bold animate-pulse flex items-center gap-1">
                   <div className="w-2 h-2 bg-amber-400 rounded-full"></div>
                   <span className="hidden sm:inline">שומר נתונים...</span>
               </span>
            )}
            {saveStatus === 'saved' && (
               <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                   <CheckIcon className="w-3 h-3" />
                   <span className="hidden sm:inline">נשמר {isCloudConfigured ? 'בענן' : 'במחשב'}</span>
               </span>
            )}
            {saveStatus === 'error' && (
               <span className="text-xs text-red-400 font-bold flex items-center gap-1">
                   ! שגיאה בשמירה
               </span>
            )}

            {userRole === 'student' && (
                <button 
                onClick={handleResetProgress}
                className="text-xs text-slate-500 hover:text-red-400 underline transition-colors mr-2"
                >
                אפס צ'אט
                </button>
            )}
            <span className="text-xs text-slate-400 bg-slate-900 px-2 py-1 rounded-full">
               {materials.length} <span className="hidden sm:inline">קבצים</span>
            </span>
          </div>
        </div>

        {/* Mobile Tabs */}
        <div className="md:hidden flex border-b border-slate-700 bg-slate-800">
            <button 
                onClick={() => setActiveTab('library')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'library' ? 'text-purple-400 border-b-2 border-purple-400 bg-slate-700/50' : 'text-slate-400'}`}
            >
                ספריית קבצים ({materials.length})
            </button>
            <button 
                onClick={() => setActiveTab('chat')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'chat' ? 'text-cyan-400 border-b-2 border-cyan-400 bg-slate-700/50' : 'text-slate-400'}`}
            >
                צ'אט ולמידה
            </button>
        </div>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
          {/* Sidebar for Files */}
          <div className={`
             absolute md:relative inset-0 md:inset-auto z-10 md:z-auto bg-slate-900 
             w-full md:w-1/3 border-l border-slate-700 p-4 flex flex-col gap-4 overflow-y-auto min-w-[250px]
             transition-transform duration-300 ease-in-out
             ${activeTab === 'library' ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
          `}>
             {/* Only Admin can drag & drop */}
             {userRole === 'admin' && (
                 <div 
                   className={`
                     border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-all text-center
                     ${!isCloudConfigured ? 'border-amber-600/50 bg-amber-500/5' : ''}
                     ${isDragging ? 'border-purple-500 bg-purple-500/20' : 'border-slate-600 hover:border-purple-500 hover:bg-slate-800'}
                   `}
                   onClick={() => fileInputRef.current?.click()}
                   onDragOver={handleDragOver}
                   onDragLeave={handleDragLeave}
                   onDrop={handleDrop}
                 >
                   <UploadIcon className={`w-8 h-8 mb-2 ${isDragging ? 'text-purple-400' : isCloudConfigured ? 'text-slate-400' : 'text-amber-400'}`} />
                   <span className={`text-sm ${isDragging ? 'text-purple-200' : 'text-slate-300'}`}>
                     {isDragging ? 'שחרר קבצים כאן...' : isCloudConfigured ? 'העלה לענן (לכולם)' : 'העלה מקומית (זמני)'}
                   </span>
                   <span className="text-xs text-slate-500 mt-1">
                       {isCloudConfigured ? 'תמונות, אודיו, וידאו (עד 20MB)' : 'נשמר רק במחשב זה. לא יופיע לתלמידים.'}
                   </span>
                   <input 
                     type="file" 
                     multiple 
                     accept="image/*,audio/*,video/*"
                     ref={fileInputRef} 
                     onChange={(e) => handleFileChange(e, false)} 
                     className="hidden" 
                   />
                 </div>
             )}

              {/* Only Admin can upload standalone Audio/Video */}
              {userRole === 'admin' && (
                  <>
                    <button
                    onClick={() => audioInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 p-3 rounded-lg transition-colors w-full"
                    title="העלאת קובץ שמע"
                    >
                    <HeadphonesIcon className="w-5 h-5 text-amber-400" />
                    <span className="text-sm font-medium">העלאת קובץ שמע</span>
                    </button>

                    <button
                    onClick={() => videoInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 p-3 rounded-lg transition-colors w-full"
                    title="העלאת קובץ וידאו"
                    >
                    <VideoIcon className="w-5 h-5 text-cyan-400" />
                    <span className="text-sm font-medium">העלאת קובץ וידאו</span>
                    </button>
                  </>
              )}
              
              {/* Fallback msg for student */}
              {materials.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-64 text-center p-6 opacity-80 border-2 border-dashed border-slate-800 rounded-xl">
                      <RefreshCwIcon className="w-12 h-12 mb-4 text-slate-600" />
                      <p className="text-lg font-bold text-slate-300">הספרייה ריקה</p>
                      <p className="text-sm text-slate-400 mt-2 max-w-xs">
                          {isCloudConfigured ? 'חומרי הלימוד יופיעו כאן ברגע שהמנהל יעלה אותם לענן.' : 'המערכת במצב מקומי. בקש מהמנהל לחבר את הענן כדי לראות תכנים.'}
                      </p>
                  </div>
              )}

             {/* Hidden inputs */}
             <input 
                 type="file" 
                 multiple 
                 accept="image/*"
                 ref={assignmentInputRef} 
                 onChange={(e) => handleFileChange(e, true)} 
                 className="hidden" 
             />
             <input 
                 type="file" 
                 multiple 
                 accept="audio/*"
                 ref={audioInputRef} 
                 onChange={(e) => handleFileChange(e, false)} 
                 className="hidden" 
             />
             <input 
                 type="file" 
                 multiple 
                 accept="video/*"
                 ref={videoInputRef} 
                 onChange={(e) => handleFileChange(e, false)} 
                 className="hidden" 
             />

             <div className="space-y-2 pb-20 md:pb-0">
               {materials.map(m => (
                 <div key={m.id} className="bg-slate-800 p-2 rounded-lg flex flex-col gap-2 group border border-slate-700 hover:border-slate-600 transition-colors">
                   <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 overflow-hidden">
                        {m.type === 'image' ? (
                          <img src={m.content} alt={m.name} className="w-8 h-8 object-cover rounded" />
                        ) : m.type === 'audio' ? (
                          <div className="w-8 h-8 bg-slate-700 rounded flex items-center justify-center text-purple-400">
                            <HeadphonesIcon className="w-4 h-4" />
                          </div>
                        ) : m.type === 'video' ? (
                          <div className="w-8 h-8 bg-slate-700 rounded flex items-center justify-center text-cyan-400">
                            <VideoIcon className="w-4 h-4" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 bg-slate-700 rounded flex items-center justify-center text-slate-400">
                            <FileTextIcon className="w-4 h-4" />
                          </div>
                        )}
                        <span className="text-xs text-slate-300 truncate max-w-[120px]">{m.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {/* Analysis Indicator */}
                        {m.isAnalyzed && (
                            <div className="text-emerald-400 bg-emerald-400/10 p-1 rounded-full" title="נותח על ידי ה-AI">
                                <CheckIcon className="w-3 h-3" />
                            </div>
                        )}
                        
                        {m.type === 'text' && (
                          <button
                            onClick={() => toggleReaderMode(m)}
                            className="text-slate-500 hover:text-cyan-400 opacity-100 transition-opacity p-1"
                            title="מצב קריאה"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </button>
                        )}
                        
                        {/* Only Admin can delete */}
                        {userRole === 'admin' && (
                            <button 
                            onClick={() => removeMaterial(m.id, m.content)} 
                            className="text-slate-500 hover:text-red-400 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity p-1"
                            title="מחק קובץ"
                            >
                            <TrashIcon className="w-4 h-4" />
                            </button>
                        )}
                      </div>
                   </div>
                   {/* Players */}
                   {m.type === 'audio' && (
                     <audio controls src={m.content} className="w-full h-8 mt-1" />
                   )}
                   {m.type === 'video' && (
                     <video controls src={m.content} className="w-full mt-2 rounded-lg max-h-32 bg-black" />
                   )}
                   {m.type === 'text' && m.name.includes('מדריך') && (
                       <div className="text-xs text-slate-400 mt-1 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto custom-scrollbar cursor-pointer hover:text-slate-300 transition-colors" onClick={() => toggleReaderMode(m)}>
                           {m.content}
                       </div>
                   )}
                 </div>
               ))}
             </div>
          </div>

          {/* Chat Area */}
          <div className={`
             flex-1 flex flex-col bg-slate-900/50 h-full
             ${activeTab === 'chat' ? 'block' : 'hidden md:flex'}
          `}>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}
                >
                  <div
                    className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-purple-600 text-white rounded-br-none'
                        : 'bg-slate-700 text-slate-200 rounded-bl-none'
                    }`}
                  >
                    {msg.isLoading ? (
                      <div className="animate-pulse">{msg.text}</div>
                    ) : (
                      <SimpleFormat text={msg.text} />
                    )}
                  </div>
                </div>
              ))}
              
              {/* Topic Grid */}
              <div className="mt-8">
                 <div className="flex justify-between items-center border-b border-slate-700 pb-2 mb-4">
                    <h3 className="text-slate-400 text-sm font-medium">מסלולי למידה</h3>
                    <span className="text-xs text-emerald-400 font-bold">
                       {completedTopics.length}/{TOPICS.length} הושלמו
                    </span>
                 </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {TOPICS.map(topic => {
                      const isCompleted = completedTopics.includes(topic.id);
                      return (
                        <div
                          key={topic.id}
                          className={`bg-slate-800 border p-4 rounded-xl flex flex-col gap-3 shadow-sm transition-all ${
                              isCompleted ? 'border-emerald-500/50 bg-emerald-900/10' : 'border-slate-700 hover:shadow-purple-500/10'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-1">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${topic.color} bg-opacity-20`}>
                                <topic.icon className={`w-5 h-5 ${topic.textColor}`} />
                              </div>
                              <h4 className="font-bold text-slate-200 text-sm">{topic.title}</h4>
                            </div>
                            <button 
                               onClick={(e) => { 
                                   e.stopPropagation(); 
                                   if(isCompleted) {
                                       toggleTopicCompletion(topic.id);
                                   } else {
                                       startQuiz(topic.id);
                                   }
                               }}
                               className="focus:outline-none transition-transform hover:scale-110"
                               title={isCompleted ? "סמן כלא הושלם" : "לחץ כדי להיבחן ולהשלים את הנושא"}
                            >
                               {isCompleted ? (
                                   <div className="bg-emerald-500 text-white rounded-full p-1 shadow-lg shadow-emerald-500/30">
                                       <CheckIcon className="w-4 h-4" />
                                   </div>
                               ) : (
                                   <div className="w-6 h-6 rounded-full border-2 border-slate-600 hover:border-emerald-400 transition-colors flex items-center justify-center">
                                       <span className="text-[10px] text-slate-500 font-bold">?</span>
                                   </div>
                               )}
                            </button>
                          </div>
                          <p className="text-xs text-slate-500 flex-1">{topic.description}</p>
                          
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <button 
                                onClick={() => handleTopicLearn(topic)}
                                className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 py-2 rounded transition-colors col-span-2"
                            >
                                למד נושא (מהיר)
                            </button>
                            <button 
                                onClick={() => handleTopicAssignment(topic.id)}
                                className="text-xs bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-600/30 py-2 rounded transition-colors flex items-center justify-center gap-1"
                            >
                                <UploadIcon className="w-3 h-3" />
                                הגש מטלה
                            </button>
                            {userRole === 'admin' && (
                                <button 
                                    onClick={() => audioInputRef.current?.click()}
                                    className="text-xs bg-slate-700 hover:bg-slate-600 text-amber-300 border border-slate-600 py-2 rounded transition-colors flex items-center justify-center gap-1"
                                    title="צרף הקלטת שיעור"
                                >
                                    <HeadphonesIcon className="w-3 h-3" />
                                    צרף הקלטה
                                </button>
                            )}
                            <button
                                onClick={() => startQuiz(topic.id)}
                                className="col-span-2 text-xs bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white py-2 rounded transition-all shadow-sm"
                            >
                                בחן את עצמך (להשלמה)
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
              </div>

              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-slate-800 border-t border-slate-700">
              <div className="flex gap-2">
                {userRole === 'admin' && (
                  <button
                    onClick={() => audioInputRef.current?.click()}
                    className="bg-slate-700 hover:bg-slate-600 text-slate-300 p-2 rounded-full transition-colors flex items-center justify-center disabled:opacity-50"
                    title="העלאת קובץ אודיו"
                  >
                    <HeadphonesIcon className="w-5 h-5 text-amber-400" />
                  </button>
                )}
                {userRole === 'admin' && (
                  <button
                    onClick={() => videoInputRef.current?.click()}
                    className="bg-slate-700 hover:bg-slate-600 text-slate-300 p-2 rounded-full transition-colors flex items-center justify-center disabled:opacity-50"
                    title="העלאת קובץ וידאו"
                  >
                    <VideoIcon className="w-5 h-5 text-cyan-400" />
                  </button>
                )}
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="שאל שאלה..."
                  className="flex-1 bg-slate-900 border border-slate-600 text-white rounded-full px-4 py-2 focus:outline-none focus:border-purple-500 transition-colors"
                  disabled={loading}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={loading}
                  className="bg-purple-600 hover:bg-purple-500 text-white p-2 rounded-full transition-colors disabled:opacity-50"
                >
                  <SendIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cloud Help Modal */}
      {showCloudHelp && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
              <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-8 shadow-2xl relative overflow-y-auto max-h-[90vh]">
                  <button onClick={() => setShowCloudHelp(false)} className="absolute top-4 left-4 text-slate-400 hover:text-white"><XIcon className="w-6 h-6" /></button>
                  
                  <div className="text-center mb-6">
                      <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
                          <DatabaseIcon className="w-8 h-8 text-amber-400" />
                      </div>
                      <h2 className="text-2xl font-bold text-white">חיבור המערכת לענן</h2>
                      <p className="text-slate-400 text-sm mt-2">כדי שכולם יראו את הקבצים, צריך לחבר את האתר ל-Firebase (בחינם).</p>
                  </div>

                  <div className="space-y-4 text-right text-slate-300 text-sm">
                      <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                          <h3 className="font-bold text-white mb-2 text-base">שלב 1: יצירת פרויקט</h3>
                          <p>היכנס ל- <a href="https://console.firebase.google.com/" target="_blank" className="text-cyan-400 underline">Firebase Console</a> וצור פרויקט חדש (Create Project).</p>
                      </div>

                      <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                          <h3 className="font-bold text-white mb-2 text-base">שלב 2: הגדרת Web App</h3>
                          <p>בתוך הפרויקט, לחץ על סמל ה-web (<code>&lt;/&gt;</code>) כדי ליצור אפליקציה. בסוף התהליך תקבל קוד הגדרות (Config).</p>
                      </div>

                      <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                          <h3 className="font-bold text-white mb-2 text-base">שלב 3: הפעלת שירותים</h3>
                          <ul className="list-disc pr-4 space-y-1">
                              <li>בתפריט בצד, לך ל-<strong>Build &gt; Firestore Database</strong> וצור דאטה-בייס (בחר מצב Test Mode).</li>
                              <li>לך ל-<strong>Build &gt; Storage</strong> והפעל את השירות (גם ב-Test Mode).</li>
                          </ul>
                      </div>

                      <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 border-l-4 border-l-cyan-500">
                          <h3 className="font-bold text-white mb-2 text-base">שלב 4: הדבקת הקוד</h3>
                          <p>פתח את הקובץ <code>services/firebase.ts</code> בקוד המקור שלך, והדבק את פרטי ה-Config במקום המסומן.</p>
                      </div>
                  </div>

                  <button onClick={() => setShowCloudHelp(false)} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl mt-6 transition-colors">
                      הבנתי, אעשה זאת בקוד
                  </button>
              </div>
          </div>
      )}

      {/* Reader Mode Overlay */}
      {readingMaterial && (
        <div className={getReaderClasses()}>
          {/* Reader Toolbar */}
          <div className={`sticky top-0 w-full p-4 flex items-center justify-between border-b bg-opacity-95 backdrop-blur-md z-10 transition-colors ${
              readerTheme === 'light' ? 'bg-white border-gray-200' : 
              readerTheme === 'sepia' ? 'bg-amber-100 border-amber-200' : 
              'bg-slate-900 border-slate-700'
          }`}>
             <h2 className="font-bold text-lg truncate max-w-[50%] opacity-80">{readingMaterial.name}</h2>
             
             <div className="flex items-center gap-4">
                {/* Theme Controls */}
                <div className="flex items-center bg-black/10 rounded-full p-1 gap-1">
                    <button onClick={() => setReaderTheme('light')} className={`w-6 h-6 rounded-full bg-white border border-gray-300 shadow-sm ${readerTheme === 'light' ? 'ring-2 ring-cyan-500' : ''}`} title="בהיר"></button>
                    <button onClick={() => setReaderTheme('sepia')} className={`w-6 h-6 rounded-full bg-[#f4ecd8] border border-amber-200 shadow-sm ${readerTheme === 'sepia' ? 'ring-2 ring-cyan-500' : ''}`} title="ספיה"></button>
                    <button onClick={() => setReaderTheme('dark')} className={`w-6 h-6 rounded-full bg-slate-900 border border-slate-600 shadow-sm ${readerTheme === 'dark' ? 'ring-2 ring-cyan-500' : ''}`} title="כהה"></button>
                </div>

                {/* Font Size Controls */}
                <div className="flex items-center gap-2 border-r border-l border-current px-4 mx-2">
                   <TypeIcon className="w-4 h-4 opacity-70" />
                   <div className="flex gap-1">
                      <button onClick={() => setReaderFontSize('sm')} className={`text-xs font-bold px-2 py-1 rounded ${readerFontSize === 'sm' ? 'bg-black/10' : ''}`}>A</button>
                      <button onClick={() => setReaderFontSize('base')} className={`text-base font-bold px-2 py-1 rounded ${readerFontSize === 'base' ? 'bg-black/10' : ''}`}>A</button>
                      <button onClick={() => setReaderFontSize('lg')} className={`text-lg font-bold px-2 py-1 rounded ${readerFontSize === 'lg' ? 'bg-black/10' : ''}`}>A</button>
                      <button onClick={() => setReaderFontSize('xl')} className={`text-xl font-bold px-2 py-1 rounded ${readerFontSize === 'xl' ? 'bg-black/10' : ''}`}>A</button>
                   </div>
                </div>

                <button 
                  onClick={closeReaderMode}
                  className="p-2 rounded-full hover:bg-black/10 transition-colors"
                >
                   <XIcon className="w-6 h-6" />
                </button>
             </div>
          </div>

          {/* Reader Content */}
          <div className="flex-1 w-full max-w-3xl mx-auto p-8 md:p-12">
             <ReaderContent text={readingMaterial.content} theme={readerTheme} />
             <div className={`mt-12 pt-8 border-t opacity-40 text-center text-sm ${
                 readerTheme === 'light' ? 'border-gray-200' : 
                 readerTheme === 'sepia' ? 'border-amber-200' : 
                 'border-slate-700'
             }`}>
                 סוף המסמך
             </div>
          </div>
          
          {/* Apply font size via style prop to container or specific wrapper */}
          <style>{`
            .whitespace-pre-wrap { font-size: ${
                readerFontSize === 'sm' ? '0.875rem' : 
                readerFontSize === 'base' ? '1rem' : 
                readerFontSize === 'lg' ? '1.125rem' : '1.25rem'
            }; line-height: 1.8; }
          `}</style>
        </div>
      )}

      {/* Quiz Modal */}
      {activeQuiz && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-w-lg w-full p-6 animate-fade-in">
                 {quizLoading ? (
                     <div className="text-center py-8">
                         <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                         <p className="text-slate-300">מייצר שאלה מאתגרת...</p>
                     </div>
                 ) : (
                     <>
                        <h3 className="text-xl font-bold text-white mb-6 text-center">{activeQuiz.question.question}</h3>
                        <div className="space-y-3">
                            {activeQuiz.question.options.map((option, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleQuizAnswer(idx)}
                                    disabled={quizFeedback !== null}
                                    className={`w-full p-4 rounded-lg text-right transition-all border ${
                                        quizFeedback === null 
                                          ? 'bg-slate-700 border-slate-600 hover:bg-slate-600 hover:border-cyan-500' 
                                          : idx === activeQuiz.question.correctAnswerIndex
                                            ? 'bg-emerald-600 border-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)]'
                                            : quizFeedback === 'incorrect' && 'opacity-50'
                                    }`}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>

                        {quizFeedback === 'correct' && (
                             <div className="mt-6 bg-emerald-500/20 border border-emerald-500/50 p-4 rounded-lg text-center animate-bounce-in">
                                 <p className="text-emerald-400 font-bold text-lg">כל הכבוד! תשובה נכונה.</p>
                                 <p className="text-emerald-300/80 text-sm mt-1">{activeQuiz.question.explanation}</p>
                                 <button onClick={closeQuiz} className="mt-4 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-bold">סיום</button>
                             </div>
                        )}

                        {quizFeedback === 'incorrect' && (
                             <div className="mt-6 bg-red-500/20 border border-red-500/50 p-4 rounded-lg text-center animate-shake">
                                 <p className="text-red-400 font-bold">תשובה שגויה. נסה שוב!</p>
                                 <button onClick={() => setQuizFeedback(null)} className="mt-2 text-red-300 hover:text-white underline text-sm">נסה שנית</button>
                             </div>
                        )}
                        
                        <button onClick={closeQuiz} className="absolute top-4 left-4 p-2 text-slate-500 hover:text-white">
                            <XIcon className="w-6 h-6" />
                        </button>
                     </>
                 )}
              </div>
          </div>
      )}
    </>
  );
};

export default LearningBox;
