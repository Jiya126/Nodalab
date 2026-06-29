import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { GripHorizontal } from 'lucide-react';

export interface PanelBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FloatingPanelProps {
  title: string;
  storageKey: string;
  defaultBounds: PanelBounds;
  minWidth?: number;
  minHeight?: number;
  headerActions?: ReactNode;
  children: ReactNode;
}

const TOPBAR_HEIGHT = 44;
const STATUSBAR_HEIGHT = 24;

function loadBounds(storageKey: string, fallback: PanelBounds): PanelBounds {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as PanelBounds;
    if (
      typeof parsed.x === 'number'
      && typeof parsed.y === 'number'
      && typeof parsed.width === 'number'
      && typeof parsed.height === 'number'
    ) {
      return parsed;
    }
  } catch {
    // ignore
  }
  return fallback;
}

function clampBounds(bounds: PanelBounds, minWidth: number, minHeight: number): PanelBounds {
  const maxWidth = window.innerWidth - 16;
  const maxHeight = window.innerHeight - TOPBAR_HEIGHT - STATUSBAR_HEIGHT - 8;
  const width = Math.min(Math.max(bounds.width, minWidth), maxWidth);
  const height = Math.min(Math.max(bounds.height, minHeight), maxHeight);
  const maxX = Math.max(8, window.innerWidth - width - 8);
  const maxY = Math.max(TOPBAR_HEIGHT + 4, window.innerHeight - STATUSBAR_HEIGHT - height - 4);
  return {
    x: Math.min(Math.max(bounds.x, 8), maxX),
    y: Math.min(Math.max(bounds.y, TOPBAR_HEIGHT + 4), maxY),
    width,
    height,
  };
}

export default function FloatingPanel({
  title,
  storageKey,
  defaultBounds,
  minWidth = 260,
  minHeight = 200,
  headerActions,
  children,
}: FloatingPanelProps) {
  const [bounds, setBounds] = useState(() => clampBounds(loadBounds(storageKey, defaultBounds), minWidth, minHeight));
  const boundsRef = useRef(bounds);
  const dragRef = useRef<{ startX: number; startY: number; origin: PanelBounds } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; origin: PanelBounds } | null>(null);

  boundsRef.current = bounds;

  const persistBounds = useCallback((next: PanelBounds) => {
    const clamped = clampBounds(next, minWidth, minHeight);
    boundsRef.current = clamped;
    setBounds(clamped);
    localStorage.setItem(storageKey, JSON.stringify(clamped));
  }, [minWidth, minHeight, storageKey]);

  useEffect(() => {
    const handleResize = () => {
      persistBounds(boundsRef.current);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [persistBounds]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (dragRef.current) {
        const dx = event.clientX - dragRef.current.startX;
        const dy = event.clientY - dragRef.current.startY;
        persistBounds({
          ...dragRef.current.origin,
          x: dragRef.current.origin.x + dx,
          y: dragRef.current.origin.y + dy,
        });
      }
      if (resizeRef.current) {
        const dx = event.clientX - resizeRef.current.startX;
        const dy = event.clientY - resizeRef.current.startY;
        persistBounds({
          ...resizeRef.current.origin,
          width: resizeRef.current.origin.width + dx,
          height: resizeRef.current.origin.height + dy,
        });
      }
    };

    const handleMouseUp = () => {
      dragRef.current = null;
      resizeRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [persistBounds]);

  const startDrag = (event: React.MouseEvent) => {
    if ((event.target as HTMLElement).closest('button')) return;
    event.preventDefault();
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      origin: boundsRef.current,
    };
  };

  const startResize = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    resizeRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      origin: boundsRef.current,
    };
  };

  return (
    <div
      className="fixed z-50 flex flex-col rounded-xl shadow-2xl overflow-hidden"
      style={{
        left: bounds.x,
        top: bounds.y,
        width: bounds.width,
        height: bounds.height,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
      }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 border-b shrink-0 cursor-grab active:cursor-grabbing select-none"
        style={{ borderColor: 'var(--border-color)' }}
        onMouseDown={startDrag}
      >
        <div className="flex items-center gap-2 min-w-0">
          <GripHorizontal size={14} style={{ color: 'var(--text-muted)' }} />
          <h2 className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
            {title}
          </h2>
        </div>
        <div className="shrink-0" onMouseDown={event => event.stopPropagation()}>
          {headerActions}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {children}
      </div>

      <div
        className="absolute right-0 bottom-0 w-4 h-4 cursor-se-resize"
        style={{ touchAction: 'none' }}
        onMouseDown={startResize}
        title="Resize"
      >
        <svg viewBox="0 0 16 16" className="w-full h-full opacity-40">
          <path d="M14 14L8 14L14 8Z" fill="currentColor" />
        </svg>
      </div>
    </div>
  );
}

export function centeredDefaultBounds(width: number, height: number): PanelBounds {
  return {
    x: Math.max(8, (window.innerWidth - width) / 2),
    y: TOPBAR_HEIGHT + 16,
    width,
    height,
  };
}

export function leftDefaultBounds(width: number, height: number): PanelBounds {
  return {
    x: 16,
    y: TOPBAR_HEIGHT + 16,
    width,
    height,
  };
}
