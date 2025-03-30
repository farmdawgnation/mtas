/**
 * Main entry point for the MTAS Google Cloud Functions
 * Export all cloud functions for deployment
 */

// Re-export the functions
export * from './functions';

// Models and services also exported for use by other modules if needed
export * from './models';
export * from './services';