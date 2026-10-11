import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Transaction, TxType } from "../lib/types";
import { currentPeriodKey } from "../lib/period";
import { useStore } from "./store";

export type Theme = "system" | "light" | "dark";
export type SheetPreset = Partial<Pick<Transaction, "accountId" | "toAccountId" | "amount" | "note" | "categoryId">>;
type SheetState = { open: false } | { open: true; tx?: Transaction; type?: TxType; preset?: SheetPreset };
interface ToastState { id: number; text: string; action?: { label: string; run: () => void } }

interface UI {
  month: string;
  setMonth: (mk: string) => void;
  sheet: SheetState;
  openSheet: (opts?: { tx?: Transaction; type?: TxType; preset?: SheetPreset }) => void;
  closeSheet: () => void;
  toast: ToastState | null;
  notify: (text: string, action?: ToastState["action"]) => void;
  dismissToast: () => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const Ctx = createContext<UI | null>(null);
export const useUI = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useUI must be used inside UIProvider");
  return v;
};

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

export function UIProvider({ children }: { children: ReactNode }) {
  // Follows the current period (which depends on your dates) until you pick another month.
  const { settings } = useStore();
  const [chosen, setChosen] = useState<string | null>(null);
  void settings.periods;
  const current = currentPeriodKey();
  const month = chosen ?? current;
  const setMonth = (mk: string) => setChosen(mk === current ? null : mk);
  const [sheet, setSheet] = useState<SheetState>({ open: false });
  const [toast, setToast] = useState<ToastState | null>(null);
  const [theme, setThemeState] = useState<Theme>(() => (read("ve-theme") as Theme) || "system");
  const timer = useRef<number>();

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") delete root.dataset.theme; else root.dataset.theme = theme;
    const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0D1110" : "#F5F6F4");
  }, [theme]);

  const notify = useCallback((text: string, action?: ToastState["action"]) => {
    window.clearTimeout(timer.current);
    setToast({ id: Date.now(), text, action });
    timer.current = window.setTimeout(() => setToast(null), action ? 6000 : 2800);
  }, []);

  const value: UI = {
    month, setMonth,
    sheet,
    openSheet: (opts) => setSheet({ open: true, ...opts }),
    closeSheet: () => setSheet({ open: false }),
    toast, notify, dismissToast: () => setToast(null),
    theme, setTheme: (t) => { setThemeState(t); write("ve-theme", t); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
