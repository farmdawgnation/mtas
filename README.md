# MTAS (Multi Tenant Alert Service)

I volunteer on with various organizations that are nonprofits and frequently have stakeholders of one kind
or another that need to be notified quickly in the event something is happening that requires a quick reaction
from folks at a location. One example of this is a nonprofit that has tenants which needs an efficient way for
trusted volunteers or staff members to boradcast alerts about utilities in the building as needed.

There are a few moving parts that are involved here:

* GCP Cloud Run Functions is where the logic actually runs. Twilio will send HTTP requests into an endpoint
  running in Functions when SMS control messages are received. It will then, depending on the request, issue
  Twilio API requests to broadcast messsages or make changes to the data in Cloud Firestore.
* GCP Cloud Firestore is used to store the current database of numbers in a single "numbers" collection. Each
  document within the collection consists of a name associated with the contact, a phone number, and one or more
  roles
  * The `SUBSCRIBER` role means that a number will receive notifications sent to the system.
  * The `STAFF` role means that a number can broadcast messages to subscribers.
  * The `ADMIN` role means that a number can add and remove users and roles.
* Twilio provides the SMS infrastructure.

When an inbound message is received from Twilio, is is checked against a few different rules to determine what
action should be taken. Specifically:

* If the number inbound is not recognized or only is a `SUBSCRIBER`, the message will be forwarded to numbers
  with the `ADMIN` role.
* If the number inbound is a `STAFF` or `ADMIN` role the message will be broadcast to all users, except the
  inbound number. Confirmation the messages have been sent will then be transmitted back to the inbound number.

## Admin API

The system provides an API for managing users in the system. The following functions are available:

### List Users
- **Function**: `listUsers`
- **Method**: GET
- **Description**: Returns a list of all users in the system
- **Response**: JSON object containing an array of users

### Get User
- **Function**: `getUser`
- **Method**: GET
- **Description**: Returns information about a specific user by phone number
- **Parameters**: Phone number (extracted from the path)
- **Response**: JSON object containing user details or an error message

### Add User
- **Function**: `addUser`
- **Method**: POST
- **Description**: Adds a new user to the system
- **Request Body**: 
  ```json
  {
    "name": "User Name",
    "phoneNumber": "+1234567890",
    "roles": ["SUBSCRIBER", "STAFF", "ADMIN"]
  }
  ```
- **Response**: JSON object with success message or error details

### Update User
- **Function**: `updateUser`
- **Method**: PUT
- **Description**: Updates a user's roles
- **Parameters**: Phone number (extracted from the path)
- **Request Body**:
  ```json
  {
    "roles": ["SUBSCRIBER", "STAFF"]
  }
  ```
- **Response**: JSON object with success message or error details

### Delete User
- **Function**: `deleteUser`
- **Method**: DELETE
- **Description**: Removes a user from the system
- **Parameters**: Phone number (extracted from the path)
- **Response**: JSON object with success message or error details

## Prerequisites

- Node.js 22.x
- Google Cloud SDK
- A Google Cloud Platform project with Cloud Functions and Firestore enabled
- Twilio account credentials

## Development Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Set up environment variables (for local development):
   ```
   export TWILIO_ACCOUNT_SID=your_account_sid
   export TWILIO_AUTH_TOKEN=your_auth_token
   ```

## Running Locally

You can test your Cloud Functions locally using the Functions Framework with the provided npm scripts:

```bash
# Build and start the function
npm start

# Or for development with auto-reloading on changes
npm run dev

# Then visit http://localhost:8080 in your browser or use curl:
curl http://localhost:8080
```

You can also run the functions directly using the Functions Framework after building:

```bash
# Build the TypeScript code
npm run build

# Run a specific function locally (replace 'handleSms' with any function name)
npx @google-cloud/functions-framework --target=handleSms --source=build
```

## Deploying to Google Cloud

Before deploying, make sure to build your TypeScript code:

```bash
# Build the TypeScript code
npm run build
```

Then deploy using gcloud:

```bash
gcloud functions deploy handleSms \
  --gen2 \
  --runtime=nodejs22 \
  --region=us-central1 \
  --source=. \
  --entry-point=handleSms \
  --trigger-http \
  --allow-unauthenticated
```

Note: You need to deploy each function separately. Replace `handleSms` with the name of the function you want to deploy, such as `listUsers`, `getUser`, etc.

## License

[Add your license information here]