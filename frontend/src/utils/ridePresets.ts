// src/utils/ridePresets.ts
import {
  Car,
  Fuel,
  Bus,
  Plane,
  Bike,
  MapPin,
  Utensils,
  Pizza,
  Flame,
  Coffee,
  Beer,
  Wine,
  Cake,
  IceCreamCone,
  ShoppingCart,
  ShoppingBag,
  Store,
  Shirt,
  Gift,
  Home,
  Wifi,
  Zap,
  Droplets,
  Tv,
  Wrench,
  Film,
  Gamepad2,
  Music,
  Trophy,
  Dumbbell,
  Tent,
  GraduationCap,
  Briefcase,
  HeartPulse,
  PawPrint,
  CreditCard,
  Coins,
  Receipt,
  type LucideIcon,
} from 'lucide-react';

export interface TagIconPreset {
  key: string;
  label: string;
  category: 'transporte' | 'alimentacao' | 'compras' | 'casa' | 'lazer' | 'outros';
  icon: LucideIcon;
  keywords: string[];
}

export interface CustomTagItem {
  id: string;
  name: string;
  iconKey: string;
}

export const TAG_ICON_CATEGORIES: {
  id: 'todos' | TagIconPreset['category'];
  label: string;
}[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'transporte', label: 'Transporte' },
  { id: 'alimentacao', label: 'Comida' },
  { id: 'compras', label: 'Compras' },
  { id: 'casa', label: 'Casa' },
  { id: 'lazer', label: 'Lazer' },
  { id: 'outros', label: 'Outros' },
];

