import React, { useState } from 'react';
import { SYSTEM_GLOSSARIES } from '../lib/systemGlossaries';
import { useTranslation } from '../i18n/TranslationContext';
import { Save, Check } from 'lucide-react';
import { MultiSelectCombobox } from './MultiSelectCombobox';

interface MandatoryGlossaryModalProps {
  isOpen: boolean;
  onSave: (selectedIds: string[]) => void;
}

export const MandatoryGlossaryModal: React.FC<MandatoryGlossaryModalProps> = ({
  isOpen,
  onSave
}) => {
  const { t } = useTranslation();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  if (!isOpen) return null;


  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
      <div className="glass p-6 max-w-md w-full rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="mb-6 shrink-0 text-center">
          <h2 className="text-xl font-bold text-white mb-2">
            {t('glossary.mandatoryTitle')}
          </h2>
          <p className="text-sm text-white/60">
            {t('glossary.mandatoryDesc')}
          </p>
        </div>

        <div className="flex-1 overflow-y-visible space-y-2 mb-6">
          <MultiSelectCombobox
            selectedValues={selectedIds}
            onChange={setSelectedIds}
            options={SYSTEM_GLOSSARIES.map(g => ({ value: g.id, label: (t(`danceStyles.${g.id}`) as string) || g.name }))}
            placeholder={t('glossary.searchPlaceholder')}
          />
        </div>

        <div className="shrink-0 pt-4 border-t border-white/10">
          <button
            onClick={() => onSave(selectedIds)}
            disabled={selectedIds.length === 0}
            className="w-full px-4 py-4 rounded-xl bg-brand hover:bg-brand/90 text-bg-dark font-bold text-base transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand/20"
          >
            <Save className="w-5 h-5" />
            {t('glossary.continueBtn')}
          </button>
          {selectedIds.length === 0 && (
            <p className="text-center text-xs text-brand mt-3">
              {t('glossary.requireOne')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
