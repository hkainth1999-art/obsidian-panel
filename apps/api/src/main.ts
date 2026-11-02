// Enable BigInt serialization to JSON across all controllers and responses
(BigInt.prototype as any).toJSON = function () {
  const int = Number.parseInt(this.toString(), 10);
  return Number.isNaN(int) ? this.toString() : int;
};

import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { SecurityService } from './modules/security/security.service';

async function bootstrap() {
  const fastifyAdapter = new FastifyAdapter({
    trustProxy: true,
    logger: false,
    bodyLimit: 104857600, // 100MB (100 * 1024 * 1024 bytes)
  });

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    fastifyAdapter,
  );

  // Register application/octet-stream parser up to 100MB for direct file/plugin uploads
  const fastifyInstance = app.getHttpAdapter().getInstance();
  fastifyInstance.addContentTypeParser(
    'application/octet-stream',
    { parseAs: 'buffer', bodyLimit: 104857600 },
    (_req: any, body: any, done: any) => {
      done(null, body);
    },
  );

  // Global DDoS Protection, IP Ban Filtering, and Live Request Tracker
  const securityService = app.get(SecurityService);

  fastifyInstance.addHook('onRequest', async (req: any, reply: any) => {
    // Resolve client IP (supporting Cloudflare CF-Connecting-IP, X-Forwarded-For, and standard proxy)
    const clientIp =
      (req.headers && req.headers['cf-connecting-ip']) ||
      (req.headers && req.headers['x-forwarded-for']
        ? String(req.headers['x-forwarded-for']).split(',')[0]!.trim()
        : '') ||
      req.ip ||
      '127.0.0.1';

    const filterResult = securityService.recordAndFilterRequest(
      clientIp,
      req.method,
      req.url,
      req.headers?.['user-agent'] ?? '',
    );

    if (!filterResult.allowed) {
      const isBan = filterResult.reason?.includes('firewall');
      reply
        .code(isBan ? 403 : 429)
        .header('Content-Type', 'application/json; charset=utf-8')
        .send({
          statusCode: isBan ? 403 : 429,
          error: isBan ? 'Forbidden' : 'Too Many Requests',
          message: filterResult.reason,
        });
      return reply;
    }
  });

  fastifyInstance.addHook('onResponse', async (req: any, reply: any) => {
    const clientIp =
      (req.headers && req.headers['cf-connecting-ip']) ||
      (req.headers && req.headers['x-forwarded-for']
        ? String(req.headers['x-forwarded-for']).split(',')[0]!.trim()
        : '') ||
      req.ip ||
      '127.0.0.1';

    securityService.logCompletedRequest(
      clientIp,
      req.method,
      req.url,
      reply.statusCode,
      req.headers?.['user-agent'] ?? '',
    );
  });

  fastifyInstance.addHook('onSend', async (_req: any, reply: any) => {
    // Hide server identity and origin fingerprinting
    reply.removeHeader('X-Powered-By');
    reply.removeHeader('Server');
  });

  // Security headers
  // Helmet is registered as Fastify plugin
  await app.register(import('@fastify/helmet') as any, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'wss:'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true },
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });

  // Fastify Cookie plugin
  await app.register(import('@fastify/cookie') as any, {
    secret: process.env.SESSION_SECRET ?? 'obsidian-panel-session-secret-key-32',
  });

  // CORS — tight by default
  app.enableCors({
    origin: process.env.APP_URL ?? 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Request-ID'],
  });

  // OpenAPI Documentation
  const config = new DocumentBuilder()
    .setTitle('Obsidian Panel API')
    .setDescription('Game server management panel API with Wings compatibility')
    .setVersion('0.1.0')
    .addBearerAuth()
    .addCookieAuth('session')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Global crash & error logging before watchdog restart
  process.on('uncaughtException', (err) => {
    Logger.error(`Uncaught exception in Obsidian API: ${err.message}`, err.stack, 'CrashHandler');
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: any) => {
    Logger.error(`Unhandled rejection in Obsidian API: ${reason?.message || reason}`, reason?.stack, 'CrashHandler');
  });

  const port = parseInt(process.env.PORT ?? process.env.API_PORT ?? '3001', 10);
  const host = process.env.API_HOST ?? '0.0.0.0';

  await app.listen(port, host);
  Logger.log(`🔮 Obsidian Panel API running on ${host}:${port}`, 'Bootstrap');
  Logger.log(`📖 API docs available at http://${host}:${port}/api/docs`, 'Bootstrap');
}

bootstrap();
