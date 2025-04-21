'use client'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import Image from "next/image";
import { ModeToggle } from "@/components/modetoggle";
import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Home as HomeIcon, Clock, ThumbsUp, PlaySquare, Menu, Bell, PlusCircle, Calendar, Trash2, Bookmark, LogOut } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format, addDays, differenceInDays } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { getSession, signOut } from "next-auth/react";
import axios from "axios"

export default function Home() {
  interface Video {
    id: string;
    uniqueId: string;
    title: string;
    thumbnail: string;
    author: string;
    views: string;
    timestamp: string;
    likes: number;
    duration?: string;
    isShort: boolean;
  }

  interface Session {
    id: string;
    name?: string;        // Add optional since API returns 'title' instead
    title?: string;       // Add to match API response
    dailyTime?: string;   // Add optional since API returns 'time' instead
    time?: string;        // Add to match API response
    endDate?: string;     // Add optional since API returns 'duration' instead
    duration?: string;    // Add to match API response
    createdAt: string;
    lastStarted?: string; 
    _id?: string;         // Add MongoDB ID
    likedVideos?: any[];  // Add from API response
    dislikedVideos?: any[];  // Add from API response
    savedVideos?: any[];  // Add from API response
    history?: any[];      // Add from API response
  }

  const [videos, setVideos] = React.useState<Video[]>([]);
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [showSearch, setShowSearch] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const searchRef = React.useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(true);
  const [isPaginationLoading, setIsPaginationLoading] = React.useState(false);
  const observerRef = React.useRef<IntersectionObserver | null>(null);
  const loadMoreTriggerRef = React.useRef<HTMLDivElement | null>(null);
  const [loggedInUser, setLoggedInUser] = React.useState<{ name?: string | null; email?: string | null; image?: string | null } | null>(null);
  // Session management states
  const [sessions, setSessions] = React.useState<Session[]>([]);
  const [sessionDialogOpen, setSessionDialogOpen] = React.useState(false);
  const [newSessionName, setNewSessionName] = React.useState("");
  const [newSessionDailyTime, setNewSessionDailyTime] = React.useState("1 hr"); // New state for daily time
  const [newSessionEndDate, setNewSessionEndDate] = React.useState<Date>(addDays(new Date(), 7));
  const [selectedSessionId, setSelectedSessionId] = React.useState<string | null>(null);
  const [sessionSelectionOpen, setSessionSelectionOpen] = React.useState(false);

  // Add state to track session progress
  const [sessionTimeElapsed, setSessionTimeElapsed] = React.useState(0); // in minutes
  const [totalSessionTime, setTotalSessionTime] = React.useState(60); // default to 60 minutes

  // Add state for user management
  const [user, setUser] = React.useState<string>('');

  // Load sessions from localStorage with a flag to track initial load
  const initialLoadRef = React.useRef(true);

  const fetchYoutubeVideos = React.useCallback(async (query: string | undefined, currentPage = 1, isLoadingMore = false) => {
    // Check if query is undefined or empty
    if (!query || !query.trim()) {
      setIsLoading(false);
      setVideos([]);
      return;
    }

    // Now we know query has a value and we can safely use trim()
    if (currentPage === 1) {
      setIsLoading(true);
      setHasMore(true);
    } else {
      setIsPaginationLoading(true);
    }

    try {
      const API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
      
      const maxResults = 12;
      const pageToken = currentPage > 1 ? `&pageToken=${localStorage.getItem(`pageToken_${query}_${currentPage - 1}`)}` : '';

      const response = await fetch(`https://youtube.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${maxResults}&q=${query}${pageToken}&key=${API_KEY}`);
      const data = await response.json();
      console.log(data);

      if (data.nextPageToken) {
        localStorage.setItem(`pageToken_${query}_${currentPage}`, data.nextPageToken);
        setHasMore(true);
      } else {
        setHasMore(false);
      }

      if (data.items && data.items.length > 0) {
        const videoIds = data.items.map((item: any) => item.id.videoId).join(',');
        const statsResponse = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails&id=${videoIds}&key=${API_KEY}`);
        const statsData = await statsResponse.json();

        const processedVideos = data.items.map((item: any, index: number) => {
          const stats = statsData.items[index]?.statistics || {};
          const contentDetails = statsData.items[index]?.contentDetails || {};

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

          // Check if the video is a Short
          const isShort = isYouTubeShort(contentDetails);

          return {
            id: item.id.videoId,
            uniqueId: `${item.id.videoId}_${currentPage}_${index}`, // Add a unique identifier
            title: item.snippet.title,
            thumbnail: item.snippet.thumbnails.high.url,
            author: item.snippet.channelTitle,
            views: `${parseInt(stats.viewCount || 0).toLocaleString()} views`,
            timestamp,
            likes: parseInt(stats.likeCount || 0),
            duration,
            isShort
          };
        });

        // Filter out YouTube Shorts
        const filteredVideos = processedVideos.filter((video: Video) => !video.isShort);

        if (isLoadingMore) {
          setVideos(prevVideos => [...prevVideos, ...filteredVideos]);
        } else {
          setVideos(filteredVideos);
        }
      } else {
        if (currentPage === 1) {
          setVideos([]);
        }
        setHasMore(false);
      }
    } catch (error) {
      console.error("Error fetching YouTube videos:", error);
      if (currentPage === 1) {
        setVideos(getMockVideos());
      }
      setHasMore(false);
    } finally {
      if (currentPage === 1) {
        setIsLoading(false);
      } else {
        setIsPaginationLoading(false);
      }
    }
  }, []);

  const loadMoreVideos = React.useCallback(() => {
    if (!isLoading && !isPaginationLoading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchYoutubeVideos(searchQuery, nextPage, true);
    }
  }, [fetchYoutubeVideos, hasMore, isLoading, isPaginationLoading, page, searchQuery]);

  React.useEffect(() => {
    // Setup intersection observer for infinite scrolling
    const options = {
      root: null,
      rootMargin: '0px',
      threshold: 0.1
    };

    observerRef.current = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (entry.isIntersecting && !isLoading && !isPaginationLoading && hasMore) {
        loadMoreVideos();
      }
    }, options);

    const observer = observerRef.current;
    const currentTrigger = loadMoreTriggerRef.current;

    if (currentTrigger) {
      observer.observe(currentTrigger);
    }

    return () => {
      if (currentTrigger) {
        observer.unobserve(currentTrigger);
      }
    };
  }, [hasMore, isLoading, isPaginationLoading, loadMoreVideos]);

  React.useEffect(() => {
    const loggedInUser = async () => {
      const session = await getSession();
      if (session?.user?.email) {
        try {
          const existingUser = await axios.get('/api/get-user', {
            params: {
              email: session.user.email,
            },
          });
  
          if (existingUser.status === 200) {
            setLoggedInUser(session?.user);
            const savedSessions = existingUser.data.user.sessions;
  
            if (savedSessions && Array.isArray(savedSessions)) {
              // Map API fields to our expected field names for consistency
              const normalizedSessions = savedSessions.map((s: Session) => ({
                ...s,
                id: s._id || s.id,    // Use MongoDB _id if available
                name: s.title || s.name,
                dailyTime: s.time || s.dailyTime,
                endDate: s.duration || s.endDate
              }));
              
              setSessions(normalizedSessions);
              
              const lastSelectedSession = localStorage.getItem('nexview-selected-session');
              if (lastSelectedSession) {
                // Check if we have this session in our normalized sessions
                const sessionExists = normalizedSessions.some((s: Session) => 
                  s.id === lastSelectedSession || s._id === lastSelectedSession
                );
                
                if (sessionExists) {
                  setSelectedSessionId(lastSelectedSession);
                  
                  const foundSession = normalizedSessions.find((s: Session) => 
                    s.id === lastSelectedSession || s._id === lastSelectedSession
                  );
                  
                  if (foundSession?.name) {
                    setSearchQuery(foundSession.name);
                  }
                } else {
                  localStorage.removeItem('nexview-selected-session');
                }
              }
            }
  
            initialLoadRef.current = false;
          } else {
            console.error('Failed to fetch user data:', existingUser.data);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      }
    };
    loggedInUser();
  }, []);


  // Add a separate effect to handle initial session selection dialogs
  React.useEffect(() => {
    if (initialLoadRef.current === false && sessions.length > 0 && !selectedSessionId) {
      // If we have sessions but none selected, show selection dialog
      setSessionSelectionOpen(true);
    } else if (initialLoadRef.current === false && sessions.length === 0) {
      // If we have no sessions, show creation dialog
      setSessionDialogOpen(true);
    }
  }, [sessions.length, selectedSessionId, initialLoadRef.current]);

  // Modify handleSessionSelect to be more robust
  const handleSessionSelect = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId || s._id === sessionId);
    
    // Store MongoDB _id if available, otherwise use the provided sessionId
    const idToStore = session?._id || sessionId;
    
    setSelectedSessionId(idToStore);
    localStorage.setItem('nexview-selected-session', idToStore);
    
    if (session?.name || session?.title) {
      setSearchQuery(session.name || session.title || "");
      setSessionSelectionOpen(false);
      setPage(1);
    } else {
      setSearchQuery("");
    }
  };

  // Fix createNewSession to handle DB ID correctly
  const createNewSession = async () => {
    if (newSessionName.trim() === "" || newSessionDailyTime.trim() === "") return;

    const localSessionId = `temp-${Date.now()}`;
    const newSession: Session = {
      id: localSessionId,
      name: newSessionName,
      title: newSessionName,       // Add title for API compatibility
      dailyTime: newSessionDailyTime,
      time: newSessionDailyTime,   // Add time for API compatibility
      endDate: newSessionEndDate.toISOString(),
      duration: newSessionEndDate.toISOString(), // Add duration for API compatibility
      createdAt: new Date().toISOString()
    };

    // Optimistically update UI
    setSessions(prev => [...prev, newSession]);
    setSelectedSessionId(localSessionId);
    setSearchQuery(newSessionName);
    setSessionDialogOpen(false);

    // Reset form fields
    setNewSessionName("");
    setNewSessionDailyTime("1 hr");
    setNewSessionEndDate(addDays(new Date(), 7));

    if (user) {
      try {
        const response = await axios.post('/api/create-session', {
          user: user,
          session: newSession
        });

        if (response.status === 200) {
          const data = response.data;
          // Handle the different response format
          if (data.message === "Session created successfully" && Array.isArray(data.data)) {
            const createdSessions = data.data;
            // Find our newly created session in the response
            const createdSession = createdSessions.find((s: Session) => s.id === localSessionId);
            
            if (createdSession && createdSession._id) {
              // Update sessions with the MongoDB ID
              setSessions(prev => prev.map(s => 
                s.id === localSessionId ? {
                  ...s,
                  _id: createdSession._id,
                  // Map API fields to our expected fields for consistency
                  name: createdSession.title || s.name,
                  dailyTime: createdSession.time || s.dailyTime,
                  endDate: createdSession.duration || s.endDate
                } : s
              ));
              
              // Store the MongoDB ID in localStorage
              localStorage.setItem('nexview-selected-session', createdSession._id);
              setSelectedSessionId(createdSession._id);
            }
          }
        } else {
          console.error('Failed to create session in MongoDB:', response.data);
          // Remove optimistically added session on failure
          setSessions(prev => prev.filter(s => s.id !== localSessionId));
          setSelectedSessionId(null);
        }
      } catch (error) {
        console.error('Error creating session in MongoDB:', error);
        // Remove optimistically added session on error
        setSessions(prev => prev.filter(s => s.id !== localSessionId));
        setSelectedSessionId(null);
      }
    }
  };

  // Ensure deleteSession properly updates everything
  const deleteSession = async (sessionId: string) => {
    // Find the session to be deleted
    const sessionToDelete = sessions.find(s => 
      s.id === sessionId || 
      s._id === sessionId || 
      String(s._id) === sessionId
    );
    
    if (!sessionToDelete) return;
    
    // Get the MongoDB ID for the API call
    const mongoDbId = sessionToDelete._id || sessionId;
    
    // Remove from local state - fix the filtering logic
    setSessions(prev => prev.filter(session => 
      session.id !== sessionId && 
      session._id !== sessionId && 
      String(session._id) !== sessionId
    ));
    
    // Update check for selected session
    const isSelected = 
      selectedSessionId === sessionId || 
      String(selectedSessionId) === String(sessionId);
    
    // If this was the selected session, clear local storage and state
    if (isSelected) {
      localStorage.removeItem('nexview-selected-session');
      setSelectedSessionId(null);
      setSearchQuery("");
    }
    
    // Delete from database
    try {
      console.log('Deleting session with ID:', mongoDbId);
      const response = await axios.post('/api/delete-session', {
        email: user,
        sessionId: String(mongoDbId) // Ensure sessionId is a string
      });
      console.log('Delete response:', response.data);
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  };

  React.useEffect(() => {
    const fetchSession = async () => {
      const session = await getSession();
      const userEmail = session?.user?.email;
      if (userEmail) {
        setUser(userEmail);
      }
    };
    fetchSession();
  }, []);

  const formatTimeFrame = (startTime: string, endTime: string) => {
    return `${startTime} - ${endTime} daily`;
  };

  const formatDuration = (endDateStr: string | undefined) => {
      if (!endDateStr) return "Unknown";
      
      const endDate = new Date(endDateStr);
      const today = new Date();
      const daysRemaining = differenceInDays(endDate, today);
  
      if (daysRemaining <= 0) return "Ended";
      if (daysRemaining === 1) return "1 day";
      if (daysRemaining < 7) return `${daysRemaining} days`;
      if (daysRemaining < 30) return `${Math.floor(daysRemaining / 7)} weeks`;
      if (daysRemaining < 365) return `${Math.floor(daysRemaining / 30)} months`;
      return `${Math.floor(daysRemaining / 365)} years`;
    };

  // Add null checks to parseTimeToMinutes function
  const parseTimeToMinutes = (timeStr: string | undefined): number => {
    // Check if timeStr is undefined or null
    if (!timeStr) return 60; // Default to 60 minutes
    
    const hourMatch = timeStr.match(/(\d+(\.\d+)?)\s*hr/);
    if (hourMatch) {
      return parseFloat(hourMatch[1]) * 60;
    }

    const minMatch = timeStr.match(/(\d+)\s*min/);
    if (minMatch) {
      return parseInt(minMatch[1]);
    }

    const numMatch = timeStr.match(/(\d+(\.\d+)?)/);
    if (numMatch) {
      return parseFloat(numMatch[1]) * 60;
    }

    return 60;
  };

  // Add safety checks in useEffect for session time tracking
  React.useEffect(() => {
    if (selectedSessionId) {
      const currentSession = sessions.find(s => s.id === selectedSessionId || s._id === selectedSessionId);
      if (currentSession) {
        const sessionMinutes = parseTimeToMinutes(currentSession.dailyTime);
        setTotalSessionTime(sessionMinutes);

        if (!currentSession.lastStarted || isNewDay(currentSession.lastStarted)) {
          const updatedSessions = sessions.map(s =>
            s.id === selectedSessionId
              ? { ...s, lastStarted: new Date().toISOString() }
              : s
          );
          setSessions(updatedSessions);
          setSessionTimeElapsed(0);
        } else {
          const startTime = new Date(currentSession.lastStarted);
          const now = new Date();
          const elapsedMinutes = (now.getTime() - startTime.getTime()) / (1000 * 60);
          setSessionTimeElapsed(Math.min(elapsedMinutes, sessionMinutes));
        }
      }
    }
  }, [selectedSessionId, sessions]);

  React.useEffect(() => {
    if (!selectedSessionId) return;

    const timer = setInterval(() => {
      const currentSession = sessions.find(s => s.id === selectedSessionId || s._id === selectedSessionId);
      if (currentSession?.lastStarted) {
        const startTime = new Date(currentSession.lastStarted);
        const now = new Date();
        const elapsedMinutes = (now.getTime() - startTime.getTime()) / (1000 * 60);
        setSessionTimeElapsed(Math.min(elapsedMinutes, totalSessionTime));
      }
    }, 30000);

    return () => clearInterval(timer);
  }, [selectedSessionId, sessions, totalSessionTime]);

  const isNewDay = (timestamp: string): boolean => {
    const date = new Date(timestamp);
    const today = new Date();
    return date.getDate() !== today.getDate() ||
      date.getMonth() !== today.getMonth() ||
      date.getFullYear() !== today.getFullYear();
  };

  const formatElapsedTime = (minutes: number): string => {
    if (minutes < 60) {
      return `${Math.floor(minutes)} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.floor(minutes % 60);
    return remainingMinutes > 0 ? `${hours} hr ${remainingMinutes} min` : `${hours} hr`;
  };

  const formatRemainingTime = (totalMinutes: number, elapsedMinutes: number): string => {
    const remaining = Math.max(0, totalMinutes - elapsedMinutes);
    return formatElapsedTime(remaining);
  };

  const convertDurationToSeconds = (duration: string): number => {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    const hours = parseInt(match?.[1] || '0');
    const minutes = parseInt(match?.[2] || '0');
    const seconds = parseInt(match?.[3] || '0');
    return hours * 3600 + minutes * 60 + seconds;
  };

  const isYouTubeShort = (contentDetails: any): boolean => {
    if (!contentDetails || !contentDetails.duration) return false;

    const durationInSeconds = convertDurationToSeconds(contentDetails.duration);
    return durationInSeconds <= 60;
  };

  const getMockVideos = () => {
    return [
      {
        id: "1",
        uniqueId: "1_mock_0", // Add uniqueId to mock data
        title: "Building a Next.js Application From Scratch",
        thumbnail: "https://picsum.photos/seed/next/300/200",
        author: "Sarah Johnson",
        views: "125K views",
        timestamp: "3 days ago",
        likes: 12453,
        duration: "14:23",
        isShort: false
      },
      // ... other mock videos
    ].filter(video => !video.isShort);
  };

  // Explicitly handle search submission
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    if (searchQuery.trim()) {
      const currentSessionName = getCurrentSessionName();
      let finalQuery = searchQuery;

      // If we have a selected session, always prefix the search with the session name
      // to keep searches within the session context
      if (selectedSessionId && currentSessionName) {
        // Check if the search query already includes the session name to avoid duplication
        if (!searchQuery.toLowerCase().includes(currentSessionName.toLowerCase())) {
          finalQuery = `${currentSessionName} ${searchQuery}`;
        }
      }

      fetchYoutubeVideos(finalQuery);
      setSearchQuery(finalQuery);
    } else if (!selectedSessionId) {
      // Only show session dialogs if no session is currently selected
      if (sessions.length > 0) {
        setSessionSelectionOpen(true);
      } else {
        setSessionDialogOpen(true);
      }
    }
    setShowSearch(false);
  };

  React.useEffect(() => {
    if (searchQuery.trim()) {
      setPage(1);

      // Apply the same session context logic here for consistency
      const currentSessionName = getCurrentSessionName();
      let finalQuery = searchQuery;

      if (selectedSessionId && currentSessionName &&
        !searchQuery.toLowerCase().includes(currentSessionName.toLowerCase())) {
        finalQuery = `${currentSessionName} ${searchQuery}`;
        // Don't update searchQuery here to avoid infinite loop
      }

      fetchYoutubeVideos(finalQuery);

      // Clear localStorage tokens when changing search query
      const localStorageKeys = Object.keys(localStorage);
      const tokenKeysToRemove = localStorageKeys.filter(key => key.startsWith('pageToken_'));
      tokenKeysToRemove.forEach(key => localStorage.removeItem(key));
    }

    // Handle clicks outside the search bar to hide it
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearch(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [fetchYoutubeVideos, searchQuery]);

  // Helper function to get the current session name
  const getCurrentSessionName = (): string => {
    if (!selectedSessionId) return "";
    const currentSession = sessions.find(s => s.id === selectedSessionId || s._id === selectedSessionId);
    return currentSession?.name || currentSession?.title || "";
  };

  // Modify the onClick handler for the search button
  const handleSearchButtonClick = () => {
    setShowSearch(true);
    // Clear the search input when opening the search box
    setSearchQuery("");
  };

  const getCurrentSession = () => {
    return sessions.find(s => s.id === selectedSessionId || s._id === selectedSessionId);
  };

  // Add a function to clear search and return to session content
  const handleClearSearch = () => {
    // Get the current session name if a session is selected
    const currentSessionName = getCurrentSessionName();

    // If we have a selected session, revert to showing session content
    if (selectedSessionId && currentSessionName) {
      setSearchQuery(currentSessionName);
      fetchYoutubeVideos(currentSessionName);
    } else {
      // If no session is selected, just clear the search
      setSearchQuery("");
      setVideos([]);
    }

    // Close the search UI
    setShowSearch(false);
  };

  return (
    <main className="flex min-h-screen flex-col bg-background pb-20">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 w-full h-16 border-b bg-background flex items-center justify-between px-4 z-50">
        <div className="flex items-center">
          <Link href="/" className="flex items-center mr-6">
            <Image className="dark:brightness-100" src="/nexlogo.png" alt="Nexview" width={40} height={24} />
          </Link>
        </div>

        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon">
            <Bell className="h-5 w-5" />
          </Button>
          <ModeToggle />
          <Avatar onClick={() => {window.location.replace('/profile')}} className="cursor-pointer">
            <AvatarImage src={loggedInUser?.image || "https://github.com/shadcn.png"} />
            <AvatarFallback>{loggedInUser?.name}</AvatarFallback>
          </Avatar>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 pt-16 px-6">

        {/* Redesigned Session Info Box with Progress Bar */}
        {selectedSessionId && (
          <div className="mb-6 mt-4 p-4 bg-muted rounded-lg">
            <div>
              <h3 className="text-lg font-medium">{getCurrentSession()?.name}</h3>
              <div className="mt-2 mb-3">
                <Progress
                  value={sessionTimeElapsed / totalSessionTime * 100}
                  className="h-2"
                />
              </div>
              <div className="flex justify-between items-center text-sm text-muted-foreground">
                <div>
                  {formatElapsedTime(sessionTimeElapsed)} elapsed
                </div>
                <div className="flex items-center">
                  <Clock className="h-4 w-4 mr-1" />
                  {formatRemainingTime(totalSessionTime, sessionTimeElapsed)} remaining
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Goal: {getCurrentSession()?.dailyTime} daily • Ends in {getCurrentSession() && formatDuration(getCurrentSession()?.endDate || "")}
              </p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        )}

        {/* Videos Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 mb-4 mt-4">
          {videos.map((video) => (
            <Link
              href={`/video/${video.id}`}
              key={video.uniqueId} // Use uniqueId instead of id for the key prop
            >
              <Card className="cursor-pointer p-2 bg-transparent border-none shadow-none hover:shadow-md transition-shadow duration-300">
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
                    {video.isShort && (
                      <div className="absolute top-2 right-2 bg-red-500 bg-opacity-90 text-white text-xs px-1 py-0.5 rounded">
                        Short
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

        {/* Intersection Observer Trigger Element */}
        <div
          ref={loadMoreTriggerRef}
          className="h-20 flex items-center justify-center w-full my-4"
        >
          {isPaginationLoading && (
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          )}
          {!isPaginationLoading && !hasMore && videos.length > 0 && (
            <p className="text-muted-foreground text-sm">No more videos to load</p>
          )}
        </div>

        {/* Session Creation Dialog */}
        <Dialog open={sessionDialogOpen} onOpenChange={setSessionDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create a new session</DialogTitle>
              <DialogDescription>
                Set up a new viewing session with your preferences.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="session-name" className="text-right">
                  Topic
                </Label>
                <Input
                  id="session-name"
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  placeholder="Chess, cooking, etc."
                  className="col-span-3"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="daily-time" className="text-right">
                  Daily Time
                </Label>
                <div className="col-span-3">
                  <Input
                    id="daily-time"
                    value={newSessionDailyTime}
                    onChange={(e) => setNewSessionDailyTime(e.target.value)}
                    placeholder="1 hr, 30 min, 1.5 hr, etc."
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">
                  End Date
                </Label>
                <div className="col-span-3">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {newSessionEndDate ? format(newSessionEndDate, "PPP") : "Pick an end date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={newSessionEndDate}
                        onSelect={(date) => date && setNewSessionEndDate(date)}
                        disabled={(date) => date < addDays(new Date(), 1)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={createNewSession}
                disabled={!newSessionName.trim() || !newSessionDailyTime.trim()}
              >
                Create Session
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Session Selection Dialog - add delete button */}
        <Dialog open={sessionSelectionOpen} onOpenChange={setSessionSelectionOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Select a session</DialogTitle>
              <DialogDescription>
                Choose an existing session or create a new one.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <RadioGroup value={selectedSessionId || ""} onValueChange={handleSessionSelect}>
                {sessions.map((session) => (
                  <div key={session.id} className="flex items-center space-x-2 mb-2 p-2 rounded hover:bg-muted">
                    <RadioGroupItem value={session.id} id={session.id} />
                    <Label htmlFor={session.id} className="flex-1 cursor-pointer">
                      <div className="font-medium">{session.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {session.dailyTime} daily • {formatDuration(session.endDate)}
                      </div>
                    </Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive/80"
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent radio selection when deleting
                        deleteSession(session.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </RadioGroup>
              <Button
                variant="outline"
                className="w-full mt-4 flex items-center justify-center gap-2"
                onClick={() => {
                  setSessionSelectionOpen(false);
                  setSessionDialogOpen(true);
                }}
              >
                <PlusCircle className="h-4 w-4" />
                Create New Session
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Floating Island Navigation - add Sessions menu */}
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
          <div
            ref={searchRef}
            className={`flex items-center gap-1 px-2 py-3 bg-background/90 backdrop-blur-lg rounded-full shadow-lg border transition-all duration-300 ${showSearch ? 'scale-105' : ''}`}
            style={{ minWidth: showSearch ? '280px' : 'auto' }}
          >
            {/* Search form and navigation buttons */}
            {showSearch ? (
              <form onSubmit={handleSearch} className="flex w-full px-2 animate-fadeIn relative">
                <Input
                  placeholder={selectedSessionId ? `Search within ${getCurrentSessionName()}...` : "Search topic"}
                  className="rounded-full border focus:ring-2 focus:ring-primary w-full pr-12"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
                {/* Add clear search button */}
                <div className="absolute right-2 top-0 h-full flex items-center gap-1">
                  {/* Clear button - only show when there's text or we're not showing the base session */}
                  {(searchQuery.trim() !== getCurrentSessionName() && searchQuery.trim() !== "") && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"
                      onClick={handleClearSearch}
                    >
                      <span className="sr-only">Clear search</span>
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </Button>
                  )}
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                  >
                    <span className="sr-only">Search</span>
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            ) : (
              <>
                <Link href="/" className="flex flex-col items-center px-5 py-1">
                  <HomeIcon className="h-5 w-5" />
                  <span className="text-xs mt-1">Home</span>
                </Link>

                {/* Sessions dropdown menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <div className="flex flex-col items-center px-5 py-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all">
                      <PlaySquare className={`h-5 w-5 ${selectedSessionId ? 'text-primary' : ''}`} />
                      <span className="text-xs mt-1">Sessions</span>
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" className="w-56">
                    <DropdownMenuLabel>Manage Sessions</DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    {sessions.length > 0 ? (
                      <>
                        {sessions.map((session) => (
                          <DropdownMenuItem
                            key={session.id}
                            className="flex justify-between items-center cursor-pointer"
                          >
                            <div
                              className="flex-1"
                              onClick={() => {
                                handleSessionSelect(session.id);
                              }}
                            >
                              <div className="font-medium">{session.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {session.dailyTime} daily • {formatDuration(session.endDate)}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive/80"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteSession(session.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                      </>
                    ) : (
                      <div className="px-2 py-1 text-sm text-center text-muted-foreground">
                        No sessions yet
                      </div>
                    )}

                    <DropdownMenuItem
                      className="cursor-pointer justify-center text-primary"
                      onClick={() => setSessionDialogOpen(true)}
                    >
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Create New Session
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Link href="/saved" className="flex flex-col items-center px-5 py-1">
                  <Bookmark className="h-5 w-5" />
                  <span className="text-xs mt-1">Saved</span>
                </Link>

                <div
                  className="flex flex-col items-center px-5 py-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-transform duration-200 hover:scale-110"
                  onClick={() => signOut()}
                >
                  <LogOut className="h-5 w-5" />
                  <span className="text-xs mt-1">Logout</span>
                </div>

                <Link href="/history" className="flex flex-col items-center px-5 py-1">
                  <Clock className="h-5 w-5" />
                  <span className="text-xs mt-1">History</span>
                </Link>
                <Link href="/likes" className="flex flex-col items-center px-5 py-1">
                  <ThumbsUp className="h-5 w-5" />
                  <span className="text-xs mt-1">Liked</span>
                </Link>
                <div
                  className="flex flex-col items-center px-5 py-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-transform duration-200 hover:scale-110"
                  onClick={handleSearchButtonClick}
                >
                  <Search className="h-5 w-5" />
                  <span className="text-xs mt-1">Search</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}