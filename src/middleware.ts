import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
export { default } from "next-auth/middleware";

export async function middleware(request: NextRequest) {
    const token = await getToken({ req: request, secret: process.env.SESSION_SECRET });
    const protectedPaths = ["/"];

    if (!token) {
        if (protectedPaths.some(path => request.nextUrl.pathname.startsWith(path))) {
            return NextResponse.redirect(new URL("/signin", request.nextUrl));
        }
        return NextResponse.next();
    }
    return NextResponse.next();
}

export const config = {
    matcher: [
        '/',
    ]
};