export const TAG_ICON_PRESETS: TagIconPreset[] = [
  // Transporte & Viagem
  {
    key: 'car',
    label: 'Carro',
    category: 'transporte',
    icon: Car,
    keywords: ['uber', '99', 'carro', 'transporte', 'corrida', 'taxi', 'táxi', 'carona', 'indrive'],
  },
  {
    key: 'fuel',
    label: 'Posto',
    category: 'transporte',
    icon: Fuel,
    keywords: ['gasolina', 'combustivel', 'combustível', 'posto', 'etanol', 'diesel', 'abastecimento'],
  },
  {
    key: 'bus',
    label: 'Ônibus',
    category: 'transporte',
    icon: Bus,
    keywords: ['onibus', 'ônibus', 'metro', 'metrô', 'passagem', 'van'],
  },
  {
    key: 'plane',
    label: 'Viagem',
    category: 'transporte',
    icon: Plane,
    keywords: ['viagem', 'voo', 'aviao', 'avião', 'aeroporto', 'hospedagem', 'hotel', 'airbnb'],
  },
  {
    key: 'bike',
    label: 'Moto',
    category: 'transporte',
    icon: Bike,
    keywords: ['moto', 'bike', 'bicicleta', 'entrega', 'mototaxi'],
  },
  {
    key: 'map-pin',
    label: 'Local',
    category: 'transporte',
    icon: MapPin,
    keywords: ['passeio', 'roteiro', 'turismo', 'estacionamento', 'pedagio', 'pedágio'],
  },

  // Alimentação & Bebidas
  {
    key: 'utensils',
    label: 'Comida',
    category: 'alimentacao',
    icon: Utensils,
    keywords: [
      'alimentacao',
      'alimentação',
      'comida',
      'restaurante',
      'jantar',
      'almoco',
      'almoço',
      'refeicao',
      'refeição',
      'ifood',
    ],
  },
  {
    key: 'pizza',
    label: 'Pizza',
    category: 'alimentacao',
    icon: Pizza,
    keywords: ['pizza', 'pizzaria', 'lanche', 'hamburguer', 'hambúrguer', 'burger', 'fastfood', 'salgado'],
  },
  {
    key: 'flame',
    label: 'Churrasco',
    category: 'alimentacao',
    icon: Flame,
    keywords: ['churrasco', 'churras', 'carne', 'espetinho', 'picanha'],
  },
  {
    key: 'coffee',
    label: 'Café',
    category: 'alimentacao',
    icon: Coffee,
    keywords: ['cafe', 'café', 'padaria', 'pao', 'pão', 'cafeteria', 'manha', 'manhã'],
  },
  {
    key: 'beer',
    label: 'Cerveja',
    category: 'alimentacao',
    icon: Beer,
    keywords: ['bar', 'cerveja', 'chopp', 'boteco', 'happy hour', 'role', 'rolê', 'bebida'],
  },
  {
    key: 'wine',
    label: 'Drinks',
    category: 'alimentacao',
    icon: Wine,
    keywords: ['vinho', 'drink', 'drinks', 'adega', 'destilado', 'festa'],
  },
  {
    key: 'cake',
    label: 'Bolo',
    category: 'alimentacao',
    icon: Cake,
    keywords: ['bolo', 'aniversario', 'aniversário', 'doce', 'confeitaria', 'comemoracao'],
  },
  {
    key: 'ice-cream',
    label: 'Sorvete',
    category: 'alimentacao',
    icon: IceCreamCone,
    keywords: ['acai', 'açaí', 'sorvete', 'sobremesa', 'gelato'],
  },

  // Compras & Mercado
  {
    key: 'shopping-cart',
    label: 'Mercado',
    category: 'compras',
    icon: ShoppingCart,
    keywords: ['mercado', 'supermercado', 'feira', 'atacadao', 'atacadão', 'mantimentos'],
  },
  {
    key: 'shopping-bag',
    label: 'Compras',
    category: 'compras',
    icon: ShoppingBag,
    keywords: ['compra', 'compras', 'shopping', 'encomenda'],
  },
  {
    key: 'store',
    label: 'Loja',
    category: 'compras',
    icon: Store,
    keywords: ['loja', 'conveniencia', 'conveniência', 'bodega', 'mercadinho'],
  },
  {
    key: 'shirt',
    label: 'Roupas',
    category: 'compras',
    icon: Shirt,
    keywords: ['roupa', 'roupas', 'vestuario', 'vestuário', 'calcado', 'calçado', 'lavanderia'],
  },
  {
    key: 'gift',
    label: 'Presente',
    category: 'compras',
    icon: Gift,
    keywords: ['presente', 'lembrancinha', 'amigo secreto', 'mimo'],
  },

  // Casa & Contas
  {
    key: 'home',
    label: 'Casa',
    category: 'casa',
    icon: Home,
    keywords: ['casa', 'aluguel', 'condominio', 'condomínio', 'moradia', 'república', 'republica', 'contas'],
  },
  {
    key: 'wifi',
    label: 'Internet',
    category: 'casa',
    icon: Wifi,
    keywords: ['internet', 'wifi', 'wi-fi', 'fibra', 'telefone', 'celular'],
  },
  {
    key: 'zap',
    label: 'Energia',
    category: 'casa',
    icon: Zap,
    keywords: ['luz', 'energia', 'eletricidade', 'enel'],
  },
  {
    key: 'droplets',
    label: 'Água',
    category: 'casa',
    icon: Droplets,
    keywords: ['agua', 'água', 'gas', 'gás', 'cagece', 'sabesp'],
  },
  {
    key: 'tv',
    label: 'TV',
    category: 'casa',
    icon: Tv,
    keywords: ['tv', 'streaming', 'netflix', 'spotify', 'youtube', 'prime', 'disney', 'hbo', 'assinatura'],
  },
  {
    key: 'wrench',
    label: 'Reparos',
    category: 'casa',
    icon: Wrench,
    keywords: ['manutencao', 'manutenção', 'reforma', 'conserto', 'obra', 'limpeza'],
  },

  // Lazer & Esporte
  {
    key: 'film',
    label: 'Cinema',
    category: 'lazer',
    icon: Film,
    keywords: ['cinema', 'filme', ' pipoca', 'ingresso', 'teatro'],
  },
  {
    key: 'gamepad',
    label: 'Jogos',
    category: 'lazer',
    icon: Gamepad2,
    keywords: ['jogo', 'jogos', 'game', 'games', 'ps5', 'xbox', 'steam', 'sinuca', 'boliche'],
  },
  {
    key: 'music',
    label: 'Show',
    category: 'lazer',
    icon: Music,
    keywords: ['show', 'balada', 'evento', 'festival', 'musica', 'música'],
  },
  {
    key: 'trophy',
    label: 'Esporte',
    category: 'lazer',
    icon: Trophy,
    keywords: ['futebol', 'racha', 'quadra', 'society', 'arena', 'beach tennis', 'volei', 'vôlei', 'esporte'],
  },
  {
    key: 'dumbbell',
    label: 'Treino',
    category: 'lazer',
    icon: Dumbbell,
    keywords: ['academia', 'treino', 'corrida', 'crossfit', 'suplemento'],
  },
  {
    key: 'tent',
    label: 'Camping',
    category: 'lazer',
    icon: Tent,
    keywords: ['praia', 'camping', 'chacara', 'chácara', 'sitio', 'sítio', 'piscina'],
  },

  // Outros (Estudos, Trabalho, Saúde, Pet, Finanças)
  {
    key: 'graduation-cap',
    label: 'Estudos',
    category: 'outros',
    icon: GraduationCap,
    keywords: ['faculdade', 'estudo', 'estudos', 'curso', 'escola', 'universidade', 'ifce', 'ufc', 'xerox', 'livro'],
  },
  {
    key: 'briefcase',
    label: 'Trabalho',
    category: 'outros',
    icon: Briefcase,
    keywords: ['trabalho', 'escritorio', 'escritório', 'empresa', 'projeto', 'freela'],
  },
  {
    key: 'heart-pulse',
    label: 'Saúde',
    category: 'outros',
    icon: HeartPulse,
    keywords: ['saude', 'saúde', 'farmacia', 'farmácia', 'remedio', 'remédio', 'medico', 'médico', 'consulta'],
  },
  {
    key: 'paw-print',
    label: 'Pet',
    category: 'outros',
    icon: PawPrint,
    keywords: ['pet', 'cachorro', 'gato', 'racao', 'ração', 'veterinario', 'veterinário'],
  },
  {
    key: 'credit-card',
    label: 'Cartão',
    category: 'outros',
    icon: CreditCard,
    keywords: ['cartao', 'cartão', 'fatura', 'parcela', 'nubank', 'inter'],
  },
  {
    key: 'coins',
    label: 'Rateio',
    category: 'outros',
    icon: Coins,
    keywords: ['vaquinha', 'rateio', 'cota', 'bolao', 'bolão', 'pix'],
  },
  {
    key: 'receipt',
    label: 'Recibo',
    category: 'outros',
    icon: Receipt,
    keywords: ['outros', 'geral', 'recibo', 'nota', 'despesa'],
  },
];

