import { redirect } from 'next/navigation';

// The compiled front end lives at /public/app.html and is served statically.
// We redirect the root to it. (Once the front end is refactored into React
// components here, replace this with the actual component tree.)
export default function Home() {
  redirect('/app.html');
}
