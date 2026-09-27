import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getAdminSession();
  return NextResponse.json({ admin: Boolean(session), administrator: session ? { name: session.name, email: session.email, role: session.role } : null });
}
