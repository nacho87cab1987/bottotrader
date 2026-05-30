// Notificaciones del paper trader: avisa por Telegram cada vez que el bot
// efectivamente abre, agrega o cierra una posicion.

import type { PaperTrade } from './paper/engine';

type NotifyTelegramConfig = {
  token: string;
  chatId: string;
};

function getTelegramConfig(): NotifyTelegramConfig | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return null;
  return { token, chatId };
}

async function sendTelegram(message: string): Promise<boolean> {
  const config = getTelegramConfig();
  if (!config) return false;

  try {
    const url = `https://api.telegram.org/bot${config.token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    const data = await res.json();
    return data.ok === true;
  } catch {
    return false;
  }
}

function modeBadge(mode: string): string {
  if (mode === 'swing') return '📊 SWING';
  if (mode === 'intraday') return '⚡ INTRADAY';
  if (mode === 'antivitalik') return '🎯 ANTIVITALIK';
  return mode.toUpperCase();
}

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: decimals });
}

// ─── Notificacion: paper trade ABIERTO ───
export async function notifyPaperOpen(trade: PaperTrade, balance: number): Promise<boolean> {
  const sideEmoji = trade.side === 'long' ? '🟢' : '🔴';
  const sideText = trade.side.toUpperCase();
  const priceDecimals = trade.entryPrice < 1 ? 6 : 2;

  const msg = `${sideEmoji} <b>PAPER ABIERTO</b> · ${trade.symbol}
${modeBadge(trade.mode)} · ${sideText}

💰 Entry: $${fmt(trade.entryPrice, priceDecimals)}
🛑 Stop: $${fmt(trade.stopLoss, priceDecimals)}
🎯 Target: $${fmt(trade.takeProfit, priceDecimals)}

Margen: $${fmt(trade.marginUsed)} (leverage ${trade.leverage}x)
Notional: $${fmt(trade.positionSize)}
${trade.entryConsensus !== 'ANTIVITALIK' ? `Consenso: ${trade.entryConsensus} · Score: ${trade.entryScore}` : ''}

Balance: $${fmt(balance)}`;

  return sendTelegram(msg);
}

// ─── Notificacion: antivitalik ADD (mas balas) ───
export async function notifyAntivitalikAdd(params: {
  symbol: string;
  balasAdded: number;
  totalBalas: number;
  totalMargin: number;
  pnlPctLeveraged: number;
  currentPrice: number;
}): Promise<boolean> {
  const priceDecimals = params.currentPrice < 1 ? 6 : 2;

  const msg = `🔵 <b>ANTIVITALIK ADD</b> · ${params.symbol}
${modeBadge('antivitalik')}

+${params.balasAdded} balas (P&L compuesto: ${params.pnlPctLeveraged >= 0 ? '+' : ''}${params.pnlPctLeveraged.toFixed(1)}%)

Total balas: ${params.totalBalas}
Margen total: $${fmt(params.totalMargin)}
Precio actual: $${fmt(params.currentPrice, priceDecimals)}`;

  return sendTelegram(msg);
}

// ─── Notificacion: paper trade CERRADO ───
export async function notifyPaperClose(trade: PaperTrade, balanceBefore: number, balanceAfter: number): Promise<boolean> {
  const isWin = (trade.pnl || 0) >= 0;
  const emoji = isWin ? '✅' : '❌';
  const reasonText = trade.exitReason === 'tp_hit' ? 'TP HIT'
    : trade.exitReason === 'sl_hit' ? 'SL HIT'
    : trade.exitReason === 'timeout' ? 'TIMEOUT'
    : trade.exitReason === 'manual' ? 'MANUAL'
    : 'CLOSED';

  const priceDecimals = trade.entryPrice < 1 ? 6 : 2;

  const msg = `${emoji} <b>PAPER CERRADO</b> · ${trade.symbol}
${modeBadge(trade.mode)} · ${trade.side.toUpperCase()}
${reasonText} · ${isWin ? 'GANANCIA' : 'PÉRDIDA'}: ${isWin ? '+' : ''}$${fmt(trade.pnl || 0)} (${(trade.pnlPercent || 0).toFixed(2)}%)

Entry: $${fmt(trade.entryPrice, priceDecimals)} → Exit: $${fmt(trade.exitPrice || 0, priceDecimals)}
Fees pagadas: $${fmt(trade.feesPaid || 0)}

Balance: $${fmt(balanceBefore)} → $${fmt(balanceAfter)}`;

  return sendTelegram(msg);
}

// ─── Notificacion: antivitalik CERRADO (todos los trades de la serie) ───
export async function notifyAntivitalikClose(params: {
  symbol: string;
  totalPnl: number;
  pnlPctLeveraged: number;
  totalBalas: number;
  reason: 'tp_hit' | 'sl_hit';
  balanceBefore: number;
  balanceAfter: number;
}): Promise<boolean> {
  const isWin = params.totalPnl >= 0;
  const emoji = isWin ? '✅' : '❌';
  const reasonText = params.reason === 'tp_hit' ? 'TP HIT (+20% apalancado)' : 'SL CATASTROFICO (-50% apalancado)';

  const msg = `${emoji} <b>ANTIVITALIK CERRADO</b> · ${params.symbol}
${modeBadge('antivitalik')}
${reasonText}

${isWin ? 'GANANCIA' : 'PÉRDIDA'} total: ${isWin ? '+' : ''}$${fmt(params.totalPnl)}
P&L apalancado: ${params.pnlPctLeveraged >= 0 ? '+' : ''}${params.pnlPctLeveraged.toFixed(1)}%
Balas cerradas: ${params.totalBalas}

Balance: $${fmt(params.balanceBefore)} → $${fmt(params.balanceAfter)}`;

  return sendTelegram(msg);
}
