
'use client';

import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from './ui/button';
import { Crown, CheckCircle, Zap } from 'lucide-react';

interface PremiumUpsellDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const PremiumUpsellDialog: React.FC<PremiumUpsellDialogProps> = ({ isOpen, onClose, onConfirm }) => {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader className="text-center items-center">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-4 border border-amber-500/30">
            <Crown className="w-8 h-8 text-amber-500" />
          </div>
          <AlertDialogTitle className="text-2xl">Desbloquea el Potencial Completo</AlertDialogTitle>
          <AlertDialogDescription className="max-w-md mx-auto pt-2">
            ¡Has alcanzado el límite de la versión de prueba! Mejora a Premium para obtener acceso ilimitado y funciones avanzadas.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-4 space-y-3 text-sm">
            <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                    <h4 className="font-semibold text-foreground">Canciones Ilimitadas</h4>
                    <p className="text-muted-foreground">Sube y gestiona toda tu biblioteca de canciones sin restricciones.</p>
                </div>
            </div>
            <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                    <h4 className="font-semibold text-foreground">Setlists Ilimitados</h4>
                    <p className="text-muted-foreground">Crea todos los setlists que necesites para tus eventos.</p>
                </div>
            </div>
            <div className="flex items-start gap-3">
                <Zap className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                    <h4 className="font-semibold text-foreground">Funciones IA Avanzadas</h4>
                    <p className="text-muted-foreground">Acceso prioritario a nuevas herramientas de IA como transcripción y sincronización de letras.</p>
                </div>
            </div>
        </div>

        <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2 mt-4">
          <AlertDialogCancel asChild>
            <Button variant="outline" onClick={onClose}>Continuar Prueba</Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
             <Button className="bg-amber-500 hover:bg-amber-600 gap-2" onClick={onConfirm}>
                <Crown className="w-4 h-4"/>
                Suscribirse a Premium
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default PremiumUpsellDialog;
