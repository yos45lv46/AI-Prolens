
import React, { useState, useEffect } from 'react';
import { SimulatorSettings } from '../types';
import { getSimulatorFeedback } from '../services/geminiService';
import { SlidersIcon, SaveIcon, DownloadIcon } from './Icons';

const APERTURES = [1.4, 1.8, 2.8, 4, 5.6, 8, 11, 16, 22];
const SHUTTERS = [4000, 2000, 1000, 500, 250, 125, 60, 30, 15, 8, 4, 2, 1]; // 1 means 1 second here for simplicity, logic handled below
const ISOS = [100, 200, 400, 800, 1600, 3200, 6400, 12800];

const ExposureSimulator: React.FC = () => {
  const [settings, setSettings] = useState<SimulatorSettings>({
    aperture: 5.6,
    shutterSpeed: 125, // 1/125
    iso: 400
  });

  const [feedback, setFeedback] = useState<string>('');
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [storageMsg, setStorageMsg] = useState<{text: string, type: 'success' | 'error'} | null>(null);

  // Calculate Exposure Value (simplified) to alter the preview image brightness
  // Baseline: f/8, 1/125, ISO 100 is decent outdoor light.
  const calculateBrightness = () => {
    const evAperture = Math.log2(settings.aperture * settings.aperture);
    const evShutter = Math.log2(settings.shutterSpeed);
    const evISO = Math.log2(settings.iso / 100);
    
    // Simplified EV calc
    const totalEV = evShutter + evAperture - evISO;
    
    // Target EV for "Good Exposure" (arbitrary relative scale)
    const targetEV = 12; 
    const diff = targetEV - totalEV;
    
    // Map diff to css brightness (1 is normal, 0 is black, >1 is overexposed)
    // If diff is 0 => brightness 1.
    // If diff is -3 (overexposed by 3 stops) => brightness 2.5
    // If diff is +3 (underexposed by 3 stops) => brightness 0.2
    return Math.max(0, Math.pow(2, -diff / 2));
  };

  const brightness = calculateBrightness();

  // Debounce AI feedback
  useEffect(() => {
    const timer = setTimeout(async () => {
        setLoadingFeedback(true);
        const result = await getSimulatorFeedback(settings.aperture, settings.shutterSpeed, settings.iso);
        setFeedback(result);
        setLoadingFeedback(false);
    }, 1200);

    return () => clearTimeout(timer);
  }, [settings]);

  // Clear storage message after 3 seconds
  useEffect(() => {
    if (storageMsg) {
      const timer = setTimeout(() => {
        setStorageMsg(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [storageMsg]);

  const handleSaveSettings = () => {
    try {
      localStorage.setItem('prolens_simulator_settings', JSON.stringify(settings));
      setStorageMsg({ text: 'ההגדרות נשמרו בהצלחה!', type: 'success' });
    } catch (e) {
      setStorageMsg({ text: 'שגיאה בשמירת ההגדרות.', type: 'error' });
    }
  };

  const handleLoadSettings = () => {
    try {
      const saved = localStorage.getItem('prolens_simulator_settings');
      if (saved) {
        setSettings(JSON.parse(saved));
        setStorageMsg({ text: 'ההגדרות נטענו בהצלחה!', type: 'success' });
      } else {
        setStorageMsg({ text: 'לא נמצאו הגדרות שמורות.', type: 'error' });
      }
    } catch (e) {
      setStorageMsg({ text: 'שגיאה בטעינת ההגדרות.', type: 'error' });
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 bg-slate-900 rounded-xl shadow-2xl text-slate-200">
      <div className="flex items-center justify-between border-b border-slate-700 pb-4">
        <div className="flex items-center gap-3">
            <SlidersIcon className="w-8 h-8 text-cyan-400" />
            <h1 className="text-2xl font-bold text-white">סימולטור חשיפה</h1>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={handleSaveSettings}
                className="bg-slate-800 hover:bg-slate-700 text-cyan-400 p-2 rounded-lg border border-slate-700 transition-colors flex items-center gap-2"
                title="שמור הגדרות נוכחיות"
            >
                <SaveIcon className="w-5 h-5" />
                <span className="text-sm hidden sm:inline">שמור</span>
            </button>
            <button 
                onClick={handleLoadSettings}
                className="bg-slate-800 hover:bg-slate-700 text-emerald-400 p-2 rounded-lg border border-slate-700 transition-colors flex items-center gap-2"
                title="טען הגדרות שמורות"
            >
                <DownloadIcon className="w-5 h-5" />
                <span className="text-sm hidden sm:inline">טען</span>
            </button>
        </div>
      </div>

      {storageMsg && (
        <div className={`p-2 rounded-lg text-center text-sm font-bold ${storageMsg.type === 'success' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
            {storageMsg.text}
        </div>
      )}

      {/* Viewport Preview */}
      <div className="relative w-full h-64 bg-black rounded-lg overflow-hidden border-4 border-slate-700 group">
        <img 
          src="https://picsum.photos/800/600" 
          alt="Simulator Target" 
          className="w-full h-full object-cover transition-all duration-300"
          style={{ 
            filter: `brightness(${brightness}) blur(${settings.aperture < 2.8 ? '2px' : '0px'})`,
            // Simulating motion blur vaguely with opacity overlay if shutter is slow? Hard to do with just CSS filter on one img, 
            // but let's use the blur for DOF simulation on low aperture for now.
          }}
        />
        
        {/* HUD Overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm p-2 flex justify-between text-xs font-mono text-cyan-400">
           <span>f/{settings.aperture}</span>
           <span>1/{settings.shutterSpeed}s</span>
           <span>ISO {settings.iso}</span>
        </div>
        
        {/* Visual Guides Overlay */}
        <div className="absolute top-2 right-2 flex flex-col gap-1">
             {brightness > 2 && <span className="bg-red-600/80 text-white px-2 py-1 text-xs rounded">חשיפת יתר (Overexposed)</span>}
             {brightness < 0.3 && <span className="bg-red-600/80 text-white px-2 py-1 text-xs rounded">חשיפת חסר (Underexposed)</span>}
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Aperture */}
        <div className="bg-slate-800 p-4 rounded-lg">
          <label className="block text-sm font-medium text-cyan-300 mb-2">צמצם (Aperture)</label>
          <input 
            type="range" 
            min="0" 
            max={APERTURES.length - 1} 
            value={APERTURES.indexOf(settings.aperture)}
            onChange={(e) => setSettings({...settings, aperture: APERTURES[parseInt(e.target.value)]})}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
          <div className="flex justify-between mt-2 text-sm font-bold">
            <span>f/{settings.aperture}</span>
            <span className="text-slate-400 text-xs font-normal">{settings.aperture < 4 ? 'עומק רדוד' : 'עומק רחב'}</span>
          </div>
        </div>

        {/* Shutter */}
        <div className="bg-slate-800 p-4 rounded-lg">
          <label className="block text-sm font-medium text-cyan-300 mb-2">תריס (Shutter Speed)</label>
          <input 
            type="range" 
            min="0" 
            max={SHUTTERS.length - 1} 
            value={SHUTTERS.indexOf(settings.shutterSpeed)}
            onChange={(e) => setSettings({...settings, shutterSpeed: SHUTTERS[parseInt(e.target.value)]})}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
          <div className="flex justify-between mt-2 text-sm font-bold">
            <span>1/{settings.shutterSpeed}</span>
            <span className="text-slate-400 text-xs font-normal">{settings.shutterSpeed < 60 ? 'מריחה' : 'הקפאה'}</span>
          </div>
        </div>

        {/* ISO */}
        <div className="bg-slate-800 p-4 rounded-lg">
          <label className="block text-sm font-medium text-cyan-300 mb-2">ISO (Sensitivity)</label>
          <input 
            type="range" 
            min="0" 
            max={ISOS.length - 1} 
            value={ISOS.indexOf(settings.iso)}
            onChange={(e) => setSettings({...settings, iso: ISOS[parseInt(e.target.value)]})}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
          <div className="flex justify-between mt-2 text-sm font-bold">
            <span>{settings.iso}</span>
            <span className="text-slate-400 text-xs font-normal">{settings.iso > 1600 ? 'רועש' : 'נקי'}</span>
          </div>
        </div>
      </div>

      {/* AI Feedback Block */}
      <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-lg min-h-[80px]">
         <h3 className="text-sm font-semibold text-slate-400 mb-2">משוב המורה (AI):</h3>
         {loadingFeedback ? (
           <span className="animate-pulse text-slate-500 text-sm">מנתח הגדרות...</span>
         ) : (
           <p className="text-sm text-slate-200">{feedback || "שנה את ההגדרות כדי לקבל משוב."}</p>
         )}
      </div>
    </div>
  );
};

export default ExposureSimulator;
