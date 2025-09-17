
'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from './ui/button';
import { X } from 'lucide-react';

interface YouTubePlayerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string | null;
  songTitle: string;
}

const getYouTubeEmbedUrl = (url: string | null): string | null => {
  if (!url) return null;
  
  let videoId: string | null = null;

  try {
    const urlObject = new URL(url);
    if (urlObject.hostname === 'youtu.be') {
      videoId = urlObject.pathname.slice(1);
    } else if (urlObject.hostname.includes('youtube.com')) {
      videoId = urlObject.searchParams.get('v');
    }
  } catch (error) {
    console.error("Invalid URL for YouTube parsing", error);
    return null;
  }


  if (videoId) {
    // Se elimina el autoplay=1 para mayor compatibilidad
    return `https://www.youtube.com/embed/${videoId}`;
  }
  
  return null; // Devuelve null si la URL no es una URL de YouTube válida
};


const YouTubePlayerDialog: React.FC<YouTubePlayerDialogProps> = ({ isOpen, onClose, videoUrl, songTitle }) => {
  const embedUrl = getYouTubeEmbedUrl(videoUrl);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] p-0 flex flex-col">
        <DialogHeader className="p-4 flex-row flex justify-between items-center">
          <DialogTitle>{songTitle}</DialogTitle>
          <DialogClose asChild>
            <Button variant="ghost" size="icon">
              <X className="w-5 h-5" />
            </Button>
          </DialogClose>
        </DialogHeader>
        <div className="flex-grow w-full h-full">
            {embedUrl ? (
                <iframe
                    width="100%"
                    height="100%"
                    src={embedUrl}
                    title="YouTube video player"
                    frameBorder="0"
                    allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="rounded-b-lg"
                ></iframe>
            ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                    <p>URL de YouTube no válida o no proporcionada.</p>
                </div>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default YouTubePlayerDialog;
