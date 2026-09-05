import { NextRequest } from 'next/server';
import { handleProxy } from '@/lib/apiProxy';

// All browser -> Express traffic flows through this allow-listed,
// session-gated proxy. See src/lib/apiProxy.ts for the rules.

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return handleProxy(req, ctx);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return handleProxy(req, ctx);
}
