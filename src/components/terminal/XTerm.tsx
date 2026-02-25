"use dom";

import React, { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";

export interface XTermRef {
  write: (data: string) => void;
  clear: () => void;
  focus: () => void;
  fit: () => void;
}

interface XTermProps {
  onData?: (data: string) => void;
  fontSize?: number;
  fontFamily?: string;
  theme?: {
    background?: string;
    foreground?: string;
    cursor?: string;
    selection?: string;
  };
}

export default forwardRef<XTermRef, XTermProps>(({ 
  onData, 
  fontSize = 13, 
  fontFamily = 'Menlo, Monaco, "Courier New", monospace',
  theme = {
    background: '#1a1b26',
    foreground: '#c0caf5',
    cursor: '#c0caf5',
    selection: '#33467c',
  }
}, ref) => {
  const divRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useImperativeHandle(ref, () => ({
    write: (data: string) => {
      xtermRef.current?.write(data);
    },
    clear: () => {
      xtermRef.current?.clear();
    },
    focus: () => {
      xtermRef.current?.focus();
    },
    fit: () => {
      fitAddonRef.current?.fit();
    }
  }));

  useEffect(() => {
    if (!divRef.current) return;

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
    
    // Initial fit
    setTimeout(() => {
      fitAddon.fit();
    }, 100);

    // Handle resizing
    const handleResize = () => {
      fitAddon.fit();
    };
    
    window.addEventListener('resize', handleResize);

    term.onData((data) => {
      if (onData) {
        onData(data);
      }
    });
    
    xtermRef.current = term;

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
    };
  }, []); // Run once on mount

  return (
    <div 
      ref={divRef} 
      style={{ 
        width: '100%', 
        height: '100%', 
        backgroundColor: theme.background,
        overflow: 'hidden'
      }} 
    />
  );
});
