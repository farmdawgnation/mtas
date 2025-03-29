/**
 * Main entry point for the MTAS Google Cloud Functions
 */
import * as functions from '@google-cloud/functions-framework';
import { Firestore } from '@google-cloud/firestore';
import * as twilio from 'twilio';
import { Request, Response } from 'express';

// Define roles for users
enum Role {
  SUBSCRIBER = 'SUBSCRIBER',
  STAFF = 'STAFF',
  ADMIN = 'ADMIN'
}

// Define user interface
interface User {
  name: string;
  phoneNumber: string;
  roles: Role[];
}

// Collections
const NUMBERS_COLLECTION = 'numbers';

// Initialize Firestore
const firestore = new Firestore();

// Initialize Twilio client
const twilioClient = new twilio.Twilio(
  process.env.TWILIO_ACCOUNT_SID as string, 
  process.env.TWILIO_AUTH_TOKEN as string
);

// Twilio phone number for outbound messages
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER as string;

/**
 * Handle incoming SMS messages from Twilio
 * This function processes the incoming SMS message according to the sender's role:
 * - If sender is not recognized or only a SUBSCRIBER, forward to ADMINs
 * - If sender is STAFF or ADMIN, broadcast to all SUBSCRIBERs
 */
functions.http('handleSms', async (req: Request, res: Response) => {
  try {
    // Extract message details from Twilio's webhook
    const from = req.body.From;
    const body = req.body.Body;
    
    console.log(`Received message from ${from}: ${body}`);

    if (!from || !body) {
      res.status(400).send('Missing required parameters');
      return;
    }

    // Get the user associated with this phone number
    const user = await getUserByPhoneNumber(from);
    
    // Process based on user roles
    if (!user || (user.roles.includes(Role.SUBSCRIBER) && 
        !user.roles.includes(Role.STAFF) && 
        !user.roles.includes(Role.ADMIN))) {
      // Forward to admins if sender is not recognized or only a SUBSCRIBER
      await forwardMessageToAdmins(from, body);
      
      // If the user is recognized, send a confirmation
      if (user) {
        await sendSms(from, 'Your message has been forwarded to the administrators.');
      }
    } else if (user.roles.includes(Role.STAFF) || user.roles.includes(Role.ADMIN)) {
      // Broadcast message to all subscribers except the sender
      await broadcastMessage(from, body);
      
      // Send confirmation to sender
      await sendSms(from, 'Your message has been broadcast to all subscribers.');
    }

    // Return a TwiML response to Twilio
    res.setHeader('Content-Type', 'text/xml');
    res.send('<Response></Response>');
  } catch (error) {
    console.error('Error handling SMS:', error);
    res.status(500).send('Internal Server Error');
  }
});

/**
 * Admin function to manage users and roles
 * Format: ADD <name> <phone> <role1,role2>
 * Format: REMOVE <phone>
 * Format: UPDATE <phone> <role1,role2>
 */
