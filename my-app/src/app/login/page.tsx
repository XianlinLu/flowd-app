'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function LoginPage() {
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#e6e8e6]">
      {/* Fallback Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat z-0"
        style={{ backgroundImage: 'url("/jimeng-2026-04-05-6729-将图中所有文字完全移除。仅保留背景中的内容不变.png")' }}
      />

      {/* Background Video */}
      <video 
        autoPlay 
        loop 
        muted 
        playsInline 
        onCanPlay={() => setIsVideoLoaded(true)}
        poster="/jimeng-2026-04-05-6729-将图中所有文字完全移除。仅保留背景中的内容不变.png"
        className={`absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-1000 ${
          isVideoLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <source src="/hero-video.mp4" type="video/mp4" />
      </video>
      
      {/* Top Navigation */}
      <div className="relative z-10 flex justify-between items-center px-10 py-8 w-full">
        <a 
          href="https://flowd-thinking-os.com/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-white font-bold tracking-widest text-sm uppercase hover:opacity-80 transition-opacity cursor-pointer"
        >
          FLOWD
        </a>
        <a 
          href="/api/feishu/login"
          className="px-6 py-2 rounded-full border border-white text-white text-sm font-medium hover:bg-white/20 transition-colors backdrop-blur-sm"
        >
          Sign In
        </a>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-[calc(100vh-100px)] text-center text-white">
        <p className="text-xs tracking-[0.3em] uppercase mb-4 text-white">
          THINKING OS
        </p>
        <h1 className="text-7xl md:text-[90px] font-semibold tracking-tight leading-none mb-2 text-white">
          Form follows
        </h1>
        <h1 className="text-7xl md:text-[90px] font-serif italic tracking-tight leading-none mb-6 text-white">
          thoughts.
        </h1>
        <p className="text-sm md:text-base text-white mt-4 tracking-wide font-light">
          Flowd shapes the form as the thinking unfolds.
        </p>
      </div>
    </div>
  );
}
