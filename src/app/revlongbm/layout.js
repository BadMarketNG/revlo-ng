export const metadata = {
  title: 'Admin — Revlo.ng',
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminLayout({ children }) {
  if (!await getAdminSession()) redirect('/app.html');
  return children;
}
import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/adminAuth';
