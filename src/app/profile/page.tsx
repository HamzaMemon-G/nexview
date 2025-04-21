"use client";

import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import axios from "axios";
import { getSession } from "next-auth/react";
import { FloatingNav } from "@/components/floating-nav";

// Define types for the user data structure
interface Session {
    id: string;
    title: string;
    time: string;
    duration: string;
    likedVideos: string[];
    dislikedVideos: string[];
    savedVideos: string[];
    history: string[];
    createdAt: string;
    _id: string;
}

interface UserData {
    _id: string;
    username: string;
    email: string;
    password: string;
    avatar: string;
    streak: number;
    sessions: Session[];
    createdAt: string;
    __v: number;
}

declare global {
    interface Window {
        user?: {
            data: {
                user: UserData;
            };
        };
    }
}

// Add a proper data fetching function
const fetchUserData = async (): Promise<UserData | null> => {
    try {
        const loginSession = await getSession();
        if (!loginSession) {
            console.error('No session found, user not logged in');
            return null;
        }
        const response = await axios.get('/api/get-user', {
            params: {
                email: loginSession.user?.email,
            }
        });

        if (response.status !== 200) {
            throw new Error('Failed to fetch user data');
        }

        const data = response.data;
        return data.user;
    } catch (error) {
        console.error('Error fetching user data:', error);
        return null;
    }
};

const calculateCurrentStreak = (sessions: Session[]): number => {
    if (!sessions || sessions.length === 0) return 0;

    // Extract and sort dates from sessions in descending order (newest first)
    const sessionDates = sessions.map(session => new Date(session.createdAt))
        .sort((a: Date, b: Date) => b.getTime() - a.getTime());

    // Normalize dates to midnight for proper comparison
    const normalizedDates = sessionDates.map((date: Date) => {
        const normalized = new Date(date);
        normalized.setHours(0, 0, 0, 0);
        return normalized.getTime();
    });

    // Remove duplicates (multiple sessions on same day)
    const uniqueDates = [...new Set(normalizedDates)].sort((b: number, a: number) => b - a);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();

    // Check if today has a session
    const hasActivityToday = uniqueDates.includes(todayTime);

    // Check if yesterday has a session
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayTime = yesterday.getTime();
    const hasActivityYesterday = uniqueDates.includes(yesterdayTime);

    // If neither today nor yesterday had activity, streak is broken
    if (!hasActivityToday && !hasActivityYesterday) return 0;

    // Start counting from today or yesterday
    let currentDate = hasActivityToday ? todayTime : yesterdayTime;
    let streak = hasActivityToday ? 1 : 0;
    let dayToCheck = hasActivityToday ? 1 : 2; // Start checking from yesterday or day before

    // Go backwards in time to count consecutive days
    while (true) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() - dayToCheck);
        checkDate.setHours(0, 0, 0, 0);
        const checkTime = checkDate.getTime();

        // Check if this date exists in our activity dates
        if (uniqueDates.includes(checkTime)) {
            streak++;
            dayToCheck++;
        } else {
            // Break in the streak
            break;
        }
    }

    return streak;
};

// Calculate longest streak
const calculateLongestStreak = (sessions: Session[]): number => {
    if (!sessions || sessions.length === 0) return 0;

    // Extract dates from sessions
    const sessionDates = sessions.map(session => new Date(session.createdAt));

    // Normalize dates to midnight for proper comparison
    const normalizedDates = sessionDates.map((date: Date) => {
        const normalized = new Date(date);
        normalized.setHours(0, 0, 0, 0);
        return normalized.getTime();
    });

    // Remove duplicates and sort (oldest first)
    const uniqueDates = [...new Set(normalizedDates)].sort((a: number, b: number) => a - b);

    let longestStreak = 0;
    let currentStreak = 1;

    for (let i = 1; i < uniqueDates.length; i++) {
        const previousTime = uniqueDates[i - 1];
        const currentTime = uniqueDates[i];

        // Get difference in days
        const diffDays = Math.round((currentTime as number - previousTime as number) / (24 * 60 * 60 * 1000));

        if (diffDays === 1) {
            // Consecutive day, increase streak
            currentStreak++;
        } else if (diffDays > 1) {
            // Break in the streak
            longestStreak = Math.max(longestStreak, currentStreak);
            currentStreak = 1;
        }
    }

    // Check if current streak is the longest
    longestStreak = Math.max(longestStreak, currentStreak);

    return longestStreak;
};

// Get activity dates for calendar display
const getActivityDates = (sessions: Session[]): Date[] => {
    if (!sessions || sessions.length === 0) return [];

    // Extract dates from sessions
    const sessionDates = sessions.map(session => {
        const date = new Date(session.createdAt);
        date.setHours(0, 0, 0, 0);
        return date;
    });

    // Remove duplicate dates (sessions on same day)
    const uniqueDates = [];
    const dateMap = new Map();

    for (const date of sessionDates) {
        const dateTime = date.getTime();
        if (!dateMap.has(dateTime)) {
            dateMap.set(dateTime, true);
            uniqueDates.push(date);
        }
    }

    return uniqueDates;
};

