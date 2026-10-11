import {
  ShoppingBasket, UtensilsCrossed, Bus, Fuel, Home, Zap, Wifi, Tv, ShoppingBag, HeartPulse,
  Sparkles, GraduationCap, Plane, Gift, Ticket, Baby, ShieldCheck, Landmark, CircleEllipsis,
  Briefcase, Laptop, TrendingUp, HandCoins, RotateCcw, PiggyBank, Car, ArrowLeftRight,
  Coffee, Dumbbell, PawPrint, Gamepad2, Music, Book, Shirt, Wrench, Smartphone, Dog, Bike, Train,
  Pill, Stethoscope, Scissors, Sofa, Hammer, Leaf, Church, HandHeart, Receipt, Building2, Wallet,
  Banknote, CreditCard, Gem, Camera, Palette, Pizza, Beer, Cigarette, Bitcoin, Store, Tag,
  type LucideIcon,
} from "lucide-react";
import type { CatType, CustomCategory } from "./types";

export interface Category {
  id: string;
  name: string;
  type: CatType | "transfer";
  icon: LucideIcon;
  color: string;
  group: string;
  custom?: boolean;
}

/** Icons offered when you make your own category. Keys are stored in Firestore. */
export const ICONS: Record<string, LucideIcon> = {
  tag: Tag, basket: ShoppingBasket, food: UtensilsCrossed, coffee: Coffee, pizza: Pizza, beer: Beer,
  home: Home, sofa: Sofa, hammer: Hammer, wrench: Wrench, zap: Zap, wifi: Wifi, phone: Smartphone,
  bus: Bus, train: Train, car: Car, bike: Bike, fuel: Fuel, plane: Plane,
  bag: ShoppingBag, shirt: Shirt, gem: Gem, tv: Tv, ticket: Ticket, game: Gamepad2, music: Music,
  camera: Camera, palette: Palette, book: Book, school: GraduationCap,
  heart: HeartPulse, pill: Pill, doctor: Stethoscope, gym: Dumbbell, scissors: Scissors, sparkles: Sparkles,
  baby: Baby, pet: PawPrint, dog: Dog, gift: Gift, charity: HandHeart, temple: Church, leaf: Leaf,
  shield: ShieldCheck, bank: Landmark, building: Building2, receipt: Receipt, piggy: PiggyBank,
  briefcase: Briefcase, laptop: Laptop, trending: TrendingUp, coins: HandCoins, cash: Banknote,
  card: CreditCard, wallet: Wallet, crypto: Bitcoin, store: Store, smoke: Cigarette, refund: RotateCcw, other: CircleEllipsis,
};

export const PALETTE = [
  "#2F9E6B", "#4C6EDB", "#E0A11B", "#1FA2B8", "#E07A2E", "#C2562C", "#E2554A", "#D24C8F",
  "#8B5CD6", "#6457C9", "#3D8FD6", "#D9434F", "#3F8A85", "#8A6A4F", "#6B7380", "#9AA33A",
];

/* Modelled on the category sets of popular expense apps (Wallet, Spendee, Money Manager, Monzo),
   tuned for everyday life in Sri Lanka. */