const ICON_PRESET_MAP = new Map<string, TagIconPreset>(
  TAG_ICON_PRESETS.map((preset) => [preset.key, preset])
);

const STORAGE_TAGS_KEY = 'rachapp_custom_tags_v1';
const STORAGE_TITLES_KEY = 'rachapp_custom_titles_v1';

export const DEFAULT_CUSTOM_TAGS: CustomTagItem[] = [
  { id: 'default-uber', name: 'Uber', iconKey: 'car' },
  { id: 'default-alimentacao', name: 'Alimentação', iconKey: 'utensils' },
  { id: 'default-mercado', name: 'Mercado', iconKey: 'shopping-cart' },
  { id: 'default-contas', name: 'Contas', iconKey: 'home' },
  { id: 'default-lazer', name: 'Lazer', iconKey: 'beer' },
  { id: 'default-viagem', name: 'Viagem', iconKey: 'plane' },
];

export const DEFAULT_PRESET_TITLES: string[] = [
  'Jantar',
  'Churrasco',
  'Mercado',
  'Uber',
  'Internet',
  'Aluguel',
  'Lanche',
];

let cachedTags: CustomTagItem[] | null = null;
let cachedTitles: string[] | null = null;

function notifyPresetsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('rachappRidePresetsUpdated'));
  }
}

export function getCustomTags(): CustomTagItem[] {
  if (cachedTags) return cachedTags;
  if (typeof window === 'undefined') return DEFAULT_CUSTOM_TAGS;

  try {
    const raw = localStorage.getItem(STORAGE_TAGS_KEY);
    if (!raw) {
      cachedTags = [...DEFAULT_CUSTOM_TAGS];
      return cachedTags;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      cachedTags = [...DEFAULT_CUSTOM_TAGS];
      return cachedTags;
    }
    const valid = parsed
      .filter((item) => item && typeof item.name === 'string' && item.name.trim().length > 0)
      .map((item, idx) => ({
        id: String(item.id || `tag-${idx}-${Date.now()}`),
        name: item.name.trim(),
        iconKey: ICON_PRESET_MAP.has(item.iconKey) ? item.iconKey : inferIconKeyFromText(item.name),
      }));
    cachedTags = valid;
    return cachedTags;
  } catch {
    cachedTags = [...DEFAULT_CUSTOM_TAGS];
    return cachedTags;
  }
}

