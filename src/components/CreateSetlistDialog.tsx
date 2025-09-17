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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Calendar as CalendarIcon, Loader2, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { saveSetlist } from '@/actions/setlists';
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

interface CreateSetlistDialogProps {
  onSetlistCreated: () => void;
}

const CreateSetlistDialog: React.FC<CreateSetlistDialogProps> = ({ onSetlistCreated }) => {
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const form = useForm<SetlistFormValues>({
    resolver: zodResolver(setlistFormSchema),
    defaultValues: {
      name: '',
      date: new Date(),
    },
  });

  async function onSubmit(data: SetlistFormValues) {
    setIsSaving(true);
    try {
      // NOTA: El userId está hardcodeado. Se deberá reemplazar con el del usuario autenticado.
      const userId = 'user_placeholder_id'; 
      const result = await saveSetlist({ ...data, userId });

      if (result.success) {
        toast({
          title: '¡Éxito!',
          description: 'El setlist ha sido guardado.',
        });
        setOpen(false);
        form.reset({ name: '', date: new Date() });
        onSetlistCreated(); // Llama a la función para refrescar la lista
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full mt-auto gap-2">
            <PlusCircle className="w-4 h-4" />
            Crear nuevo setlist
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Crear nuevo setlist</DialogTitle>
          <DialogDescription>
            Dale un nombre y una fecha a tu nuevo setlist.
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
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateSetlistDialog;
