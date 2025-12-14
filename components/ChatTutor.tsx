import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../types';
import { sendMessageToTutor } from '../services/geminiService';
import { SendIcon, InfoIcon } from './Icons';

const SimpleFormat = ({ text }: { text: string }) => {
  // Split by bold markers **text**
  const parts = text.split(/(\*\*.*?\*\*)/);
  return (
    <div className="whitespace-pre-wrap" dir="auto">
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={index} className="font-bold text-cyan-300">{part.slice(2, -2)}</strong>;
        }
        return part;
      })}
    </div>
  );
};

const ChatTutor: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'model', text: 'שלום! אני המורה האישי שלך לצילום. שאל אותי כל שאלה על המצלמה שלך, הגדרות חשיפה, או קומפוזיציה.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const loadingMsg: Message = { id: 'loading', role: 'model', text: '...', isLoading: true };
    setMessages(prev => [...prev, loadingMsg]);

    const responseText = await sendMessageToTutor(messages, input);
    
    setMessages(prev => prev.filter(msg => msg.id !== 'loading').concat({
      id: (Date.now() + 1).toString(),
      role: 'model',
      text: responseText
    }));
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-4rem)] bg-slate-900 rounded-lg border border-slate-700 overflow-hidden shadow-xl">
      <div className="bg-slate-800 p-4 border-b border-slate-700 flex items-center">
        <InfoIcon className="w-5 h-5 text-cyan-400 ml-2" />
        <h2 className="text-lg font-bold text-white">מדריך אישי (AI Tutor)</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}
          >
            <div
              className={`max-w-[80%] p-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-cyan-600 text-white rounded-br-none'
                  : 'bg-slate-700 text-slate-200 rounded-bl-none'
              }`}
            >
               {msg.isLoading ? (
                 <div className="animate-pulse">חושב...</div>
               ) : (
                 <SimpleFormat text={msg.text} />
               )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-slate-800 border-t border-slate-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="שאל שאלה בנושא צילום..."
            className="flex-1 bg-slate-900 border border-slate-600 text-white rounded-full px-4 py-2 focus:outline-none focus:border-cyan-500 transition-colors"
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={loading}
            className="bg-cyan-600 hover:bg-cyan-500 text-white p-2 rounded-full transition-colors disabled:opacity-50"
          >
            <SendIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatTutor;