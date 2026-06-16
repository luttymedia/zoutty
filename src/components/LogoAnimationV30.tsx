import React, { useState, useLayoutEffect, useRef } from 'react';

interface LogoAnimationProps {
  onComplete: () => void;
}

export const LogoAnimationV30: React.FC<LogoAnimationProps> = ({ onComplete }) => {
  const [animActive, setAnimActive] = useState(false);
  const [outroActive, setOutroActive] = useState(false);
  const [variables, setVariables] = useState<React.CSSProperties>({});
  
  const containerRef = useRef<HTMLDivElement>(null);
  const line1Ref = useRef<SVGPathElement>(null);
  const line2Ref = useRef<SVGPathElement>(null);

  useLayoutEffect(() => {
    // 1. Calculate path length and clip coordinates
    const line1 = line1Ref.current;
    const line2 = line2Ref.current;
    if (!line1 || !line2) return;

    const SNAKE_LEN_1 = 183;
    const SNAKE_LEN_2 = 189;

    const trackLen1 = line1.getTotalLength() || 277.03;
    const trackLen2 = line2.getTotalLength() || 277.03;

    // Calculate Y offsets for trimming masks dynamically
    const pt0_1 = line1.getPointAtLength(0);
    const pt1_1 = line1.getPointAtLength(1);
    const dirY_1 = pt1_1.y - pt0_1.y;
    const startY_1 = pt0_1.y + dirY_1 * (-SNAKE_LEN_1);
    const endY_1 = line1.getPointAtLength(Math.max(0, trackLen1 - SNAKE_LEN_1)).y;

    const pt0_2 = line2.getPointAtLength(0);
    const pt1_2 = line2.getPointAtLength(1);
    const dirY_2 = pt1_2.y - pt0_2.y;
    const startY_2 = pt0_2.y + dirY_2 * (-SNAKE_LEN_2);
    const endY_2 = line2.getPointAtLength(Math.max(0, trackLen2 - SNAKE_LEN_2)).y;

    setVariables({
      '--snake-length-1': SNAKE_LEN_1,
      '--snake-length-2': SNAKE_LEN_2,
      '--track-length-1': trackLen1,
      '--track-length-2': trackLen2,
      '--clip-y-start-1': `${startY_1 - 8}px`,
      '--clip-y-end-1': `${endY_1 - 8}px`,
      '--clip-y-start-2': `${startY_2 + 8}px`,
      '--clip-y-end-2': `${endY_2 + 8}px`,
    } as React.CSSProperties);

    // 2. Play Intro
    setAnimActive(true);

    // 3. Play Outro after 4.5s
    const outroTimer = setTimeout(() => {
      setOutroActive(true);
    }, 4500);

    // 4. Finish all animations after 5.4s (4.5s intro + 0.9s outro)
    const completeTimer = setTimeout(() => {
      onComplete();
    }, 5400);

    return () => {
      clearTimeout(outroTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  // Dynamic path shapes based on Outro active state
  const line1Path = outroActive
    ? "M12.86,231.88 L133.73,82.44 C139.91,74.8 134.46,63.41 124.63,63.42 L-800,63.52"
    : "M12.86,231.88 L133.73,82.44 C139.91,74.8 134.46,63.41 124.63,63.42 L54.80,63.52";

  const line2Path = outroActive
    ? "M173.825,-4.603 L57.55,138.88 C51.34,146.55 56.81,157.99 66.68,157.98 L1000,157.88"
    : "M173.825,-4.603 L57.55,138.88 C51.34,146.55 56.81,157.99 66.68,157.98 L144.03,157.88";

  const arrowOffsetPath = outroActive
    ? 'path("M173.825,-4.603 L57.55,138.88 C51.34,146.55 56.81,157.99 66.68,157.98 L1000,157.88")'
    : 'path("M173.825,-4.603 L57.55,138.88 C51.34,146.55 56.81,157.99 66.68,157.98 L144.03,157.88")';

  return (
    <div
      ref={containerRef}
      style={variables}
      className={`logo-anim-overlay v30 ${animActive ? 'anim-active' : ''} ${outroActive ? 'outro-active' : ''}`}
    >
      <div className="logo-v30-group">
        <svg className="zoutty-logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 191.39 230.75">
          <defs>
            <clipPath id="box-clip">
              <rect y="22.92" width="191.39" height="191.39" rx="41.01" ry="41.01" />
            </clipPath>

            {/* Intro Masks */}
            <mask id="trim-1" maskUnits="userSpaceOnUse" x="-3000" y="-3000" width="6000" height="6000">
              <rect x="-3000" y="-3000" width="6000" height="6000" fill="white" />
              <rect className="mask-eraser-1" x="-3000" y="0" width="6000" height="3000" fill="black" />
            </mask>
            <mask id="trim-2" maskUnits="userSpaceOnUse" x="-3000" y="-3000" width="6000" height="6000">
              <rect x="-3000" y="-3000" width="6000" height="6000" fill="white" />
              <rect className="mask-eraser-2" x="-3000" y="-3000" width="6000" height="3000" fill="black" />
            </mask>
          </defs>

          <rect id="BOX" className="logo-box" fill="#2dd4bf" y="22.92" width="191.39" height="191.39" rx="41.01" ry="41.01" />

          {/* Clip wrapper masks elements inside the box during intro */}
          <g clipPath={!outroActive ? "url(#box-clip)" : undefined} id="clip-wrapper">
            
            {/* Introductory lines sequence */}
            {!outroActive ? (
              <g className="anim-guides">
                <path
                  ref={line1Ref}
                  id="guide-1"
                  className="stroke-line line-1"
                  mask="url(#trim-1)"
                  d={line1Path}
                />
                <path
                  ref={line2Ref}
                  id="guide-2"
                  className="stroke-line line-2"
                  mask="url(#trim-2)"
                  d={line2Path}
                />
                <g className="arrow-mover" style={{ offsetPath: arrowOffsetPath }}>
                  <g transform="translate(-143.93, -157.88)">
                    <path
                      fill="#fff"
                      d="M150.37,152.65l-15.95-15.95c-2.94-2.94-7.7-2.94-10.64,0s-2.94,7.7,0,10.64l10.64,10.64-10.64,10.64c-2.94,2.94-2.94,7.7,0,10.64s7.7,2.94,10.64,0l15.95-15.95c1.47-1.47,2.21-3.41,2.2-5.34,0-1.93-.73-3.86-2.2-5.34Z"
                    />
                  </g>
                </g>
              </g>
            ) : (
              // Outro guides (bypass clipping and masks)
              <g className="anim-guides">
                <path
                  id="guide-1"
                  className="stroke-line line-1"
                  d={line1Path}
                />
                <path
                  id="guide-2"
                  className="stroke-line line-2"
                  d={line2Path}
                />
                <g className="arrow-mover" style={{ offsetPath: arrowOffsetPath }}>
                  <g transform="translate(-143.93, -157.88)">
                    <path
                      fill="#fff"
                      d="M150.37,152.65l-15.95-15.95c-2.94-2.94-7.7-2.94-10.64,0s-2.94,7.7,0,10.64l10.64,10.64-10.64,10.64c-2.94,2.94-2.94,7.7,0,10.64s7.7,2.94,10.64,0l15.95-15.95c1.47-1.47,2.21-3.41,2.2-5.34,0-1.93-.73-3.86-2.2-5.34Z"
                    />
                  </g>
                </g>
              </g>
            )}

            {/* Final Logo swap shapes */}
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
        <div className="zoutty-text-wrapper">
          <svg className="zoutty-text-logo" viewBox="0 0 573.39 83.13" xmlns="http://www.w3.org/2000/svg">
            <path fill="#2dd4bf" d="M0,68.47L52.76,14.72H1.33V0h78.22v13.93l-53.44,54.54h53.58v14.66H0v-14.66Z"/>
            <path fill="#2dd4bf" d="M165.85,73.96c-6.28,6.11-15.36,9.17-27.24,9.17s-20.96-3.06-27.24-9.17c-8.42-7.5-12.63-18.3-12.63-32.4s4.21-25.19,12.63-32.4c6.28-6.11,15.36-9.17,27.24-9.17s20.96,3.06,27.24,9.17c8.38,7.21,12.58,18.01,12.58,32.4s-4.19,24.9-12.58,32.4ZM155,62.03c4.04-4.8,6.06-11.62,6.06-20.46s-2.02-15.62-6.06-20.44c-4.04-4.81-9.5-7.22-16.38-7.22s-12.37,2.4-16.47,7.19c-4.1,4.8-6.15,11.62-6.15,20.46s2.05,15.67,6.15,20.46c4.1,4.8,9.59,7.19,16.47,7.19s12.34-2.4,16.38-7.19Z"/>
            <path fill="#2dd4bf" d="M197.48,0h21.08v49.77c0,5.57.81,9.63,2.42,12.2,2.51,4.54,7.96,6.81,16.38,6.81s13.8-2.27,16.31-6.81c1.61-2.56,2.42-6.63,2.42-12.2V0h21.08v49.81c0,8.61-1.64,15.32-4.91,20.12-6.1,8.8-17.73,13.2-34.9,13.2s-28.83-4.4-34.97-13.2c-3.27-4.8-4.91-11.51-4.91-20.12V0Z"/>
            <path fill="#2dd4bf" d="M375.91,0v14.72h-29.43v68.41h-20.69V14.72h-29.57V0h79.69Z"/>
            <path fill="#2dd4bf" d="M474.65,0v14.72h-29.43v68.41h-20.69V14.72h-29.57V0h79.69Z"/>
            <path fill="#2dd4bf" d="M552.18,0h21.21l-29.97,51.96v31.17h-18.72v-31.17L493.7,0h22.07l18.6,36.21L552.18,0Z"/>
          </svg>
        </div>
      </div>
    </div>
  );
};
