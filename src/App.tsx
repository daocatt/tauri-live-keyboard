import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";

interface KeyConfig {
  label: string;
}

interface KeyConfigs {
  [key: string]: KeyConfig;
}

function App() {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [configs, setConfigs] = useState<KeyConfigs>(() => {
    const saved = localStorage.getItem("key-configs");
    return saved ? JSON.parse(saved) : {};
  });
  const [customPath, setCustomPath] = useState<string | null>(() => {
    return localStorage.getItem("custom-sound-path");
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const keys = [
    "1", "2", "3",
    "4", "5", "6",
    "7", "8", "9",
    "", "0", ""
  ];

  const playSound = async (key: string) => {
    if (!key) return;
    try {
      await invoke("play_sound", { key });
    } catch (error) {
      console.error("Failed to play sound:", error);
    }
  };

  const handleSelectDirectory = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "选择音频文件夹 (0-9.mp3/wav)"
      });
      if (selected && typeof selected === "string") {
        setCustomPath(selected);
        localStorage.setItem("custom-sound-path", selected);
        await invoke("set_custom_path", { path: selected });
      } else if (selected === null) {
        // User cancelled, optional: clear path?
      }
    } catch (err) {
      console.error("Failed to open dialog:", err);
    }
  };

  const handleResetDirectory = async () => {
    setCustomPath(null);
    localStorage.removeItem("custom-sound-path");
    await invoke("set_custom_path", { path: null });
  };

  const updateLabel = (key: string, label: string) => {
    const newConfigs = { ...configs, [key]: { label } };
    setConfigs(newConfigs);
    localStorage.setItem("key-configs", JSON.stringify(newConfigs));
  };

  useEffect(() => {
    // Sync initial custom path to backend
    if (customPath) {
      invoke("set_custom_path", { path: customPath }).catch(console.error);
    }

    const unlisten = listen<string>("key-pressed", (event) => {
      setActiveKey(event.payload);
      setTimeout(() => setActiveKey(null), 200);
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      if (keys.includes(key) && key !== "") {
        playSound(key);
        setActiveKey(key);
        setTimeout(() => setActiveKey(null), 200);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      unlisten.then((f) => f());
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="h-screen w-full bg-[#050914] flex flex-col items-center justify-center select-none overflow-hidden text-white relative font-sans">
      {/* Dynamic Gaming Background */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30 scale-105 animate-[pulse_8s_infinite_alternate]"
        style={{ backgroundImage: 'url("/bg_switch.png")' }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#050914]/80 via-transparent to-[#050914]/90" />
      
      {/* Background Neon Glows (Switch Red/Blue) */}
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-[#ff003c]/15 blur-[120px] rounded-full pointer-events-none animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-[#00e5ff]/10 blur-[120px] rounded-full pointer-events-none animate-pulse" style={{ animationDelay: '2s' }} />

      {/* Settings Toggle */}
      <button 
        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
        className="absolute top-8 right-8 z-50 p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-all active:scale-90 shadow-lg backdrop-blur-md"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
      </button>

      {/* Main Board */}
      <div className={`relative transition-all duration-700 ease-out ${isSettingsOpen ? 'scale-90 blur-2xl opacity-0 pointer-events-none' : 'scale-100 opacity-100'}`}>
        <div className="bg-slate-900/40 backdrop-blur-3xl p-10 rounded-[3.5rem] border border-white/10 shadow-[0_30px_100px_rgba(0,0,0,0.6)] w-full max-w-[420px]">
          <div className="flex flex-col items-center mb-10">
            <h1 className="text-3xl font-[1000] tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-[#ff003c] via-white to-[#00e5ff] uppercase italic">
              SWITCH LIVE
            </h1>
            <div className="h-1.5 w-16 bg-gradient-to-r from-[#ff003c] to-[#00e5ff] rounded-full mt-3 shadow-[0_0_15px_rgba(255,0,60,0.5)]" />
          </div>
          
          <div className="grid grid-cols-3 gap-6">
            {keys.map((key, idx) => {
              const column = idx % 3;
              const isLeft = column === 0 && key !== "";
              const isRight = column === 2;
              
              const activeColor = isLeft ? "bg-[#ff003c]" : isRight ? "bg-[#00e5ff]" : "bg-white";
              const shadowColor = isLeft ? "shadow-[#ff003c]/60" : isRight ? "shadow-[#00e5ff]/60" : "shadow-white/60";

              return key ? (
                <button
                  key={idx}
                  onClick={() => playSound(key)}
                  className={`
                    aspect-square rounded-[2.2rem] transition-all duration-300
                    flex flex-col items-center justify-center
                    border border-white/5 relative overflow-hidden group
                    ${activeKey === key 
                      ? `${activeColor} scale-90 shadow-[0_0_40px] ${shadowColor} text-slate-900 border-white/40` 
                      : "bg-white/5 hover:bg-white/10 text-slate-100 backdrop-blur-md"}
                  `}
                >
                  {/* Digital Indicator */}
                  <span className={`font-black italic tracking-tighter transition-all duration-500 ${
                    configs[key]?.label 
                      ? 'absolute top-4 right-5 text-sm opacity-60' 
                      : 'text-5xl opacity-90 group-hover:scale-110 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]'
                  } ${activeKey === key ? 'opacity-100 scale-110' : ''}`}>
                    {key}
                  </span>
                  
                  {/* Label (Center) */}
                  {configs[key]?.label && (
                    <span className={`text-lg font-black tracking-widest pt-1 px-2 text-center break-words animate-in fade-in zoom-in duration-500 ${activeKey === key ? 'text-slate-900' : 'text-white'}`}>
                      {configs[key].label}
                    </span>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                </button>
              ) : (
                <div key={idx} />
              );
            })}
          </div>

          <div className="mt-10 flex flex-col items-center gap-2">
            <div className="flex items-center gap-3 text-slate-400 text-[11px] font-black uppercase tracking-[0.3em]">
              <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_12px_#22c55e] animate-pulse" />
              {customPath ? "PRO MODE" : "STANDARD"}
            </div>
          </div>
        </div>
      </div>

      {/* Settings Screen */}
      {isSettingsOpen && (
        <div className="absolute inset-0 z-40 flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-slate-900/80 backdrop-blur-2xl w-full max-w-sm rounded-[2.5rem] border border-white/10 p-8 shadow-3xl max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">设置 / Settings</h2>
              <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-6 scrollbar-hide">
              {/* Folder Selection */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">音频目录 / Sound Directory</label>
                <div className="flex flex-col gap-2">
                  <div className="bg-white/5 p-3 rounded-2xl text-[10px] break-all border border-white/5 text-slate-400">
                    {customPath || "未选择自定义目录 (默认使用 public/voices)"}
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={handleSelectDirectory}
                      className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold transition-all active:scale-95"
                    >
                      选择文件夹 / Select
                    </button>
                    {customPath && (
                      <button 
                        onClick={handleResetDirectory}
                        className="px-4 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl text-xs font-bold transition-all active:scale-95"
                      >
                        重置
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Key Naming */}
              <div className="space-y-4">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">按键重命名 / Key Labels</label>
                <div className="grid grid-cols-2 gap-3">
                  {["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"].map(num => (
                    <div key={num} className="bg-white/5 p-2 rounded-xl border border-white/5 flex items-center gap-2">
                      <span className="text-xs font-mono bg-white/10 w-6 h-6 flex items-center justify-center rounded-md text-blue-400">{num}</span>
                      <input 
                        type="text"
                        placeholder="静音/哈哈..."
                        maxLength={4}
                        value={configs[num]?.label || ""}
                        onChange={(e) => updateLabel(num, e.target.value)}
                        className="bg-transparent border-none outline-none text-xs w-full text-slate-200 placeholder:text-slate-600"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button 
              onClick={() => setIsSettingsOpen(false)}
              className="mt-6 w-full py-4 bg-white/10 hover:bg-white/20 rounded-2xl font-bold transition-all"
            >
              完成 / Done
            </button>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}

export default App;
