
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Home, User, Shield, Crown } from 'lucide-react';
import { getAllUsers, updateUserRole } from '@/actions/users';
import { useToast } from '@/components/ui/use-toast';
import { useAuth, AppUser, UserRole } from '@/contexts/AuthContext';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';

const roleMap: Record<UserRole, { icon: React.ElementType, label: string, color: string }> = {
    trial: { icon: User, label: 'Trial', color: 'bg-gray-500' },
    premium: { icon: Crown, label: 'Premium', color: 'bg-amber-500' },
    admin: { icon: Shield, label: 'Admin', color: 'bg-red-600' },
};

const UsersAdminPage = () => {
    const { user, loading } = useAuth();
    const [users, setUsers] = useState<Partial<AppUser>[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(true);
    const [usersError, setUsersError] = useState<string | null>(null);
    const { toast } = useToast();

    const handleFetchUsers = async () => {
        setIsLoadingUsers(true);
        setUsersError(null);
        try {
            const result = await getAllUsers();
            if (result.success && result.users) {
                setUsers(result.users);
            } else {
                setUsersError(result.error || 'No se pudieron cargar los usuarios.');
            }
        } catch (err) {
            setUsersError('Ocurrió un error al buscar los usuarios.');
        } finally {
            setIsLoadingUsers(false);
        }
    };

    useEffect(() => {
        if (user && user.role === 'admin') {
            handleFetchUsers();
        }
    }, [user]);
    
    const handleRoleChange = async (uid: string, newRole: UserRole) => {
        const result = await updateUserRole(uid, newRole);
        if (result.success) {
            toast({
                title: "Rol actualizado",
                description: "El rol del usuario ha sido cambiado."
            });
            // Update local state to reflect the change
            setUsers(prevUsers => prevUsers.map(u => u.uid === uid ? { ...u, role: newRole } : u));
        } else {
            toast({
                variant: 'destructive',
                title: "Error",
                description: result.error || "No se pudo actualizar el rol."
            });
        }
    }
    
    const getUserInitials = (name: string | null | undefined) => {
        if (!name) return 'U';
        const parts = name.split(' ');
        if (parts.length > 1) {
            return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }


    if (loading || !user) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }
    
    return (
        <div className="h-screen w-full overflow-y-auto">
            <div className="container mx-auto p-4 md:p-8">
                <header className="flex justify-between items-start mb-8">
                    <div>
                        <h1 className="text-3xl font-bold">Gestión de Usuarios</h1>
                        <p className="text-muted-foreground">Administra los usuarios de la plataforma.</p>
                    </div>
                    <Link href="/admin" passHref>
                        <Button variant="outline" className="gap-2">
                            <Home className="w-4 h-4" />
                            Volver al Panel
                        </Button>
                    </Link>
                </header>

                <main>
                    {isLoadingUsers ? (
                        <div className="flex justify-center items-center h-64">
                          <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : usersError ? (
                        <div className="text-destructive text-center p-4">{usersError}</div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Usuario</TableHead>
                                    <TableHead>Short ID</TableHead>
                                    <TableHead>Canciones Subidas</TableHead>
                                    <TableHead>Rol</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.map(u => (
                                    <TableRow key={u.uid}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <Avatar>
                                                    <AvatarImage src={u.photoURL || undefined} />
                                                    <AvatarFallback>{getUserInitials(u.displayName)}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="font-medium">{u.displayName}</p>
                                                    <p className="text-sm text-muted-foreground">{u.email}</p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary">{u.shortId || '-'}</Badge>
                                        </TableCell>
                                        <TableCell>{u.songsUploadedCount ?? 0}</TableCell>
                                        <TableCell>
                                            <Select
                                                defaultValue={u.role}
                                                onValueChange={(newRole: UserRole) => handleRoleChange(u.uid!, newRole)}
                                                disabled={u.uid === user.uid} // No puedes cambiar tu propio rol
                                            >
                                                <SelectTrigger className="w-[180px]">
                                                    <SelectValue placeholder="Seleccionar rol" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {Object.keys(roleMap).map(roleKey => {
                                                        const roleInfo = roleMap[roleKey as UserRole];
                                                        const Icon = roleInfo.icon;
                                                        return (
                                                            <SelectItem key={roleKey} value={roleKey}>
                                                                <div className="flex items-center gap-2">
                                                                    <Icon className="w-4 h-4" />
                                                                    {roleInfo.label}
                                                                </div>
                                                            </SelectItem>
                                                        )
                                                    })}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </main>
            </div>
        </div>
    );
};

export default UsersAdminPage;
