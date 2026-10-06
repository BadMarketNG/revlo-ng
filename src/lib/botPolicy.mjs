const CONTENT_CRAWLER_PATTERN = /(?:GPTBot|ChatGPT-User|CCBot|ClaudeBot|Claude-Web|anthropic-ai|PerplexityBot|Bytespider|Applebot-Extended|cohere-ai|Diffbot|ImagesiftBot|Omgilibot)/i;
const SCRIPT_CLIENT_PATTERN = /(?:curl|Wget|python-requests|python-httpx|Go-http-client|Scrapy|aiohttp|libwww-perl|Apache-HttpClient)/i;

export function isBlockedContentCrawler(userAgent) {
  return CONTENT_CRAWLER_PATTERN.test(String(userAgent || ''));
}

export function isScriptedPublicReader(userAgent) {
  return SCRIPT_CLIENT_PATTERN.test(String(userAgent || ''));
}

export function shouldBlockPublicRead(request) {
  const userAgent = request?.headers?.get?.('user-agent') || '';
  return isBlockedContentCrawler(userAgent) || isScriptedPublicReader(userAgent);
}

