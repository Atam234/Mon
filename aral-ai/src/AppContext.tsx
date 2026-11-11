import { createContext, useContext } from 'react';
import type { DocMeta } from './docs/store';

export type Tab = 'chat' | 'pdf' | 'model';

export type AppCtx = {
  tab: Tab;
  setTab: (t: Tab) => void;
  modelPath: string | null;
  setModelPath: (p: string | null) => void;
  activeDoc: DocMeta | null;
  setActiveDoc: (d: DocMeta | null) => void;
};

export const AppContext = createContext<AppCtx>(null as unknown as AppCtx);
export const useApp = () => useContext(AppContext);
