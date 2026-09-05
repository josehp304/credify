import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/server';

/**
 * Session-gated proxy between the browser and the Express backend.
 *
 * The browser never talks to Express directly and never holds a secret.
 * Every request here must carry a valid Neon Auth session cookie; the proxy
 * then forwards to Express with the shared INTERNAL_API_SECRET header, and
 * injects the caller's identity (session email / user id) server-side so
 * trust profiles can never be written or read on behalf of someone else.
 */

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || 'http://localhost:3002';

interface SessionUser {
  id: string;
  email: string;
  name?: string;
}

type JsonBody = Record<string, unknown>;

interface ProxyRule {
  method: 'GET' | 'POST';
  /** Upstream path under /api/v1/, resolved per-request when identity-dependent. */
  upstream: string | ((user: SessionUser) => string);
  body?: 'json' | 'multipart';
  /** Pass the upstream response through as-is (e.g. watermarked PNG). */
  binary?: boolean;
  /** Overwrite identity fields server-side; user-supplied values are discarded. */
  inject?: (payload: FormData | JsonBody, user: SessionUser) => void;
}

const RULES: Record<string, ProxyRule> = {
  'POST refund/verify': {
    method: 'POST',
    upstream: 'refund/verify',
    body: 'multipart',
    inject: (form, user) => {
      (form as FormData).set('email', user.email);
      (form as FormData).delete('phone_number');
    },
  },
  'POST document/watermark': {
    method: 'POST',
    upstream: 'document/watermark',
    body: 'multipart',
    binary: true,
  },
  'POST document/verify': {
    method: 'POST',
    upstream: 'document/verify',
    body: 'multipart',
  },
  'POST id/generate': {
    method: 'POST',
    upstream: 'id/generate',
    body: 'json',
  },
  'POST id/verify': {
    method: 'POST',
    upstream: 'id/verify',
    body: 'multipart',
  },
  'POST review/score': {
    method: 'POST',
    upstream: 'review/score',
    body: 'json',
    inject: (body, user) => {
      (body as JsonBody).reviewer_email = user.email;
      delete (body as JsonBody).reviewer_phone;
    },
  },
  'POST user/sync': {
    method: 'POST',
    upstream: 'user/sync',
    body: 'json',
    inject: (body, user) => {
      (body as JsonBody).email = user.email;
    },
  },
  'POST profile': {
    method: 'POST',
    upstream: 'profile',
    body: 'json',
    inject: (body, user) => {
      (body as JsonBody).userId = user.id;
    },
  },
  'GET profile/me': {
    method: 'GET',
    upstream: (user) => `profile/${user.id}`,
  },
  'GET dashboard/stats': { method: 'GET', upstream: 'dashboard/stats' },
  'GET dashboard/recent': { method: 'GET', upstream: 'dashboard/recent' },
  'GET trustcanvas': { method: 'GET', upstream: 'trustcanvas' },
};

export async function handleProxy(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  const { path } = await ctx.params;
  const rule = RULES[`${req.method} ${path.join('/')}`];

  if (!rule) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  const { data: session } = await auth.getSession();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: sign in required' },
      { status: 401 }
    );
  }
  const user = session.user as SessionUser;

  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    console.error('INTERNAL_API_SECRET is not set; refusing to proxy.');
    return NextResponse.json(
      { success: false, error: 'Server misconfigured' },
      { status: 500 }
    );
  }

  const upstreamPath = typeof rule.upstream === 'function' ? rule.upstream(user) : rule.upstream;
  const url = `${BACKEND_URL}/api/v1/${upstreamPath}`;
  const headers: Record<string, string> = { 'x-internal-secret': secret };

  let body: BodyInit | undefined;
  if (rule.body === 'multipart') {
    const form = await req.formData();
    rule.inject?.(form, user);
    body = form; // fetch sets the multipart boundary itself
  } else if (rule.body === 'json') {
    const json: JsonBody = await req.json().catch(() => ({}));
    rule.inject?.(json, user);
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  }

  let upstream: Response;
  try {
    upstream = await fetch(url, { method: rule.method, headers, body });
  } catch (err) {
    console.error(`Proxy to ${url} failed:`, err);
    return NextResponse.json(
      { success: false, error: 'Verification service unavailable' },
      { status: 502 }
    );
  }

  if (rule.binary && upstream.ok) {
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/octet-stream' },
    });
  }

  const data = await upstream.json().catch(() => ({ success: false, error: 'Bad upstream response' }));
  return NextResponse.json(data, { status: upstream.status });
}