functions.http('adminCommand', async (req: Request, res: Response) => {
  try {
    const from = req.body.From;
    const body = req.body.Body;
    
    if (!from || !body) {
      res.status(400).send('Missing required parameters');
      return;
    }

    // Check if the sender is an admin
    const user = await getUserByPhoneNumber(from);
    if (!user || !user.roles.includes(Role.ADMIN)) {
      await sendSms(from, 'You do not have permission to use admin commands.');
      res.setHeader('Content-Type', 'text/xml');
      res.send('<Response></Response>');
      return;
    }

    const parts = body.trim().split(' ');
    const command = parts[0].toUpperCase();

    let result = '';
    
    if (command === 'ADD' && parts.length >= 4) {
      const name = parts[1];
      const phoneNumber = parts[2];
      const roles = parts[3].split(',').map((role: string) => role.toUpperCase()) as Role[];
      
      await addUser(name, phoneNumber, roles);
      result = `Added user ${name} with phone ${phoneNumber} and roles ${roles.join(', ')}`;
    } 
    else if (command === 'REMOVE' && parts.length >= 2) {
      const phoneNumber = parts[1];
      await removeUser(phoneNumber);
      result = `Removed user with phone ${phoneNumber}`;
    }
    else if (command === 'UPDATE' && parts.length >= 3) {
      const phoneNumber = parts[1];
      const roles = parts[2].split(',').map((role: string) => role.toUpperCase()) as Role[];
      
      await updateUserRoles(phoneNumber, roles);
      result = `Updated user ${phoneNumber} with roles ${roles.join(', ')}`;
    }
    else if (command === 'LIST') {
      const users = await listUsers();
      result = `Users in system:\n${users.map(u => `${u.name} (${u.phoneNumber}): ${u.roles.join(', ')}`).join('\n')}`;
    }
    else {
      result = 'Invalid command format. Use ADD, REMOVE, UPDATE, or LIST.';
    }

    // Send result back to admin
    await sendSms(from, result);
    
    res.setHeader('Content-Type', 'text/xml');
    res.send('<Response></Response>');
  } catch (error) {
    console.error('Error handling admin command:', error);
    res.status(500).send('Internal Server Error');
  }
});

/**
 * Helper function to get a user by phone number
 */
async function getUserByPhoneNumber(phoneNumber: string): Promise<User | null> {
  const snapshot = await firestore.collection(NUMBERS_COLLECTION)
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
 * Helper function to add a new user
 */
async function addUser(name: string, phoneNumber: string, roles: Role[]): Promise<void> {
  await firestore.collection(NUMBERS_COLLECTION).add({
    name,
    phoneNumber,
    roles
  });
}

/**
 * Helper function to remove a user
 */
async function removeUser(phoneNumber: string): Promise<void> {
  const snapshot = await firestore.collection(NUMBERS_COLLECTION)
    .where('phoneNumber', '==', phoneNumber)
    .get();

  const batch = firestore.batch();
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });

  await batch.commit();
}

/**
 * Helper function to update a user's roles
 */
async function updateUserRoles(phoneNumber: string, roles: Role[]): Promise<void> {
  const snapshot = await firestore.collection(NUMBERS_COLLECTION)
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
 * Helper function to list all users
 */
async function listUsers(): Promise<User[]> {
  const snapshot = await firestore.collection(NUMBERS_COLLECTION).get();
  return snapshot.docs.map(doc => doc.data() as User);
}

/**
 * Helper function to forward a message to all admins
 */
async function forwardMessageToAdmins(fromNumber: string, message: string): Promise<void> {
  const snapshot = await firestore.collection(NUMBERS_COLLECTION)
    .where('roles', 'array-contains', Role.ADMIN)
    .get();

  const adminPromises = snapshot.docs.map(doc => {
    const admin = doc.data() as User;
    return sendSms(
      admin.phoneNumber, 
      `Message from ${fromNumber}:\n${message}`
    );
  });

  await Promise.all(adminPromises);
}

/**
 * Helper function to broadcast a message to all subscribers except the sender
 */
async function broadcastMessage(fromNumber: string, message: string): Promise<void> {
  const snapshot = await firestore.collection(NUMBERS_COLLECTION)
    .where('roles', 'array-contains', Role.SUBSCRIBER)
    .get();

  const sender = await getUserByPhoneNumber(fromNumber);
  const senderName = sender ? sender.name : fromNumber;

  const broadcastPromises = snapshot.docs
    .map(doc => doc.data() as User)
    .filter(user => user.phoneNumber !== fromNumber) // Exclude the sender
    .map(subscriber => {
      return sendSms(
        subscriber.phoneNumber,
        `Broadcast from ${senderName}:\n${message}`
      );
    });

  await Promise.all(broadcastPromises);
}

/**
 * Helper function to send an SMS using Twilio
 */
async function sendSms(to: string, body: string): Promise<void> {
  await twilioClient.messages.create({
    body,
    from: TWILIO_PHONE_NUMBER,
    to
  });
}