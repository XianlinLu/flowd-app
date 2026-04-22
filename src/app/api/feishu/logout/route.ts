import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL('/login', request.url));
  
  // Clear the feishu tokens
  response.cookies.delete('feishu_token');
  response.cookies.delete('feishu_user');
  
  return response;
}
