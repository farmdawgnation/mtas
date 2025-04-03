/**
 * User management RESTful API using Express
 */
import * as functions from '@google-cloud/functions-framework';
import express, { Request, Response } from 'express';
import { Role } from '../models';
import { 
  listUsers, 
  getUserByPhoneNumber, 
  addUser, 
  updateUserRoles,
  removeUser
} from '../services';

// Create Express app
const app = express();

// Middleware
app.use(express.json());

// Routes
const router = express.Router();

/**
 * List all users
 * GET /api/users
 */
router.get('/users', async (req: Request, res: Response) => {
  try {
    const users = await listUsers();
    res.status(200).json({ users });
  } catch (error) {
    console.error('Error listing users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get a user by phone number
 * GET /api/users/:phoneNumber
 */
router.get('/users/:phoneNumber', async (req: Request, res: Response) => {
  try {
    const { phoneNumber } = req.params;
    
    if (!phoneNumber) {
      res.status(400).json({ error: 'Phone number is required' });
      return;
    }
    
    const user = await getUserByPhoneNumber(phoneNumber);
    
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    
    res.status(200).json({ user });
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Add a new user
 * POST /api/users
 */
router.post('/users', async (req: Request, res: Response) => {
  try {
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
 * PUT /api/users/:phoneNumber
 */
router.put('/users/:phoneNumber', async (req: Request, res: Response) => {
  try {
    const { phoneNumber } = req.params;
    const { roles } = req.body;
    
    if (!phoneNumber) {
      res.status(400).json({ error: 'Phone number is required' });
      return;
    }
    
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
 * DELETE /api/users/:phoneNumber
 */
router.delete('/users/:phoneNumber', async (req: Request, res: Response) => {
  try {
    const { phoneNumber } = req.params;
    
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

// Mount the router to a base path
app.use('/api', router);

// Register the Express app as a Cloud Function
export const userManagementApi = functions.http('userManagementApi', app);