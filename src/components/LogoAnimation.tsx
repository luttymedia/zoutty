import React, { useLayoutEffect, useRef } from 'react';

interface LogoAnimationProps {
  onComplete: () => void;
}

export const LogoAnimation: React.FC<LogoAnimationProps> = ({ onComplete }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const onCompleteRef = useRef(onComplete);

  useLayoutEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useLayoutEffect(() => {
    const wrapper = containerRef.current;
    if (!wrapper) return;

    // Fixed snake lengths (from sandbox)
    const SNAKE_LEN_1 = 183;
    const SNAKE_LEN_2 = 189;
    wrapper.style.setProperty('--snake-length-1', SNAKE_LEN_1.toString());
    wrapper.style.setProperty('--snake-length-2', SNAKE_LEN_2.toString());

    let isOutro = false;
    let outroTimer: any = null;

    function calculateTrimPositions() {
      const line1 = wrapper!.querySelector('#guide-1') as SVGPathElement;
      const line2 = wrapper!.querySelector('#guide-2') as SVGPathElement;
      
      // Force layout flush so getTotalLength returns correct updated value
      void line1.getBoundingClientRect();
      
      const trackLen1 = line1.getTotalLength() || 277.03;
      const trackLen2 = line2.getTotalLength() || 277.03;
      wrapper!.style.setProperty('--track-length-1', trackLen1.toString());
      wrapper!.style.setProperty('--track-length-2', trackLen2.toString());

      const pt0_1 = line1.getPointAtLength(0);
      const pt1_1 = line1.getPointAtLength(1);
      const dirY_1 = (pt1_1.y - pt0_1.y); 
      const startY_1 = pt0_1.y + dirY_1 * (-SNAKE_LEN_1);
      const endY_1 = line1.getPointAtLength(Math.max(0, trackLen1 - SNAKE_LEN_1)).y;

      wrapper!.style.setProperty('--clip-y-start-1', (startY_1 - 8) + 'px');
      wrapper!.style.setProperty('--clip-y-end-1', (endY_1 - 8) + 'px');

      const pt0_2 = line2.getPointAtLength(0);
      const pt1_2 = line2.getPointAtLength(1);
      const dirY_2 = (pt1_2.y - pt0_2.y); 
      const startY_2 = pt0_2.y + dirY_2 * (-SNAKE_LEN_2);
      const endY_2 = line2.getPointAtLength(Math.max(0, trackLen2 - SNAKE_LEN_2)).y;

      wrapper!.style.setProperty('--clip-y-start-2', (startY_2 + 8) + 'px');
      wrapper!.style.setProperty('--clip-y-end-2', (endY_2 + 8) + 'px');
    }

    function playOutro() {
      if (isOutro) return; 
      isOutro = true;
      
      const line1 = wrapper!.querySelector('#guide-1') as SVGPathElement;
      const line2 = wrapper!.querySelector('#guide-2') as SVGPathElement;
      const arrowMover = wrapper!.querySelector('.arrow-mover') as SVGGElement;
      
      // 1. Hide Final Logo & Re-show Guides
      (wrapper!.querySelector('.final-shapes') as HTMLElement).style.display = 'none';
      const animGuides = wrapper!.querySelector('.anim-guides') as SVGGElement;
      animGuides.style.opacity = '1';
      animGuides.style.visibility = 'visible';
      arrowMover.style.opacity = '1';
      
      // 2. Extend Paths Horizontally (Shooting out of the box)
      line1.setAttribute('d', 'M12.86,231.88 L133.73,82.44 C139.91,74.8 134.46,63.41 124.63,63.42 L-800,63.52');
      line2.setAttribute('d', 'M173.825,-4.603 L57.55,138.88 C51.34,146.55 56.81,157.99 66.68,157.98 L1000,157.88');
      (arrowMover as any).style.offsetPath = 'path("M173.825,-4.603 L57.55,138.88 C51.34,146.55 56.81,157.99 66.68,157.98 L1000,157.88")';
      
      // 3. Trigger Pure CSS Outro Animations!
      wrapper!.classList.add('outro-active');
    }

    // Initialize animation
    calculateTrimPositions();
    wrapper.classList.remove('anim-active');
    void wrapper.offsetWidth; 
    wrapper.classList.add('anim-active');
    
    outroTimer = setTimeout(playOutro, 4500);

    const completeTimer = setTimeout(() => {
      onCompleteRef.current();
    }, 5400);

    return () => {
      clearTimeout(outroTimer);
      clearTimeout(completeTimer);
    };
  }, []);

  return (
    <div ref={containerRef} className="logo-anim-overlay">
      {/* 
        This is the EXACT SVG copied verbatim from sandbox-v29-final.html
        React attributes (className, clipPath) are updated to match JSX syntax 
      */}
      <svg className="zoutty-logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 191.39 230.75">
        <defs>
          <clipPath id="box-clip">
            <rect y="22.92" width="191.39" height="191.39" rx="41.01" ry="41.01"/>
          </clipPath>

          <mask id="trim-1" maskUnits="userSpaceOnUse" x="-3000" y="-3000" width="6000" height="6000">
            <rect x="-3000" y="-3000" width="6000" height="6000" fill="white" />
            <rect className="mask-eraser-1" x="-3000" y="0" width="6000" height="3000" fill="black" />
          </mask>
          <mask id="trim-2" maskUnits="userSpaceOnUse" x="-3000" y="-3000" width="6000" height="6000">
            <rect x="-3000" y="-3000" width="6000" height="6000" fill="white" />
            <rect className="mask-eraser-2" x="-3000" y="-3000" width="6000" height="3000" fill="black" />
          </mask>
        </defs>

        <rect id="BOX" className="logo-box" fill="#2dd4bf" y="22.92" width="191.39" height="191.39" rx="41.01" ry="41.01"/>
        
        <g clipPath="url(#box-clip)" id="clip-wrapper">
          <g className="anim-guides">
            <path id="guide-1" className="stroke-line line-1" mask="url(#trim-1)" d="M12.86,231.88 L133.73,82.44 C139.91,74.8 134.46,63.41 124.63,63.42 L54.80,63.52" />
            <path id="guide-2" className="stroke-line line-2" mask="url(#trim-2)" d="M173.825,-4.603 L57.55,138.88 C51.34,146.55 56.81,157.99 66.68,157.98 L144.03,157.88" />
            <g className="arrow-mover" style={{ offsetPath: 'path("M173.825,-4.603 L57.55,138.88 C51.34,146.55 56.81,157.99 66.68,157.98 L144.03,157.88")' }}>
              <g transform="translate(-143.93, -157.88)">
                <path fill="#fff" d="M150.37,152.65l-15.95-15.95c-2.94-2.94-7.7-2.94-10.64,0s-2.94,7.7,0,10.64l10.64,10.64-10.64,10.64c-2.94,2.94-2.94,7.7,0,10.64s7.7,2.94,10.64,0l15.95-15.95c1.47-1.47,2.21-3.41,2.2-5.34,0-1.93-.73-3.86-2.2-5.34Z"/>
              </g>
            </g>
          </g>

          <g className="final-shapes" id="final-logo">
            <path fill="#fff" d="M123.89,71.04h.2c.07,0,.13.02.19.02.16,0,.32.02.48.05.14.02.28.04.42.08.15.04.29.08.43.13.14.05.28.1.42.17.13.06.25.13.37.2.14.08.28.17.41.27.05.04.11.06.16.1.06.05.1.11.16.16.12.11.23.22.34.34.1.11.19.22.27.33.09.12.17.24.25.37.08.13.15.25.21.38.06.13.12.27.17.41.05.14.09.28.13.42.04.14.06.28.09.43.02.16.04.32.05.48,0,.08.02.15.02.22,0,.07-.02.13-.02.19,0,.16-.02.32-.05.48-.02.14-.04.28-.08.42-.04.15-.08.29-.13.43-.05.14-.1.28-.17.42-.06.13-.13.25-.2.37-.08.14-.17.28-.27.41-.04.05-.06.11-.11.16l-48.68,59.93-2.26,2.78h18.7l2.28-2.78,42.06-51.31c10.25-12.5,1.35-31.29-14.81-31.29h0s-.04,0-.06,0c-.01,0-.02,0-.03,0H54.8c-4.15,0-7.52,3.37-7.52,7.52v.17c0,4.15,3.37,7.52,7.52,7.52h64.37s4.72,0,4.72,0Z"/>
            <path fill="#fff" d="M150.37,152.58l-15.95-15.95c-2.94-2.94-7.7-2.94-10.64,0s-2.94,7.7,0,10.64l3.12,3.12-24.92-.02-31.83-.02h-2.81s-.25,0-.25,0c-.07,0-.13-.02-.19-.02-.16,0-.32-.02-.48-.05-.14-.02-.28-.04-.42-.08-.14-.04-.29-.08-.43-.13-.14-.05-.29-.1-.42-.17-.13-.06-.25-.13-.37-.2-.14-.08-.28-.17-.41-.27-.05-.04-.11-.06-.16-.1-.06-.05-.1-.11-.16-.16-.12-.11-.24-.22-.34-.34-.1-.11-.19-.22-.27-.33-.09-.12-.17-.25-.25-.37-.08-.13-.15-.25-.21-.38-.06-.13-.12-.27-.17-.41-.05-.14-.09-.28-.13-.42-.04-.14-.06-.28-.09-.43-.02-.16-.04-.32-.05-.48,0-.08-.02-.15-.02-.22,0-.07.02-.13.02-.19,0-.16.02-.32.05-.48.02-.14.04-.28.08-.42.04-.15.08-.29.13-.43.05-.14.1-.28.17-.42.06-.13.13-.25.2-.37.08-.14.17-.28.27-.41.04-.05.06-.11.11-.16l47.54-58.51,3.41-4.2h-18.6l-3.44,4.2-40.8,49.77c-10.25,12.5-1.35,31.29,14.81,31.29h0c.05,0,.11,0,.16,0,.03,0,.06,0,.09,0h60.18s-3.12,3.12-3.12,3.12c-2.94,2.94-2.94,7.7,0,10.64s7.7,2.94,10.64,0l15.95-15.95c1.47-1.47,2.21-3.41,2.2-5.34,0-1.93-.73-3.86-2.2-5.34Z"/>
          </g>
          <g className="glow-shapes">
            <path fill="#fff" d="M123.89,71.04h.2c.07,0,.13.02.19.02.16,0,.32.02.48.05.14.02.28.04.42.08.15.04.29.08.43.13.14.05.28.1.42.17.13.06.25.13.37.2.14.08.28.17.41.27.05.04.11.06.16.1.06.05.1.11.16.16.12.11.23.22.34.34.1.11.19.22.27.33.09.12.17.24.25.37.08.13.15.25.21.38.06.13.12.27.17.41.05.14.09.28.13.42.04.14.06.28.09.43.02.16.04.32.05.48,0,.08.02.15.02.22,0,.07-.02.13-.02.19,0,.16-.02.32-.05.48-.02.14-.04.28-.08.42-.04.15-.08.29-.13.43-.05.14-.1.28-.17.42-.06.13-.13.25-.2.37-.08.14-.17.28-.27.41-.04.05-.06.11-.11.16l-48.68,59.93-2.26,2.78h18.7l2.28-2.78,42.06-51.31c10.25-12.5,1.35-31.29-14.81-31.29h0s-.04,0-.06,0c-.01,0-.02,0-.03,0H54.8c-4.15,0-7.52,3.37-7.52,7.52v.17c0,4.15,3.37,7.52,7.52,7.52h64.37s4.72,0,4.72,0Z"/>
            <path fill="#fff" d="M150.37,152.58l-15.95-15.95c-2.94-2.94-7.7-2.94-10.64,0s-2.94,7.7,0,10.64l3.12,3.12-24.92-.02-31.83-.02h-2.81s-.25,0-.25,0c-.07,0-.13-.02-.19-.02-.16,0-.32-.02-.48-.05-.14-.02-.28-.04-.42-.08-.14-.04-.29-.08-.43-.13-.14-.05-.29-.1-.42-.17-.13-.06-.25-.13-.37-.2-.14-.08-.28-.17-.41-.27-.05-.04-.11-.06-.16-.1-.06-.05-.1-.11-.16-.16-.12-.11-.24-.22-.34-.34-.1-.11-.19-.22-.27-.33-.09-.12-.17-.25-.25-.37-.08-.13-.15-.25-.21-.38-.06-.13-.12-.27-.17-.41-.05-.14-.09-.28-.13-.42-.04-.14-.06-.28-.09-.43-.02-.16-.04-.32-.05-.48,0-.08-.02-.15-.02-.22,0-.07.02-.13.02-.19,0-.16.02-.32.05-.48.02-.14.04-.28.08-.42.04-.15.08-.29.13-.43.05-.14.1-.28.17-.42.06-.13.13-.25.2-.37.08-.14.17-.28.27-.41.04-.05.06-.11.11-.16l47.54-58.51,3.41-4.2h-18.6l-3.44,4.2-40.8,49.77c-10.25,12.5-1.35,31.29,14.81,31.29h0c.05,0,.11,0,.16,0,.03,0,.06,0,.09,0h60.18s-3.12,3.12-3.12,3.12c-2.94,2.94-2.94,7.7,0,10.64s7.7,2.94,10.64,0l15.95-15.95c1.47-1.47,2.21-3.41,2.2-5.34,0-1.93-.73-3.86-2.2-5.34Z"/>
          </g>
        </g>
      </svg>
    </div>
  );
};
