import React, { useEffect, useRef } from 'react';

interface AutoGrowingTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  // any additional custom props
}

export const AutoGrowingTextarea = React.forwardRef<HTMLTextAreaElement, AutoGrowingTextareaProps>(
  ({ className = '', onChange, value, ...props }, ref) => {
    const localRef = useRef<HTMLTextAreaElement | null>(null);
    const textareaRef = (ref as React.MutableRefObject<HTMLTextAreaElement | null>) || localRef;

    const adjustHeight = () => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
      }
    };

    useEffect(() => {
      adjustHeight();
    }, [value]);

    return (
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          if (onChange) onChange(e);
          adjustHeight();
        }}
        className={`resize-none overflow-hidden ${className}`}
        {...props}
      />
    );
  }
);

AutoGrowingTextarea.displayName = 'AutoGrowingTextarea';
