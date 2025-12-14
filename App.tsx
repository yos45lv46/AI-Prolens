import React, { useState, useEffect, ReactNode, ErrorInfo, Component } from 'react';
import ChatTutor from './components/ChatTutor';
import ExposureSimulator from './components/ExposureSimulator';
import PhotoCritique from './components/PhotoCritique';
import LearningBox from './components/LearningBox';
import CourseRegistration from './components/CourseRegistration';
import LoginScreen from './components/LoginScreen';
import AdminDashboard from './components/AdminDashboard';
import UpdatesModal from './components/UpdatesModal';
import StudentSyncModal from './components/StudentSyncModal';
import { CameraIcon, SlidersIcon, MessageSquareIcon, ImageIcon, BookIcon, ClipboardIcon, DownloadIcon, LogOutIcon, ShieldIcon, MegaphoneIcon, LightbulbIcon, MenuIcon, SparklesIcon, RefreshCwIcon } from './components/Icons';
import { View } from './types';

// Defined explicit interfaces for ErrorBoundary
interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

// Simple Error Boundary with explicit typing
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("App crashed:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-4 text-center">
          <h1 className="text-3xl font-bold mb-4">אופס! משהו השתבש.</h1>
          <p className="text-slate-400 mb-6">קרתה תקלה לא צפויה בטעינת האפליקציה.</p>
          <div className="flex gap-4">
              <button onClick={() => window.location.reload()} className="bg-cyan-600 px-6 py-2 rounded-lg hover:bg-cyan-500">
                טען מחדש
              </button>
              <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="bg-red-600 px-6 py-2 rounded-lg hover:bg-red-500">
                איפוס נתוני אפליקציה (חירום)
              </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const TIPS = [
    "כלל השלישים: מקם את נושא הצילום בצד, לא במרכז.",
    "שעת הזהב: שעה אחרי הזריחה ושעה לפני השקיעה הן השעות עם האור הכי מחמיא.",
    "עומק שדה: צמצם פתוח (f/1.8) מטשטש את הרקע, צמצם סגור (f/11) משאיר הכל חד.",
    "ISO נמוך = איכות גבוהה. נסה להישאר על 100-400 באור יום.",
    "הולכת עין: חפש קווים טבעיים שמובילים את העין לנושא הצילום.",
    "צלם מגובה העיניים של המצולם, במיוחד בצילום ילדים או בעלי חיים.",
    "השתמש בחצובה לצילומי לילה כדי למנוע מריחות."
];

interface StudentProfile {
    name: string;
    phone: string;
}

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.HOME);
  const [userRole, setUserRole] = useState<'student' | 'admin' | null>(null);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [dailyTip, setDailyTip] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showUpdates, setShowUpdates] = useState(true); // Open updates by default on load
  const [showSyncModal, setShowSyncModal] = useState(false);

  // Persist user login on refresh
  useEffect(() => {
    const storedRole = localStorage.getItem('prolens_user_role');
    const storedProfile = localStorage.getItem('prolens_student_profile');
    
    if (storedRole === 'student' || storedRole === 'admin') {
        setUserRole(storedRole as 'student' | 'admin');
        if (storedRole === 'student' && storedProfile) {
            setStudentProfile(JSON.parse(storedProfile));
        }
    }
  }, []);

  useEffect(() => {
    // Select daily tip based on day of year to keep it consistent for the day
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 1000 / 60 / 60 / 24);
    setDailyTip(TIPS[dayOfYear % TIPS.length]);

    // Check for admin announcement
    const savedAnnouncement = localStorage.getItem('prolens_announcement');
    if (savedAnnouncement) setAnnouncement(savedAnnouncement);

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [currentView]); 

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleLogin = (role: 'student' | 'admin', studentData?: StudentProfile) => {
      setUserRole(role);
      localStorage.setItem('prolens_user_role', role);
      
      if (role === 'student' && studentData) {
          setStudentProfile(studentData);
          localStorage.setItem('prolens_student_profile', JSON.stringify(studentData));
      }
  };

  const handleLogout = () => {
    setUserRole(null);
    setStudentProfile(null);
    setCurrentView(View.HOME);
    localStorage.removeItem('prolens_user_role');
    localStorage.removeItem('prolens_student_profile');
  };

  const toggleSidebar = () => {
      setIsSidebarOpen(!isSidebarOpen);
  };

  if (!userRole) {
    return (
        <ErrorBoundary>
            <LoginScreen onLogin={handleLogin} />
        </ErrorBoundary>
    );
  }

  const renderContent = () => {
    if (userRole === 'admin' && currentView === View.ADMIN) {
        return <AdminDashboard />;
    }

    switch (currentView) {
      case View.SIMULATOR:
        return <ExposureSimulator />;
      case View.CRITIQUE:
        return <PhotoCritique />;
      case View.CHAT:
        return <ChatTutor />;
      case View.LEARNING_BOX:
        return <LearningBox userRole={userRole} />;
      case View.REGISTRATION:
        return <CourseRegistration />;
      case View.ADMIN: 
        return <AdminDashboard />;
      case View.HOME:
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-8 animate-fade-in relative pt-8 md:pt-0">
            
            {/* Instructor Announcement Area */}
            {announcement && userRole === 'student' && (
                <div className="w-full max-w-2xl bg-gradient-to-r from-indigo-900/80 to-purple-900/80 border border-indigo-500/50 p-4 rounded-xl flex items-start gap-4 text-right shadow-lg mb-4 backdrop-blur-sm animate-bounce-in mx-4">
                    <div className="bg-indigo-500 p-2 rounded-full mt-1">
                        <MegaphoneIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-indigo-200 text-lg">הודעה ממנהל האתר</h3>
                        <p className="text-white whitespace-pre-wrap">{announcement}</p>
                    </div>
                </div>
            )}

            <div className="bg-cyan-500/10 p-6 rounded-full">
              <CameraIcon className="w-20 h-20 text-cyan-400" />
            </div>
            
            <div>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white tracking-tight px-4">
                  {userRole === 'student' && studentProfile ? (
                      <span className="block text-2xl md:text-3xl font-medium text-slate-300 mb-2">שלום, {studentProfile.name}</span>
                  ) : (
                      <span className="block text-2xl md:text-3xl font-medium text-slate-300 mb-2">ברוכים הבאים</span>
                  )}
                  <span className="text-cyan-400">AI המורה לצילום</span>
                </h1>
            </div>
            
            {/* Daily Tip */}
            <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-lg flex items-center gap-3 max-w-xl mx-auto mx-4">
                 <LightbulbIcon className="w-6 h-6 text-amber-400 flex-shrink-0" />
                 <p className="text-slate-300 text-sm md:text-base">
                     <span className="font-bold text-amber-400">טיפ יומי:</span> {dailyTip}
                 </p>
            </div>

            <p className="text-xl text-slate-400 max-w-2xl px-4">
              {userRole === 'admin' ? 'ממשק מנהל האתר - נהל את המערכת, ערוך הודעות, ובדוק את כלי הלימוד.' : 'המקום שלך ללמוד צילום מקצועי. השתמש בסימולטור, קבל ביקורת על תמונות מה-AI, או שוחח עם המורה האישי שלך.'}
            </p>
            <div className="flex flex-wrap justify-center gap-4 mt-8 px-4 pb-8">
              {/* Show Learning Buttons for BOTH Student AND Admin (so admin can test) */}
              <button onClick={() => setCurrentView(View.SIMULATOR)} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white px-6 py-3 rounded-lg transition-all hover:scale-105 w-full md:w-auto justify-center">
                  <SlidersIcon className="w-5 h-5 text-amber-400" /> סימולטור חשיפה
              </button>
              <button onClick={() => setCurrentView(View.LEARNING_BOX)} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white px-6 py-3 rounded-lg transition-all hover:scale-105 w-full md:w-auto justify-center">
                  <BookIcon className="w-5 h-5 text-purple-400" /> תיבת למידה
              </button>
              <button onClick={() => setCurrentView(View.REGISTRATION)} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white px-6 py-3 rounded-lg transition-all hover:scale-105 w-full md:w-auto justify-center">
                  <ClipboardIcon className="w-5 h-5 text-cyan-400" /> סילבוס הקורס
              </button>
              
              {userRole === 'admin' && (
                  <button onClick={() => setCurrentView(View.ADMIN)} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-lg transition-all hover:scale-105 shadow-lg w-full md:w-auto justify-center">
                      <ShieldIcon className="w-5 h-5" /> לוח בקרה (Admin)
                  </button>
              )}
            </div>
          </div>
        );
    }
  };

  return (
    <ErrorBoundary>
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row overflow-hidden h-[100dvh]">
        
        {/* Mobile Header */}
        <header className="md:hidden bg-slate-900 border-b border-slate-800 p-4 flex items-center justify-between z-50">
             <div className="flex items-center gap-2">
                 <CameraIcon className="w-6 h-6 text-cyan-400" />
                 <span className="font-bold text-lg">ProLens</span>
             </div>
             <button onClick={toggleSidebar} className="p-2 text-slate-300">
                 <MenuIcon className="w-6 h-6" />
             </button>
        </header>

        {/* Sidebar Navigation */}
        <aside className={`
            fixed md:relative top-0 right-0 h-full z-40 bg-slate-900 border-l border-slate-800 
            transition-transform duration-300 ease-in-out transform 
            ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'} 
            md:translate-x-0 md:w-20 lg:w-64 flex flex-col pt-16 md:pt-6 shadow-2xl md:shadow-none
        `}>
            {/* Close button for mobile */}
            <button 
                onClick={toggleSidebar} 
                className="md:hidden absolute top-4 left-4 p-2 text-slate-400"
            >
                <LogOutIcon className="w-6 h-6 rotate-180" /> {/* Reusing logout icon as 'back/close' arrow visually */}
            </button>

            <div className="hidden md:flex mb-8 w-full justify-center md:justify-start md:px-6 cursor-pointer" onClick={() => setCurrentView(View.HOME)}>
                <CameraIcon className="w-8 h-8 text-cyan-400" />
                <span className="hidden lg:block mr-3 font-bold text-xl tracking-wider">ProLens</span>
            </div>
            
            <nav className="flex flex-col gap-2 w-full px-4 overflow-y-auto flex-1 custom-scrollbar">
                <NavButton view={View.HOME} current={currentView} onClick={(v) => { setCurrentView(v); setIsSidebarOpen(false); }} icon={<CameraIcon />} label="ראשי" />
                
                <NavButton view={View.REGISTRATION} current={currentView} onClick={(v) => { setCurrentView(v); setIsSidebarOpen(false); }} icon={<ClipboardIcon />} label="סילבוס הקורס" />
                
                <NavButton view={View.SIMULATOR} current={currentView} onClick={(v) => { setCurrentView(v); setIsSidebarOpen(false); }} icon={<SlidersIcon />} label="סימולטור" />
                <NavButton view={View.CRITIQUE} current={currentView} onClick={(v) => { setCurrentView(v); setIsSidebarOpen(false); }} icon={<ImageIcon />} label="ניתוח תמונה" />
                <NavButton view={View.LEARNING_BOX} current={currentView} onClick={(v) => { setCurrentView(v); setIsSidebarOpen(false); }} icon={<BookIcon />} label="תיבת למידה" />
                <NavButton view={View.CHAT} current={currentView} onClick={(v) => { setCurrentView(v); setIsSidebarOpen(false); }} icon={<MessageSquareIcon />} label="צ'אט לימוד" />

                {userRole === 'admin' && (
                    <>
                        <div className="w-full border-t border-slate-700 my-2"></div>
                        <NavButton view={View.ADMIN} current={currentView} onClick={(v) => { setCurrentView(v); setIsSidebarOpen(false); }} icon={<ShieldIcon />} label="ניהול מערכת" />
                    </>
                )}
                
                <div className="mt-4 space-y-2">
                     <button
                        onClick={() => { setShowUpdates(true); setIsSidebarOpen(false); }}
                        className="flex items-center p-3 rounded-xl transition-all duration-200 w-full justify-start text-slate-400 hover:bg-slate-800 hover:text-cyan-300"
                    >
                        <div className="w-6 h-6"><SparklesIcon /></div>
                        <span className="lg:block md:hidden block mr-3 font-medium whitespace-nowrap">עדכונים ותיקונים</span>
                    </button>
                    
                    {/* Sync Button - Visible for BOTH Student AND Admin now to facilitate file transfer */}
                    <button
                        onClick={() => { setShowSyncModal(true); setIsSidebarOpen(false); }}
                        className="flex items-center p-3 rounded-xl transition-all duration-200 w-full justify-start text-slate-400 hover:bg-slate-800 hover:text-emerald-400"
                    >
                        <div className="w-6 h-6"><RefreshCwIcon /></div>
                        <span className="lg:block md:hidden block mr-3 font-medium whitespace-nowrap">סנכרון בין מכשירים</span>
                    </button>
                </div>
            </nav>
            
            <div className="mt-auto w-full flex flex-col items-start pt-4 border-t border-slate-800 pb-6">
                {deferredPrompt && (
                    <button onClick={handleInstall} className="mx-4 mb-4 bg-emerald-600 hover:bg-emerald-500 text-white p-2 lg:px-4 rounded-lg flex items-center justify-center gap-2 shadow-lg transition-all w-[calc(100%-2rem)]">
                    <DownloadIcon className="w-5 h-5" />
                    <span className="lg:inline text-sm font-bold">התקן אפליקציה</span>
                    </button>
                )}

                <button 
                    onClick={handleLogout}
                    className="w-[calc(100%-2rem)] mx-4 mb-2 flex items-center justify-start gap-2 p-2 px-4 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                >
                    <LogOutIcon className="w-5 h-5" />
                    <span className="lg:inline font-medium">התנתק ({userRole === 'admin' ? 'מנהל' : 'תלמיד'})</span>
                </button>
                
                <div className="hidden lg:block px-6 text-xs text-slate-600">
                    <p>מופעל על ידי Google Gemini</p>
                </div>
            </div>
        </aside>

        {/* Overlay for mobile sidebar */}
        {isSidebarOpen && (
            <div 
                className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm"
                onClick={() => setIsSidebarOpen(false)}
            ></div>
        )}

        {/* Updates Modal */}
        {showUpdates && <UpdatesModal onClose={() => setShowUpdates(false)} />}
        
        {/* Student Sync Modal */}
        {showSyncModal && <StudentSyncModal onClose={() => setShowSyncModal(false)} />}

        {/* Main Content Area */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto bg-slate-950 relative w-full">
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0 opacity-20">
                <div className="absolute -top-20 -left-20 w-96 h-96 bg-cyan-900 rounded-full blur-3xl mix-blend-screen"></div>
                <div className="absolute top-40 right-20 w-64 h-64 bg-indigo-900 rounded-full blur-3xl mix-blend-screen"></div>
            </div>
            
            <div className="relative z-10 h-full max-w-6xl mx-auto flex flex-col">
            {renderContent()}
            </div>
        </main>
        </div>
    </ErrorBoundary>
  );
};

interface NavButtonProps {
  view: View;
  current: View;
  onClick: (v: View) => void;
  icon: React.ReactNode;
  label: string;
}

const NavButton: React.FC<NavButtonProps> = ({ view, current, onClick, icon, label }) => {
  const isActive = view === current;
  return (
    <button
      onClick={() => onClick(view)}
      className={`
        flex items-center p-3 rounded-xl transition-all duration-200 w-full justify-start min-w-[50px]
        ${isActive 
          ? 'bg-cyan-500/20 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.2)]' 
          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}
      `}
    >
      <div className="w-6 h-6">{icon}</div>
      <span className="lg:block md:hidden block mr-3 font-medium whitespace-nowrap">{label}</span>
    </button>
  );
};

export default App;