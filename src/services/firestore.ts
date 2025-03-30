/**
 * Firestore service for database operations
 */
import { Firestore } from '@google-cloud/firestore';
import { User, Role } from '../models';

// Initialize Firestore
const firestore = new Firestore();

// Collections
const USERS_COLLECTION = 'users';

/**
 * Get a user by phone number
 */
export async function getUserByPhoneNumber(phoneNumber: string): Promise<User | null> {
  const snapshot = await firestore.collection(USERS_COLLECTION)
    .where('phoneNumber', '==', phoneNumber)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return doc.data() as User;
}

/**
 * Add a new user
 */
export async function addUser(name: string, phoneNumber: string, roles: Role[]): Promise<void> {
  await firestore.collection(USERS_COLLECTION).add({
    name,
    phoneNumber,
    roles
  });
}

/**
 * Remove a user
 */
export async function removeUser(phoneNumber: string): Promise<void> {
  const snapshot = await firestore.collection(USERS_COLLECTION)
    .where('phoneNumber', '==', phoneNumber)
    .get();

  const batch = firestore.batch();
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });

  await batch.commit();
}

/**
 * Update a user's roles
 */
export async function updateUserRoles(phoneNumber: string, roles: Role[]): Promise<void> {
  const snapshot = await firestore.collection(USERS_COLLECTION)
    .where('phoneNumber', '==', phoneNumber)
    .get();

  if (snapshot.empty) {
    throw new Error(`No user found with phone number ${phoneNumber}`);
  }

  const batch = firestore.batch();
  snapshot.docs.forEach(doc => {
    batch.update(doc.ref, { roles });
  });

  await batch.commit();
}

/**
 * List all users
 */
export async function listUsers(): Promise<User[]> {
  const snapshot = await firestore.collection(USERS_COLLECTION).get();
  return snapshot.docs.map(doc => doc.data() as User);
}

/**
 * List users by a specific role
 */
export async function listUsersByRole(role: Role): Promise<User[]> {
  const snapshot = await firestore.collection(USERS_COLLECTION)
    .where('roles', 'array-contains', role)
    .get();
    
  return snapshot.docs.map(doc => doc.data() as User);
}