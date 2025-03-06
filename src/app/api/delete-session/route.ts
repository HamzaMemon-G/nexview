import UserModel from "@/models/User";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {

    const { email, sessionId } = await req.json();


    if (!email || !sessionId) {
        return new Response('Invalid request', { status: 400 });
    }


    const existingUser = await UserModel.findOne({
        email: email
    });
    if (!existingUser) {
        return NextResponse.json({ message: 'User not found' }, { status: 404 });
    } else {
        const existingSession = existingUser.sessions.find((session) => session.id === sessionId);
        if (!existingSession) {
            return NextResponse.json({ message: 'Session not found' }, { status: 404 });
        }
        
        if (existingSession.id === sessionId) {
            existingUser.sessions = existingUser.sessions.filter((session) => session.id !== sessionId);
            await existingUser.save();
            return NextResponse.json({ message: 'Session deleted successfully' }, { status: 200 });
        }
    }


    return NextResponse.json({ message: 'User Found', user: existingUser }, { status: 200 });
}