import { NextResponse } from 'next/server';
import { publicOrigin } from '@/lib/publicOrigin';

export const dynamic = 'force-dynamic';

export function GET() {
  const origin = publicOrigin();
  const body = [
    'Contact: mailto:logic@badmarket.ng',
    'Expires: 2027-09-27T23:59:59Z',
    'Preferred-Languages: en',
    `Canonical: ${origin}/.well-known/security.txt`,
    '',
  ].join('\n');
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
