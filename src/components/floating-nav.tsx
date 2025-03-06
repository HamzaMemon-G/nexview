'use client'
import React from "react";
import Link from "next/link";
import { Search, Home, Clock, ThumbsUp, PlaySquare, Bookmark } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PlusCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Session {
  id: string;
  name: string;
  dailyTime: string;
  endDate: string;
}

interface FloatingNavProps {
  activeRoute: 'home' | 'saved' | 'history' | 'likes';
  sessions?: Session[];
  showSearch?: boolean;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  onSearchSubmit?: (e: React.FormEvent) => void;
  setShowSearch?: (show: boolean) => void;
  onSessionSelect?: (sessionId: string) => void;
  onSessionDelete?: (sessionId: string) => void;
  onCreateSessionClick?: () => void;
  selectedSessionId?: string | null;
  sessionName?: string; // Add new prop for session name
}

export function FloatingNav({
  activeRoute,
  sessions = [],
  showSearch = false,
  searchQuery = "",
  onSearchQueryChange = () => {},
  onSearchSubmit = (e) => { e.preventDefault(); },
  setShowSearch = () => {},
  onSessionSelect = () => {},
  onSessionDelete = () => {},
  onCreateSessionClick = () => {},
  selectedSessionId = null,
  sessionName = "" // Default to empty string
}: FloatingNavProps) {
  const searchRef = React.useRef<HTMLDivElement>(null);

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
  }, [setShowSearch]);

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
      <div
        ref={searchRef}
        className={`flex items-center gap-1 px-2 py-3 bg-background/90 backdrop-blur-lg rounded-full shadow-lg border transition-all duration-300 ${showSearch ? 'scale-105' : ''}`}
        style={{ minWidth: showSearch ? '280px' : 'auto' }}
      >
        {showSearch ? (
          <form onSubmit={onSearchSubmit} className="flex w-full px-2 animate-fadeIn">
            <Input
              placeholder={sessionName ? `Search in ${sessionName}` : `Search ${activeRoute === 'home' ? 'topics' : activeRoute}`}
              className="rounded-full border focus:ring-2 focus:ring-primary w-full"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              autoFocus
            />
          </form>
        ) : (
          <>
            <Link href="/" className="flex flex-col items-center px-5 py-1">
              <Home className={`h-5 w-5 ${activeRoute === 'home' ? 'text-primary' : ''}`} />
              <span className={`text-xs mt-1 ${activeRoute === 'home' ? 'text-primary' : ''}`}>Home</span>
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
                <DropdownMenuLabel>{activeRoute === 'home' ? 'Manage Sessions' : 'View Sessions'}</DropdownMenuLabel>
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
                          onClick={() => onSessionSelect(session.id)}
                        >
                          <div className="font-medium">{session.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {session.dailyTime} daily • {formatDuration(session.endDate)}
                          </div>
                        </div>
                        
                        {activeRoute === 'home' && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-destructive hover:text-destructive/80"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSessionDelete(session.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
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
                  onClick={onCreateSessionClick}
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Create New Session
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Link href="/saved" className="flex flex-col items-center px-5 py-1">
              <Bookmark className={`h-5 w-5 ${activeRoute === 'saved' ? 'text-primary' : ''}`} />
              <span className={`text-xs mt-1 ${activeRoute === 'saved' ? 'text-primary' : ''}`}>Saved</span>
            </Link>
            
            <Link href="/history" className="flex flex-col items-center px-5 py-1">
              <Clock className={`h-5 w-5 ${activeRoute === 'history' ? 'text-primary' : ''}`} />
              <span className={`text-xs mt-1 ${activeRoute === 'history' ? 'text-primary' : ''}`}>History</span>
            </Link>
            
            <Link href="/likes" className="flex flex-col items-center px-5 py-1">
              <ThumbsUp className={`h-5 w-5 ${activeRoute === 'likes' ? 'text-primary' : ''}`} />
              <span className={`text-xs mt-1 ${activeRoute === 'likes' ? 'text-primary' : ''}`}>Liked</span>
            </Link>
            
            <div
              className="flex flex-col items-center px-5 py-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-transform duration-200 hover:scale-110"
              onClick={() => setShowSearch(true)}
            >
              <Search className="h-5 w-5" />
              <span className="text-xs mt-1">Search</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
