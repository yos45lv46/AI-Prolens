
import React from 'react';
import { XIcon, SparklesIcon } from './Icons';

interface UpdatesModalProps {
  onClose: () => void;
}

const UpdatesModal: React.FC<UpdatesModalProps> = ({ onClose }) => {
  const updates = [
    {
      version: '1.4.0',
      date: 'עכשיו',
      changes: [
        { type: 'new', text: 'עיצוב חדש ומודרני ללוח הבקרה (Glassmorphism) עם ממשק נקי וברור.' },
        { type: 'fix', text: 'תצוגת נרשמים רספונסיבית: טבלה במחשב וכרטיסיות נוחות במובייל.' }
      ]
    },
    {
      version: '1.3.0',
      date: 'השבוע',
      changes: [
        { type: 'fix', text: 'תיקון מנגנון בדיקת קבצים (File Checker) בלוח הבקרה.' },
        { type: 'new', text: 'נוספה חלונית "עדכונים ותיקונים" למעקב אחר שינויים.' },
        { type: 'fix', text: 'אופטימיזציה של טעינת תמונות ושיפור ביצועים.' }
      ]
    },
    {
      version: '1.2.5',
      date: 'גרסאות קודמות',
      changes: [
        { type: 'new', text: 'הושק לוח בקרה למנהל (Admin Dashboard) עם ניהול נרשמים.' },
        { type: 'new', text: 'אפשרות לייצוא וייבוא גיבוי מלא של המערכת.' }
      ]
    }
  ];

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-gradient-to-r from-slate-900 to-slate-800">
           <div className="flex items-center gap-3">
               <div className="bg-cyan-500/20 p-2 rounded-lg">
                   <SparklesIcon className="w-6 h-6 text-cyan-400" />
               </div>
               <div>
                   <h2 className="text-xl font-bold text-white">מה חדש ב-ProLens?</h2>
                   <p className="text-xs text-slate-400">יומן שינויים ועדכוני גרסה</p>
               </div>
           </div>
           <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
               <XIcon className="w-6 h-6" />
           </button>
        </div>
        
        <div className="overflow-y-auto p-6 space-y-8 custom-scrollbar">
            {updates.map((update, i) => (
                <div key={i} className="relative pl-4 border-r-2 border-slate-800 pr-4">
                    <div className="absolute top-0 -right-[9px] w-4 h-4 rounded-full bg-slate-800 border-2 border-cyan-500/50"></div>
                    <div className="flex justify-between items-baseline mb-3">
                        <span className="text-lg font-bold text-slate-200">גרסה {update.version}</span>
                        <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded-full">{update.date}</span>
                    </div>
                    <ul className="space-y-3">
                        {update.changes.map((change, idx) => (
                            <li key={idx} className="flex items-start gap-3 text-sm">
                                {change.type === 'fix' ? (
                                    <span className="bg-amber-500/10 text-amber-400 text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 shrink-0">תיקון</span>
                                ) : (
                                    <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 shrink-0">חדש</span>
                                )}
                                <span className="text-slate-300 leading-relaxed">{change.text}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </div>
        
        <div className="p-4 border-t border-slate-800 bg-slate-900/50 text-center">
            <button onClick={onClose} className="w-full bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-lg font-medium transition-colors">
                סגור ופתח את האתר
            </button>
        </div>
      </div>
    </div>
  );
};

export default UpdatesModal;
