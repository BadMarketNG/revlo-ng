import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ admin: isAdminRequest() });
}
