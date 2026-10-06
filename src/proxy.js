import { NextResponse } from 'next/server';
import { isBlockedContentCrawler, isScriptedPublicReader } from '@/lib/botPolicy.mjs';

const PUBLIC_DATA_PATH = /^\/api\/posts(?:\/|$)/;

export function proxy(request) {
  const userAgent = request.headers.get('user-agent') || '';
  const path = request.nextUrl.pathname;
  const blockedCrawler = isBlockedContentCrawler(userAgent);
  const scriptedApiReader = PUBLIC_DATA_PATH.test(path) && isScriptedPublicReader(userAgent);

  if (blockedCrawler || scriptedApiReader) {
    return NextResponse.json(
      { error: 'Automated collection is not permitted.' },
      {
        status: 403,
        headers: {
          'Cache-Control': 'private, no-store',
          'X-Robots-Tag': 'noindex, nofollow, noarchive',
        },
      },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/app.html', '/p/:path*', '/api/posts', '/api/posts/:path*'],
};

