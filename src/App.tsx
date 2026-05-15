import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Moon, Sun, Trash2, StopCircle, Volume2, Send, Plus, MessageSquare, Edit2, Menu, X, Copy, Check, RefreshCw, Paperclip, FileText, Image as ImageIcon } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

type Role = 'user' | 'model';

interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  isTyping?: boolean;
  file?: {
    name: string;
    dataUrl: string;
    isText: boolean;
    textContent?: string;
  };
}

interface Session {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
}

const VOICES = ['nova', 'echo', 'onyx', 'alloy'];
const generateId = () => Math.random().toString(36).substring(2, 10);

export default function App() {
  const [sessions, setSessions] = useState<Session[]>(() => {
    try {
      const saved = localStorage.getItem('voice_ai_sessions');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem('voice_ai_sessions');
      return saved ? JSON.parse(saved)?.[0]?.id || null : null;
    } catch {
      return null;
    }
  });

  // UI state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitleBuffer, setEditTitleBuffer] = useState('');
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // File Upload State
  const [attachedFile, setAttachedFile] = useState<{name: string, type: string, dataUrl: string, isText: boolean, textContent?: string} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Voice & AI State
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  
  const [voice, setVoice] = useState('nova');
  const [isDark, setIsDark] = useState(true);
  const [voiceSpeed, setVoiceSpeed] = useState(1.0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const silenceTimerRef = useRef<any>(null);
  const transcriptBufferRef = useRef('');

  const currentSession = sessions.find((s) => s.id === currentSessionId);
  const currentMessages = currentSession?.messages || [];

  useEffect(() => {
    const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
    localStorage.setItem('voice_ai_sessions', JSON.stringify(sorted));
  }, [sessions]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages, isThinking, isSpeaking, interimTranscript]);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        if (audioRef.current && isSpeaking) stopAudio();

        setInterimTranscript(interim);
        if (final) transcriptBufferRef.current += final + ' ';

        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          const fullText = (transcriptBufferRef.current + interim).trim();
          if (fullText) handleUserMessage(fullText);
        }, 1500);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        if (event.error !== 'no-speech') setIsListening(false);
      };
      
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
    }
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      stopAudio();
    };
  }, [isSpeaking, sessions, voice, currentSessionId]);

  const stopAudio = () => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch (e) {}
      audioRef.current = null;
    }
    setIsSpeaking(false);
  };

  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      const fullText = (transcriptBufferRef.current + interimTranscript).trim();
      if (fullText) {
        handleUserMessage(fullText);
      } else {
        setIsListening(false);
      }
    } else {
      stopAudio();
      transcriptBufferRef.current = '';
      setInterimTranscript('');
      try {
        if (recognitionRef.current) recognitionRef.current.start();
      } catch (e) {}
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
        const resizeImage = (f: File): Promise<string> => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        let w = img.width;
                        let h = img.height;
                        const MAX = 800; // Resize to max 800px to ensure extremely fast API processing

                        if (w > h) {
                            if (w > MAX) { h *= MAX / w; w = MAX; }
                        } else {
                            if (h > MAX) { w *= MAX / h; h = MAX; }
                        }

                        canvas.width = w;
                        canvas.height = h;
                        const ctx = canvas.getContext('2d');
                        if(ctx) {
                           ctx.fillStyle = 'white';
                           ctx.fillRect(0,0,w,h);
                           ctx.drawImage(img, 0, 0, w, h);
                        }
                        resolve(canvas.toDataURL('image/jpeg', 0.6)); // 60% quality JPEG is very small
                    };
                    img.src = e.target?.result as string;
                };
                reader.readAsDataURL(f);
            });
        };

        const dataUrl = await resizeImage(file);
        setAttachedFile({
            name: file.name,
            type: file.type,
            dataUrl: dataUrl,
            isText: false
        });
    } else {
        const reader = new FileReader();
        reader.onload = (e) => {
            setAttachedFile({
                name: file.name,
                type: file.type,
                dataUrl: '',
                isText: true,
                textContent: e.target?.result as string
            });
        };
        reader.readAsText(file);
    }
    e.target.value = ''; // reset
  };

  const handleSendText = () => {
    const text = input.trim();
    if ((!text && !attachedFile) || isThinking) return;

    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    handleUserMessage(text);
  };

  // 3-LAYER AI SYSTEM
  const fetchAIResponse = async (contextMessages: Message[]) => {
    const formattedMessages = [
      { role: 'system', content: 'You are a concise, helpful conversational AI assistant. You process text and return high-quality markdown responses instantly.' },
      ...contextMessages.slice(-15).map(m => {
        let content: any = m.content;
        
        if (m.role === 'user' && m.file) {
           if (m.file.isText) {
               content = `${m.content}\n\n[Attached File: ${m.file.name}]\n${m.file.textContent}`;
           } else {
               content = [
                   { type: 'text', text: m.content || 'Please analyze this image' },
                   { type: 'image_url', image_url: { url: m.file.dataUrl } }
               ];
           }
        }

        return {
          role: m.role === 'model' ? 'assistant' : 'user',
          content: content
        };
      })
    ];

    try {
      // Layer 1: Primary AI (Pollinations) - using model=openai for extremely fast response
      const res = await fetch('https://text.pollinations.ai/?model=openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: formattedMessages, seed: Math.floor(Math.random() * 1000000) }),
      });
      if (!res.ok) throw new Error(`Primary API failed: ${res.status}`);
      return await res.text();
    } catch (primaryErr) {
      console.warn("Layer 1 failed, trying Layer 2...", primaryErr);
      try {
        // Layer 2: Secondary Public AI (Simulated using another free endpoint or direct fallback param)
        const userMsgText = contextMessages[contextMessages.length - 1].content;
        const fallbackRes = await fetch(`https://api.popcat.xyz/chatbot?msg=${encodeURIComponent(userMsgText)}&owner=AI&botname=Assistant`);
        if (!fallbackRes.ok) throw new Error("Secondary API failed");
        const data = await fallbackRes.json();
        return data.response || "I could not generate a response.";
      } catch (secondaryErr) {
         console.warn("Layer 2 failed, activating Layer 3 (Local API)...", secondaryErr);
         // Layer 3: Local simulated fallback 
         return "I am currently functioning in **Offline/Local Fallback Mode** due to network interruptions. I understood your message, but cannot reach my primary servers. How can I assist you locally?";
      }
    }
  };

  const handleUserMessage = async (text: string) => {
    if (recognitionRef.current) recognitionRef.current.stop();
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    
    transcriptBufferRef.current = '';
    setInterimTranscript('');
    setIsListening(false);
    
    // Grab the attached file currently in state and clear it out
    const fileToSend = attachedFile;
    setAttachedFile(null);

    let activeSessionId = currentSessionId;
    let isNewSession = false;

    if (!activeSessionId) {
      activeSessionId = generateId();
      isNewSession = true;
      setCurrentSessionId(activeSessionId);
    }

    const newUserMsg: Message = { 
        id: generateId(), 
        role: 'user', 
        content: text, 
        timestamp: Date.now(),
        file: fileToSend ? { name: fileToSend.name, dataUrl: fileToSend.dataUrl, isText: fileToSend.isText, textContent: fileToSend.textContent } : undefined
    };
    
    const sessionHistory = activeSessionId && !isNewSession
       ? (sessions.find(s => s.id === activeSessionId)?.messages || [])
       : [];
       
    const chatContext = [...sessionHistory, newUserMsg];

    setSessions((prev) => {
      if (isNewSession) {
        return [{
          id: activeSessionId as string,
          title: text.substring(0, 30) + (text.length > 30 ? '...' : ''),
          messages: [newUserMsg],
          updatedAt: Date.now(),
        }, ...prev];
      } else {
        return prev.map((s) => s.id === activeSessionId ? { ...s, messages: [...s.messages, newUserMsg], updatedAt: Date.now() } : s);
      }
    });

    setIsThinking(true);

    let responseText = '';
    const textLower = text.toLowerCase();
    const isImageCommand = textLower.includes('create image') || textLower.includes('generate image') || textLower.includes('/image');

    if (isImageCommand) {
       const prompt = text.replace(/\/image/ig, '').replace(/create image/ig, '').replace(/generate image/ig, '').replace(/of /ig, '').trim() || 'beautiful digital art';
       const seed = Math.floor(Math.random() * 1000000);
       // Use turbo model and 768px for much faster image generation
       const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?nologo=true&seed=${seed}&model=turbo&enhance=false&width=768&height=768`;
       responseText = `Here is your image for **"${prompt}"**:\n\n![Generated Image](${imageUrl})`;
    } else {
       responseText = await fetchAIResponse(chatContext);
    }
    
    const newAiMsg: Message = { id: generateId(), role: 'model', content: responseText, timestamp: Date.now(), isTyping: false };
    
    setSessions((prev) =>
      prev.map((s) => s.id === activeSessionId ? { ...s, messages: [...s.messages, newAiMsg], updatedAt: Date.now() } : s)
    );
    setIsThinking(false);
    playAudioResponse(responseText);
  };

  const regenerateResponse = async () => {
     if (!currentSession || currentMessages.length === 0 || isThinking) return;
     
     // Remove the last model message if it exists to regenerate it
     const lastUserIndex = currentMessages.length - 1;
     let contextToUse = currentMessages;
     
     if (currentMessages[lastUserIndex].role === 'model') {
        contextToUse = currentMessages.slice(0, -1);
     }
     
     if (contextToUse.length === 0) return;
     setIsThinking(true);
     setSessions(prev => prev.map(s => s.id === currentSession.id ? { ...s, messages: contextToUse } : s));
     
     const responseText = await fetchAIResponse(contextToUse);
     const regeneratedMsg: Message = { id: generateId(), role: 'model', content: responseText, timestamp: Date.now(), isTyping: false };
     
     setSessions((prev) =>
      prev.map((s) => s.id === currentSession.id ? { ...s, messages: [...contextToUse, regeneratedMsg], updatedAt: Date.now() } : s)
     );
     setIsThinking(false);
     playAudioResponse(responseText);
  };

  const playAudioResponse = (text: string) => {
    stopAudio();
    const cleanText = text.replace(/[*_~`#*[\]()]/g, '').trim();
    if (!cleanText) {
      if (recognitionRef.current) {
        try { recognitionRef.current.start(); } catch(e) {}
      }
      return;
    }

    setIsSpeaking(true);
    const url = `https://gen.pollinations.ai/audio/${encodeURIComponent(cleanText)}?voice=${voice}`;
    const audio = new Audio(url);
    audio.crossOrigin = "anonymous";
    audio.playbackRate = voiceSpeed;
    audioRef.current = audio;

    audio.onended = () => {
      setIsSpeaking(false);
      if (recognitionRef.current) {
        try { recognitionRef.current.start(); } catch(e) {}
      }
    };
    
    audio.onerror = () => {
      console.warn("Audio playback error. The generative voice service might be unavailable.");
      setIsSpeaking(false);
    }

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(e => {
        setIsSpeaking(false);
      });
    }
  };

  // Setup Sidebar Actions
  const startNewChat = () => {
    setCurrentSessionId(null);
    setIsSidebarOpen(false);
    setInput('');
    setAttachedFile(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (currentSessionId === id) setCurrentSessionId(null);
  };

  const startRename = (e: React.MouseEvent, id: string, currentTitle: string) => {
    e.stopPropagation();
    setEditingSessionId(id);
    setEditTitleBuffer(currentTitle);
  };

  const submitRename = (id: string) => {
    if (editTitleBuffer.trim()) {
      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, title: editTitleBuffer.trim() } : s))
      );
    }
    setEditingSessionId(null);
  };

  const clearCurrentChat = () => {
    if (currentSessionId && window.confirm('Clear all messages in this conversation?')) {
      setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: [] } : s));
      stopAudio();
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className={cn("flex h-screen w-full transition-colors duration-300 font-sans overflow-hidden", isDark ? "bg-zinc-950 text-zinc-100 dark" : "bg-white text-zinc-900")}>
      {/* Mobile Sidebar Backdrop */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-[280px] flex flex-col transform transition-transform duration-300 md:relative",
        isDark ? "bg-zinc-900 border-r border-zinc-800" : "bg-zinc-50 border-r border-zinc-200",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="p-4">
          <button
            onClick={startNewChat}
            className={cn("flex items-center justify-between w-full p-2.5 rounded-xl border transition-all shadow-sm", isDark ? "border-zinc-700 bg-zinc-800 hover:bg-zinc-700" : "border-zinc-300 bg-white hover:bg-zinc-50")}
          >
            <div className="flex items-center gap-2"><Plus className="w-4 h-4" /><span className="text-sm font-medium">New Conversation</span></div>
            <Edit2 className="w-4 h-4 opacity-50" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wider pl-2 mb-2 opacity-50 mt-2">Recent Chats</div>
          {sessions.map((s) => (
            <div key={s.id}>
              {editingSessionId === s.id ? (
                <div className={cn("flex items-center gap-2 p-2 rounded-lg", isDark ? "bg-zinc-800" : "bg-zinc-200")}>
                  <input
                    autoFocus
                    value={editTitleBuffer}
                    onChange={(e) => setEditTitleBuffer(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitRename(s.id)}
                    onBlur={() => submitRename(s.id)}
                    className="bg-transparent outline-none flex-1 font-medium text-sm w-full"
                  />
                </div>
              ) : (
                <div
                  onClick={() => { setCurrentSessionId(s.id); setIsSidebarOpen(false); }}
                  className={cn(
                    "group flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors",
                    currentSessionId === s.id ? (isDark ? "bg-indigo-600/20 text-indigo-400" : "bg-indigo-50 text-indigo-700") : (isDark ? "hover:bg-zinc-800" : "hover:bg-zinc-200")
                  )}
                >
                  <div className="flex items-center gap-3 overflow-hidden flex-1">
                    <MessageSquare className={cn("w-4 h-4 flex-shrink-0", currentSessionId === s.id ? "text-indigo-500" : "opacity-50")} />
                    <span className="text-sm font-medium truncate">{s.title}</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => startRename(e, s.id, s.title)} className="p-1 hover:bg-zinc-700 hover:text-white rounded text-zinc-400"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={(e) => deleteSession(e, s.id)} className="p-1 hover:bg-red-500/20 rounded hover:text-red-500 text-zinc-400"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className={cn("p-4 border-t", isDark ? "border-zinc-800" : "border-zinc-200")}>
          <div className="flex items-center justify-between mb-2">
             <button onClick={() => setIsDark(!isDark)} className={cn("flex items-center gap-2 p-2 rounded-lg text-sm transition-colors", isDark ? "hover:bg-zinc-800" : "hover:bg-zinc-200")}>
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />} Theme
             </button>
             <button onClick={() => {if(window.confirm('Clear all data?')) {setSessions([]); setCurrentSessionId(null);}}} className="p-2 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors" title="Delete All Data">
                <Trash2 className="w-5 h-5" />
             </button>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        <header className={cn("flex items-center justify-between px-4 py-3 border-b shrink-0 z-10", isDark ? "border-zinc-800 bg-zinc-950" : "border-zinc-200 bg-white")}>
          <div className="flex items-center gap-3">
             <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 -ml-2 rounded-lg hover:bg-zinc-800 transition-colors">
               <Menu className="w-5 h-5" />
             </button>
             <div>
                <h1 className="text-base font-semibold tracking-tight">{currentSession?.title || 'New Conversation'}</h1>
                <div className="text-[11px] font-medium text-green-500 flex items-center gap-1.5 uppercase tracking-widest mt-0.5">
                   <div className="w-1.5 h-1.5 rounded-full bg-green-500" /> Layer 1 AI Active
                </div>
             </div>
          </div>
          
          <div className="flex items-center gap-2">
            <select value={voice} onChange={(e) => setVoice(e.target.value)} className={cn("text-xs rounded-lg px-2 py-1.5 outline-none cursor-pointer border hidden sm:block", isDark ? "bg-zinc-900 border-zinc-800" : "bg-zinc-100 border-zinc-200")}>
              {VOICES.map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
            </select>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col items-center">
          <div className="w-full max-w-3xl flex flex-col gap-6">
            {!currentSession || currentMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[50vh] text-center">
                 <div className="w-16 h-16 bg-indigo-600/10 rounded-2xl flex items-center justify-center mb-6">
                   <Volume2 className="w-8 h-8 text-indigo-500" />
                 </div>
                 <h2 className="text-2xl font-bold mb-2">How can I help you today?</h2>
                 <p className="max-w-md mx-auto text-sm opacity-60">Uses Pollinations AI. Talk naturally or type your message below.</p>
              </div>
            ) : (
              currentMessages.map((msg, idx) => {
                const isLast = idx === currentMessages.length - 1;
                return (
                <div key={msg.id} className={cn("flex w-full group", msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn("flex flex-col gap-1.5 w-full md:max-w-[85%]", msg.role === 'user' ? 'items-end' : 'items-start')}>
                    <div className={cn(
                        "px-5 py-4 rounded-3xl shadow-sm text-[15px] leading-relaxed relative",
                        msg.role === 'user'
                          ? "bg-indigo-600 text-white rounded-br-sm"
                          : isDark ? "bg-zinc-900/80 border border-zinc-800 text-zinc-100 rounded-bl-sm" : "bg-white border border-zinc-200 text-zinc-900 rounded-bl-sm"
                      )}
                    >
                      {msg.role === 'model' ? (
                        <>
                            <div className={cn("markdown-body", isDark ? "dark-markdown" : "")}>
                               <Markdown remarkPlugins={[remarkGfm]}>{msg.content}</Markdown>
                            </div>
                        </>
                      ) : (
                        <div className="whitespace-pre-wrap flex flex-col gap-2">
                           {msg.file && (
                               <div className={cn("flex flex-col gap-2 p-2 rounded-xl border max-w-sm", isDark ? "bg-zinc-800/50 border-zinc-700" : "bg-white/50 border-white/20")}>
                                   {!msg.file.isText && <img src={msg.file.dataUrl} alt="Attached file" className="w-full h-auto rounded-lg max-h-48 object-cover" />}
                                   <div className="flex items-center gap-2 text-xs opacity-90 truncate font-semibold">
                                       {msg.file.isText ? <FileText className="w-4 h-4 flex-shrink-0" /> : <ImageIcon className="w-4 h-4 flex-shrink-0" />}
                                       <span className="truncate">{msg.file.name}</span>
                                   </div>
                               </div>
                           )}
                           <span>{msg.content}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className={cn("flex items-center gap-3 px-1", msg.role === 'user' ? "flex-row-reverse" : "")}>
                      <span className="text-[11px] font-medium opacity-40">
                        {new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: 'numeric' }).format(msg.timestamp)}
                      </span>
                      
                      {msg.role === 'model' && !msg.isTyping && (
                         <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => copyToClipboard(msg.content, msg.id)} className="p-1 rounded hover:bg-zinc-800/50 text-zinc-500 hover:text-zinc-300 transition-colors" title="Copy Message">
                               {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                            {isLast && (
                              <button onClick={regenerateResponse} className="p-1 rounded hover:bg-zinc-800/50 text-zinc-500 hover:text-zinc-300 transition-colors" title="Regenerate">
                                 <RefreshCw className="w-3.5 h-3.5" />
                              </button>
                            )}
                         </div>
                      )}
                    </div>
                  </div>
                </div>
              )})
            )}

            {interimTranscript && (
               <div className="flex w-full justify-end">
                  <div className="px-5 py-3.5 rounded-3xl bg-indigo-600/70 text-white rounded-br-sm animate-pulse max-w-[85%]">
                     {transcriptBufferRef.current} {interimTranscript}
                  </div>
               </div>
            )}

            {isThinking && (
               <div className="flex w-full justify-start">
                  <div className={cn("px-5 py-4 rounded-3xl rounded-bl-sm shadow-sm flex items-center gap-2", isDark ? "bg-zinc-900 border border-zinc-800" : "bg-white border border-zinc-200")}>
                     <div className="flex space-x-1.5">
                       <div className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                       <div className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                       <div className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                     </div>
                  </div>
               </div>
            )}
            <div ref={messagesEndRef} className="h-4" />
          </div>
        </div>

        {/* Input Area */}
        <div className={cn("relative pb-6 pt-2 px-4 shrink-0 bg-transparent", isDark ? "bg-gradient-to-t from-zinc-950 via-zinc-950 to-transparent" : "bg-gradient-to-t from-white via-white to-transparent")}>
          <div className="max-w-3xl mx-auto flex flex-col items-center">
              {isSpeaking && (
                 <button onClick={stopAudio} className="mb-4 px-4 py-2 rounded-full text-xs font-semibold tracking-wide flex items-center gap-2 shadow-xl bg-zinc-800 text-zinc-200 hover:text-white border border-zinc-700 animate-pulse">
                   <StopCircle className="w-4 h-4" /> Stop Speaking
                 </button>
              )}

              <div className={cn(
                "relative flex flex-col w-full shadow-lg border rounded-3xl p-1.5 transition-all",
                isDark ? "bg-zinc-900/90 backdrop-blur border-zinc-700/50 focus-within:border-indigo-500" : "bg-white backdrop-blur border-zinc-200 focus-within:border-indigo-400"
              )}>
                
                {attachedFile && (
                   <div className="px-3 pt-3 pb-1 flex items-center">
                       <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-xl border relative pr-8 max-w-sm", isDark ? "bg-zinc-800 border-zinc-700" : "bg-zinc-100 border-zinc-200")}>
                           {!attachedFile.isText && <div className="w-8 h-8 rounded shrink-0 bg-cover bg-center overflow-hidden" style={{ backgroundImage: `url(${attachedFile.dataUrl})` }} />}
                           <div className="flex flex-col overflow-hidden">
                              <span className="text-xs font-semibold truncate">{attachedFile.name}</span>
                              <span className="text-[10px] opacity-60 uppercase">{attachedFile.type || 'Unknown Type'}</span>
                           </div>
                           <button onClick={() => setAttachedFile(null)} className="absolute right-1 hover:bg-zinc-500/20 p-1 rounded-full text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
                              <X className="w-3.5 h-3.5" />
                           </button>
                       </div>
                   </div>
                )}

                <div className="w-full flex items-end">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className={cn(
                        "m-1 p-3 rounded-2xl transition-all duration-300 flex-shrink-0 relative",
                        isDark ? "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800" : "text-zinc-500 hover:bg-zinc-100"
                      )}
                      title="Attach File"
                    >
                      <Plus className="w-5 h-5" />
                      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*, .txt, .md, .csv, .json" />
                    </button>

                    {/* Left the microphone button if needed, but made it secondary */}
                    <button
                      onClick={toggleListening}
                      disabled={isThinking}
                      className={cn(
                        "mb-1 mr-1 p-3 rounded-2xl transition-all duration-300 flex-shrink-0",
                        isListening ? "bg-red-500 hover:bg-red-600 text-white animate-pulse shadow-md shadow-red-500/20" : isDark ? "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800" : "text-zinc-500 hover:bg-zinc-100"
                      )}
                      title={isListening ? "Stop listening" : "Start speaking"}
                    >
                      {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </button>

                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={handleInput}
                      onKeyDown={handleKeyDown}
                      placeholder={isListening ? "Listening..." : "Message AI..."}
                      style={{ minHeight: '44px' }}
                      className={cn(
                        "w-full max-h-[200px] bg-transparent outline-none resize-none px-2 py-3.5 text-[15px] custom-scrollbar",
                        isDark ? "text-zinc-100 placeholder-zinc-500" : "text-zinc-900 placeholder-zinc-400"
                      )}
                      rows={1}
                    />
                    
                    <div className="flex flex-col m-1 gap-1">
                      <button onClick={handleSendText} disabled={(!input.trim() && !attachedFile) || isThinking} className="p-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:bg-indigo-600/50 rounded-2xl text-white transition-colors flex-shrink-0 shadow-sm">
                        <Send className="w-5 h-5" />
                      </button>
                    </div>
                </div>
              </div>
              <div className="w-full flex justify-between items-center px-4 mt-3">
                 <div className="text-[10px] uppercase tracking-wider font-semibold opacity-40">
                    Model: Pollinations AI • 3-Layer Backup
                 </div>
                 {currentSession && currentSession.messages.length > 0 && (
                    <button onClick={clearCurrentChat} className="text-[10px] flex items-center gap-1 uppercase tracking-wider font-semibold opacity-40 hover:opacity-100 hover:text-red-400 transition-colors">
                       <Trash2 className="w-3 h-3" /> Clear Chat
                    </button>
                 )}
              </div>
          </div>
        </div>
      </main>
    </div>
  );
}
