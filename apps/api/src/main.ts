import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Explicit allow-list (comma-separated CORS_ORIGINS or FRONTEND_URL) plus
  // sensible dev defaults: the Next.js web app (3000) and the Expo web dev
  // server (8081).
  const allowedOrigins = (
    process.env.CORS_ORIGINS ??
    process.env.FRONTEND_URL ??
    'http://localhost:3000,http://localhost:8081'
  )
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  // Loopback/LAN origins on the common dev ports — lets the web app and the
  // Expo web build connect from localhost or your machine's LAN IP.
  const devOriginPattern =
    /^https?:\/\/(localhost|127\.0\.0\.1|(?:192\.168|10|172\.(?:1[6-9]|2\d|3[01]))\.\d+\.\d+):(3000|8081)$/;

  app.enableCors({
    origin: (origin, callback) => {
      // No Origin header → native apps (Expo Go / RN), curl, server-to-server.
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || devOriginPattern.test(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Not allowed by CORS: ${origin}`), false);
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );

  await app.listen(process.env.PORT ?? 3333);
}

bootstrap().catch((err) => {
  console.error('Error starting the application:', err);
  process.exit(1);
});
