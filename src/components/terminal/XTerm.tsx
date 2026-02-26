"use dom";

import React, { useEffect, useRef, type Ref } from "react";
import { useDOMImperativeHandle, type DOMImperativeFactory, type DOMProps } from "expo/dom";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";

const XTERM_CSS = `
.xterm {
    cursor: text;
    position: relative;
    user-select: none;
    -ms-user-select: none;
    -webkit-user-select: none;
}

.xterm.focus,
.xterm:focus {
    outline: none;
}

.xterm .xterm-helpers {
    position: absolute;
    top: 0;
    z-index: 5;
}

.xterm .xterm-helper-textarea {
    padding: 0;
    border: 0;
    margin: 0;
    position: absolute;
    opacity: 0;
    left: -9999em;
    top: 0;
    width: 0;
    height: 0;
    z-index: -5;
    white-space: nowrap;
    overflow: hidden;
    resize: none;
}

.xterm .composition-view {
    background: #000;
    color: #FFF;
    display: none;
    position: absolute;
    white-space: nowrap;
    z-index: 1;
}

.xterm .composition-view.active {
    display: block;
}

.xterm .xterm-viewport {
    background-color: #000;
    overflow-y: scroll;
    cursor: default;
    position: absolute;
    right: 0;
    left: 0;
    top: 0;
    bottom: 0;
}

.xterm .xterm-screen {
    position: relative;
}

.xterm .xterm-screen canvas {
    position: absolute;
    left: 0;
    top: 0;
}

.xterm .xterm-scroll-area {
    visibility: hidden;
}

.xterm-char-measure-element {
    display: inline-block;
    visibility: hidden;
    position: absolute;
    top: 0;
    left: -9999em;
    line-height: normal;
}

.xterm.enable-mouse-events {
    cursor: default;
}

.xterm.xterm-cursor-pointer,
.xterm .xterm-cursor-pointer {
    cursor: pointer;
}

.xterm.column-select.focus {
    cursor: crosshair;
}

.xterm .xterm-accessibility,
.xterm .xterm-message {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    right: 0;
    z-index: 10;
    color: transparent;
    pointer-events: none;
}

.xterm .live-region {
    position: absolute;
    left: -9999px;
    width: 1px;
    height: 1px;
    overflow: hidden;
}

.xterm-dim {
    opacity: 1 !important;
}

.xterm-underline-1 { text-decoration: underline; }
.xterm-underline-2 { text-decoration: double underline; }
.xterm-underline-3 { text-decoration: wavy underline; }
.xterm-underline-4 { text-decoration: dotted underline; }
.xterm-underline-5 { text-decoration: dashed underline; }

.xterm-overline {
    text-decoration: overline;
}

.xterm-overline.xterm-underline-1 { text-decoration: overline underline; }
.xterm-overline.xterm-underline-2 { text-decoration: overline double underline; }
.xterm-overline.xterm-underline-3 { text-decoration: overline wavy underline; }
.xterm-overline.xterm-underline-4 { text-decoration: overline dotted underline; }
.xterm-overline.xterm-underline-5 { text-decoration: overline dashed underline; }

.xterm-strikethrough {
    text-decoration: line-through;
}

.xterm-screen .xterm-decoration-container .xterm-decoration {
	z-index: 6;
	position: absolute;
}

.xterm-screen .xterm-decoration-container .xterm-decoration.xterm-decoration-top-layer {
	z-index: 7;
}

.xterm-decoration-overview-ruler {
    z-index: 8;
    position: absolute;
    top: 0;
    right: 0;
    pointer-events: none;
}

.xterm-decoration-top {
    z-index: 2;
    position: relative;
}
`;

export interface XTermRef extends DOMImperativeFactory {
  write: (...args: any[]) => void;
  clear: (...args: any[]) => void;
  focus: (...args: any[]) => void;
  fit: (...args: any[]) => void;
}

interface XTermProps {
  ref: Ref<XTermRef>;
  dom?: DOMProps;
  onData?: (data: string) => void;
  onResize?: (dimensions: { cols: number; rows: number }) => void;
  fontSize?: number;
  fontFamily?: string;
  theme?: {
    background?: string;
    foreground?: string;
    cursor?: string;
    selection?: string;
  };
}

export default function XTerm({ 
  ref,
  onData,
  onResize,
  fontSize = 13, 
  fontFamily = 'Menlo, Monaco, "Courier New", monospace',
  theme = {
    background: '#1a1b26',
    foreground: '#c0caf5',
    cursor: '#c0caf5',
    selection: '#33467c',
  }
}: XTermProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const onDataRef = useRef(onData);
  onDataRef.current = onData;
  const onResizeRef = useRef(onResize);
  onResizeRef.current = onResize;

  useDOMImperativeHandle(ref, () => ({
    write: (...args: any[]) => {
      const data = args[0] as string;
      if (data) xtermRef.current?.write(data);
    },
    clear: () => {
      xtermRef.current?.clear();
    },
    focus: () => {
      xtermRef.current?.focus();
    },
    fit: () => {
      try {
        fitAddonRef.current?.fit();
      } catch (e) {
        console.warn('XTerm fit error:', e);
      }
    }
  }), []);

  useEffect(() => {
    if (!divRef.current) return;

    // console.log('XTerm mounting...');
    const term = new Terminal({
      cursorBlink: true,
      fontSize,
      fontFamily,
      theme,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    fitAddonRef.current = fitAddon;

    term.open(divRef.current);
    
    // Initial fit with retry strategy
    const fit = () => {
      try {
        fitAddon.fit();
        // console.log('XTerm fitted');
      } catch (e) {
        // console.warn('XTerm initial fit error:', e);
      }
    };

    // Try to fit immediately and then after short delays to handle layout pass
    fit();
    const t1 = setTimeout(fit, 100);
    const t2 = setTimeout(fit, 500);

    // Handle resizing
    const handleResize = () => {
      fit();
    };
    
    window.addEventListener('resize', handleResize);

    term.onData((data) => {
      onDataRef.current?.(data);
    });

    term.onResize(({ cols, rows }) => {
      onResizeRef.current?.({ cols, rows });
    });
    
    xtermRef.current = term;

    // Report initial dimensions after the first fit settles
    const t3 = setTimeout(() => {
      if (term.cols && term.rows) {
        onResizeRef.current?.({ cols: term.cols, rows: term.rows });
      }
    }, 600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener('resize', handleResize);
      term.dispose();
    };
  }, []); // Run once on mount

  return (
    <>
      <style>{XTERM_CSS}{`
        html, body {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
          background-color: ${theme.background};
        }
      `}</style>
      <div 
        ref={divRef} 
        style={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: theme.background,
          overflow: 'hidden'
        }} 
      />
    </>
  );
}
