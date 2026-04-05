import dotenv from 'dotenv';
import path from 'path';

// Load test environment before anything else
dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });