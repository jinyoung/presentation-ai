import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // 임시로 인증 체크를 비활성화하고 루트 리다이렉트만 유지
  
  // Always redirect from root to /presentation
  if (request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/presentation", request.url));
  }

  // 모든 요청을 그대로 통과시킴 (인증 없이 접근 허용)
  return NextResponse.next();
}

// Add routes that should be protected by authentication
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
