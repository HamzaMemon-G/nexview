import mongoose from "mongoose";

type ConnectionObject = {
    isConnected?: number,
}

const connection: ConnectionObject = {}

async function dbConnect(): Promise<void> {
    if (connection.isConnected){

        console.log("Connection already exists.")
        return

    }

    try{
        const db = await mongoose.connect(process.env.MONGODB_URI || '', {})
        connection.isConnected = db.connections[0].readyState

        console.log("Connection created successfully.")
    }catch(err){
        console.error("Db connection error: ", err)
        process.exit(1)
    }
}

export default dbConnect