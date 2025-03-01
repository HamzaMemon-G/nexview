import dbConnect from "@/lib/dbConnect";
import UserModel from "@/models/User";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { user, session } = await req.json();
        if (!user || !session) {
            return NextResponse.json({ message: "Invalid request" }, { status: 400 });
        }

        await dbConnect();

        const existingUser = await UserModel.findOne({ email: user });

        if (!existingUser) {
            return NextResponse.json({ message: "User not found" }, { status: 404 });
        }

        if (!session.dailyTime || !session.name || !session.endDate || !session.id) {
            return NextResponse.json(
                { message: "Session validation failed: duration, time, title, and id are required." },
                { status: 400 }
            );
        }

        existingUser.sessions.push({
            id: session.id,
            title: session.name,
            time: session.dailyTime,
            duration: session.endDate,
            likedVideos: session.likedVideos || [],
            dislikedVideos: session.dislikedVideos || [],
            savedVideos: session.savedVideos || [],
            history: session.history || [],
            createdAt: new Date(),
        });

        await existingUser.save();

        return NextResponse.json({ message: "Session created successfully" }, { status: 201 });
    } catch (error) {
        console.error("Error saving session:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}