export function saveCustomTags(tags: CustomTagItem[]): CustomTagItem[] {
  const seen = new Set<string>();
  const cleaned: CustomTagItem[] = [];

  for (const t of tags) {
    const name = (t.name || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push({
      id: t.id || `tag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      iconKey: ICON_PRESET_MAP.has(t.iconKey) ? t.iconKey : inferIconKeyFromText(name),
    });
  }

  cachedTags = cleaned;
  try {
    localStorage.setItem(STORAGE_TAGS_KEY, JSON.stringify(cleaned));
  } catch {}
  notifyPresetsChanged();
  return cleaned;
}

export function upsertCustomTag(name: string, iconKey: string, existingId?: string): CustomTagItem[] {
  const cleanName = name.trim();
  if (!cleanName) return getCustomTags();
  const validIconKey = ICON_PRESET_MAP.has(iconKey) ? iconKey : inferIconKeyFromText(cleanName);

  const current = [...getCustomTags()];
  const idx = existingId
    ? current.findIndex((t) => t.id === existingId)
    : current.findIndex((t) => t.name.toLowerCase() === cleanName.toLowerCase());

  if (idx >= 0) {
    current[idx] = {
      ...current[idx],
      name: cleanName,
      iconKey: validIconKey,
    };
  } else {
    current.push({
      id: `tag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: cleanName,
      iconKey: validIconKey,
    });
  }

  return saveCustomTags(current);
}

export function deleteCustomTag(idOrName: string): CustomTagItem[] {
  const current = getCustomTags();
  const filtered = current.filter(
    (t) => t.id !== idOrName && t.name.toLowerCase() !== idOrName.toLowerCase()
  );
  return saveCustomTags(filtered);
}

export function resetCustomTagsToDefault(): CustomTagItem[] {
  return saveCustomTags([...DEFAULT_CUSTOM_TAGS]);
}

export function getPresetTitles(): string[] {
  if (cachedTitles) return cachedTitles;
  if (typeof window === 'undefined') return DEFAULT_PRESET_TITLES;

  try {
    const raw = localStorage.getItem(STORAGE_TITLES_KEY);
    if (!raw) {
      cachedTitles = [...DEFAULT_PRESET_TITLES];
      return cachedTitles;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      cachedTitles = [...DEFAULT_PRESET_TITLES];
      return cachedTitles;
    }
    const cleaned = parsed
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item, idx, arr) => item.length > 0 && arr.findIndex((x) => x.toLowerCase() === item.toLowerCase()) === idx);
    cachedTitles = cleaned;
    return cachedTitles;
  } catch {
    cachedTitles = [...DEFAULT_PRESET_TITLES];
    return cachedTitles;
  }
}

export function savePresetTitles(titles: string[]): string[] {
  const seen = new Set<string>();
  const cleaned: string[] = [];

  for (const raw of titles) {
    const t = (raw || '').trim();
    if (!t) continue;
    const lower = t.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    cleaned.push(t);
  }

  cachedTitles = cleaned;
  try {
    localStorage.setItem(STORAGE_TITLES_KEY, JSON.stringify(cleaned));
  } catch {}
  notifyPresetsChanged();
  return cleaned;
}

export function addPresetTitle(title: string): string[] {
  const clean = title.trim();
  if (!clean) return getPresetTitles();
  const current = getPresetTitles();
  if (current.some((t) => t.toLowerCase() === clean.toLowerCase())) {
    return current;
  }
  return savePresetTitles([...current, clean]);
}

export function removePresetTitle(title: string): string[] {
  const current = getPresetTitles();
  return savePresetTitles(current.filter((t) => t.toLowerCase() !== title.trim().toLowerCase()));
}

export function resetPresetTitlesToDefault(): string[] {
  return savePresetTitles([...DEFAULT_PRESET_TITLES]);
}

export function inferIconKeyFromText(text?: string | null): string {
  const lower = (text || '').trim().toLowerCase();
  if (!lower) return 'receipt';

  // 1. Verifica primeiro se o usuário tem uma tag customizada com esse nome
  if (cachedTags) {
    const exactCustom = cachedTags.find((t) => t.name.toLowerCase() === lower);
    if (exactCustom && ICON_PRESET_MAP.has(exactCustom.iconKey)) {
      return exactCustom.iconKey;
    }
  }

  // 2. Busca por palavras-chave nos presets
  for (const preset of TAG_ICON_PRESETS) {
    if (preset.keywords.some((kw) => lower.includes(kw.trim()))) {
      return preset.key;
    }
  }

  return 'receipt';
}

export function getIconByKey(iconKey?: string | null): LucideIcon {
  if (iconKey && ICON_PRESET_MAP.has(iconKey)) {
    return ICON_PRESET_MAP.get(iconKey)!.icon;
  }
  return Receipt;
}

export function getTagIconKey(tag?: string | null): string {
  const clean = (tag || '').trim();
  if (!clean) return 'car';

  const tags = getCustomTags();
  const found = tags.find((t) => t.name.toLowerCase() === clean.toLowerCase());
  if (found && ICON_PRESET_MAP.has(found.iconKey)) {
    return found.iconKey;
  }

  return inferIconKeyFromText(clean);
}

export function getTagIconComponent(tag?: string | null): LucideIcon {
  const key = getTagIconKey(tag);
  return getIconByKey(key);
}
