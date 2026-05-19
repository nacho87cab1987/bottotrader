import { NextResponse } from 'next/server';
import { fetchSpotSymbols } from '@/lib/binance';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const symbols = await fetchSpotSymbols();
    return NextResponse.json({ symbols });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