export const BUILT_IN: Category[] = [
  { id: "groceries", name: "Groceries", type: "expense", icon: ShoppingBasket, color: "#2F9E6B", group: "Essentials" },
  { id: "housing", name: "Rent & Home", type: "expense", icon: Home, color: "#4C6EDB", group: "Essentials" },
  { id: "bills", name: "Bills & Utilities", type: "expense", icon: Zap, color: "#E0A11B", group: "Essentials" },
  { id: "phone", name: "Mobile & Internet", type: "expense", icon: Wifi, color: "#1FA2B8", group: "Essentials" },
  { id: "transport", name: "Transport", type: "expense", icon: Bus, color: "#E07A2E", group: "Getting around" },
  { id: "fuel", name: "Fuel", type: "expense", icon: Fuel, color: "#C2562C", group: "Getting around" },
  { id: "vehicle", name: "Vehicle", type: "expense", icon: Car, color: "#8A6A4F", group: "Getting around" },
  { id: "dining", name: "Eating Out", type: "expense", icon: UtensilsCrossed, color: "#E2554A", group: "Lifestyle" },
  { id: "shopping", name: "Shopping", type: "expense", icon: ShoppingBag, color: "#D24C8F", group: "Lifestyle" },
  { id: "entertainment", name: "Entertainment", type: "expense", icon: Ticket, color: "#8B5CD6", group: "Lifestyle" },
  { id: "subscriptions", name: "Subscriptions", type: "expense", icon: Tv, color: "#6457C9", group: "Lifestyle" },
  { id: "personal", name: "Personal Care", type: "expense", icon: Sparkles, color: "#C77DBA", group: "Lifestyle" },
  { id: "travel", name: "Travel", type: "expense", icon: Plane, color: "#3D8FD6", group: "Lifestyle" },
  { id: "health", name: "Health", type: "expense", icon: HeartPulse, color: "#D9434F", group: "Life" },
  { id: "education", name: "Education", type: "expense", icon: GraduationCap, color: "#5168C9", group: "Life" },
  { id: "family", name: "Family & Kids", type: "expense", icon: Baby, color: "#E58A6B", group: "Life" },
  { id: "gifts", name: "Gifts & Donations", type: "expense", icon: Gift, color: "#C8457A", group: "Life" },
  { id: "insurance", name: "Insurance", type: "expense", icon: ShieldCheck, color: "#3F8A85", group: "Money" },
  { id: "loans", name: "Loans & Fees", type: "expense", icon: Landmark, color: "#6B7380", group: "Money" },
  { id: "savings", name: "Savings", type: "expense", icon: PiggyBank, color: "#2C9C8F", group: "Money" },
  { id: "other", name: "Other", type: "expense", icon: CircleEllipsis, color: "#8A8F98", group: "Money" },
  { id: "salary", name: "Salary", type: "income", icon: Briefcase, color: "#1F9D63", group: "Income" },
  { id: "freelance", name: "Freelance", type: "income", icon: Laptop, color: "#2E8BC0", group: "Income" },
  { id: "bonus", name: "Bonus", type: "income", icon: Sparkles, color: "#D49A12", group: "Income" },
  { id: "investments", name: "Investments", type: "income", icon: TrendingUp, color: "#6A5BD0", group: "Income" },
  { id: "gift-in", name: "Gifts Received", type: "income", icon: HandCoins, color: "#C8457A", group: "Income" },
  { id: "refund", name: "Refunds", type: "income", icon: RotateCcw, color: "#3F8A85", group: "Income" },
  { id: "other-in", name: "Other Income", type: "income", icon: CircleEllipsis, color: "#8A8F98", group: "Income" },
];

const TRANSFER: Category = { id: "transfer", name: "Transfer", type: "transfer", icon: ArrowLeftRight, color: "#6B7380", group: "Transfer" };

/* ---------- Registry: built-ins plus the person's own categories ---------- */
let custom: Category[] = [];
let hidden = new Set<string>();
let byId = new Map<string, Category>([...BUILT_IN, TRANSFER].map((c) => [c.id, c]));

export function setCategoryRegistry(list: CustomCategory[], hiddenIds: string[]) {
  custom = list.map((c) => ({ id: c.id, name: c.name, type: c.type, icon: ICONS[c.icon] ?? Tag, color: c.color, group: "Yours", custom: true }));
  hidden = new Set(hiddenIds);
  byId = new Map([...BUILT_IN, TRANSFER, ...custom].map((c) => [c.id, c]));
}

export function getCategory(id: string): Category {
  return byId.get(id) ?? byId.get("other")!;
}

/** Categories to offer when entering a transaction (hidden ones left out). */
export function pickable(type: CatType): Category[] {
  return [...BUILT_IN, ...custom].filter((c) => c.type === type && !hidden.has(c.id));
}

/** Every category of a type, for settings and budgets. */
export function allOf(type: CatType): Category[] {
  return [...BUILT_IN, ...custom].filter((c) => c.type === type);
}

export const isHidden = (id: string) => hidden.has(id);

/** Maps category ids from the earlier single-page versions to the new set. */
export const LEGACY_CATEGORY_MAP: Record<string, string> = {
  housing: "housing", groceries: "groceries", transport: "transport", dining: "dining",
  utilities: "bills", entertainment: "entertainment", shopping: "shopping", health: "health",
  education: "education", travel: "travel", other: "other",
  "🏠": "housing", "🛒": "groceries", "🚗": "transport", "🍔": "dining", "💡": "bills",
  "🎬": "entertainment", "👕": "shopping", "💊": "health", "📚": "education", "✈️": "travel", "💳": "other",
  Housing: "housing", Groceries: "groceries", Transport: "transport", Dining: "dining", Utilities: "bills",
  Entertainment: "entertainment", Shopping: "shopping", Health: "health", Education: "education",
  Travel: "travel", Other: "other",
};
