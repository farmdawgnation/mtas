/**
 * Handle incoming SMS messages from Twilio
 */
import * as functions from '@google-cloud/functions-framework';
import { Request, Response } from 'express';
import { Role } from '../models';
import { 
  getUserByPhoneNumber, 
  forwardMessageToSupervisor,
  broadcastMessage, 
  sendSms 
} from '../services';

/**
 * Handle incoming SMS messages from Twilio
 * This function processes the incoming SMS message according to the sender's role:
 * - If sender is not recognized or only a SUBSCRIBER, forward to ADMINs
 * - If sender is STAFF or ADMIN, broadcast to all SUBSCRIBERs
 */
export const handleSmsFunction = async (req: Request, res: Response) => {
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
        !user.roles.includes(Role.SUPERVISOR))) {
      // Forward to admins if sender is not recognized or only a SUBSCRIBER
      await forwardMessageToSupervisor(from, body);
      
      // If the user is recognized, send a confirmation
      if (user) {
        await sendSms(from, 'Your message has been forwarded to the administrators.');
      }
    } else if (user.roles.includes(Role.STAFF) || user.roles.includes(Role.SUPERVISOR)) {
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
};

// Register the Cloud Function
functions.http('handleSms', handleSmsFunction);