/**
 * Main entry point for the MTAS Google Cloud Functions
 */

import * as functions from '@google-cloud/functions-framework';
import { Firestore } from '@google-cloud/firestore';
import * as twilio from 'twilio';
import { Request, Response } from 'express';

// Initialize Firestore
const firestore = new Firestore();

// Initialize Twilio client (commented out until environment variables are set)
// const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

/**
 * Hello World HTTP Cloud Function.
 * This function can be triggered by an HTTP request.
 * 
 * @param req Cloud Function request context.
 * @param res Cloud Function response context.
 */
functions.http('hello', (req: Request, res: Response) => {
  const name = req.query.name as string || req.body?.name as string || 'World';
  
  // Log request for demonstration
  console.log(`Function invoked with name: ${name}`);
  
  // Simple demonstration of the configured clients (not actually using them yet)
  console.log('Firestore client initialized');
  console.log('Twilio client would be initialized with proper environment variables');
  
  // Send response
  res.status(200).send(`Hello, ${name}!`);
});