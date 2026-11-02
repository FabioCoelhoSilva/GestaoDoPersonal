import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 1_048_576;
const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

function getApiBaseUrl(): URL | null {
  const configuredUrl = process.env.API_BASE_URL;
  if (!configuredUrl) return null;

  const url = new URL(configuredUrl);
  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error('API_BASE_URL deve ser uma URL HTTP(S) sem credenciais, query ou fragmento.');
  }
  return url;
}

async function proxyRequest(request: NextRequest, path: string[]) {
  if (!ALLOWED_METHODS.has(request.method)) {
    return NextResponse.json({ error: 'Método não permitido', code: 'METHOD_NOT_ALLOWED' }, { status: 405 });
  }

  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ') || authorization.length <= 'Bearer '.length) {
    return NextResponse.json({ error: 'Autenticação obrigatória', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (path.length === 0 || path.some((segment) => !segment || segment === '.' || segment === '..')) {
    return NextResponse.json({ error: 'Caminho da API inválido', code: 'BAD_REQUEST' }, { status: 400 });
  }

  let baseUrl: URL | null;
  try {
    baseUrl = getApiBaseUrl();
  } catch (error) {
    console.error('Configuração inválida do proxy da API.', error);
    return NextResponse.json(
      { error: 'A API não está configurada corretamente', code: 'API_CONFIGURATION_ERROR' },
      { status: 503 },
    );
  }
  if (!baseUrl) {
    return NextResponse.json(
      { error: 'API_BASE_URL não está configurada', code: 'API_CONFIGURATION_ERROR' },
      { status: 503 },
    );
  }

  let body: ArrayBuffer | undefined;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    body = await request.arrayBuffer();
    if (body.byteLength > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: 'Pedido excede o tamanho permitido', code: 'PAYLOAD_TOO_LARGE' },
        { status: 413 },
      );
    }
  }

  const encodedPath = path.map((segment) => encodeURIComponent(segment)).join('/');
  const targetUrl = new URL(`${baseUrl.pathname.replace(/\/+$/, '')}/${encodedPath}`, baseUrl.origin);
  targetUrl.search = request.nextUrl.search;
  const contentType = request.headers.get('content-type');

  try {
    const upstream = await fetch(targetUrl, {
      method: request.method,
      headers: {
        Authorization: authorization,
        Accept: request.headers.get('accept') ?? 'application/json',
        ...(contentType ? { 'Content-Type': contentType } : {}),
      },
      ...(body ? { body } : {}),
      cache: 'no-store',
      redirect: 'manual',
    });

    const headers = new Headers({ 'Cache-Control': 'no-store' });
    const responseContentType = upstream.headers.get('content-type');
    if (responseContentType) headers.set('Content-Type', responseContentType);
    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    console.error('Não foi possível alcançar a API configurada.', error);
    return NextResponse.json(
      { error: 'A API está temporariamente indisponível', code: 'API_UNAVAILABLE' },
      { status: 502 },
    );
  }
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, (await context.params).path);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, (await context.params).path);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, (await context.params).path);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, (await context.params).path);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, (await context.params).path);
}
