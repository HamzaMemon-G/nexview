import dbConnect from "@/lib/dbConnect";
import UserModel from "@/models/User";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        
        const { user, sessionId, videoId, action } = await req.json();
        
        console.log(user, sessionId, videoId, action);
        if (!user || !sessionId || !videoId || !action) {
            return NextResponse.json({ message: "Invalid request" }, { status: 400 });
        }

        await dbConnect();

        const existingUser = await UserModel.findOne({ email: user });
        
        if (!existingUser) {
            return NextResponse.json({ message: "User not found" }, { status: 404 });
        }

        const existingSession = existingUser.sessions.find((session) => session.id === sessionId);
        
        if (!existingSession) {
            return NextResponse.json({ message: "Session not found" }, { status: 404 });
        }

        if (action === "like") {
            existingSession.likedVideos.push(videoId);
        } else if (action === "dislike") {
            existingSession.dislikedVideos.push(videoId);
        } else if (action === "save") {
            existingSession.savedVideos.push(videoId);
        } else if (action === "history") {
            if (!existingSession.history.includes(videoId)) {
                existingSession.history.push(videoId);
            } else {
                return NextResponse.json({ message: "Video already exists in history" }, { status: 200 });
            }
            
        } else if (action === "unlike") {
            existingSession.likedVideos = existingSession.likedVideos.filter((video) => video !== videoId);
        } else if (action === "undislike") {
            existingSession.dislikedVideos = existingSession.dislikedVideos.filter((video) => video !== videoId);
        } else if (action === "unsave") {
            existingSession.savedVideos = existingSession.savedVideos.filter((video) => video !== videoId);
        } else {
            return NextResponse.json({ message: "Invalid action" }, { status: 400 });
        }

        await existingUser.save();

        return NextResponse.json({ message: "Action processed successfully" }, { status: 200 });

    } catch (error) {
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}
