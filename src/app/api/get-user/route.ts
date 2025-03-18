import dbConnect from "@/lib/dbConnect";
import UserModel from "@/models/User";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {

    const email = req.nextUrl.searchParams.get('email');
    

    if (!email) {
        return NextResponse.json({ message: "Invalid request" }, { status: 400 });
    }

    try {
        
        await dbConnect();

        const existingUser = await UserModel.findOne({
            email: email
        });

        if (existingUser) {
            return NextResponse.json({ message: 'User Found', user: existingUser }, { status: 200 });

        } else {
            return NextResponse.json({ message: 'User not found' }, { status: 404 });

        }



    } catch (error) {
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });   
    }
}