export default function ProfilePage() {
    // Use client-side rendering for components that cause hydration mismatches
    const [isClient, setIsClient] = useState(false);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [streakDates, setStreakDates] = useState<Date[]>([]);
    const [currentStreak, setCurrentStreak] = useState(0);
    const [longestStreak, setLongestStreak] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [sessions, setSessions] = useState<any[]>([]);

    useEffect(() => {
        setIsClient(true);

        const loadUserData = async () => {
            try {
                setIsLoading(true);
                const user = await fetchUserData();

                if (user) {
                    setUserData(user);
                    setCurrentStreak(calculateCurrentStreak(user.sessions));
                    setLongestStreak(calculateLongestStreak(user.sessions));
                    setStreakDates(getActivityDates(user.sessions));
                }
            } catch (error) {
                console.error('Error loading user data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        const loadSessions = () => {
            const savedSessions = localStorage.getItem('nexview-sessions');
            if (savedSessions) {
                try {
                    const parsedSessions = JSON.parse(savedSessions);
                    if (Array.isArray(parsedSessions)) {
                        setSessions(parsedSessions);
                    } else {
                        setSessions([]);
                    }
                } catch (error) {
                    console.error("Error parsing sessions:", error);
                    setSessions([]);
                }
            }
        }

        loadUserData();
        loadSessions();
    }, []);

    if (isLoading) {
        return (
            <div className="container mx-auto py-8 px-4 flex items-center justify-center min-h-[50vh]">
                <div className="text-center">
                    <h2 className="text-xl mb-2">Loading profile...</h2>
                    <p className="text-muted-foreground">Please wait while we fetch your data</p>
                </div>
            </div>
        );
    }

    // If no user data could be loaded after loading finished
    if (!userData && !isLoading) {
        return (
            <div className="container mx-auto py-8 px-4 flex items-center justify-center min-h-[50vh]">
                <div className="text-center">
                    <h2 className="text-xl mb-2">Could not load profile</h2>
                    <p className="text-muted-foreground">Please try refreshing the page</p>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8 px-4 max-w-5xl">
            <h1 className="text-3xl font-bold mb-8">User Profile</h1>

            {/* Profile Card */}
            <Card className="mb-8">
                <CardHeader className="flex flex-row items-center gap-4">
                    <Avatar className="h-20 w-20">
                        <AvatarImage src={userData?.avatar || ""} alt={userData?.username || ""} />
                        <AvatarFallback>{userData?.username.substring(0, 2).toUpperCase() || ""}</AvatarFallback>
                    </Avatar>
                    <div>
                        <CardTitle className="text-2xl">{userData?.username}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">{userData?.email}</p>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-2 items-center">
                        <Badge variant="secondary">Member since {userData ? new Date(userData.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : ""}</Badge>
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            {currentStreak} day streak 🔥
                        </Badge>
                    </div>
                </CardContent>
            </Card>

            {/* Stats and History Tabs */}
            <Tabs defaultValue="streak" className="mb-8">
                <TabsList className="mb-4">
                    <TabsTrigger value="streak">Activity Streak</TabsTrigger>
                    <TabsTrigger value="sessions">Learning Sessions</TabsTrigger>
                </TabsList>

                <TabsContent value="streak">
                    <Card>
                        <CardHeader>
                            <CardTitle>Your Learning Streak</CardTitle>
                            <CardDescription>Days with learning activity are highlighted</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isClient ? (
                                <Calendar
                                    mode="multiple"
                                    selected={streakDates}

                                    disabled={(date) => date > new Date()}
                                />
                            ) : (
                                <div className="h-[350px] flex items-center justify-center">
                                    <p>Loading calendar...</p>
                                </div>
                            )}
                        </CardContent>
                        <CardFooter className="flex justify-between">
                            <p className="text-sm text-muted-foreground">Current streak: {currentStreak} days</p>
                            <p className="text-sm text-muted-foreground">Best streak: {longestStreak} days</p>
                        </CardFooter>
                    </Card>
                </TabsContent>

                <TabsContent value="sessions">
                    <Card>
                        <CardHeader>
                            <CardTitle>Your Learning Sessions</CardTitle>
                            <CardDescription>{userData?.sessions.length || 0} total sessions</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {userData && userData.sessions.length > 0 ? (
                                    userData.sessions.map((session: Session) => (
                                        <div key={session.id} className="border rounded-lg p-4 flex flex-col sm:flex-row justify-between gap-2">
                                            <div>
                                                <h3 className="font-medium">{session.title}</h3>
                                                <p className="text-sm text-muted-foreground">
                                                    {new Date(session.createdAt).toLocaleDateString()} • {session.time}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {session.history.length > 0 && (
                                                    <Badge variant="outline">
                                                        {session.history.length} video{session.history.length !== 1 ? 's' : ''}
                                                    </Badge>
                                                )}
                                                {session.savedVideos.length > 0 && (
                                                    <Badge variant="secondary">
                                                        {session.savedVideos.length} saved
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-center py-8 text-muted-foreground">No sessions yet</p>
                                )}
                            </div>
                        </CardContent>
                        <CardFooter>
                            <p className="text-sm text-muted-foreground">
                                Created {userData ? new Date(userData.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ""}
                            </p>
                        </CardFooter>
                    </Card>
                </TabsContent>
            </Tabs>
            <FloatingNav
                activeRoute="profile"
                sessions={sessions}
                showSearch={false} // Adjust based on your needs
                searchQuery=""
                onSearchQueryChange={() => { }}
                onSearchSubmit={() => { }}
                setShowSearch={() => { }}
                onCreateSessionClick={() => console.log("Create session clicked")} // Replace with your logic
            />
        </div>
    );
}
