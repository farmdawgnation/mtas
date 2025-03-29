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
 * List all users
 */
functions.http('listUsers', async (req: Request, res: Response) => {
  try {
    // Check if request method is GET
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    // Get all users from the database
    const users = await listUsers();
    
    // Return the users
    res.status(200).json({ users });
  } catch (error) {
    console.error('Error listing users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get a user by phone number
 */
functions.http('getUser', async (req: Request, res: Response) => {
  try {
    // Check if request method is GET
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    // Get phone number from URL path
    const phoneNumber = req.path.split('/').pop();
    
    if (!phoneNumber) {
      res.status(400).json({ error: 'Phone number is required' });
      return;
    }

    // Get user by phone number
    const user = await getUserByPhoneNumber(phoneNumber);
    
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    
    // Return the user
    res.status(200).json({ user });
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Add a new user
 * Body: { name: string, phoneNumber: string, roles: Role[] }
 */
functions.http('addUser', async (req: Request, res: Response) => {
  try {
    // Check if request method is POST
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    // Get user details from request body
    const { name, phoneNumber, roles } = req.body;
    
    // Validate request body
    if (!name || !phoneNumber || !roles || !Array.isArray(roles)) {
      res.status(400).json({ error: 'Name, phone number, and roles are required' });
      return;
    }

    // Validate roles
    for (const role of roles) {
      if (!Object.values(Role).includes(role)) {
        res.status(400).json({ error: `Invalid role: ${role}` });
        return;
      }
    }

    // Check if user already exists
    const existingUser = await getUserByPhoneNumber(phoneNumber);
    if (existingUser) {
      res.status(409).json({ error: 'User with this phone number already exists' });
      return;
    }

    // Add the user
    await addUser(name, phoneNumber, roles);
    
    // Return success message
    res.status(201).json({ message: 'User added successfully' });
  } catch (error) {
    console.error('Error adding user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Update a user's roles
 * Body: { roles: Role[] }
 */
functions.http('updateUser', async (req: Request, res: Response) => {
  try {
    // Check if request method is PUT
    if (req.method !== 'PUT') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    // Get phone number from URL path
    const phoneNumber = req.path.split('/').pop();
    
    if (!phoneNumber) {
      res.status(400).json({ error: 'Phone number is required' });
      return;
    }

    // Get roles from request body
    const { roles } = req.body;
    
    // Validate roles
    if (!roles || !Array.isArray(roles)) {
      res.status(400).json({ error: 'Roles are required and must be an array' });
      return;
    }

    for (const role of roles) {
      if (!Object.values(Role).includes(role)) {
        res.status(400).json({ error: `Invalid role: ${role}` });
        return;
      }
    }

    // Update the user's roles
    try {
      await updateUserRoles(phoneNumber, roles);
    } catch (error) {
      if (error instanceof Error && error.message.includes('No user found')) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      throw error;
    }
    
    // Return success message
    res.status(200).json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Delete a user
 */
functions.http('deleteUser', async (req: Request, res: Response) => {
  try {
    // Check if request method is DELETE
    if (req.method !== 'DELETE') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    // Get phone number from URL path
    const phoneNumber = req.path.split('/').pop();
    
    if (!phoneNumber) {
      res.status(400).json({ error: 'Phone number is required' });
      return;
    }

    // Check if user exists
    const existingUser = await getUserByPhoneNumber(phoneNumber);
    if (!existingUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Remove the user
    await removeUser(phoneNumber);
    
    // Return success message
    res.status(200).json({ message: 'User removed successfully' });
  } catch (error) {
    console.error('Error removing user:', error);
    res.status(500).json({ error: 'Internal server error' });
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