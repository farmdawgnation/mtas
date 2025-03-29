# MTAS (My Twilio Application Service)

A TypeScript service designed to run on Google Cloud Run Functions that integrates with Twilio and Firestore.

## Project Structure

```
mtas/
├── src/                   # Source code
│   └── index.ts           # Main entry point with Cloud Functions (TypeScript)
├── build/                 # Compiled JavaScript output (generated)
│   └── index.js           # Compiled JavaScript code
├── package.json           # Node.js dependencies and scripts
├── package-lock.json      # Lock file for dependencies
├── tsconfig.json          # TypeScript configuration
└── README.md              # This file
```

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

# Run the hello function locally
npx @google-cloud/functions-framework --target=hello --source=build
```

## Deploying to Google Cloud

Before deploying, make sure to build your TypeScript code:

```bash
# Build the TypeScript code
npm run build
```

Then deploy using gcloud:

```bash
gcloud functions deploy hello \
  --gen2 \
  --runtime=nodejs22 \
  --region=us-central1 \
  --source=. \
  --entry-point=hello \
  --trigger-http \
  --allow-unauthenticated
```

Note: The deployment process will detect and use the TypeScript configuration to build your code. The entry point should reference the function name exported from your built JavaScript files.

## License

[Add your license information here]