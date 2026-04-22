import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // If the user is trying to access the root page (or any protected page)
  if (request.nextUrl.pathname === '/') {
    // Check if there is a feishu_token cookie
    const token = request.cookies.get('feishu_token');
    
    // If no token exists, redirect to the login page
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }
  
  // If they are on the login page and ALREADY authenticated, redirect them to /
  if (request.nextUrl.pathname === '/login') {
    const token = request.cookies.get('feishu_token');
    if (token) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/login'],
};
