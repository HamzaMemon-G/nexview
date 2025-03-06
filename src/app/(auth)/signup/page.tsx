"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { signIn } from "next-auth/react";
import Image from "next/image";

export default function Signin() {
    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50/50">
            <Card className="w-full max-w-md mx-4 shadow-lg">
                <CardHeader className="p-0 text-center flex items-center justify-center">
                    <Image src='/nexview.png' width={150} height={150} alt={"NexView"} className="dark:brightness-100"></Image>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        <Button className="w-full" onClick={(e) => { e.preventDefault(); signIn("google") }}>Google</Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}