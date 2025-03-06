'use client'

import React, { useEffect, useState, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ModeToggle } from "@/components/modetoggle";
import { ArrowLeft, ThumbsUp, ThumbsDown, Share2, BookmarkPlus, BookmarkCheck, Play, Pause, Volume2, VolumeX, Maximize } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { getSession } from 'next-auth/react';
import axios from 'axios';

interface VideoData {
  id: string;
  title: string;
  author: string;
  views: string;
  timestamp: string;
  likes: number;
  description?: string;
}

// YouTube Player interface
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface VideoPageParams {
  id: string;
}

export default function VideoPage({ params }: { params: VideoPageParams }) {
  const router = useRouter();
  const unwrappedParams = use(params) as { id: string };
  const videoId = unwrappedParams.id;
  
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [isDisliked, setIsDisliked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  
  // Add state for user and session
  const [user, setUser] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  // Custom video player states
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isBuffering, setIsBuffering] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [embedMode, setEmbedMode] = useState<'api' | 'iframe'>('api');
  const [playerAttempts, setPlayerAttempts] = useState(0);
  
  // Add loading state specifically for player
  const [playerLoading, setPlayerLoading] = useState(true);
  
  // Refs for the YouTube player
  const playerRef = useRef<any>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const playerInterval = useRef<NodeJS.Timeout | null>(null);
  
  // Add ref for the iframe element
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  // Track fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Load video data and user preferences
  useEffect(() => {
    const fetchVideoData = async () => {
      setIsLoading(true);
      const session = await getSession();
      if (session){
        setUser(session.user?.email ?? null);
        setIsLoggedIn(true);
      }

      // Safely access localStorage within useEffect
      try {
        const sessionid = localStorage.getItem('nexview-selected-session');
        if (sessionid) {
          setSessionId(sessionid);
        }

        // Load preferences from localStorage
        const likedVideos = JSON.parse(localStorage.getItem('likedVideos') || '[]');
        const dislikedVideos = JSON.parse(localStorage.getItem('dislikedVideos') || '[]');
        const savedVideos = JSON.parse(localStorage.getItem('savedVideos') || '[]');
        
        setIsLiked(likedVideos.includes(videoId));
        setIsDisliked(dislikedVideos.includes(videoId));
        setIsSaved(savedVideos.includes(videoId));
      } catch (error) {
        console.error("LocalStorage access error:", error);
      }
  
      try {
        const API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
        const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoId}&key=${API_KEY}`);
        const data = await response.json();
        
        if (data.items && data.items.length > 0) {
          const videoItem = data.items[0];
          const snippet = videoItem.snippet;
          const stats = videoItem.statistics;
          
          const publishedAt = new Date(snippet.publishedAt);
          const now = new Date();
          const diffInDays = Math.floor((now.getTime() - publishedAt.getTime()) / (1000 * 60 * 60 * 24));

          let timestamp = "";
          if (diffInDays === 0) timestamp = "Today";
          else if (diffInDays === 1) timestamp = "Yesterday";
          else if (diffInDays < 7) timestamp = `${diffInDays} days ago`;
          else if (diffInDays < 30) timestamp = `${Math.floor(diffInDays / 7)} weeks ago`;
          else if (diffInDays < 365) timestamp = `${Math.floor(diffInDays / 30)} months ago`;
          else timestamp = `${Math.floor(diffInDays / 365)} years ago`;
          
          setVideoData({
            id: videoId,
            title: snippet.title,
            author: snippet.channelTitle,
            views: `${parseInt(stats.viewCount || 0).toLocaleString()} views`,
            timestamp,
            likes: parseInt(stats.likeCount || 0),
            description: snippet.description
          });
          
        }
      } catch (error) {
        console.error("Error fetching video data:", error);
        // Fallback to mock data if API fails
        setVideoData({
          id: videoId,
          title: "Video Title",
          author: "Video Author",
          views: "123K views",
          timestamp: "2 days ago",
          likes: 5432,
          description: "This is a video description. If you're seeing this, there was an error loading the actual video data."
        });
        
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchVideoData();
  }, [videoId]);
  
  
  
  // Initialize YouTube Player
  useEffect(() => {
    if (embedMode === 'iframe') {
      // For iframe mode, set loading to false immediately
      setPlayerLoading(false);
      setIsBuffering(false);
      return;
    }
    
    // Don't try more than 2 times with the API
    if (playerAttempts > 2) {
      console.log("Switching to iframe embed mode after multiple API failures");
      setEmbedMode('iframe');
      return;
    }
    
    // Check if YouTube API is already loaded
    let apiLoaded = typeof window !== 'undefined' && window.YT && typeof window.YT.Player === 'function';
    
    if (!apiLoaded) {
      // Load YouTube API script
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }
    
    // Function to initialize the player
    const initializePlayer = () => {
      if (!videoContainerRef.current || !videoId) return;
      
      try {
        // Set loading state
        setPlayerLoading(true);
        
        if (playerRef.current) {
          try {
            playerRef.current.destroy();
          } catch (e) {
            console.log("Error while destroying player:", e);
          }
        }
        
        playerRef.current = new window.YT.Player('player-container', {
          videoId,
          height: '100%',
          width: '100%',
          playerVars: {
            autoplay: 1,
            controls: 0, // Hide default controls
            rel: 0,
            showinfo: 0,
            modestbranding: 1,
            iv_load_policy: 3,
            fs: 0, // Disable fullscreen (we'll handle it ourselves)
            cc_load_policy: 0,
            autohide: 0,
            playsinline: 1,
          },
          events: {
            onReady: handlePlayerReady,
            onStateChange: handlePlayerStateChange,
            onError: handlePlayerError,
          }
        });
      } catch (error) {
        console.error("Error initializing YouTube player:", error);
        handlePlayerError();
      }
    };
    
    // Initialize player when API is ready
    if (apiLoaded) {
      initializePlayer();
    } else {
      window.onYouTubeIframeAPIReady = () => {
        initializePlayer();
      };
    }
    
    const playerTimeout = setTimeout(() => {
      if ((isBuffering || playerLoading) && !playerReady && embedMode === 'api') {
        console.log("Player initialization timeout, switching to iframe mode");
        setEmbedMode('iframe');
      }
    }, 5000); // Reduced timeout for better UX

    // Cleanup
    return () => {
      clearTimeout(playerTimeout);
      if (playerRef.current && playerRef.current.destroy) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          console.log("Error while destroying player:", e);
        }
      }
      if (playerInterval.current) {
        clearInterval(playerInterval.current);
      }
      window.onYouTubeIframeAPIReady = () => {};
    };
  }, [videoId, embedMode, playerAttempts]);

  const handlePlayerReady = (event: any) => {
    try {
      console.log("Player ready!");
      setPlayerReady(true);
      setPlayerLoading(false);
      setIsBuffering(false);
      setDuration(event.target.getDuration());
      
      // Ensure video starts playing
      event.target.playVideo();
      setIsPlaying(true);
      
      // Check if video is muted and sync UI state
      setIsMuted(event.target.isMuted());
      
      // Set up interval to update current time
      if (playerInterval.current) {
        clearInterval(playerInterval.current);
      }
      
      playerInterval.current = setInterval(() => {
        if (playerRef.current && playerRef.current.getCurrentTime) {
          try {
            setCurrentTime(playerRef.current.getCurrentTime());
          } catch (e) {
            console.log("Error getting current time:", e);
          }
        }
      }, 1000);
    } catch (error) {
      console.error("Error in player ready handler:", error);
      handlePlayerError();
    }
  };

  const handlePlayerStateChange = (event: any) => {
    // Log player state for debugging
    console.log("Player state changed:", event.data);
    
    // Use numeric values directly in case window.YT is not fully loaded
    switch(event.data) {
      case 1: // PLAYING
        setIsPlaying(true);
        setIsBuffering(false);
        setPlayerLoading(false);
        break;
      case 2: // PAUSED
        setIsPlaying(false);
        setIsBuffering(false);
        break;
      case 3: // BUFFERING
        setIsBuffering(true);
        break;
      case 0: // ENDED
        setIsPlaying(false);
        setIsBuffering(false);
        break;
      case 5: // CUED
        // Video is cued and ready to play
        if (playerRef.current) {
          playerRef.current.playVideo();
        }
        break;
    }
  };
  
  const handlePlayerError = () => {
    console.error("YouTube player error");
    setVideoError(true);
    setIsBuffering(false);
    setPlayerLoading(false);
    
    // Increment attempt counter
    setPlayerAttempts(prev => prev + 1);
    
    // After multiple attempts, switch to iframe mode
    if (playerAttempts >= 1) {
      setEmbedMode('iframe');
    }
  };

  // Video player event handlers
  const handlePlayPause = () => {
    if (playerRef.current) {
      if (isPlaying) {
        playerRef.current.pauseVideo();
      } else {
        playerRef.current.playVideo();
      }
    }
  };
  
  const handleMuteToggle = () => {
    if (playerRef.current) {
      if (isMuted) {
        playerRef.current.unMute();
      } else {
        playerRef.current.mute();
      }
      setIsMuted(!isMuted);
    }
  };
  
  const handleProgress = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (progressBarRef.current && playerRef.current) {
      const progressBar = progressBarRef.current;
      const rect = progressBar.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      const newTime = pos * duration;
      playerRef.current.seekTo(newTime, true);
    }
  };
  
  // Enhanced fullscreen handler to track state
  const handleFullscreen = () => {
    if (videoContainerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
        setIsFullscreen(false);
      } else {
        videoContainerRef.current.requestFullscreen();
        setIsFullscreen(true);
      }
    }
  };

  // Listen for fullscreen change events (in case user uses Escape key or other methods)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  // Handle like, dislike, save, and share functions
  const handleLike = async () => {
    if (isLoggedIn && user && sessionId) {
      try {
        if (isLiked) {
          const response = await axios.post('/api/video-handle', {
            user,
            sessionId: sessionId,
            videoId: videoId,
            action: 'unlike'
          });
          if (response.status === 200) {
            setIsLiked(false);
          }
        } else {
          const response = await axios.post('/api/video-handle', {
            user,
            sessionId: sessionId,
            videoId: videoId,
            action: 'like'
          });
          if (response.status === 200) {
            setIsLiked(true);
          }
          
          if (isDisliked) {
            const response = await axios.post('/api/video-handle', {
              user,
              sessionId: sessionId,
              videoId: videoId,
              action: 'undislike'
            });
            if (response.status === 200) {
              setIsDisliked(false);
            }
          }
        }
        
        // Toggle state
        setIsLiked(!isLiked);

        
        // Also update localStorage for offline access
        updateLocalStorage('likedVideos', videoId, !isLiked);
        if (isDisliked && !isLiked) {
          updateLocalStorage('dislikedVideos', videoId, false);
        }
      } catch (error) {
        console.error("Error updating like status:", error);
      }
    } else {
      // Fallback to localStorage-only approach
      const likedVideos = JSON.parse(localStorage.getItem('likedVideos') || '[]');
      
      if (isLiked) {
        // Remove from liked videos
        const updatedLikedVideos = likedVideos.filter((id: string) => id !== videoId);
        localStorage.setItem('likedVideos', JSON.stringify(updatedLikedVideos));
        setIsLiked(false);
      } else {
        // Add to liked videos
        if (!likedVideos.includes(videoId)) {
          likedVideos.push(videoId);
          localStorage.setItem('likedVideos', JSON.stringify(likedVideos));
        }
        setIsLiked(true);
        
        // Remove from disliked if it was disliked
        if (isDisliked) {
          const dislikedVideos = JSON.parse(localStorage.getItem('dislikedVideos') || '[]');
          const updatedDislikedVideos = dislikedVideos.filter((id: string) => id !== videoId);
          localStorage.setItem('dislikedVideos', JSON.stringify(updatedDislikedVideos));
          setIsDisliked(false);
        }
      }
    }
  };
  
  const handleDislike = async () => {
    if (isLoggedIn && user && sessionId) {
      try {
        if (isDisliked) {
          const response = await axios.post('/api/video-handle', {
            user,
            sessionId: sessionId,
            videoId: videoId,
            action: 'undislike'
          });
          if (response.status === 200) {
            setIsDisliked(false);
          }
        } else {
          const response = await axios.post('/api/video-handle', {
            user,
            sessionId: sessionId,
            videoId: videoId,
            action: 'dislike'
          });

          if (response.status === 200) {
            setIsDisliked(true);
          }

          // If it was liked before, remove the like
          if (isLiked) {
            const response = await axios.post('/api/video-handle', {
              user,
              sessionId: sessionId,
              videoId: videoId,
              action: 'unlike'
            });

            if (response.status === 200) {
              setIsLiked(false);
            }
          }
        }
        
        // Toggle state
        setIsDisliked(!isDisliked);
        
        // Also update localStorage for offline access
        updateLocalStorage('dislikedVideos', videoId, !isDisliked);
        if (isLiked && !isDisliked) {
          updateLocalStorage('likedVideos', videoId, false);
        }
      } catch (error) {
        console.error("Error updating dislike status:", error);
      }
    } else {
      // Fallback to localStorage-only approach
      const dislikedVideos = JSON.parse(localStorage.getItem('dislikedVideos') || '[]');
      
      if (isDisliked) {
        // Remove from disliked videos
        const updatedDislikedVideos = dislikedVideos.filter((id: string) => id !== videoId);
        localStorage.setItem('dislikedVideos', JSON.stringify(updatedDislikedVideos));
        setIsDisliked(false);
      } else {
        // Add to disliked videos
        if (!dislikedVideos.includes(videoId)) {
          dislikedVideos.push(videoId);
          localStorage.setItem('dislikedVideos', JSON.stringify(dislikedVideos));
        }
        setIsDisliked(true);
        
        // Remove from liked if it was liked
        if (isLiked) {
          const likedVideos = JSON.parse(localStorage.getItem('likedVideos') || '[]');
          const updatedLikedVideos = likedVideos.filter((id: string) => id !== videoId);
          localStorage.setItem('likedVideos', JSON.stringify(updatedLikedVideos));
          setIsLiked(false);
        }
      }
    }
  };
  
  const handleSave = async () => {
    if (isLoggedIn && user && sessionId) {
      try {
        if (isSaved) {
          const response = await axios.post('/api/video-handle', {
            user,
            sessionId: sessionId,
            videoId: videoId,
            action: 'unsave'
          });
          if (response.status === 200) {
            setIsSaved(false);
          }
        } else {
          const response = await axios.post('/api/video-handle', {
            user,
            sessionId: sessionId,
            videoId: videoId,
            action: 'save'
          });
          if (response.status === 200) {
            setIsSaved(true);
          }
        }
        
        // Toggle state
        setIsSaved(!isSaved);
        
        // Also update localStorage for offline access
        updateLocalStorage('savedVideos', videoId, !isSaved);
      } catch (error) {
        console.error("Error updating save status:", error);
      }
    } else {
      // Fallback to localStorage-only approach
      const savedVideos = JSON.parse(localStorage.getItem('savedVideos') || '[]');
      
      if (isSaved) {
        // Remove from saved videos
        const updatedSavedVideos = savedVideos.filter((id: string) => id !== videoId);
        localStorage.setItem('savedVideos', JSON.stringify(updatedSavedVideos));
        setIsSaved(false);
      } else {
        // Add to saved videos
        if (!savedVideos.includes(videoId)) {
          savedVideos.push(videoId);
          localStorage.setItem('savedVideos', JSON.stringify(savedVideos));
        }
        setIsSaved(true);
      }
    }
  };

  const handleHistory = async () => {
    console.log("Adding to history");
    console.log(isLoggedIn, user, sessionId);
    if (isLoggedIn && user && sessionId) {
      try {
        const response = await axios.post('/api/video-handle', {
          user,
          sessionId: sessionId,
          videoId: videoId,
          action: 'history'
        });
        if (response.status === 200) {
          console.log("Added to history");
        }
      } catch (error) {
        console.error("Error updating history:", error);
      }
    } else {

      const history = JSON.parse(localStorage.getItem('history') || '[]');

      if (history){
        if (!history.includes(videoId)) {
          history.push(videoId);
          localStorage.setItem('history', JSON.stringify(history));
        }
      }else{
        localStorage.setItem('history', JSON.stringify([videoId]));
      }
    }
  };
  
  
  // Helper for updating localStorage
  const updateLocalStorage = (key: string, id: string, addToList: boolean) => {
    const items = JSON.parse(localStorage.getItem(key) || '[]');
    
    if (addToList) {
      if (!items.includes(id)) {
        items.push(id);
      }
    } else {
      const updatedItems = items.filter((itemId: string) => itemId !== id);
      localStorage.setItem(key, JSON.stringify(updatedItems));
      return;
    }
    
    localStorage.setItem(key, JSON.stringify(items));
  };
  
  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/video/${videoId}`;
    
    try {
      if (navigator.share) {
        await navigator.share({
          title: videoData?.title || 'Check out this video',
          url: shareUrl
        });
      } else {
        // Fallback - copy to clipboard
        await navigator.clipboard.writeText(shareUrl);
        alert('Link copied to clipboard!');
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };
  
  const retryVideoLoad = () => {
    setVideoError(false);
    
    if (embedMode === 'api' && playerAttempts >= 2) {
      // Switch to iframe embed after multiple API failures
      setEmbedMode('iframe');
    } else if (embedMode === 'api') {
      // Retry with API
      if (playerRef.current && playerRef.current.destroy) {
        try {
          playerRef.current.destroy();
          playerRef.current = null;
        } catch (e) {
          console.log("Error destroying player during retry:", e);
        }
      }
      
      // Load YouTube API again
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      
      setPlayerAttempts(prev => prev + 1);
    } else {
      // Just reload the page if in iframe mode
      window.location.reload();
    }
  };

  // Add debugging UI for testing MongoDB connection
  useEffect(() => {
    const fetchSessionData = async () => {
      const currentSession = await getSession();
      console.log("Current session:", currentSession);
    };
    
    fetchSessionData();
  }, []);
  
  // Enhanced iframe blocker that works in fullscreen
  useEffect(() => {
    if (embedMode === 'iframe' && iframeRef.current) {
      handleHistory();
      try {
        const interceptClicks = () => {
          const iframe = iframeRef.current;
          if (!iframe || !iframe.contentWindow) return;
          
          // Attempt to modify iframe content (this may not work due to cross-origin restrictions)
          try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            
            if (iframeDoc) {
              // Hide YouTube logo and info button
              const ytElements = iframeDoc.querySelectorAll('.ytp-youtube-button, .ytp-watermark');
              ytElements.forEach(el => {
                (el as HTMLElement).style.display = 'none';
              });
            }
          } catch (e) {
            console.log("Could not access iframe content:", e);
          }
          
          // Add StyleSheet to parent document instead
          const styleId = 'youtube-iframe-style';
          if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
              /* Larger bottom-right blocker for fullscreen mode */
              .yt-blocker-fullscreen {
                position: fixed;
                right: 0;
                bottom: 0;
                width: 180px; 
                height: 80px;
                z-index: 10;
                background: transparent;
                pointer-events: auto;
                display: block;
              }

              .ytp-pause-overlay {
                display: none !important;
                }
              
              // /* Show blocker in fullscreen */
              // :fullscreen .yt-blocker-fullscreen {
              //   display: block;
              // }
              
              /* More aggressive CSS for iframe */
              iframe.youtube-nocookie-embed {
                position: relative;
                z-index: 1;
              }
            `;
            document.head.appendChild(style);
          }
        };
        
        // Try when iframe loads
        iframeRef.current.addEventListener('load', interceptClicks);
        
        // Also try immediately and after delays
        interceptClicks();
        setTimeout(interceptClicks, 1000);
        setTimeout(interceptClicks, 3000);
      } catch (error) {
        console.error("Error setting up iframe blocker:", error);
      }
    }
  }, [embedMode]);
  
  return (
    <main className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 w-full h-16 border-b bg-background flex items-center justify-between px-4 z-50">
        <div className="flex items-center">
          <Button variant="ghost" size="icon" className="mr-2" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <Link href="/" className="flex items-center mr-6">
            <Image src="/nexview.png" alt="Nexview" width={120} height={32} />
          </Link>
        </div>
        
        <div className="flex items-center space-x-4">
          <ModeToggle />
          <Avatar>
            <AvatarImage src="https://github.com/shadcn.png" />
            <AvatarFallback>CN</AvatarFallback>
          </Avatar>
        </div>
      </div>
      
      {/* Video and Content */}
      <div className="pt-16 px-4 md:px-6 lg:px-8 max-w-6xl mx-auto w-full">
        {isLoading ? (
          <div className="flex justify-center items-center h-[50vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            {/* Custom Video Player with YouTube Iframe */}
            <div 
              ref={videoContainerRef} 
              className="aspect-video w-full rounded-lg overflow-hidden mb-4 mt-6 bg-black relative group"
            >
              {/* Add custom styles to hide YouTube branding */}
              <style jsx>{`
                /* Hide YouTube logo and Watch on YouTube button */
                iframe {
                  position: relative;
                  z-index: 1;
                }
                
                /* This creates an overlay that blocks clicks on the YouTube logo in the bottom right */
                .yt-blocker {
                  position: absolute;
                  right: 48px;
                  bottom: 6px;
                  width: 70px; /* Increased width */
                  height: 30px; /* Increased height */
                  z-index: 10;
                  background: transparent;
                  pointer-events: auto;
                  cursor: default;
                }
                
                /* Extra iframe specific CSS won't work inside the iframe due to security, 
                   but we add it in case some browsers allow it */
                :global(.ytp-youtube-button),
                :global(.ytp-watermark),
                :global(a.ytp-title),
                :global(.ytp-title-text > a) {
                  display: none !important;
                  opacity: 0 !important;
                  pointer-events: none !important;
                  visibility: hidden !important;
                }
              `}</style>
              
              {/* Show loading indicator only when actually loading/buffering */}
              {(isBuffering || playerLoading) && !videoError && (
                <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                </div>
              )}
              
              {videoError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-30 bg-black/60 p-4">
                  <div className="text-white mb-2 text-center">
                    <p className="font-semibold mb-2">Unable to load video</p>
                    <p className="text-sm opacity-80">
                      {embedMode === 'api' 
                        ? "Having trouble with the YouTube player, trying alternative methods..." 
                        : "There was an error loading the YouTube video"}
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    className="bg-primary/20 hover:bg-primary/30 text-white border-white/20"
                    onClick={retryVideoLoad}
                  >
                    {embedMode === 'api' && playerAttempts < 2 
                      ? "Retry" 
                      : embedMode === 'api' 
                        ? "Try Alternative Player" 
                        : "Reload Page"}
                  </Button>
                </div>
              ) : (
                <>
                  {embedMode === 'api' ? (
                    <>
                      {/* YouTube player container for API mode */}
                      <div id="player-container" className="w-full h-full absolute inset-0" />
                      
                      {/* Invisible overlay to handle clicks - improved for better interaction */}
                      <div 
                        className="absolute inset-0 z-10 cursor-pointer"
                        onClick={handlePlayPause}
                      >
                        {/* Large play button overlay - only show when paused */}
                        {!isPlaying && !isBuffering && playerReady && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="rounded-full bg-black/50 p-5 hover:bg-black/70 transition-colors">
                              <Play className="h-12 w-12 text-white" />
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Direct iframe embed as fallback - improved with better parameters */}
                      <iframe 
                        ref={iframeRef}
                        className="w-full h-full border-0 youtube-nocookie-embed"
                        src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&modestbranding=1&rel=0&showinfo=0&enablejsapi=1&playsinline=1&origin=${encodeURIComponent(window.location.origin)}&widget_referrer=${encodeURIComponent(window.location.href)}&iv_load_policy=3&color=white&controls=1`}
                        title={videoData?.title || "YouTube video player"}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      ></iframe>
                      
                      {/* Add a transparent blocker over the YouTube logo area */}
                      <div 
                        className="yt-blocker"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          return false;
                        }}
                      ></div>
                      
                      {/* Fullscreen blocker that will be fixed positioned */}
                      <div 
                        className="yt-blocker-fullscreen"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          return false;
                        }}
                      ></div>
                    </>
                  )}
                </>
              )}
              
              {/* Custom Video Controls - only show in API mode and when player is ready */}
              {embedMode === 'api' && playerReady && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col z-20">
                  {/* Progress bar */}
                  <div 
                    ref={progressBarRef}
                    className="w-full h-2 bg-gray-600 mb-4 cursor-pointer rounded-full overflow-hidden"
                    onClick={handleProgress}
                  >
                    <div 
                      className="h-full bg-primary" 
                      style={{ width: `${(currentTime / duration) * 100}%` }}
                    />
                  </div>
                  
                  {/* Controls */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={handlePlayPause}
                        className="text-white hover:text-primary hover:bg-white/10"
                      >
                        {isPlaying ? (
                          <Pause className="h-5 w-5" />
                        ) : (
                          <Play className="h-5 w-5" />
                        )}
                      </Button>
                      
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={handleMuteToggle}
                        className="text-white hover:text-primary hover:bg-white/10"
                      >
                        {isMuted ? (
                          <VolumeX className="h-5 w-5" />
                        ) : (
                          <Volume2 className="h-5 w-5" />
                        )}
                      </Button>
                      
                      <span className="text-white text-sm">
                        {formatTime(currentTime)} / {formatTime(duration)}
                      </span>
                    </div>
                    
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={handleFullscreen}
                      className="text-white hover:text-primary hover:bg-white/10"
                    >
                      <Maximize className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Video Title & Info */}
            <h1 className="text-xl md:text-2xl font-bold mt-4">{videoData?.title}</h1>
            
            <div className="flex flex-wrap justify-between items-center mt-4">
              <div className="flex items-center">
                <Avatar className="h-10 w-10 mr-3">
                  <AvatarImage src={`https://picsum.photos/seed/${videoData?.author}/30/30`} />
                  <AvatarFallback>{videoData?.author?.[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-medium">{videoData?.author}</h3>
                  <p className="text-sm text-muted-foreground">
                    {videoData?.views} • {videoData?.timestamp}
                  </p>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex items-center space-x-2 mt-4 sm:mt-0">
                <Button 
                  variant={isLiked ? "default" : "outline"} 
                  size="sm" 
                  onClick={handleLike}
                  className="flex items-center gap-2"
                >
                  <ThumbsUp className="h-4 w-4" />
                  <span>Like</span>
                </Button>
                
                <Button 
                  variant={isDisliked ? "default" : "outline"} 
                  size="sm" 
                  onClick={handleDislike}
                  className="flex items-center gap-2"
                >
                  <ThumbsDown className="h-4 w-4" />
                  <span>Dislike</span>
                </Button>
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleShare}
                  className="flex items-center gap-2"
                >
                  <Share2 className="h-4 w-4" />
                  <span>Share</span>
                </Button>
                
                <Button 
                  variant={isSaved ? "default" : "outline"}
                  size="sm" 
                  onClick={handleSave}
                  className="flex items-center gap-2"
                >
                  {isSaved ? (
                    <BookmarkCheck className="h-4 w-4" />
                  ) : (
                    <BookmarkPlus className="h-4 w-4" />
                  )}
                  <span>{isSaved ? "Saved" : "Save"}</span>
                </Button>
              </div>
            </div>
            
            {/* Description with "Show More" Toggle */}
            {videoData?.description && (
              <div className="my-6 p-4 rounded-lg bg-muted/30">
                <p className={`text-sm ${!showFullDescription ? 'line-clamp-3' : 'whitespace-pre-line'}`}>
                  {videoData.description}
                </p>
                {videoData.description.length > 150 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setShowFullDescription(!showFullDescription)}
                    className="mt-2 text-xs font-medium"
                  >
                    {showFullDescription ? 'Show less' : 'Show more'}
                  </Button>
                )}
              </div>
            )}
          </>
        )}
        
        {/* Add debug info */}
        <div className="p-4 mt-8 border-t">
          <h2 className="text-lg font-bold mb-2">Debug Info</h2>
          <div className="text-sm space-y-1">
            <p>User ID: {user || 'Not logged in'}</p>
            <p>Session ID: {sessionId || 'No session'}</p>
            <p>Video ID: {videoId}</p>
            <p>Is Liked: {isLiked ? 'Yes' : 'No'}</p>
            <p>Is Disliked: {isDisliked ? 'Yes' : 'No'}</p>
            <p>Is Saved: {isSaved ? 'Yes' : 'No'}</p>
          </div>
        </div>
      </div>
    </main>
  );
}