import { Role } from './Role';

/**
 * A User is someone who is registered in the mtas system somehow. Users are
 * capable of having multiple roles. The roles are defined in the Role model.
 */
export interface User {
  name: string;
  phoneNumber: string;
  roles: Role[];
}