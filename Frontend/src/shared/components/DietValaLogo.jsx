import React from 'react';
import { useAppLogo } from "@food/hooks/useAppLogo";

/**
 * DietValaLogo Component
 * Renders the custom uploaded logo from business settings/admin if uploaded, 
 * otherwise renders the default SVG vector DietVala logo.
 */
export default function DietValaLogo({ 
  size = 'md', // 'sm', 'md', 'lg', 'xl'
  showTagline = false,
  showText = true,
  className = '',
  stacked = true,
  lightText = false
}) {
  const dynamicLogoUrl = useAppLogo('user_app');

  const sizeMap = {
    sm: { mark: 'h-9 w-auto', text: 'text-xl', tagline: 'text-[8.5px]', img: 'h-9' },
    md: { mark: 'h-13 sm:h-14 w-auto', text: 'text-3xl sm:text-4xl', tagline: 'text-[10px] sm:text-[11px]', img: 'h-14' },
    lg: { mark: 'h-18 w-auto', text: 'text-4xl sm:text-5xl', tagline: 'text-[13px]', img: 'h-18' },
    xl: { mark: 'h-28 w-auto', text: 'text-6xl sm:text-7xl', tagline: 'text-[17px]', img: 'h-28' },
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  if (dynamicLogoUrl) {
    return (
      <div className={`flex flex-col items-center justify-center ${className}`}>
        <img 
          src={dynamicLogoUrl} 
          alt="App Logo" 
          className={`${currentSize.img} w-auto object-contain mix-blend-multiply`} 
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      </div>
    );
  }

  return (
    <div className={`flex ${stacked ? 'flex-col items-center justify-center' : 'flex-row items-center gap-2'} ${className}`}>
      <div className={`${stacked ? 'flex flex-col items-center' : 'flex items-center gap-2'}`}>
        {/* Exact DietVala D Logo Mark with Motion Lines & White Outline Leaf */}
        <div className={`${currentSize.mark} relative flex items-center justify-center flex-shrink-0 mb-0.5`}>
          <svg className="h-full w-auto aspect-[1.35/1]" viewBox="0 0 240 180" fill="none">
            {/* 4 Motion Speed Lines */}
            <rect x="10" y="54" width="60" height="13" rx="6.5" fill="#FFC700" />
            <rect x="32" y="79" width="60" height="13" rx="6.5" fill="#FFC700" />
            <rect x="32" y="104" width="48" height="13" rx="6.5" fill="#FFC700" />
            <rect x="50" y="129" width="32" height="13" rx="6.5" fill="#FFC700" />

            {/* Main Thick Yellow D Loop */}
            <path
              d="M90 12 C90 12 178 8 198 46 C218 84 200 138 148 158 C112 174 66 156 66 156 L100 22 Z"
              fill="#FFC700"
            />

            {/* Green Leaf overlay inside D */}
            <path
              d="M82 158 C82 158 78 92 148 48 C184 26 194 40 184 66 C170 112 110 148 82 158 Z"
              fill="#16A34A"
            />

            {/* White Leaf Vein Stroke */}
            <path
              d="M86 150 C102 128 134 94 174 56"
              stroke="#FFFFFF"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <path
              d="M106 130 C114 114 126 102 136 92"
              stroke="#FFFFFF"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* DietVala Text: Bold Italic Black "Diet" with Green Leaf + Bold Green "Vala" */}
        {showText && (
          <div className={`${currentSize.text} font-black italic tracking-tighter flex items-center leading-none select-none`}>
            <span className={lightText ? "text-white" : "text-[#111827] dark:text-white"}>Diet</span>
            <span className="text-[#388E3C] not-italic ml-0.5 font-black">Vala</span>
          </div>
        )}
      </div>

      {/* Tagline: Healthy khana, Aapke ghar tak */}
      {showTagline && (
        <div className="flex items-center gap-2 mt-1">
          <div className="h-[2px] w-6 sm:w-10 bg-[#FFB800]" />
          <span className={`${currentSize.tagline} font-black text-[#1F2937] dark:text-gray-100 tracking-tight whitespace-nowrap`}>
            Healthy khana, Aapke ghar tak
          </span>
          <div className="h-[2px] w-6 sm:w-10 bg-[#FFB800]" />
        </div>
      )}
    </div>
  );
}
