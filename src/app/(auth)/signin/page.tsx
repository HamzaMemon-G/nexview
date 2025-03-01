'use client'
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { Separator } from "@/components/ui/separator";
import { signIn } from "next-auth/react";

export default function Signin() {
    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50/50">
            <Card className="w-full max-w-md mx-4 shadow-lg">
                <CardHeader className="p-0 text-center flex items-center justify-center">
                    <Image src='/nexview.png' width={150} height={150} alt={"NexView"} className="brightness-0"></Image>
                </CardHeader>
                <CardContent>
                    <form className="space-y-6">
                        <div className="space-y-2">
                            <Button className="w-full" onClick={(e) => { e.preventDefault(); signIn("google") }}>Google</Button>
                        </div>
                        <div className="flex flex-row space-x-4 items-center text-center">
                            <Separator className="w-1/3" />
                            <Label className="w-1/3" htmlFor="OR">OR</Label>
                            <Separator className="w-1/3" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-sm font-medium">
                                Email
                            </Label>
                            <Input
                                type="email"
                                id="email"
                                placeholder="name@example.com"
                                className="w-full"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-sm font-medium">
                                Password
                            </Label>
                            <Input
                                type="password"
                                id="password"
                                placeholder="••••••••"
                                className="w-full"
                            />
                        </div>
                        <Button className="w-full">
                            Sign in
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}