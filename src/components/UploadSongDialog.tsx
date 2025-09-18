

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Upload } from 'lucide-react';
import UploadSongForm from './UploadSongForm';


interface UploadSongDialogProps {
  onUploadFinished: () => void;
}

const UploadSongDialog: React.FC<UploadSongDialogProps> = ({ onUploadFinished }) => {
  const [open, setOpen] = useState(false);

  const handleUploadFinished = () => {
    onUploadFinished();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
            <Upload className="w-4 h-4" />
            Subir Canción
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Subir nueva canción (grupo de pistas)</DialogTitle>
          <DialogDescription>Añade los metadatos de la canción y sube todos los archivos de las pistas.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto pr-2">
            <UploadSongForm onUploadFinished={handleUploadFinished} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UploadSongDialog;
