import mongoose, { Schema, Document } from "mongoose";

export interface Session {
    id: string;
    title: string;
    time: string;
    duration: Date;
    likedVideos: Array<string>;
    dislikedVideos: Array<string>;
    savedVideos: Array<string>;
    history: Array<string>;
    createdAt?: Date;
}

export interface User extends Document {
    username: string;
    email: string;
    password: string;
    avatar: string;
    sessions: Session[];
    streak: number;
    createdAt: Date;
}

const SessionSchema: Schema<Session> = new Schema({
    id: { type: String, required: true },
    title: { type: String, required: true },
    time: { type: String, required: true },
    duration: { type: Date, required: true },
    likedVideos: { type: [String], default: [] },
    dislikedVideos: { type: [String], default: [] },
    savedVideos: { type: [String], default: [] },
    history: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now },
});

const UserSchema: Schema<User> = new Schema({
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String },
    avatar: { type: String, required: true },
    sessions: { type: [SessionSchema], default: [] },
    streak: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
});

const UserModel = (mongoose.models.User as mongoose.Model<User>) || mongoose.model<User>("User", UserSchema);

export default UserModel;