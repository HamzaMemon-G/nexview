'use client'
import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import Image from "next/image";
import { ModeToggle } from "@/components/modetoggle";
import { Search, Home as HomeIcon, Clock, ThumbsUp, PlaySquare, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PlusCircle } from "lucide-react";
import { getSession } from "next-auth/react";
import axios from "axios";
import { FloatingNav } from "@/components/floating-nav";
import Router from "next/router";

interface VideoDetails {
  id: string;
  uniqueId: string;
  title: string;
  thumbnail: string;
  author: string;
  views: string;
  timestamp: string;
  likes?: number;
  duration?: string;
}

export default function LikesPage() {
  const [likedVideos, setLikedVideos] = React.useState<VideoDetails[]>([]);
  const [showSearch, setShowSearch] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const searchRef = React.useRef<HTMLDivElement>(null);
  const [sessions, setSessions] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch video details from YouTube API with better error handling
  const fetchVideoDetails = async (videoIds: string[]) => {
    if (!videoIds || videoIds.length === 0) {
      console.log("No video IDs provided to fetch");
      return [];
    }

    try {
      const API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
      if (!API_KEY) {
        console.error("YouTube API key is missing in environment variables");
        throw new Error("YouTube API key is missing");
      }

      
      // Join video IDs with comma for the API request
      const videoIdsParam = videoIds.join(',');
      
      // Fetch video details from YouTube API
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIdsParam}&key=${API_KEY}`
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("YouTube API error response:", errorText);
        throw new Error(`YouTube API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.items || data.items.length === 0) {
        console.log("No videos found in YouTube API response");
        return [];
      }
      
      // Process the video data into our format
      return data.items.map((item: any, index: number) => {
        const snippet = item.snippet || {};
        const statistics = item.statistics || {};
        const contentDetails = item.contentDetails || {};
        
        // Format the duration if available
        let duration = "";
        if (contentDetails.duration) {
          const match = contentDetails.duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
          if (match) {
            const hours = match[1] ? match[1].replace('H', '') : '0';
            const minutes = match[2] ? match[2].replace('M', '') : '0';
            const seconds = match[3] ? match[3].replace('S', '') : '0';

            duration = hours !== '0'
              ? `${hours}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`
              : `${minutes}:${seconds.padStart(2, '0')}`;
          }
        }

        // Format the published date
        const publishedAt = new Date(snippet.publishedAt || new Date());
        const now = new Date();
        const diffInDays = Math.floor((now.getTime() - publishedAt.getTime()) / (1000 * 60 * 60 * 24));

        let timestamp = "";
        if (diffInDays === 0) timestamp = "Today";
        else if (diffInDays === 1) timestamp = "Yesterday";
        else if (diffInDays < 7) timestamp = `${diffInDays} days ago`;
        else if (diffInDays < 30) timestamp = `${Math.floor(diffInDays / 7)} weeks ago`;
        else if (diffInDays < 365) timestamp = `${Math.floor(diffInDays / 30)} months ago`;
        else timestamp = `${Math.floor(diffInDays / 365)} years ago`;

        const thumbnailUrl = 
          snippet.thumbnails?.maxres?.url ||
          snippet.thumbnails?.high?.url || 
          snippet.thumbnails?.medium?.url ||
          snippet.thumbnails?.default?.url || 
          "https://picsum.photos/seed/placeholder/300/200";

        return {
          id: item.id,
          uniqueId: `${item.id}_liked_${index}`,
          title: snippet.title || "Untitled Video",
          thumbnail: thumbnailUrl,
          author: snippet.channelTitle || "Unknown Channel",
          views: `${parseInt(statistics.viewCount || 0).toLocaleString()} views`,
          timestamp: timestamp,
          likes: parseInt(statistics.likeCount || 0),
          duration
        };
      });
    } catch (error) {
      console.error("Error fetching video details:", error);
      throw error;
    }
  };

  // Load liked videos from the session with improved logging
  React.useEffect(() => {
    const fetchLikedVideos = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Get the current session ID
        const selectedSessionId = localStorage.getItem('nexview-selected-session');
        if (!selectedSessionId) {
          setLikedVideos([]);
          setIsLoading(false);
          return;
        }
        
        
        // Get user session from API
        const session = await getSession();
        if (!session?.user?.email) {
          console.error("User not authenticated");
          throw new Error("User not authenticated");
        }
        
        const getUser = await axios.get('/api/get-user', {
          params: {
            email: session.user.email
          }
        });
        
        
        if (getUser.status !== 200 || !getUser.data?.user?.sessions) {
          console.error("Failed to fetch user data or no sessions found");
          throw new Error("Failed to fetch user data");
        }
        
        // Find the selected session
        const selectedSession = getUser.data.user.sessions.find(
          (s: any) => s.id === selectedSessionId
        );
        
        
        if (!selectedSession) {
          console.log("Selected session not found in user data");
          setLikedVideos([]);
          setIsLoading(false);
          return;
        }
        
        // Get the liked video IDs from the session
        let likedVideoIds: string[] = [];
        
        // Handle both array of strings and array of objects
        if (Array.isArray(selectedSession.likedVideos)) {
          likedVideoIds = selectedSession.likedVideos.map((item: any) => {
            if (typeof item === 'string') return item;
            if (item && item.videoId) return item.videoId;
            return null;
          }).filter(Boolean);
        } else if (typeof selectedSession.likedVideos === 'string') {
          // Handle case where likedVideos is a single string
          likedVideoIds = [selectedSession.likedVideos];
        }
        
        
        if (!likedVideoIds.length) {
          console.log("No liked videos found in session");
          setLikedVideos([]);
          setIsLoading(false);
          return;
        }
        
        // Fetch video details for each ID
        const videoDetails = await fetchVideoDetails(likedVideoIds);
        setLikedVideos(videoDetails);
      } catch (error: any) {
        console.error("Error in fetchLikedVideos:", error);
        setError(error.message || "Failed to load liked videos");
        setLikedVideos([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchLikedVideos();
  }, []);

  // Load sessions from localStorage
  React.useEffect(() => {
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
  }, []);

  // Handle search functionality
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!likedVideos || likedVideos.length === 0) {
      return;
    }

    if (searchQuery.trim()) {
      const filteredVideos = likedVideos.filter(video =>
        video && video.title && video.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setLikedVideos(filteredVideos);
    } else {
      // Reload all liked videos
      fetchLikedVideos();
    }
    setShowSearch(false);
  };

  // Re-fetch liked videos
  const fetchLikedVideos = async () => {
    setIsLoading(true);
    try {
      const selectedSessionId = localStorage.getItem('nexview-selected-session');
      const session = await getSession();
      if (!selectedSessionId || !session?.user?.email) {
        setLikedVideos([]);
        return;
      }
      
      const getUser = await axios.get('/api/get-user', {
        params: { email: session.user.email }
      });
      
      if (getUser.status === 200 && getUser.data?.user?.sessions) {
        const selectedSession = getUser.data.user.sessions.find(
          (s: any) => s.id === selectedSessionId
        );
        
        if (selectedSession?.likedVideos?.length) {
          const videoDetails = await fetchVideoDetails(selectedSession.likedVideos);
          setLikedVideos(videoDetails);
        } else {
          setLikedVideos([]);
        }
      }
    } catch (error) {
      console.error("Error fetching liked videos:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle clicks outside the search bar
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearch(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Format session duration for display
  const formatDuration = (endDateStr: string) => {
    if (!endDateStr) return "Unknown";
    try {
      const endDate = new Date(endDateStr);
      const today = new Date();
      const daysRemaining = Math.floor((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (daysRemaining <= 0) return "Ended";
      if (daysRemaining === 1) return "1 day";
      if (daysRemaining < 7) return `${daysRemaining} days`;
      if (daysRemaining < 30) return `${Math.floor(daysRemaining / 7)} weeks`;
      if (daysRemaining < 365) return `${Math.floor(daysRemaining / 30)} months`;
      return `${Math.floor(daysRemaining / 365)} years`;
    } catch (e) {
      return "Unknown";
    }
  };

  return (
    <main className="flex min-h-screen flex-col bg-background pb-20">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 w-full h-16 border-b bg-background flex items-center justify-between px-4 z-50">
        <div className="flex items-center">
          <Link href="/" className="flex items-center mr-6">
            <Image src="/nexlogo.png" alt="Nexview" width={40} height={24} />
          </Link>
          <h1 className="text-xl font-bold">Liked Videos</h1>
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
        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-80 text-center">
            <ThumbsUp className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-medium mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchLikedVideos}>Try Again</Button>
          </div>
        ) : likedVideos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-80">
            <ThumbsUp className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-medium mb-2">No liked videos yet</h2>
            <p className="text-muted-foreground">Videos you like will appear here</p>
            <div className="flex gap-4">
              <Link href="/">
                <Button className="mt-6">Browse Videos</Button>
              </Link>
              <Button variant="outline" className="mt-6" onClick={() => {
                const fetchDebug = async () => {
                  const session = await getSession();
                  const selectedSessionId = localStorage.getItem('nexview-selected-session');
                  if (session?.user?.email) {
                    const userResult = await axios.get('/api/get-user', {
                      params: { email: session.user.email }
                    });
                  }
                };
                fetchDebug();
              }}>
                Debug Info
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 mb-4 mt-4">
            {likedVideos.map((video) => (
              video && video.id ? (
                <Link
                  href={`/video/${video.id}`}
                  key={video.uniqueId}
                >
                  <Card className="cursor-pointer border-none shadow-none hover:shadow-md transition-shadow duration-300">
                    <CardContent className="p-0">
                      <div className="aspect-video relative rounded-lg overflow-hidden mb-2">
                        <Image
                          src={video.thumbnail || "https://picsum.photos/seed/placeholder/300/200"}
                          alt={video.title || "Video thumbnail"}
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
                          <AvatarImage src={`https://picsum.photos/seed/${video.author || 'user'}/30/30`} />
                          <AvatarFallback>{(video.author && video.author[0]) || 'U'}</AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-medium text-sm line-clamp-2">{video.title || "Untitled video"}</h3>
                          <p className="text-sm text-muted-foreground mt-1">{video.author || "Unknown author"}</p>
                          <p className="text-xs text-muted-foreground">
                            {video.views || "0 views"} • {video.timestamp || "Unknown time"}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ) : null
            ))}
          </div>
        )}
      </div>

      {/* Floating Island Navigation */}
      <FloatingNav
        activeRoute="likes"
        sessions={sessions}
        showSearch={showSearch}
        searchQuery={searchQuery}
        onSearchQueryChange={(query) => setSearchQuery(query)}
        onSearchSubmit={handleSearch}
        setShowSearch={setShowSearch}
        onCreateSessionClick={() => Router.push('/')}
      />
    </main>
  );
}
