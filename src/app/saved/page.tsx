'use client'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import Image from "next/image";
import { ModeToggle } from "@/components/modetoggle";
import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Home as HomeIcon, Clock, ThumbsUp, Bell, Bookmark, Trash2 } from "lucide-react";
import axios from "axios";
import { getSession } from "next-auth/react";
import { FloatingNav } from "@/components/floating-nav";

export default function SavedVideos() {
    interface SavedVideo {
        id: string;
        title: string;
        thumbnail: string;
        author: string;
        views: string;
        timestamp: string;
        duration?: string;
        dateSaved: string;
    }

    const [savedVideos, setSavedVideos] = React.useState<SavedVideo[]>([]);
    const [showSearch, setShowSearch] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState("");
    const searchRef = React.useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = React.useState(true);

    // Get saved videos from MongoDB
    const getSavedVideos = async () => {
        setIsLoading(true);
        try {
            const session = await getSession();
            if (!session) {
                window.location.href = "/signin";
                return;
            }

            const selectedSessionId = localStorage.getItem('nexview-selected-session');
            if (!selectedSessionId) {
                console.log("No selected session found");
                window.location.href = "/";
                return;
            }

            const user = await axios.get("/api/get-user", {
                params: {
                    email: session?.user?.email,
                },
            });

            console.log("User data:", user.data);

            // Find the selected session
            const selectedSession = user.data.user.sessions.find(
                (s: any) => s.id === selectedSessionId
            );
            
            console.log("Selected session:", selectedSession);
            
            if (!selectedSession || !selectedSession.savedVideos || selectedSession.savedVideos.length === 0) {
                console.log("No saved videos found");
                setSavedVideos([]);
                setIsLoading(false);
                return;
            }
            
            // Extract just the video IDs from the saved videos
            const videoIds = selectedSession.savedVideos.map((video: any) => {
                // Handle both string IDs and object with id property
                return typeof video === 'string' ? video : video.id;
            }).filter(Boolean).join(',');
            
            console.log("Video IDs to fetch:", videoIds);
            
            if (!videoIds) {
                setSavedVideos([]);
                setIsLoading(false);
                return;
            }
            
            // Fetch the videos from YouTube API
            await fetchVideoDetails(videoIds, selectedSession.savedVideos);
        } catch (error) {
            console.error("Error fetching saved videos:", error);
            setSavedVideos([]);
            setIsLoading(false);
        }
    };

    // Fetch video details from YouTube API
    const fetchVideoDetails = async (videoIds: string, savedVideoData: any[]) => {
        try {
            const API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
            
            console.log("Fetching videos with IDs:", videoIds);
            
            // Fetch video details from YouTube API
            const response = await fetch(
                `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds}&key=${API_KEY}`
            );
            const data = await response.json();
            
            console.log("YouTube API response:", data);
            
            if (data.items && data.items.length > 0) {
                // Process the API response
                const processedVideos = data.items.map((item: any) => {
                    // Find the corresponding saved video data (if any)
                    const savedData = savedVideoData.find((v: any) => {
                        // Support both string IDs and objects with id
                        const savedId = typeof v === 'string' ? v : v.id;
                        return savedId === item.id;
                    });
                    
                    // Process duration
                    let duration = "";
                    if (item.contentDetails?.duration) {
                        const match = item.contentDetails.duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
                        if (match) {
                            const hours = match[1] ? match[1].replace('H', '') : '0';
                            const minutes = match[2] ? match[2].replace('M', '') : '0';
                            const seconds = match[3] ? match[3].replace('S', '') : '0';

                            duration = hours !== '0'
                                ? `${hours}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`
                                : `${minutes}:${seconds.padStart(2, '0')}`;
                        }
                    }
                    
                    // Format views
                    const viewCount = parseInt(item.statistics?.viewCount || 0);
                    const views = `${viewCount.toLocaleString()} views`;
                    
                    // Process publish date for timestamp
                    const publishedAt = new Date(item.snippet.publishedAt);
                    const now = new Date();
                    const diffInDays = Math.floor((now.getTime() - publishedAt.getTime()) / (1000 * 60 * 60 * 24));

                    let timestamp = "";
                    if (diffInDays === 0) timestamp = "Today";
                    else if (diffInDays === 1) timestamp = "Yesterday";
                    else if (diffInDays < 7) timestamp = `${diffInDays} days ago`;
                    else if (diffInDays < 30) timestamp = `${Math.floor(diffInDays / 7)} weeks ago`;
                    else if (diffInDays < 365) timestamp = `${Math.floor(diffInDays / 30)} months ago`;
                    else timestamp = `${Math.floor(diffInDays / 365)} years ago`;
                    
                    // Get savedAt date if available, otherwise use current date
                    const dateSaved = savedData && typeof savedData === 'object' && savedData.dateSaved
                        ? new Date(savedData.dateSaved)
                        : new Date();
                    
                    // Format saved date
                    const savedDiffInDays = Math.floor((now.getTime() - dateSaved.getTime()) / (1000 * 60 * 60 * 24));
                    let savedAtFormatted = "";
                    if (savedDiffInDays === 0) savedAtFormatted = "Today";
                    else if (savedDiffInDays === 1) savedAtFormatted = "Yesterday";
                    else if (savedDiffInDays < 7) savedAtFormatted = `${savedDiffInDays} days ago`;
                    else if (savedDiffInDays < 30) savedAtFormatted = `${Math.floor(savedDiffInDays / 7)} weeks ago`;
                    else if (savedDiffInDays < 365) savedAtFormatted = `${Math.floor(savedDiffInDays / 30)} months ago`;
                    else savedAtFormatted = `${Math.floor(savedDiffInDays / 365)} years ago`;
                    
                    return {
                        id: item.id,
                        title: item.snippet.title,
                        thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
                        author: item.snippet.channelTitle,
                        views,
                        timestamp,
                        duration,
                        dateSaved: savedAtFormatted
                    };
                });
                
                console.log("Processed videos:", processedVideos);
                setSavedVideos(processedVideos);
            } else {
                setSavedVideos([]);
            }
        } catch (error) {
            console.error("Error fetching video details from YouTube API:", error);
            setSavedVideos([]);
        } finally {
            setIsLoading(false);
        }
    };

    // Handle click outside search box
    const handleClickOutside = (event: MouseEvent) => {
        if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
            setShowSearch(false);
        }
    };

    // Load saved videos on component mount
    React.useEffect(() => {
        getSavedVideos();

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Handle search form submission
    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setShowSearch(false);
    };

    // Remove a video from saved videos
    const removeVideo = async (id: string) => {
        try {
            const session = await getSession();
            if (!session) return;

            const selectedSessionId = localStorage.getItem('nexview-selected-session');
            if (!selectedSessionId) return;

            // Remove from UI first for better UX
            setSavedVideos(prevVideos => prevVideos.filter(video => video.id !== id));
            
            // Then remove from database
            await axios.post("/api/remove-saved-video", {
                email: session.user?.email,
                sessionId: selectedSessionId,
                videoId: id
            });
            
            console.log(`Video ${id} removed from saved videos`);
        } catch (error) {
            console.error("Error removing saved video:", error);
            // Reload videos if there was an error
            getSavedVideos();
        }
    };
    
    // Filter videos based on search query
    const filteredVideos = React.useMemo(() => {
        return savedVideos.filter((video: SavedVideo) =>
            (video?.title?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
            (video?.author?.toLowerCase() || '').includes(searchQuery.toLowerCase())
        );
    }, [savedVideos, searchQuery]);

    return (
        <main className="flex min-h-screen flex-col bg-background pb-20">
            {/* Header */}
            <div className="fixed top-0 left-0 right-0 w-full h-16 border-b bg-background flex items-center justify-between px-4 z-50">
                <div className="flex items-center">
                    <Link href="/" className="flex items-center mr-6">
                        <Image src="/nexlogo.png" alt="Nexview" width={40} height={24} />
                    </Link>
                    <h1 className="text-xl font-medium">Saved Videos</h1>
                </div>

                <div className="flex items-center space-x-4">
                    <Button variant="ghost" size="icon">
                        <Bell className="h-5 w-5" />
                    </Button>
                    <ModeToggle />
                    <Avatar>
                        <AvatarImage src="https://github.com/shadcn.png" />
                        <AvatarFallback>CN</AvatarFallback>
                    </Avatar>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 pt-16 px-6">
                {/* Loading state */}
                {isLoading && (
                    <div className="flex justify-center items-center h-40">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    </div>
                )}
                
                {/* Empty state - only show when not loading and no videos */}
                {!isLoading && filteredVideos.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-[70vh] text-center">
                        <Bookmark className="h-16 w-16 text-muted-foreground mb-4" />
                        <h2 className="text-xl font-medium mb-2">No saved videos yet</h2>
                        <p className="text-muted-foreground mb-6">Videos you save will appear here</p>
                        <Link href="/">
                            <Button>Browse Videos</Button>
                        </Link>
                    </div>
                )}

                {/* Videos Grid - only show when not loading and has videos */}
                {!isLoading && filteredVideos.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 mb-4 mt-4">
                        {filteredVideos.map((video) => (
                            <div key={video.id} className="relative group">
                                <Link href={`/video/${video.id}`}>
                                    <Card className="cursor-pointer border-none shadow-none hover:shadow-md transition-shadow duration-300">
                                        <CardContent className="p-0">
                                            <div className="aspect-video relative rounded-lg overflow-hidden mb-2">
                                                <Image
                                                    src={video.thumbnail}
                                                    alt={video.title}
                                                    fill
                                                    className="object-cover transition-transform hover:scale-105"
                                                />
                                                {video.duration && (
                                                    <div className="absolute bottom-2 right-2 bg-black bg-opacity-80 text-white text-xs px-1 py-0.5 rounded">
                                                        {video.duration}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="mt-2 flex">
                                                <Avatar className="h-9 w-9 mr-3 mt-0.5">
                                                    <AvatarImage src={`https://picsum.photos/seed/${video.author}/30/30`} />
                                                    <AvatarFallback>{video.author[0]}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <h3 className="font-medium text-sm line-clamp-2">{video.title}</h3>
                                                    <p className="text-sm text-muted-foreground mt-1">{video.author}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {video.views} • Saved {video.dateSaved}
                                                    </p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>
                                <Button
                                    variant="secondary"
                                    size="icon"
                                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => removeVideo(video.id)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Floating Island Navigation */}
                <FloatingNav
                    activeRoute="saved"
                    showSearch={showSearch}
                    searchQuery={searchQuery}
                    onSearchQueryChange={(query) => setSearchQuery(query)}
                    onSearchSubmit={handleSearch}
                    setShowSearch={setShowSearch}
                />
            </div>
        </main>
    );
}
