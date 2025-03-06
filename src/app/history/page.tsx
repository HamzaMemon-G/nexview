'use client'
import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import Image from "next/image";
import { ModeToggle } from "@/components/modetoggle";
import { Search, Home as HomeIcon, Clock, ThumbsUp, PlaySquare, Bell, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  progress?: number;
  viewedAt?: string;
  duration?: string;
}

export default function HistoryPage() {
  const [watchHistory, setWatchHistory] = React.useState<any[]>([]);
  const [showSearch, setShowSearch] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const searchRef = React.useRef<HTMLDivElement>(null);
  const [sessions, setSessions] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  
  // Group videos by date 
  const groupByDate = (videos: any[]) => {
    const grouped: { [key: string]: any[] } = {};
    
    videos.forEach(video => {
      const viewedDate = video.viewedAt ? new Date(video.viewedAt) : new Date();
      const dateKey = viewedDate.toDateString();
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(video);
    });
    
    return grouped;
  };

  // Format date for display
  const formatDate = (dateKey: string) => {
    const today = new Date().toDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayString = yesterday.toDateString();
    
    if (dateKey === today) return "Today";
    if (dateKey === yesterdayString) return "Yesterday";
    return dateKey;
  };

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

      console.log("Fetching details for videos:", videoIds);
      
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
      console.log("YouTube API response:", data);
      
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
          uniqueId: `${item.id}_history_${index}`,
          title: snippet.title || "Untitled Video",
          thumbnail: thumbnailUrl,
          author: snippet.channelTitle || "Unknown Channel",
          views: `${parseInt(statistics.viewCount || 0).toLocaleString()} views`,
          timestamp: timestamp,
          duration,
          viewedAt: new Date().toISOString(), // Default to now, will be overridden if we have real data
          progress: 0 // Default progress
        };
      });
    } catch (error) {
      console.error("Error fetching video details:", error);
      throw error;
    }
  };

  // Moved fetchWatchHistory outside the useEffect so it can be reused
  const fetchWatchHistory = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Get the current session ID
      const selectedSessionId = localStorage.getItem('nexview-selected-session');
      if (!selectedSessionId) {
        console.log("No selected session found");
        setWatchHistory([]);
        setIsLoading(false);
        return;
      }
      
      console.log("Selected session ID:", selectedSessionId);
      
      // Get user session from API
      const session = await getSession();
      if (!session?.user?.email) {
        console.error("User not authenticated");
        throw new Error("User not authenticated");
      }
      
      console.log("Fetching user data for:", session.user.email);
      const getUser = await axios.get('/api/get-user', {
        params: {
          email: session.user.email
        }
      });
      
      console.log("API response:", getUser.data);
      
      if (getUser.status !== 200 || !getUser.data?.user?.sessions) {
        console.error("Failed to fetch user data or no sessions found");
        throw new Error("Failed to fetch user data");
      }
      
      // Find the selected session
      const selectedSession = getUser.data.user.sessions.find(
        (s: any) => s.id === selectedSessionId
      );
      
      console.log("Selected session data:", selectedSession);
      
      if (!selectedSession) {
        console.log("Selected session not found in user data");
        setWatchHistory([]);
        setIsLoading(false);
        return;
      }
      
      // Get the history video IDs from the session
      const historyItems = selectedSession.history || [];
      console.log("History items:", historyItems);
      
      if (!historyItems.length) {
        console.log("No history found in session");
        setWatchHistory([]);
        setIsLoading(false);
        return;
      }
      
      // Extract video IDs from history items
      const videoIds = historyItems.map((item: any) => {
        if (typeof item === 'string') return item;
        if (item && item.videoId) return item.videoId;
        return null;
      }).filter(Boolean);
      
      console.log("Extracted video IDs:", videoIds);
      
      if (!videoIds.length) {
        console.log("No valid video IDs found in history");
        setWatchHistory([]);
        setIsLoading(false);
        return;
      }
      
      // Fetch video details for each ID
      const videoDetails = await fetchVideoDetails(videoIds);
      console.log("Fetched video details:", videoDetails);
      
      // Merge progress information if available
      const videosWithProgress = videoDetails.map((video: { viewedAt: any; }, index: string | number) => {
        const historyItem = historyItems[index];
        if (typeof historyItem === 'object' && historyItem !== null) {
          return {
            ...video,
            progress: historyItem.progress || 0,
            viewedAt: historyItem.viewedAt || video.viewedAt
          };
        }
        return video;
      });
      
      setWatchHistory(videosWithProgress);
    } catch (error: any) {
      console.error("Error in fetchWatchHistory:", error);
      setError(error.message || "Failed to load watch history");
      setWatchHistory([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Load watch history from backend with improved logging
  React.useEffect(() => {
    fetchWatchHistory();
  }, []);

  // Handle search functionality
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      const filteredVideos = watchHistory.filter(video => 
        video.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setWatchHistory(filteredVideos);
    } else {
      // Instead of relying on localStorage, refetch the data
      fetchWatchHistory();
    }
    setShowSearch(false);
  };

  // Clear watch history with improved handling
 
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

  // Group videos by date
  const groupedHistory = groupByDate(watchHistory);

  // Format session duration for display
  const formatDuration = (endDateStr: string) => {
    const endDate = new Date(endDateStr);
    const today = new Date();
    const daysRemaining = Math.floor((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysRemaining <= 0) return "Ended";
    if (daysRemaining === 1) return "1 day";
    if (daysRemaining < 7) return `${daysRemaining} days`;
    if (daysRemaining < 30) return `${Math.floor(daysRemaining / 7)} weeks`;
    if (daysRemaining < 365) return `${Math.floor(daysRemaining / 30)} months`;
    return `${Math.floor(daysRemaining / 365)} years`;
  };

  // For development purposes - create sample history if none exists
  const createSampleHistory = () => {
    const now = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const sampleHistory = [
      {
        id: "sample1",
        uniqueId: "sample1_history_0",
        title: "Learn TypeScript in 1 Hour",
        thumbnail: "https://picsum.photos/seed/typescript/300/200",
        author: "TypeScript Wizard",
        views: "78K views",
        timestamp: "5 days ago",
        progress: 75,
        viewedAt: now.toISOString(),
        duration: "1:02:34"
      },
      {
        id: "sample2",
        uniqueId: "sample2_history_0",
        title: "Building UI Components with React",
        thumbnail: "https://picsum.photos/seed/components/300/200",
        author: "React Master",
        views: "32K views",
        timestamp: "2 weeks ago",
        progress: 100,
        viewedAt: yesterday.toISOString(),
        duration: "26:48"
      }
    ];
    
    setWatchHistory(sampleHistory);
    localStorage.setItem('history', JSON.stringify(sampleHistory));
    localStorage.setItem('nexview-watch-history', JSON.stringify(sampleHistory));
  };

  return (
    <main className="flex min-h-screen flex-col bg-background pb-20">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 w-full h-16 border-b bg-background flex items-center justify-between px-4 z-50">
        <div className="flex items-center">
          <Link href="/" className="flex items-center mr-6">
            <Image src="/nexlogo.png" alt="Nexview" width={40} height={24} />
          </Link>
          <h1 className="text-xl font-bold">Watch History</h1>
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
            <Clock className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-medium mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchWatchHistory}>Try Again</Button>
          </div>
        ) : watchHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-80">
            <Clock className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-medium mb-2">No watch history</h2>
            <p className="text-muted-foreground">Videos you watch will appear here</p>
            <div className="flex gap-4">
              <Link href="/">
                <Button className="mt-6">Browse Videos</Button>
              </Link>
              <Button variant="outline" className="mt-6" onClick={createSampleHistory}>
                Create Sample History
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-8 mb-4 mt-4">
            {Object.keys(groupedHistory).map((dateKey) => (
              <div key={dateKey}>
                <h2 className="text-lg font-semibold mb-4">{formatDate(dateKey)}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                  {groupedHistory[dateKey].map((video) => (
                    <Link
                      href={`/video/${video.id}`}
                      key={video.uniqueId} 
                    >
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
                            {video.progress && (
                              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-600">
                                <div 
                                  className="h-full bg-red-600" 
                                  style={{ width: `${video.progress}%` }}
                                ></div>
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
                                {video.views} • {video.timestamp}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Island Navigation */}
      <FloatingNav
        activeRoute="history"
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
