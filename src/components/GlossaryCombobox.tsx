import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, Mail } from 'lucide-react';
import { useTranslation } from '../i18n/TranslationContext';

interface GlossaryOption {
  value: string;
  label: string;
}

interface GlossaryComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: GlossaryOption[];
}

export const GlossaryCombobox: React.FC<GlossaryComboboxProps> = ({ value, onChange, options }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    } else {
      setSearch('');
    }
  }, [isOpen]);

  const filteredOptions = options.filter(opt => 
    opt.value === 'auto' || 
    (opt.label || '').toLowerCase().includes((search || '').toLowerCase())
  );

  const selectedOption = options.find(o => o.value === value) || options[0];

  return (
    <div className="relative" ref={containerRef}>
      <div 
        className="bg-black/20 border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-xs text-white">{selectedOption?.label}</span>
        <ChevronDown className="w-4 h-4 text-white/40" />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-bg-dark/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[300px]">
          <div className="p-2 border-b border-white/5 shrink-0 relative">
            <Search className="w-4 h-4 text-white/40 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              ref={inputRef}
              type="text"
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-white outline-none focus:border-brand/50"
              placeholder={t('glossary.searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="overflow-y-auto custom-scrollbar flex-1 p-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-xs flex items-center justify-between ${
                    value === opt.value 
                      ? 'bg-brand/10 text-brand font-medium' 
                      : 'text-white/80 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {opt.label}
                  {value === opt.value && <Check className="w-3.5 h-3.5" />}
                </button>
              ))
            ) : (
              <div className="px-3 py-4 text-center text-xs text-white/40">
                No styles found.
              </div>
            )}
          </div>
          <div className="p-2 border-t border-white/5 shrink-0 bg-black/20">
            <a
              href="mailto:lewtchy@gmail.com?subject=Requesting%20a%20Dance%20Style%20Glossary&body=Hi%2C%0A%0AI%20would%20like%20to%20request%20a%20new%20dance%20style%20glossary%20for%3A%0A%0ADance%20Style%3A%20%5BEnter%20Style%5D"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full text-center px-3 py-2.5 rounded-lg text-xs text-brand/80 hover:text-brand hover:bg-brand/10 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Mail className="w-3.5 h-3.5" />
              {t('glossary.requestGlossary')}
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
