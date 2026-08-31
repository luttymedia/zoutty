import React, { useState, useEffect } from 'react';
import { X, Save, Trash2 } from 'lucide-react';
import { useTranslation } from '../i18n/TranslationContext';
import { DanceGlossary } from '../types';

interface GlossaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  glossary: DanceGlossary | null;
  onSave: (glossary: DanceGlossary) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export const GlossaryModal: React.FC<GlossaryModalProps> = ({
  isOpen,
  onClose,
  glossary,
  onSave,
  onDelete,
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [terms, setTerms] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (glossary) {
        setName(glossary.name);
        setTerms(glossary.terms.map(t => t.canonicalTerm).join('\n'));
      } else {
        setName('');
        setTerms('');
      }
    }
  }, [isOpen, glossary]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!name.trim() || !terms.trim()) return;
    setIsSaving(true);
    
    const parsedTerms = terms
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(term => ({
        canonicalTerm: term,
        variants: [],
        category: 'custom'
      }));

    try {
      await onSave({
        id: glossary?.id || Date.now().toString(),
        name: name.trim(),
        terms: parsedTerms,
        isSystem: glossary?.isSystem || false,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!glossary) return;
    setIsDeleting(true);
    try {
      await onDelete(glossary.id);
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  const isSystem = glossary?.isSystem;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="glass p-6 max-w-md w-full rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h2 className="text-lg font-bold text-white">
            {glossary ? t('common.edit') : t('glossary.addTitle')}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">
              {t('common.name') || 'Name'}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSystem}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-50"
              placeholder="e.g. Salsa, Bachata"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">
              {t('common.terms') || 'Terms'}
            </label>
            <textarea
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              disabled={isSystem}
              className="w-full h-48 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand resize-none disabled:opacity-50"
              placeholder="Enter terms, one per line..."
            />
            {isSystem && (
              <p className="text-xs text-brand/80 mt-1">
                System glossaries cannot be edited.
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3 shrink-0">
          {glossary && !isSystem && (
            <button
              onClick={handleDelete}
              disabled={isDeleting || isSaving}
              className="px-4 py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-semibold text-sm transition-colors flex items-center justify-center disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white text-sm font-semibold transition-colors"
          >
            {t('common.cancel')}
          </button>
          
          {!isSystem && (
            <button
              onClick={handleSave}
              disabled={!name.trim() || !terms.trim() || isSaving}
              className="flex-1 px-4 py-3 rounded-xl bg-brand hover:bg-brand/90 text-bg-dark font-bold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {t('common.save')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
