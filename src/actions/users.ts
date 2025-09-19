
'use server';

import { db } from '@/lib/firebase';
import { collection, getDocs, query, doc, updateDoc } from 'firebase/firestore';
import type { AppUser, UserRole } from '@/contexts/AuthContext';
import { auth as adminAuth } from 'firebase-admin';

// Función para convertir el documento de usuario a un tipo seguro
const processUserDoc = (doc: any): Partial<AppUser> => {
    const data = doc.data();
    return {
        uid: doc.id,
        displayName: data.displayName,
        email: data.email,
        photoURL: data.photoURL,
        shortId: data.shortId,
        role: data.role,
        songsUploadedCount: data.songsUploadedCount,
        createdAt: data.createdAt,
    };
};

// Devuelve todos los usuarios de la aplicación
export async function getAllUsers(): Promise<{ success: boolean; users?: Partial<AppUser>[], error?: string }> {
    try {
        const usersCollection = collection(db, 'users');
        const usersSnapshot = await getDocs(usersCollection);

        const users: Partial<AppUser>[] = usersSnapshot.docs.map(processUserDoc);

        return { success: true, users };
    } catch (error) {
        console.error(`Error obteniendo todos los usuarios:`, error);
        return { success: false, error: (error as Error).message };
    }
}

// Actualiza el rol de un usuario
export async function updateUserRole(uid: string, role: UserRole): Promise<{ success: boolean, error?: string }> {
    try {
        const userRef = doc(db, 'users', uid);
        await updateDoc(userRef, { role: role });
        return { success: true };
    } catch (error) {
        console.error(`Error actualizando el rol para el usuario ${uid}:`, error);
        return { success: false, error: (error as Error).message };
    }
}
