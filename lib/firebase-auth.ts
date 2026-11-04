import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  getIdTokenResult,
  updateProfile,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import { auth, db } from './firebase-config';
import { setDocument, getDocument, updateDocument } from './firebase-db';
import { User } from '@/types/firebase';

// Setup persistence
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error('Error setting persistence:', error);
  });
}

// Create user account
export async function registerUser(
  email: string,
  password: string,
  userData: Omit<User, 'id' | 'email' | 'createdAt' | 'updatedAt' | 'active' | 'lastLogin'>
): Promise<FirebaseUser> {
  try {
    // Create Firebase Auth user
    const { user } = await createUserWithEmailAndPassword(auth, email, password);

    // Create user document in Firestore
    await setDocument<User>(
      'users',
      user.uid,
      {
        email,
        ...userData,
        active: true,
        createdAt: new Date() as any,
        updatedAt: new Date() as any,
      },
      false
    );

    return user;
  } catch (error) {
    console.error('Error registering user:', error);
    throw error;
  }
}

// Sign in user
export async function loginUser(email: string, password: string): Promise<FirebaseUser> {
  try {
    const { user } = await signInWithEmailAndPassword(auth, email, password);

    // Update last login
    await updateDocument('users', user.uid, {
      lastLogin: new Date() as any,
    });

    return user;
  } catch (error) {
    console.error('Error signing in:', error);
    throw error;
  }
}

// Sign out user
export async function logoutUser(): Promise<void> {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
}

// Get current user
export function getCurrentUser(): FirebaseUser | null {
  return auth.currentUser;
}

// Get current user as promise
export function getCurrentUserAsync(): Promise<FirebaseUser | null> {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

// Get user data from Firestore
export async function getUserData(userId: string): Promise<User | null> {
  try {
    return await getDocument<User>('users', userId);
  } catch (error) {
    console.error('Error getting user data:', error);
    return null;
  }
}

// Get user role
export async function getUserRole(userId: string): Promise<string | null> {
  try {
    const user = await getUserData(userId);
    return user?.role || null;
  } catch (error) {
    console.error('Error getting user role:', error);
    return null;
  }
}

// Check if user is admin
export async function isUserAdmin(userId: string): Promise<boolean> {
  try {
    const role = await getUserRole(userId);
    return role === 'admin';
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

// Check if user belongs to company
export async function userBelongsToCompany(userId: string, companyId: string): Promise<boolean> {
  try {
    const user = await getUserData(userId);
    return user?.companyId === companyId;
  } catch (error) {
    console.error('Error checking company membership:', error);
    return false;
  }
}

// Update user profile
export async function updateUserProfile(
  userId: string,
  updates: Partial<Omit<User, 'id' | 'email' | 'createdAt'>>
): Promise<void> {
  try {
    // Update Firestore document
    await updateDocument('users', userId, {
      ...updates,
      updatedAt: new Date() as any,
    });

    // Update Firebase Auth profile if name changed
    const currentUser = getCurrentUser();
    if (currentUser && (updates.firstName || updates.lastName)) {
      const displayName = `${updates.firstName || ''} ${updates.lastName || ''}`.trim();
      await updateProfile(currentUser, { displayName });
    }
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
}

// Get user's custom claims (roles, permissions)
export async function getUserClaims(userId: string): Promise<Record<string, any>> {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser || currentUser.uid !== userId) {
      throw new Error('Unauthorized');
    }

    const idTokenResult = await getIdTokenResult(currentUser);
    return idTokenResult.claims;
  } catch (error) {
    console.error('Error getting user claims:', error);
    return {};
  }
}

// Auth state listener
export function onAuthChange(callback: (user: FirebaseUser | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}
