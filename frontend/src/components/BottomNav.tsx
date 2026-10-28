// src/components/BottomNav.tsx
import { Home, ListOrdered, Users, User } from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function BottomNav({ activeTab, setActiveTab }: BottomNavProps) {
  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'viagens', label: 'Rachas', icon: ListOrdered },
    { id: 'amigos', label: 'Contatos', icon: Users },
    { id: 'perfil', label: 'Perfil', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 w-full bg-[#0a0f16]/95 backdrop-blur-md border-t border-gray-800/80 pb-safe z-30 select-none">
      <div className="flex justify-around items-center h-16 max-w-lg md:max-w-xl lg:max-w-2xl mx-auto px-2 sm:px-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center flex-1 h-full py-1 min-h-[48px] space-y-1 transition-all active:scale-90 ${
                isActive ? 'text-[#2DD4BF]' : 'text-gray-500 hover:text-gray-400'
              }`}
            >
              <Icon size={22} strokeWidth={isActive ? 2.5 : 2} className="shrink-0" />
              <span className="text-[10px] sm:text-xs font-semibold tracking-tight truncate max-w-full">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
