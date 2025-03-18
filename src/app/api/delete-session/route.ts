import UserModel from "@/models/User";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

export async function POST(req: NextRequest) {
    const { email, sessionId } = await req.json();


    if (!email || !sessionId) {
        return new Response('Invalid request', { status: 400 });
    }

    try {
        const existingUser = await UserModel.findOne({
            email: email
        });
        
        if (!existingUser) {
            return NextResponse.json({ message: 'User not found' }, { status: 404 });
        }
        
        // Convert the session ID to string for comparison
        const sessionIdStr = String(sessionId);
        
        // Find the session by either id or _id (both converted to string)
        const sessionIndex = existingUser.sessions.findIndex(
            (session) => String(session._id) === sessionIdStr || session.id === sessionIdStr
        );
        
        if (sessionIndex === -1) {
            console.log("Session not found");
            return NextResponse.json({ message: 'Session not found' }, { status: 404 });
        }
        
        // Remove the session by index
        existingUser.sessions.splice(sessionIndex, 1);
        await existingUser.save();
        
        return NextResponse.json({ 
            message: 'Session deleted successfully',
            remainingSessions: existingUser.sessions 
        }, { status: 200 });
    } catch (error) {
        console.error("Error deleting session:", error);
        return NextResponse.json({ 
            message: 'Error deleting session', 
            error: error instanceof Error ? error.message : String(error) 
        }, { status: 500 });
    }
}