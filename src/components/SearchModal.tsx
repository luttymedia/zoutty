import React, { useState, useEffect } from 'react';
import { Search, Settings, X } from 'lucide-react';
import { CustomCheckbox } from './CustomCheckbox';
import { CustomSwitch } from './CustomSwitch';
import { CustomSelect } from './CustomSelect';
import { SearchFilters, defaultSearchFilters } from '../lib/search';
import { Glossary } from '../types';
import { useTranslation } from '../i18n/TranslationContext';

interface SearchModalProps {
  onClose: () => void;
  onConfirm: (query: string, filters: SearchFilters) => void;
  initialQuery?: string;
  initialFilters?: SearchFilters;
  glossaries: Glossary[];
}

export function SearchModal({
  onClose,
  onConfirm,
  initialQuery = '',
  initialFilters = defaultSearchFilters,
  glossaries
}: SearchModalProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState(initialQuery);
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);

  // Handle exclusivity of the "All" filter
  const handleFilterChange = (key: keyof SearchFilters, value: boolean | string) => {
    if (key === 'hasGalleryItems' || key === 'hasAudioRecordings' || key === 'glossaryUsed') {
      setFilters(prev => ({ ...prev, [key]: value }));
      return;
    }

    if (key === 'all') {
      if (value) {
        setFilters(prev => ({
          ...prev,
          all: true,
          folders: false,
          sessions: false,
          entries: false,
          transcriptions: false,
          reports: false,
          notes: false,
        }));
      } else {
        // Unchecking "All" without checking anything else shouldn't be allowed or defaults back to All.
        setFilters(prev => ({ ...prev, all: true }));
      }
    } else {
      // It's a specific filter
      setFilters(prev => {
        if (prev.all && typeof value === 'boolean') {
          // If "All" was checked, they clicked a specific filter to focus on it.
          // Because it was visually checked, the onChange fired with `false`, but they mean `true`.
          return {
            ...prev,
            all: false,
            folders: key === 'folders',
            sessions: key === 'sessions',
            entries: key === 'entries',
            transcriptions: key === 'transcriptions',
            reports: key === 'reports',
            notes: key === 'notes'
          };
        }
        
        const next = { ...prev, [key]: value, all: false };
        // If all specific standard filters become unchecked, revert to "All"
        if (!next.folders && !next.sessions && !next.entries && !next.transcriptions && !next.reports && !next.notes) {
          next.all = true;
        }
        return next;
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onConfirm(query, filters);
  };

  const glossaryOptions = [
    { value: 'all', label: t('search.anyGlossary') },
    ...glossaries.map(g => ({ value: g.id, label: g.name }))
  ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center z-50 p-6">
      <div className="glass p-6 max-w-md w-full animate-in zoom-in-95 flex flex-col max-h-[90vh]">
        <div className="flex items-center gap-3 border-b border-white/10 pb-4 mb-4">
          <div className="w-10 h-10 rounded-full bg-brand/20 flex items-center justify-center shrink-0">
            <Search className="w-5 h-5 text-brand" />
          </div>
          <h2 className="text-xl font-bold text-white">{t('search.title')}</h2>
          <button onClick={onClose} className="ml-auto p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-5 h-5 text-white/70" />
          </button>
        </div>

        {/* Search Input */}
        <div className="mb-6 relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 pl-11 text-white placeholder-white/40 focus:outline-none focus:border-brand/50 transition-colors"
            placeholder={t('search.placeholder')}
            autoFocus
          />
          <Search className="w-5 h-5 text-white/40 absolute left-3 top-3.5" />
        </div>

        <div className="mb-6 overflow-y-auto pr-2">
          {/* Filters */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-white/40 mb-3">{t('search.searchIn')}</h3>
            <div className="grid grid-cols-2 gap-3">
              <CustomCheckbox
                checked={filters.all}
                onChange={(c) => handleFilterChange('all', c)}
                label={t('search.all')}
              />
              <CustomCheckbox
                checked={filters.folders || filters.all}
                onChange={(c) => handleFilterChange('folders', c)}
                label={t('search.folders')}
                className={filters.all ? "opacity-50 hover:opacity-100 transition-opacity" : ""}
              />
              <CustomCheckbox
                checked={filters.sessions || filters.all}
                onChange={(c) => handleFilterChange('sessions', c)}
                label={t('search.sessions')}
                className={filters.all ? "opacity-50 hover:opacity-100 transition-opacity" : ""}
              />
              <CustomCheckbox
                checked={filters.entries || filters.all}
                onChange={(c) => handleFilterChange('entries', c)}
                label={t('search.entries')}
                className={filters.all ? "opacity-50 hover:opacity-100 transition-opacity" : ""}
              />
              <CustomCheckbox
                checked={filters.transcriptions || filters.all}
                onChange={(c) => handleFilterChange('transcriptions', c)}
                label={t('search.transcriptions')}
                className={filters.all ? "opacity-50 hover:opacity-100 transition-opacity" : ""}
              />
              <CustomCheckbox
                checked={filters.reports || filters.all}
                onChange={(c) => handleFilterChange('reports', c)}
                label={t('search.reports')}
                className={filters.all ? "opacity-50 hover:opacity-100 transition-opacity" : ""}
              />
              <CustomCheckbox
                checked={filters.notes || filters.all}
                onChange={(c) => handleFilterChange('notes', c)}
                label={t('search.notes')}
                className={filters.all ? "opacity-50 hover:opacity-100 transition-opacity" : ""}
              />
            </div>
          </div>

          {/* Advanced Filters */}
          <div className="mb-2 p-4 bg-white/5 rounded-xl border border-white/5">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-brand/70 mb-4 flex items-center gap-2">
              <Settings className="w-4 h-4" />
              {t('search.advancedFilters')}
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/80">{t('search.hasGalleryItems')}</span>
                <CustomSwitch
                  checked={filters.hasGalleryItems}
                  onChange={(c) => handleFilterChange('hasGalleryItems', c)}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/80">{t('search.hasAudioRecordings')}</span>
                <CustomSwitch
                  checked={filters.hasAudioRecordings}
                  onChange={(c) => handleFilterChange('hasAudioRecordings', c)}
                />
              </div>
              <div className="pt-2 border-t border-white/10 space-y-2 relative">
                <span className="text-sm text-white/80 block">{t('search.glossaryUsed')}</span>
                <CustomSelect
                  value={filters.glossaryUsed}
                  onChange={(v) => handleFilterChange('glossaryUsed', v || 'all')}
                  options={glossaryOptions}
                  className="w-full"
                  position="fixed"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-auto">
          <button
            onClick={onClose}
            className="flex-1 py-3 glass bg-white/5 border-white/10 text-white/70 font-semibold rounded-xl hover:bg-white/10 transition-colors"
          >
            {t('search.cancel')}
          </button>
          <button
            onClick={() => onConfirm(query, filters)}
            className="flex-1 py-3 glass bg-brand/20 border-brand/30 text-brand font-bold rounded-xl hover:bg-brand/30 transition-colors shadow-[0_0_15px_rgba(45,212,191,0.2)]"
          >
            {t('search.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
