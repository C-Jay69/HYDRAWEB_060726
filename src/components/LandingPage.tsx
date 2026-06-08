import React, { useState, useEffect } from 'react';
import { Code, Send, Plus, Mic, Globe, Mail, Copy, User, Rocket, Key, Loader2 } from 'lucide-react';
import { generateWebsite } from '../utils/aiService';

interface LandingPageProps {
  onStart: (content: { html: string; css: string }) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
  const [prompt, setPrompt] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showKeyInput, setShowKeyInput] = useState(false);

  useEffect(() => {
    const savedKey = localStorage.getItem('hydraweb_api_key');
    if (savedKey) setApiKey(savedKey);
  }, []);

  const handleGenerate = async (overridePrompt?: string) => {
    const finalPrompt = overridePrompt || prompt;
    if (!finalPrompt) return alert('Please enter a prompt first!');
    if (!apiKey) {
      setShowKeyInput(true);
      return alert('Please enter your OpenRouter API key!');
    }

    setIsLoading(true);
    try {
      localStorage.setItem('hydraweb_api_key', apiKey);
      const content = await generateWebsite(finalPrompt, apiKey);
      onStart(content);
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-purple-500/30">
      {/* ... nav and hero ... */}
      {/* I will update the buttons specifically */}

      {/* Hero Section */}
      <main className="max-w-4xl mx-auto pt-32 pb-20 px-4 text-center">
        <h1 className="text-5xl md:text-6xl font-extrabold mb-6 tracking-tight leading-tight">
          Build beautiful <span className="italic text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-violet-500">websites</span> with AI
        </h1>
        <p className="text-xl text-gray-400 mb-4">
          With drag & drop editing and HTML output
        </p>
        <p className="text-gray-500 mb-12 italic">
          Your future self will love you
        </p>

        {/* AI Input Area */}
        <div className="relative group max-w-2xl mx-auto">
          <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
          <div className="relative bg-[#0a0a0a] border border-white/10 rounded-2xl p-4 shadow-2xl">
            <textarea
              id="user-prompt"
              name="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Let's create a website for your e-commerce store redesign..."
              className="w-full bg-transparent border-none focus:ring-0 text-lg resize-none h-24 text-gray-200 placeholder-gray-600"
              disabled={isLoading}
            />

            <div className="flex items-center justify-between mt-4">
              <div className="flex gap-2">
                <button className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-xs font-medium text-purple-400">
                  <Globe size={14} />
                  Web
                </button>
                <button className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 border border-transparent rounded-full text-xs font-medium text-gray-500 hover:text-gray-300">
                  <Mail size={14} />
                  Email
                </button>
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowKeyInput(!showKeyInput)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${showKeyInput ? 'bg-purple-600 text-white' : 'bg-white/5 border border-white/10 text-gray-500 hover:text-gray-300'}`}
                >
                  <Key size={14} />
                  {apiKey ? 'Key Set' : 'API Key'}
                </button>
                <button className="text-gray-500 hover:text-white transition-colors">
                  <Plus size={20} />
                </button>
                <button className="text-gray-500 hover:text-white transition-colors">
                  <Mic size={20} />
                </button>
                <button
                  onClick={() => handleGenerate()}
                  disabled={isLoading}
                  className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center hover:bg-purple-500 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="ml-0.5" />}
                </button>
              </div>
            </div>

            {/* API Key Input Field */}
            {showKeyInput && (
              <div className="mt-4 pt-4 border-t border-white/10 animate-in fade-in slide-in-from-top-2">
                <input
                  id="api-key"
                  name="api_key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your OpenRouter API Key..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap justify-center gap-4 mt-12">
          <button
            onClick={() => handleGenerate('Clone a modern landing page for a SaaS')}
            className="flex items-center gap-2 px-6 py-2.5 bg-white/5 border border-white/10 rounded-full text-sm font-medium hover:bg-white/10 transition-colors"
          >
            <Copy size={16} className="text-gray-400" />
            Clone a website
          </button>
          <button
            onClick={() => handleGenerate('Create a personal portfolio website for a designer')}
            className="flex items-center gap-2 px-6 py-2.5 bg-white/5 border border-white/10 rounded-full text-sm font-medium hover:bg-white/10 transition-colors"
          >
            <User size={16} className="text-gray-400" />
            Personal Website
          </button>
          <button
            onClick={() => handleGenerate('Generate a high-converting product landing page')}
            className="flex items-center gap-2 px-6 py-2.5 bg-white/5 border border-white/10 rounded-full text-sm font-medium hover:bg-white/10 transition-colors"
          >
            <Rocket size={16} className="text-gray-400" />
            New Product Landing Page
          </button>
        </div>
      </main>

      {/* Subtle background glow */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-600/10 blur-[100px] -z-10 rounded-full" />
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-purple-900/10 blur-[120px] -z-10 rounded-full" />
    </div>
  );
};

export default LandingPage;
