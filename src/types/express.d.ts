import 'express-serve-static-core';

declare module 'express-serve-static-core' {
  interface Request {
    /** Set by API-key middleware */
    auth?: {
      apiKey: string;
      // scopes?: string[]; // add more fields if needed
    };
  }
}

export {}; // make this file a module
