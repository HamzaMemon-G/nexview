import dbConnect from "@/lib/dbConnect";
import UserModel from "@/models/User";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        
        const { user, sessionid, action } = await req.json();
        
        if (!user || !sessionid || !action) {
            return NextResponse.json({ message: "Invalid request" }, { status: 400 });
        }

        await dbConnect();

        const existingUser = await UserModel.findOne({ email: user });
        
        if (!existingUser) {
            return NextResponse.json({ message: "User not found" }, { status: 404 });
        }

        const existingSession = existingUser.sessions.find((session) => session.id === sessionid);
        
        if (!existingSession) {
            return NextResponse.json({ message: "Session not found" }, { status: 404 });
        }

        if (action === "like") {
            existingSession.likedVideos.push(sessionid);
        } else if (action === "dislike") {
            existingSession.dislikedVideos.push(sessionid);
        } else if (action === "save") {
            existingSession.savedVideos.push(sessionid);
        } else if (action === "history") {
            existingSession.history.push(sessionid);
        } else if (action === "unlike") {
            existingSession.likedVideos = existingSession.likedVideos.filter((video) => video !== sessionid);
        } else if (action === "undislike") {
            existingSession.dislikedVideos = existingSession.dislikedVideos.filter((video) => video !== sessionid);
        } else if (action === "unsave") {
            existingSession.savedVideos = existingSession.savedVideos.filter((video) => video !== sessionid);
        } else {
            return NextResponse.json({ message: "Invalid action" }, { status: 400 });
        }

        await existingUser.save();

        return NextResponse.json({ message: "Action processed successfully" }, { status: 200 });

    } catch (error) {
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}
