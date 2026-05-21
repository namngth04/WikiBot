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
  // Định nghĩa kích thước hiển thị đồng bộ
  const sizes = {
    sm: {
      container: 'w-8 h-8 rounded-lg p-1.5',
      botIcon: 18,
      sparkleIcon: 10,
      sparkleContainer: '-top-0.5 -right-0.5 p-0.5 bg-indigo-500 rounded-full border border-white',
    },
    md: {
      container: 'w-10 h-10 rounded-xl p-2.5',
      botIcon: 20,
      sparkleIcon: 12,
      sparkleContainer: '-top-1 -right-1 p-0.5 bg-indigo-500 rounded-full border border-white',
    },
    lg: {
      container: 'w-16 h-16 rounded-2xl p-4',
      botIcon: 32,
      sparkleIcon: 16,
      sparkleContainer: '-top-1.5 -right-1.5 p-1 bg-indigo-500 rounded-full border-2 border-white',
    },
  };

  const currentSize = sizes[size];

  const logoContent = (
    <div className={cn(
      "relative inline-flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg text-white shrink-0",
      currentSize.container,
      className
    )}>
      {/* Icon Robot thông minh */}
      <Bot size={currentSize.botIcon} className="text-white" />
      
      {/* Badge Sparkles thu nhỏ nổi bật góc phải */}
      <div className={cn(
        "absolute flex items-center justify-center shadow-md",
        currentSize.sparkleContainer
      )}>
        <Sparkles size={currentSize.sparkleIcon} className="text-white fill-white" />
      </div>
    </div>
  );

  if (animate) {
    return (
      <motion.div
        className="inline-block shrink-0"
        whileHover={{ scale: 1.08, rotate: [0, -5, 5, 0] }}
        animate={size === 'lg' ? { scale: [1, 1.04, 1], y: [0, -3, 0] } : undefined}
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
