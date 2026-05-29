import { readJson, writeJson } from '../storage/store';
import type { PaperTrade, PaperAccount, PaperConfig } from './engine';
import { DEFAULT_PAPER_CONFIG, createInitialAccount } from './engine';

export const PAPER_KEYS = {
  account: 'paper-account',
  trades: 'paper-trades',
  config: 'paper-config',
} as const;

export async function getPaperAccount(): Promise<PaperAccount> {
  const fallback = createInitialAccount(DEFAULT_PAPER_CONFIG.initialBalance);
  return readJson<PaperAccount>(PAPER_KEYS.account, fallback);
}

export async function savePaperAccount(account: PaperAccount): Promise<void> {
  return writeJson(PAPER_KEYS.account, account);
}

export async function getPaperTrades(): Promise<PaperTrade[]> {
  return readJson<PaperTrade[]>(PAPER_KEYS.trades, []);
}

export async function savePaperTrades(trades: PaperTrade[]): Promise<void> {
  return writeJson(PAPER_KEYS.trades, trades);
}

export async function getPaperConfig(): Promise<PaperConfig> {
  return readJson<PaperConfig>(PAPER_KEYS.config, DEFAULT_PAPER_CONFIG);
}

export async function savePaperConfig(config: PaperConfig): Promise<void> {
  return writeJson(PAPER_KEYS.config, config);
}

export async function resetPaperAccount(initialBalance?: number): Promise<void> {
  const config = await getPaperConfig();
  const balance = initialBalance ?? config.initialBalance;
  const fresh = createInitialAccount(balance);
  await savePaperAccount(fresh);
  await savePaperTrades([]);
}
