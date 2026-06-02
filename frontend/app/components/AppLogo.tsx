'use client';

import React from 'react';
import { Bot, Sparkles } from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { motion } from 'framer-motion';

interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  animate?: boolean;
}

export default function AppLogo({ size = 'md', className, animate = true }: AppLogoProps) {
  const sizes = {
    sm: "w-8 h-8 rounded-md",
    md: "w-10 h-10 rounded-md",
    lg: "w-16 h-16 rounded-lg"
  };

  const logoContent = (
    <div className={cn(
      "relative inline-flex items-center justify-center shrink-0 overflow-hidden bg-transparent select-none pointer-events-none",
      sizes[size],
      className
    )}>
      <img 
        src="/chatbot.png" 
        alt="WikiBot Logo" 
        className="w-full h-full object-contain"
      />
    </div>
  );

  if (animate) {
    return (
      <motion.div
        className="inline-block shrink-0"
        whileHover={{ scale: 1.08, rotate: [0, -3, 3, 0] }}
        animate={size === 'lg' ? { scale: [1, 1.03, 1], y: [0, -2, 0] } : undefined}
        transition={{ 
          duration: size === 'lg' ? 4 : 0.25, 
          repeat: size === 'lg' ? Infinity : 0, 
          ease: 'easeInOut' 
        }}
      >
        {logoContent}
      </motion.div>
    );
  }

  return logoContent;
}
