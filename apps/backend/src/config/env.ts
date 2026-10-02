import dotenv from 'dotenv';
dotenv.config();

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`CRITICAL: ${name} is missing in your .env file!`);
  }
  return value;
};

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: requireEnv('DATABASE_URL'),
  jwtSecret: requireEnv('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  githubClientId: process.env.GITHUB_CLIENT_ID,
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET,
  corsOrigin: process.env.FRONTEND_URL || 'http://localhost:5173',
  scrapers: {
    youtubeApiKey: process.env.YOUTUBE_API_KEY,
    redditClientId: process.env.REDDIT_CLIENT_ID,
    redditClientSecret: process.env.REDDIT_CLIENT_SECRET,
  },
  // Object storage for student uploads. The defaults match docker-compose.yml
  // (Minikio on the host); production must set every one of these.
  storage: {
    endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
    region: process.env.S3_REGION || 'us-east-1',
    bucket: process.env.S3_BUCKET || 'techtalk-documents',
    accessKeyId: process.env.S3_ACCESS_KEY_ID || 'teachtalk',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || 'techtalk_secret',
    maxUploadBytes: parseInt(process.env.MAX_UPLOAD_MB || '25', 10) * 1024 * 1024,
    signedUrlTtlSeconds: parseInt(process.env.SIGNED_URL_TTL_SECONDS || '300', 10),
  },
};
