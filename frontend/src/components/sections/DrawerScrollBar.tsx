'use client';

import { useEffect, useState, useRef } from 'react';
import { icons } from '@/components/icons';

export function DrawerScrollBar({ targetId = 'about' }: { targetId?: string }) {
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);
  const startScrollRef = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startYRef.current = e.clientY;
    startScrollRef.current = window.scrollY;
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const delta = e.clientY - startYRef.current;
      window.scrollTo({
        top: startScrollRef.current - delta,
        behavior: 'auto',
      });
    };
    const handleUp = () => {
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    if (isDragging) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isDragging]);

  const scrollToSection = () => {
    const el = document.getElementById(targetId);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <div
        onMouseDown={handleMouseDown}
        className="absolute bottom-0 left-0 right-0 h-16 cursor-grab active:cursor-grabbing"
        style={{ zIndex: 10 }}
      />
      <div
        onClick={scrollToSection}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            scrollToSection();
          }
        }}
        aria-label="Faire défiler vers le contenu"
        className={`absolute bottom-6 left-1/2 -translate-x-1/2 w-14 h-1.5 rounded-full transition-colors cursor-pointer ${
          isDragging ? 'bg-brand' : 'bg-brand/40 hover:bg-brand/70'
        }`}
      />
    </>
  );
}
