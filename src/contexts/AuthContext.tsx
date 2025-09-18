
'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User as FirebaseAuthUser, signOut as firebaseSignOut, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { doc, setDoc, getDoc, runTransaction } from 'firebase/firestore';

// Interfaz extendida para incluir nuestros datos personalizados
export interface AppUser extends FirebaseAuthUser {
    shortId?: string;
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

const generateAndAssignShortId = async (user: FirebaseAuthUser): Promise<string | null> => {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);

    // Si el usuario ya existe y tiene un shortId, no hacemos nada.
    if (userSnap.exists() && userSnap.data().shortId) {
        return userSnap.data().shortId;
    }

    const counterRef = doc(db, 'counters', 'users');
    let newShortId = '';

    try {
        await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            let newCount;
            if (!counterDoc.exists()) {
                newCount = 1;
            } else {
                newCount = (counterDoc.data().count || 0) + 1;
            }

            const initial = (user.displayName || user.email || 'U').charAt(0).toUpperCase();
            const paddedCount = String(newCount).padStart(4, '0');
            newShortId = `${initial}${paddedCount}`;

            // Actualizar el contador
            transaction.set(counterRef, { count: newCount });

            // Crear o actualizar el documento del usuario con el nuevo shortId
            const userData = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                createdAt: userSnap.exists() ? userSnap.data().createdAt : new Date().toISOString(),
                shortId: newShortId,
            };
            transaction.set(userRef, userData, { merge: true });
        });
        console.log(`Assigned shortId ${newShortId} to user ${user.uid}`);
        return newShortId;
    } catch (e) {
        console.error("Transaction failed: ", e);
        return null;
    }
};


const fetchAppUser = async (firebaseUser: FirebaseAuthUser): Promise<AppUser | null> => {
    const userRef = doc(db, 'users', firebaseUser.uid);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
        const firestoreData = userSnap.data();
        return {
            ...firebaseUser,
            shortId: firestoreData.shortId,
        };
    } else {
        // Esto podría pasar si un usuario existe en Auth pero no en Firestore (caso raro)
        // Lo creamos ahora
        const shortId = await generateAndAssignShortId(firebaseUser);
        return {
            ...firebaseUser,
            shortId: shortId || undefined,
        };
    }
}


const saveUserToFirestore = async (user: FirebaseAuthUser) => {
    const userRef = doc(db, 'users', user.uid);
    const docSnap = await getDoc(userRef);

    if (!docSnap.exists() || !docSnap.data().shortId) {
       await generateAndAssignShortId(user);
    }
};

const ProtectedRoutes: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    const publicRoutes = ['/', '/signup'];

    useEffect(() => {
        if (loading) return;

        const isPublicRoute = publicRoutes.includes(pathname);

        if (!user && !isPublicRoute) {
            router.replace('/'); // Redirect to login
        } else if (user && isPublicRoute) {
            router.replace('/daw'); // Redirect to main app
        }
    }, [user, loading, router, pathname]);

    if (loading && !user) {
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
