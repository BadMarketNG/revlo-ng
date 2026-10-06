import { publicOrigin } from '@/lib/publicOrigin';

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/revlongbm'],
      },
      ...[
        'GPTBot',
        'ChatGPT-User',
        'CCBot',
        'ClaudeBot',
        'anthropic-ai',
        'PerplexityBot',
        'Bytespider',
        'Applebot-Extended',
        'Google-Extended',
        'cohere-ai',
      ].map((userAgent) => ({ userAgent, disallow: '/' })),
    ],
    sitemap: `${publicOrigin()}/sitemap.xml`,
  };
}
