// src/components/TopBar.tsx
import { useState, useEffect, useRef, type ReactNode } from 'react';
import { dbService } from '../services/database';

interface TopBarProps {
  title: string;
  subtitle?: ReactNode;
  rightContent?: ReactNode;
  showProfileButton?: boolean;
  onNavigateToProfile?: () => void;
}

export function TopBar({
  title,
  subtitle,
  rightContent,
  showProfileButton = true,
  onNavigateToProfile,
}: TopBarProps) {
  const headerRef = useRef<HTMLElement | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [userName, setUserName] = useState('U');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!showProfileButton) return;
    let mounted = true;

    const loadUser = () => {
      dbService.auth
        .getSessionUser()
        .then((u) => {
          if (!mounted || !u) return;
          setUserName(u.name || 'U');
          setAvatarUrl(u.avatar_url || null);
        })
        .catch(() => {});
    };

    loadUser();
    const unsub = dbService.sync.subscribe((st) => {
      if (st.state === 'synced' || st.state === 'pending') {
        loadUser();
      }
    });

    return () => {
      mounted = false;
      unsub();
    };
  }, [showProfileButton]);

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

  const handleProfileClick = () => {
    if (onNavigateToProfile) {
      onNavigateToProfile();
    } else {
      window.dispatchEvent(new CustomEvent('rachapp:navigate-tab', { detail: 'perfil' }));
    }
  };

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

        {(rightContent || showProfileButton) && (
          <div className="flex items-center gap-2 shrink-0">
            {rightContent}
            {showProfileButton && (
              <button
                type="button"
                onClick={handleProfileClick}
                title="Ir para o meu perfil"
                className="w-10 h-10 bg-[var(--primary)] text-white rounded-full overflow-hidden flex items-center justify-center font-display font-bold shadow-sm border border-[var(--primary)]/20 shrink-0 cursor-pointer hover:ring-2 hover:ring-[var(--primary)]/40 transition-all active:scale-95"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={userName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-sm uppercase font-bold">{(userName || 'U')[0]}</span>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
