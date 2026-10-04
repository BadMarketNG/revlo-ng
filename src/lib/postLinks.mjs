// Post copy stays on Revlo. Source URLs may be retained in private import
// records, but are never published in titles, descriptions or locations.
const URL = /(?:https?:\/\/|www\.)[^\s<>"'`]+|(?<!@)\b(?:[a-z\d](?:[a-z\d-]*[a-z\d])?\.)+[a-z]{2,}(?::\d{2,5})?(?:\/[^\s<>"'`]*)?/giu;

export function hasPostLink(...values) {
  return values.some(value => typeof value === 'string' && new RegExp(URL.source, URL.flags).test(value));
}

export function stripPostLinks(value) {
  return String(value ?? '')
    .replace(/\[([^\]]+)\]\(\s*(?:https?:\/\/|www\.)[^)]+\)/giu, '$1')
    .replace(URL, '')
    .replace(/ +([,.;!?])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function postWithoutLinks(post) {
  if (!post) return post;
  return {
    ...post,
    title: post.title == null ? post.title : stripPostLinks(post.title),
    description: post.description == null ? post.description : stripPostLinks(post.description),
    location: post.location == null ? post.location : stripPostLinks(post.location),
  };
}
