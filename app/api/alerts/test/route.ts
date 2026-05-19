import { NextResponse } from 'next/server';
import { getNotifyConfig } from '@/lib/notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const config = getNotifyConfig();
  const results: any[] = [];

  if (!config.whatsapp && !config.telegram) {
    return NextResponse.json({
      error: 'Sin canales configurados.',
    }, { status: 400 });
  }

  const testMsg = '✅ EDGE Test — canales conectados.';

  if (config.whatsapp) {
    try {
      const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(config.whatsapp.phone)}&text=${encodeURIComponent(testMsg)}&apikey=${config.whatsapp.apiKey}`;
      const res = await fetch(url);
      const text = await res.text();
      results.push({
        channel: 'whatsapp',
        success: text.toLowerCase().includes('sent') || text.toLowerCase().includes('queued'),
        response: text.slice(0, 200),
      });
    } catch (e: any) {
      results.push({ channel: 'whatsapp', success: false, error: e.message });
    }
  }

  if (config.telegram) {
    try {
      const url = `https://api.telegram.org/bot${config.telegram.token}/sendMessage`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: config.telegram.chatId, text: testMsg }),
      });
      const data = await res.json();
      results.push({ channel: 'telegram', success: data.ok, response: data });
    } catch (e: any) {
      results.push({ channel: 'telegram', success: false, error: e.message });
    }
  }

  return NextResponse.json({ results });
}
