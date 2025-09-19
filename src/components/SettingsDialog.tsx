'use client';

import React, { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { Label } from './ui/label';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';
import { ChevronRight, X, Heart, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import SamplerPadSettings from './SamplerPadSettings';
import UploadSongDialog from './UploadSongDialog';
import { useAuth } from '@/contexts/AuthContext';

type SettingsTab = 'General' | 'Sampler' | 'Subir Canciones' | 'About';

interface SettingsRowProps {
  label: string;
  value: string | React.ReactNode;
  onClick?: () => void;
  isSelect?: boolean;
}

const SettingsRow: React.FC<SettingsRowProps> = ({ label, value, onClick, isSelect }) => (
  <div className="flex items-center justify-between py-3 cursor-pointer" onClick={onClick}>
    <Label className="text-base cursor-pointer">{label}</Label>
    <div className="flex items-center gap-2 text-muted-foreground">
      <span>{value}</span>
      {isSelect && <ChevronRight className="h-5 w-5" />}
    </div>
  </div>
);


interface SettingsSliderRowProps {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
  displayFormatter?: (value: number) => string;
}

const SettingsSliderRow: React.FC<SettingsSliderRowProps> = ({ label, value, onValueChange, displayFormatter }) => (
  <div className="py-3">
    <div className="flex items-center justify-between mb-2">
        <Label className="text-base">{label}</Label>
        <span className="text-muted-foreground">{displayFormatter ? displayFormatter(value) : value}</span>
    </div>
    <Slider
      defaultValue={[value]}
      max={5} // Max 5 segundos de fade
      step={0.1}
      onValueChange={(vals) => onValueChange(vals[0])}
    />
  </div>
);

interface SettingsSwitchRowProps {
    label: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
}

const SettingsSwitchRow: React.FC<SettingsSwitchRowProps> = ({ label, checked, onCheckedChange }) => (
    <div className="flex items-center justify-between py-3">
        <Label className="text-base">{label}</Label>
        <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
);

interface SettingsDialogProps {
    children: React.ReactNode;
    fadeOutDuration: number;
    onFadeOutDurationChange: (duration: number) => void;
    isPanVisible: boolean;
    onPanVisibilityChange: (isVisible: boolean) => void;
}


const SettingsDialog = ({ 
    children, 
    fadeOutDuration, 
    onFadeOutDurationChange,
    isPanVisible,
    onPanVisibilityChange,
}: SettingsDialogProps) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('General');
  const [tonicFollows, setTonicFollows] = useState(true);

  const tabs: SettingsTab[] = ['General', 'Sampler', 'Subir Canciones', 'About'];

  const renderGeneralSettings = () => {
    return (
        <div>
            <SettingsRow label="Appearance" value="Dark" isSelect />
            <Separator />
            <SettingsSliderRow 
              label="Fade out / in duration" 
              value={fadeOutDuration} 
              onValueChange={onFadeOutDurationChange}
              displayFormatter={(value) => `${value.toFixed(1)}s`}
            />
            <Separator />
            <SettingsSwitchRow label="Show Pan Controls" checked={isPanVisible} onCheckedChange={onPanVisibilityChange} />
            <Separator />
            <SettingsSwitchRow label="Tonic Pad follows Key of Tracks" checked={tonicFollows} onCheckedChange={setTonicFollows} />
            <Separator />
        </div>
    );
  }
  
  const renderUploadSong = () => {
    return (
        <div className="max-w-md mx-auto text-center">
            <Upload className="w-16 h-16 mx-auto text-primary mb-4" />
            <h2 className="text-2xl font-bold">Subir Nueva Canción</h2>
            <p className="text-muted-foreground mt-2 mb-6">
                Añade nuevas canciones a tu biblioteca personal. Se te pedirá el nombre, artista, tempo, y los archivos de audio de las pistas.
            </p>
            <UploadSongDialog onUploadFinished={() => console.log('Upload finished from settings.')}>
                <Button size="lg" className="gap-2">
                    Abrir Formulario de Subida
                    <ChevronRight />
                </Button>
            </UploadSongDialog>
        </div>
    );
  }

  const renderAboutSettings = () => {
    return (
      <div className="max-w-md mx-auto text-center">
        <h2 className="text-2xl font-bold text-primary">Multitrack Player</h2>
        <p className="text-muted-foreground mb-6">Versión 1.0.0</p>
        <Separator />
        <div className="py-6">
            <p className="text-foreground">
                Esta aplicación es un reproductor de audio multipista diseñado para músicos y directores de alabanza que necesitan una solución flexible y potente para sus presentaciones en vivo.
            </p>
        </div>
        <Separator />
        <div className="py-6 flex flex-col items-center gap-2 text-muted-foreground">
            <p>Desarrollado con</p>
            <Heart className="w-5 h-5 text-destructive fill-destructive" />
            <p className="font-semibold">por Freedom Labs</p>
        </div>
      </div>
    );
  }

  return (
    <Sheet onOpenChange={(isOpen) => {
        if (!isOpen) {
            setActiveTab('General');
        }
    }}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent
        side="left"
        className="w-full h-full max-w-full sm:max-w-full md:max-w-full lg:max-w-full xl:max-w-full p-0"
      >
        <div className="grid grid-cols-[280px_1fr] h-full">
            {/* Left Nav */}
            <div className="bg-secondary/30 flex flex-col h-full">
                <SheetHeader className="p-4 text-left">
                    <SheetTitle className="text-4xl font-bold flex items-center justify-between">
                        Settings
                        <SheetClose asChild>
                            <Button variant="ghost" size="icon" className="rounded-full w-10 h-10">
                                <X className="w-5 h-5"/>
                            </Button>
                        </SheetClose>
                    </SheetTitle>
                </SheetHeader>
                <div className="flex flex-col p-4 flex-grow">
                    {tabs.map(tab => (
                        <Button 
                            key={tab}
                            variant="ghost" 
                            className={cn(
                                "justify-start text-lg h-12 px-4",
                                activeTab === tab && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                            )}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab}
                        </Button>
                    ))}
                    {user?.role === 'admin' && (
                         <Button
                            variant="ghost" 
                            className="justify-start text-lg h-12 px-4"
                            onClick={() => window.location.href = '/admin/users'}
                        >
                            Gestionar Usuarios
                        </Button>
                    )}
                </div>
            </div>

            {/* Right Content */}
            <div className="p-8 overflow-y-auto">
                {activeTab === 'General' && (
                    <div className="max-w-md mx-auto">
                       {renderGeneralSettings()}
                    </div>
                )}
                 {activeTab === 'Sampler' && (
                    <div className="max-w-4xl mx-auto">
                        <SamplerPadSettings />
                    </div>
                )}
                 {activeTab === 'Subir Canciones' && (
                    <div className="flex items-center justify-center h-full">
                        {renderUploadSong()}
                    </div>
                )}
                {activeTab === 'About' && (
                    <div className="flex items-center justify-center h-full">
                        {renderAboutSettings()}
                    </div>
                )}
            </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default SettingsDialog;
