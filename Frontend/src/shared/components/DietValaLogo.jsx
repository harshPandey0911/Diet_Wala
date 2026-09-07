import React from 'react';

/**
 * DietValaLogo Component
 * Renders the accurate DietVala brand logo with logo mark D, text, and tagline optional.
 */
export default function DietValaLogo({ 
  size = 'md', // 'sm', 'md', 'lg', 'xl'
  showTagline = false,
  className = '',
  stacked = true
}) {
  const sizeMap = {
    sm: { mark: 'w-6 h-6', text: 'text-base', tagline: 'text-[7px]' },
    md: { mark: 'w-8 h-8', text: 'text-lg sm:text-xl', tagline: 'text-[8px]' },
    lg: { mark: 'w-10 h-10', text: 'text-2xl', tagline: 'text-[10px]' },
    xl: { mark: 'w-14 h-14', text: 'text-3xl sm:text-4xl', tagline: 'text-[12px]' },
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  return (
    <div className={`flex ${stacked ? 'flex-col items-center justify-center' : 'flex-row items-center gap-2'} ${className}`}>
      <div className={`${stacked ? 'flex flex-col items-center' : 'flex items-center gap-2'}`}>
        {/* Stylized D Leaf Logo Mark */}
        <div className={`${currentSize.mark} relative flex items-center justify-center flex-shrink-0 mb-0.5`}>
          <svg className="w-full h-full" viewBox="0 0 100 100" fill="none">
            {/* Gold D outer shape */}
            <path d="M22 14 H56 C76 14, 88 28, 88 48 C88 68, 76 82, 56 82 H22 V14 Z" fill="#FFC700" />
            {/* Inner cut */}
            <path d="M34 26 H53 C66 26, 75 36, 75 48 C75 60, 66 70, 53 70 H34 V26 Z" fill="#FFFBEB" />
            {/* Green Leaf inside D */}
            <path d="M42 42 C42 30, 62 33, 62 48 C62 62, 47 60, 42 42 Z" fill="#16A34A" />
          </svg>
        </div>

        {/* DietVala Text */}
        <span className={`${currentSize.text} font-black tracking-tight flex items-center leading-none`}>
          <span className="text-[#262626] dark:text-white">Diet</span>
          <span className="text-[#16A34A]">Vala</span>
        </span>
      </div>

      {/* Optional Tagline */}
      {showTagline && (
        <div className="flex items-center gap-1.5 mt-0.5">
          <div className="h-[1.5px] w-5 sm:w-6 bg-[#FFC700]" />
          <span className={`${currentSize.tagline} font-bold text-gray-700 dark:text-gray-300 tracking-tight whitespace-nowrap`}>
            Healthy khana, Aapke ghar tak
          </span>
          <div className="h-[1.5px] w-5 sm:w-6 bg-[#FFC700]" />
        </div>
      )}
    </div>
  );
}
