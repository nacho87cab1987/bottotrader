import type { AnalysisResult } from './scoring';

export type NotifyResult = {
  channel: string;
  success: boolean;
  error?: string;
};

async function sendWhatsApp(phone: string, apiKey: string, message: string): Promise<NotifyResult> {
  try {
    const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(message)}&apikey=${apiKey}`;
    const res = await fetch(url, { method: 'GET' });
    const text = await res.text();
    if (text.toLowerCase().includes('sent') || text.toLowerCase().includes('queued')) {
      return { channel: 'whatsapp', success: true };
    }
    return { channel: 'whatsapp', success: false, error: text.slice(0, 200) };
  } catch (e: any) {
    return { channel: 'whatsapp', success: false, error: e.message };
  }
}

async function sendTelegram(token: string, chatId: string, message: string): Promise<NotifyResult> {
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    const data = await res.json();
    if (data.ok) return { channel: 'telegram', success: true };
    return { channel: 'telegram', success: false, error: data.description };
  } catch (e: any) {
    return { channel: 'telegram', success: false, error: e.message };
  }
}

export function formatAlertMessage(result: AnalysisResult, format: 'plain' | 'html'): string {
  const isLong = result.verdict === 'long';
  const emoji = isLong ? '🟢▲' : '🔴▼';
  const side = isLong ? 'LONG' : 'SHORT';
  const score = isLong ? result.longScore : result.shortScore;

  const activeSignals = (isLong ? result.longSignals : result.shortSignals)
    .filter(s => s.triggered)
    .map(s => `• ${s.name}${s.value ? ` (${s.value})` : ''}`)
    .join('\n');

  if (format === 'html') {
    const tfBadge = (bias: string) => bias === 'bullish' ? '🟢' : bias === 'bearish' ? '🔴' : '⚪';

    let levelsBlock = '';
    if (result.levels) {
      const ns = result.levels.nearestSupport;
      const nr = result.levels.nearestResistance;
      if (ns || nr) {
        levelsBlock = `\n📍 <b>Niveles clave:</b>\n`;
        if (nr) levelsBlock += `• Resistencia: $${nr.price.toFixed(2)} (+${nr.distance.toFixed(2)}%)\n`;
        if (ns) levelsBlock += `• Soporte: $${ns.price.toFixed(2)} (${ns.distance.toFixed(2)}%)\n`;
      }
    }

    return `${emoji} <b>EDGE ALERT — ${result.symbol}</b> [${result.mode.toUpperCase()}]

<b>SETUP ${side} VÁLIDO · Consenso ${result.consensus.level}</b>
Score: <b>${score}/100</b>

💰 Precio: $${result.price.toLocaleString()} (${result.priceChange24h >= 0 ? '+' : ''}${result.priceChange24h.toFixed(2)}% 24h)

🕐 <b>Multi-Timeframe:</b>
${tfBadge(result.tfTrigger.bias)} ${result.tfLabels.trigger}: ${result.tfTrigger.bias} (${result.tfTrigger.strength})
${tfBadge(result.tfSetup.bias)} ${result.tfLabels.setup}: ${result.tfSetup.bias} (${result.tfSetup.strength})
${tfBadge(result.tfMacro.bias)} ${result.tfLabels.macro}: ${result.tfMacro.bias} (${result.tfMacro.strength})
<i>${result.consensus.description}</i>
${levelsBlock}
📊 <b>Indicadores:</b>
• RSI: ${result.indicators.rsi.toFixed(1)}
• Vol ratio: ${result.indicators.volumeRatio.toFixed(2)}x
• F&amp;G: ${result.context.fearGreed ?? '—'}

✅ <b>Confluencias:</b>
${activeSignals}

⚠ <i>Verificá R:R antes de entrar. No es asesoría financiera.</i>`;
  }

  const tfTxt = (bias: string) => bias === 'bullish' ? '[+]' : bias === 'bearish' ? '[-]' : '[ ]';

  let levelsBlockPlain = '';
  if (result.levels) {
    const ns = result.levels.nearestSupport;
    const nr = result.levels.nearestResistance;
    if (ns || nr) {
      levelsBlockPlain = `\nNiveles clave:\n`;
      if (nr) levelsBlockPlain += `- Resistencia: $${nr.price.toFixed(2)} (+${nr.distance.toFixed(2)}%)\n`;
      if (ns) levelsBlockPlain += `- Soporte: $${ns.price.toFixed(2)} (${ns.distance.toFixed(2)}%)\n`;
    }
  }

  return `${emoji} EDGE ALERT - ${result.symbol} [${result.mode.toUpperCase()}]

SETUP ${side} VALIDO - Consenso ${result.consensus.level}
Score: ${score}/100

Precio: $${result.price.toLocaleString()} (${result.priceChange24h >= 0 ? '+' : ''}${result.priceChange24h.toFixed(2)}% 24h)

Multi-TF:
${tfTxt(result.tfTrigger.bias)} ${result.tfLabels.trigger}: ${result.tfTrigger.bias} (${result.tfTrigger.strength})
${tfTxt(result.tfSetup.bias)} ${result.tfLabels.setup}: ${result.tfSetup.bias} (${result.tfSetup.strength})
${tfTxt(result.tfMacro.bias)} ${result.tfLabels.macro}: ${result.tfMacro.bias} (${result.tfMacro.strength})
${result.consensus.description}
${levelsBlockPlain}
Indicadores:
- RSI: ${result.indicators.rsi.toFixed(1)}
- Vol: ${result.indicators.volumeRatio.toFixed(2)}x
- F&G: ${result.context.fearGreed ?? '-'}

Confluencias:
${activeSignals}

Verifica R:R antes de entrar. No es asesoria financiera.`;
}

export type NotifyConfig = {
  whatsapp?: { phone: string; apiKey: string };
  telegram?: { token: string; chatId: string };
};

export async function sendAlert(result: AnalysisResult, config: NotifyConfig): Promise<NotifyResult[]> {
  const results: NotifyResult[] = [];

  if (config.whatsapp?.phone && config.whatsapp?.apiKey) {
    const msg = formatAlertMessage(result, 'plain');
    results.push(await sendWhatsApp(config.whatsapp.phone, config.whatsapp.apiKey, msg));
  }

  if (config.telegram?.token && config.telegram?.chatId) {
    const msg = formatAlertMessage(result, 'html');
    results.push(await sendTelegram(config.telegram.token, config.telegram.chatId, msg));
  }

  return results;
}

export function getNotifyConfig(): NotifyConfig {
  const config: NotifyConfig = {};

  const waPhone = process.env.WHATSAPP_PHONE;
  const waKey = process.env.WHATSAPP_API_KEY;
  if (waPhone && waKey) config.whatsapp = { phone: waPhone, apiKey: waKey };

  const tgToken = process.env.TELEGRAM_BOT_TOKEN;
  const tgChat = process.env.TELEGRAM_CHAT_ID;
  if (tgToken && tgChat) config.telegram = { token: tgToken, chatId: tgChat };

  return config;
}
