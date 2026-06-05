import React from 'react';

interface CustomSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: React.ReactNode;
  id?: string;
  className?: string;
}

export const CustomSwitch: React.FC<CustomSwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  label,
  id,
  className = ''
}) => {
  return (
    <label className={`flex items-center justify-between w-full select-none ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'} ${className}`}>
      {label && <span className="text-sm font-semibold text-white">{label}</span>}
      <div className="relative flex items-center">
        <input
          type="checkbox"
          id={id}
          disabled={disabled}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div className={`w-9 h-5 rounded-full transition-colors duration-200 ${
          checked ? 'bg-brand/90 shadow-[0_0_8px_rgba(45,212,191,0.2)]' : 'bg-white/10'
        }`} />
        <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-4 bg-black' : 'translate-x-0'
        }`} />
      </div>
    </label>
  );
};
