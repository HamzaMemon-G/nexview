import GoogleProvider from "next-auth/providers/google";
import { NextAuthOptions } from "next-auth";
import dbConnect from "@/lib/dbConnect";
import UserModel from "@/models/User";

export const authOptions: NextAuthOptions  = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            authorization: {
                params: {
                    access_type: "offline",
                    prompt: "consent",
                    response_type: "code",
                },
            }
        })
    ],
    callbacks: {
        async signIn({ user, account }) {
            await dbConnect();
            try {
                if (account?.provider === "google") {
                    const existingUser = await UserModel.findOne({ email: user.email });
                    if (!existingUser) {
                        await UserModel.create({
                            username: user.name,
                            email: user.email,
                            avatar: user.image,
                            password: "",
                            streak: 0,
                        });
                    } 
                }
                return true;

            } catch (error) {
                console.error(error);
                return false;
            }
        },
        async redirect({ baseUrl }) {
            return baseUrl;
        }
    },
    pages: {
        signIn: '/signin',
    },
    session: {
        strategy: "jwt",
    },
    secret: process.env.SESSION_SECRET,
};