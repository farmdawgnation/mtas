/**
 * User management functions
 */
import * as functions from '@google-cloud/functions-framework';
import { Request, Response } from 'express';
import { Role } from '../models';
import { 
  listUsers, 
  getUserByPhoneNumber, 
  addUser, 
  updateUserRoles,
  removeUser
} from '../services';

/**
 * List all users
 */
export const listUsersFunction = async (req: Request, res: Response) => {
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
};

/**
 * Get a user by phone number
 */
export const getUserFunction = async (req: Request, res: Response) => {
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
};

/**
 * Add a new user
 */
export const addUserFunction = async (req: Request, res: Response) => {
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
};

/**
 * Update a user's roles
 */
export const updateUserFunction = async (req: Request, res: Response) => {
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
};

/**
 * Delete a user
 */
export const deleteUserFunction = async (req: Request, res: Response) => {
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
};

// Register the Cloud Functions
functions.http('listUsers', listUsersFunction);
functions.http('getUser', getUserFunction);
functions.http('addUser', addUserFunction);
functions.http('updateUser', updateUserFunction);
functions.http('deleteUser', deleteUserFunction);