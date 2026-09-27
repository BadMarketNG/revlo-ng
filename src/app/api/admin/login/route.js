import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  void request;
  return NextResponse.json({ error: 'not found' }, { status: 404 });
}
