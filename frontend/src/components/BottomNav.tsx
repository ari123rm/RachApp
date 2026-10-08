// src/components/BottomNav.tsx
import { Home, ListOrdered, Users, User, UsersRound } from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function BottomNav({ activeTab, setActiveTab }: BottomNavProps) {
  // Lista dos botões para facilitar a renderização
  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'viagens', label: 'Rachas', icon: ListOrdered },
    { id: 'amigos', label: 'Amigos', icon: Users },
    { id: 'grupos', label: 'Grupos', icon: UsersRound }, // 🟢 Nova Aba
    { id: 'perfil', label: 'Perfil', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 w-full bg-[#0a0f16] border-t border-gray-800 pb-safe">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                isActive ? 'text-[#2DD4BF]' : 'text-gray-500 hover:text-gray-400'
              }`}
            >
              <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}