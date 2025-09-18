
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { updateSetlist, Setlist } from '@/actions/setlists';
import { useToast } from '@/components/ui/use-toast';

const setlistFormSchema = z.object({
  name: z.string().min(2, {
    message: 'El nombre debe tener al menos 2 caracteres.',
  }),
  date: z.date({
    required_error: 'Se requiere una fecha.',
  }),
});

type SetlistFormValues = z.infer<typeof setlistFormSchema>;

interface EditSetlistDialogProps {
  setlist: Setlist;
  isOpen: boolean;
  onClose: () => void;
  onSetlistUpdated: () => void;
}

const EditSetlistDialog: React.FC<EditSetlistDialogProps> = ({ setlist, isOpen, onClose, onSetlistUpdated }) => {
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const form = useForm<SetlistFormValues>({
    resolver: zodResolver(setlistFormSchema),
  });

  useEffect(() => {
    if (setlist) {
      form.reset({
        name: setlist.name,
        date: new Date(setlist.date),
      });
    }
  }, [setlist, form]);

  async function onSubmit(data: SetlistFormValues) {
    setIsSaving(true);
    try {
      const result = await updateSetlist(setlist.id, data);

      if (result.success) {
        toast({
          title: '¡Éxito!',
          description: 'El setlist ha sido actualizado.',
        });
        onSetlistUpdated();
        onClose();
      } else {
        throw new Error(result.error || 'Error desconocido al guardar.');
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error al guardar',
        description: (error as Error).message,
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Setlist</DialogTitle>
          <DialogDescription>
            Cambia el nombre o la fecha de tu setlist.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid gap-4 py-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="grid grid-cols-4 items-center gap-4">
                    <FormLabel className="text-right">Nombre</FormLabel>
                    <FormControl>
                      <Input {...field} className="col-span-3" />
                    </FormControl>
                    <FormMessage className="col-span-4 text-right" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="grid grid-cols-4 items-center gap-4">
                    <FormLabel className="text-right">Fecha</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={'outline'}
                            className={cn(
                              'col-span-3 justify-start text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? (
                              format(field.value, 'PPP')
                            ) : (
                              <span>Elige una fecha</span>
                            )}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage className="col-span-4 text-right" />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
               <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>Cancelar</Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar Cambios
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default EditSetlistDialog;
