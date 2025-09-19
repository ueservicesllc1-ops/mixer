
'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User as FirebaseAuthUser, signOut as firebaseSignOut, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { doc, setDoc, getDoc, runTransaction, DocumentData, updateDoc } from 'firebase/firestore';

export type UserRole = 'trial' | 'premium' | 'admin';

// Interfaz extendida para incluir nuestros datos personalizados
export interface AppUser extends FirebaseAuthUser {
    shortId?: string;
    role?: UserRole;
    songsUploadedCount?: number;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const generateAndAssignShortId = async (user: FirebaseAuthUser, existingData: DocumentData = {}): Promise<Partial<AppUser>> => {
    // Si el usuario ya existe y tiene un shortId, no hacemos nada más que devolver los datos.
    if (existingData.shortId) {
        return {
            shortId: existingData.shortId,
            role: existingData.role || 'trial',
            songsUploadedCount: existingData.songsUploadedCount || 0,
        };
    }

    const counterRef = doc(db, 'counters', 'users');
    let newShortId = '';
    let newRole: UserRole = user.email === 'ueservicesllc1@gmail.com' ? 'admin' : 'trial';
    let newSongsUploadedCount = 0;

    try {
        await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            let newCount = 1;
            if (counterDoc.exists()) {
                newCount = (counterDoc.data()?.count || 0) + 1;
            }

            const initial = (user.displayName || user.email || 'U').charAt(0).toUpperCase();
            const paddedCount = String(newCount).padStart(4, '0');
            newShortId = `${initial}${paddedCount}`;
            
            const userData: DocumentData = {
                ...existingData,
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                createdAt: existingData.createdAt || new Date().toISOString(),
                shortId: newShortId,
                role: existingData.role || newRole,
                songsUploadedCount: existingData.songsUploadedCount === undefined ? newSongsUploadedCount : existingData.songsUploadedCount,
            };
            
            transaction.set(counterRef, { count: newCount });
            transaction.set(userRef, userData, { merge: true });
        });
        console.log(`Assigned shortId ${newShortId} to user ${user.uid}`);
        return { shortId: newShortId, role: newRole, songsUploadedCount: newSongsUploadedCount };
    } catch (e) {
        console.error("Transaction failed: ", e);
        return {};
    }
};


const fetchAppUser = async (firebaseUser: FirebaseAuthUser): Promise<AppUser | null> => {
    const userRef = doc(db, 'users', firebaseUser.uid);
    const userSnap = await getDoc(userRef);
    
    let firestoreData;

    if (userSnap.exists()) {
        firestoreData = userSnap.data();
        // Lógica para asignar rol de admin al usuario específico
        if (firebaseUser.email === 'ueservicesllc1@gmail.com' && firestoreData.role !== 'admin') {
            await updateDoc(userRef, { role: 'admin' });
            firestoreData.role = 'admin';
        }
    } else {
        // Esto podría pasar si un usuario existe en Auth pero no en Firestore
        // Lo creamos ahora
        const extraData = await generateAndAssignShortId(firebaseUser);
        firestoreData = { ...extraData };
    }

    return {
        ...firebaseUser,
        shortId: firestoreData.shortId,
        role: firestoreData.role,
        songsUploadedCount: firestoreData.songsUploadedCount,
    };
}


const saveUserToFirestore = async (user: FirebaseAuthUser) => {
    const userRef = doc(db, 'users', user.uid);
    const docSnap = await getDoc(userRef);
    const existingData = docSnap.exists() ? docSnap.data() : {};

    if (!docSnap.exists() || !existingData.shortId) {
       await generateAndAssignShortId(user, existingData);
    } else if (user.email === 'ueservicesllc1@gmail.com' && existingData.role !== 'admin') {
        await updateDoc(userRef, { role: 'admin' });
    }
};

const ProtectedRoutes: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    const publicRoutes = ['/', '/signup'];
    const adminRoutes = ['/admin', '/admin/users'];

    useEffect(() => {
        if (loading) return;

        const isPublicRoute = publicRoutes.includes(pathname);
        const isAdminRoute = adminRoutes.some(route => pathname.startsWith(route));

        if (!user && !isPublicRoute) {
            router.replace('/'); // Redirect to login
        } else if (user && isPublicRoute) {
            router.replace('/daw'); // Redirect to main app
        } else if (user && isAdminRoute && user.role !== 'admin') {
            router.replace('/daw'); // Redirect non-admins from admin routes
        }
    }, [user, loading, router, pathname]);

    // Show loader on initial load or when redirecting from protected routes
    if (loading || (!user && !publicRoutes.includes(pathname)) || (user && publicRoutes.includes(pathname))) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }
    
    // Non-admin trying to access admin route (show loader while redirecting)
    if (user && adminRoutes.some(route => pathname.startsWith(route)) && user.role !== 'admin') {
         return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    return <>{children}</>;
};


export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const appUser = await fetchAppUser(currentUser);
        setUser(appUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      setLoading(true);
      const result = await signInWithPopup(auth, provider);
      await saveUserToFirestore(result.user);
      const appUser = await fetchAppUser(result.user);
      setUser(appUser); // Actualizar el estado con el usuario completo
      router.push('/daw');
    } catch (error) {
      console.error("Error during Google sign-in:", error);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      await firebaseSignOut(auth);
      setUser(null);
      router.push('/');
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      setLoading(false);
    }
  };
  
  const value = {
      user,
      loading,
      signInWithGoogle,
      signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      <ProtectedRoutes>
          {children}
      </ProtectedRoutes>
    </AuthContext.Provider>
  );
};
