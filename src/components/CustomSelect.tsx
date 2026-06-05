import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  className?: string;
  position?: 'absolute' | 'relative';
}

export const CustomSelect: React.FC<CustomSelectProps> = ({ value, onChange, options, className = '', position = 'absolute' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const selectedOption = options.find(opt => opt.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between w-full bg-[#1b1b1f]/60 backdrop-blur-md border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white/95 outline-none hover:border-brand/40 transition-all cursor-pointer ${className}`}
      >
        <span>{selectedOption?.label}</span>
        <ChevronDown className={`w-4 h-4 text-white/40 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className={`${
          position === 'relative' 
            ? 'relative w-full' 
            : 'absolute left-0 right-0 z-[80]'
        } mt-1.5 bg-[#1b1b1f] border border-white/10 rounded-xl overflow-hidden shadow-2xl max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150 scrollbar-custom`}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full text-left px-4 py-2.5 text-xs transition-colors hover:bg-white/5 cursor-pointer ${
                option.value === value ? 'text-brand font-bold bg-white/5' : 'text-white/80'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
