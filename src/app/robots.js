const APP_URL = process.env.APP_URL || 'https://revlo.ng';

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/revlongbm'],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
