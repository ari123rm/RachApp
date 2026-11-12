// src/components/TopBar.tsx
import { useState, useEffect, useRef, type ReactNode } from 'react';

interface TopBarProps {
  title: string;
  subtitle?: ReactNode;
  rightContent?: ReactNode;
}

export function TopBar({ title, subtitle, rightContent }: TopBarProps) {
  const headerRef = useRef<HTMLElement | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    let scrollParent: HTMLElement | null = el.parentElement;
    while (scrollParent && scrollParent !== document.body) {
      if (
        scrollParent.classList.contains('overflow-y-auto') ||
        scrollParent.getAttribute('data-tab-scroll') === 'true'
      ) {
        break;
      }
      scrollParent = scrollParent.parentElement;
    }

    if (!scrollParent) return;

    const handleScroll = () => {
      const nextScrolled = (scrollParent?.scrollTop || 0) > 6;
      setIsScrolled((prev) => (prev !== nextScrolled ? nextScrolled : prev));
    };

    handleScroll();
    scrollParent.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      scrollParent?.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <header
      ref={headerRef}
      className={`sticky top-0 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-[max(2rem,calc(env(safe-area-inset-top,0px)+0.65rem))] pb-3 bg-[var(--bg-app)]/92 backdrop-blur-md transition-colors duration-150 border-b ${
        isScrolled
          ? 'border-[var(--border-color)] shadow-[var(--shadow-sm)]'
          : 'border-transparent'
      }`}
    >
      <div className="flex items-center justify-between gap-3 min-w-0 min-h-[44px]">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-display font-bold text-[var(--text-primary)] tracking-tight truncate leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] truncate mt-0.5 leading-snug">
              {subtitle}
            </p>
          )}
        </div>

        {rightContent && (
          <div className="flex items-center gap-2 shrink-0">{rightContent}</div>
        )}
      </div>
    </header>
  );
}
