/**
 * Defines the roles available in the system.
 * 
 * - `SUBSCRIBER`: A user who subscribes to the service. These users will receive
 *   messages from the system. They can also send message to supervisors.
 * - `STAFF`: A user who is part of the staff. These users can send messages to
 *    subscribers, but will not receive messages from them.
 * - `SUPERVISOR`: A user who recieved untrusted messages from subscribers and
 *    unrecognized users. These users can send messages to subscribers.
 */
export enum Role {
  SUBSCRIBER = 'SUBSCRIBER',
  STAFF = 'STAFF',
  SUPERVISOR = 'SUPERVISOR',
}