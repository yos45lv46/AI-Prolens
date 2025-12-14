import React, { useState, useRef } from 'react';
import { analyzePhoto } from '../services/geminiService';
import { UploadIcon, ImageIcon } from './Icons';

const SimpleFormat = ({ text }: { text: string }) => {
  // Split by bold markers **text**
  const parts = text.split(/(\*\*.*?\*\*)/);
  return (
    <div className="whitespace-pre-wrap" dir="auto">
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={index} className="font-bold text-amber-400">{part.slice(2, -2)}</strong>;
        }
        return part;
      })}
    </div>
  );
};

const PhotoCritique: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setSelectedImage(base64String);
      setAnalysis(''); // Clear previous analysis
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!selectedImage) return;

    setLoading(true);
    // Extract just the base64 data part
    const base64Data = selectedImage.split(',')[1];
    
    const result = await analyzePhoto(base64Data);
    setAnalysis(result);
    setLoading(false);
  };

  return (
    <div className="flex flex-col gap-6 p-6 bg-slate-900 rounded-xl shadow-2xl h-full">
      <div className="flex items-center gap-3 border-b border-slate-700 pb-4">
        <ImageIcon className="w-8 h-8 text-cyan-400" />
        <h1 className="text-2xl font-bold text-white">ניתוח תמונות (Critique)</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
        {/* Left Column: Upload & Preview */}
        <div className="flex flex-col gap-4">
          <div 
            className={`
              border-2 border-dashed rounded-xl h-80 flex flex-col items-center justify-center cursor-pointer transition-all
              ${selectedImage ? 'border-slate-600 bg-slate-800' : 'border-slate-600 hover:border-cyan-500 hover:bg-slate-800'}
            `}
            onClick={() => fileInputRef.current?.click()}
          >
            {selectedImage ? (
              <img 
                src={selectedImage} 
                alt="Uploaded" 
                className="h-full w-full object-contain rounded-lg p-2" 
              />
            ) : (
              <div className="text-center p-6">
                <UploadIcon className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                <p className="text-slate-300 font-medium">לחץ להעלאת תמונה</p>
                <p className="text-slate-500 text-sm mt-2">JPG, PNG</p>
              </div>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept="image/*" 
              className="hidden" 
            />
          </div>

          <button
            onClick={handleAnalyze}
            disabled={!selectedImage || loading}
            className={`
              w-full py-3 rounded-lg font-bold text-lg transition-all shadow-lg
              ${!selectedImage || loading 
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
                : 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-500 hover:to-blue-500 hover:scale-[1.02]'}
            `}
          >
            {loading ? 'מנתח תמונה...' : 'קבל ביקורת מקצועית'}
          </button>
        </div>

        {/* Right Column: Analysis Result */}
        <div className="bg-slate-800 rounded-xl p-6 overflow-y-auto border border-slate-700 shadow-inner min-h-[320px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
              <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-slate-400 animate-pulse">ה-AI מנתח את הקומפוזיציה והחשיפה...</p>
            </div>
          ) : analysis ? (
            <div className="prose prose-invert prose-sm md:prose-base max-w-none font-light leading-relaxed text-right" dir="rtl">
               <SimpleFormat text={analysis} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
               <p>התוצאות יופיעו כאן לאחר הניתוח.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PhotoCritique;