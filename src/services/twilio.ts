/**
 * Twilio service for sending SMS messages
 */
import * as twilio from 'twilio';
import { Role } from '../models';
import { getUserByPhoneNumber } from './firestore';

// Initialize Twilio client
const twilioClient = new twilio.Twilio(
  process.env.TWILIO_ACCOUNT_SID as string, 
  process.env.TWILIO_AUTH_TOKEN as string
);

// Twilio phone number for outbound messages
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER as string;

/**
 * Send an SMS using Twilio
 */
export async function sendSms(to: string, body: string): Promise<void> {
  await twilioClient.messages.create({
    body,
    from: TWILIO_PHONE_NUMBER,
    to
  });
}

/**
 * Forward a message to all admins
 */
export async function forwardMessageToAdmins(fromNumber: string, message: string): Promise<void> {
  const { listUsersByRole } = await import('./firestore');
  const admins = await listUsersByRole(Role.ADMIN);

  const adminPromises = admins.map(admin => {
    return sendSms(
      admin.phoneNumber, 
      `Message from ${fromNumber}:\n${message}`
    );
  });

  await Promise.all(adminPromises);
}

/**
 * Broadcast a message to all subscribers except the sender
 */
export async function broadcastMessage(fromNumber: string, message: string): Promise<void> {
  const { listUsersByRole } = await import('./firestore');
  const subscribers = await listUsersByRole(Role.SUBSCRIBER);

  const sender = await getUserByPhoneNumber(fromNumber);
  const senderName = sender ? sender.name : fromNumber;

  const broadcastPromises = subscribers
    .filter(user => user.phoneNumber !== fromNumber) // Exclude the sender
    .map(subscriber => {
      return sendSms(
        subscriber.phoneNumber,
        `Broadcast from ${senderName}:\n${message}`
      );
    });

  await Promise.all(broadcastPromises);
}