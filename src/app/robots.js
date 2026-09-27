import { publicOrigin } from '@/lib/publicOrigin';

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/revlongbm'],
      },
    ],
    sitemap: `${publicOrigin()}/sitemap.xml`,
  };
}
