export const metadata = {
  title: 'Admin — Revlo.ng',
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }) {
  if (!getAdminSession()) redirect(`${process.env.BADMARKET_ADMIN_ORIGIN || 'https://badmarket.ng'}/admin`);
  return children;
}
import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/adminAuth';
