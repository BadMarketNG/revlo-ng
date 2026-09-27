import { redirect } from 'next/navigation';

// The compiled front end lives at /public/app.html and is served statically.
// We redirect the root to it. (Once the front end is refactored into React
// components here, replace this with the actual component tree.)
// The query string is forwarded so emailed links (e.g. ?token=) still work.
export default function Home({ searchParams }) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams || {})) {
    for (const v of [].concat(value)) query.append(key, v);
  }
  const qs = query.toString();
  redirect(qs ? `/app.html?${qs}` : '/app.html');
}
