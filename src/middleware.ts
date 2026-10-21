import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESSAO, inicioPorPapel, lerToken } from "@/lib/auth/token";

const AREAS: Record<string, string> = { "/consultor": "CONSULTOR", "/cliente": "CLIENTE", "/ponto": "EMPREGADO" };

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const sessao = await lerToken(req.cookies.get(COOKIE_SESSAO)?.value);

  const area = Object.keys(AREAS).find((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (area) {
    if (!sessao) {
      const url = new URL("/login", req.url);
      url.searchParams.set("voltar", pathname);
      return NextResponse.redirect(url);
    }
    if (sessao.papel !== AREAS[area]) return NextResponse.redirect(new URL(inicioPorPapel(sessao.papel), req.url));
  }
  if (pathname === "/login" && sessao) return NextResponse.redirect(new URL(inicioPorPapel(sessao.papel), req.url));
  return NextResponse.next();
}

export const config = { matcher: ["/consultor/:path*", "/cliente/:path*", "/ponto/:path*", "/login"] };
