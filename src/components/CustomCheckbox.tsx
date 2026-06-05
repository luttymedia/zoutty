import React from 'react';

interface CustomCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: React.ReactNode;
  id?: string;
  className?: string;
}

export const CustomCheckbox: React.FC<CustomCheckboxProps> = ({
  checked,
  onChange,
  disabled = false,
  label,
  id,
  className = ''
}) => {
  return (
    <label className={`flex items-start gap-3 select-none ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'} ${className}`}>
      <div className="relative flex items-center mt-0.5">
        <input
          type="checkbox"
          id={id}
          disabled={disabled}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div className={`w-4 h-4 border rounded transition-all duration-150 flex items-center justify-center ${
          checked 
            ? 'bg-brand border-brand shadow-[0_0_8px_rgba(45,212,191,0.3)]' 
            : 'bg-black/30 border-white/20 hover:border-brand/40'
        }`}>
          {checked && (
            <svg className="w-2.5 h-2.5 text-black stroke-[3px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          )}
        </div>
      </div>
      {label && <span className="text-xs text-white/80">{label}</span>}
    </label>
  );
};
