import { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import prisma from '../db';

interface RegisterBody {
  username: string;
  password: string;
  publicKey: string;
  encryptedPrivateKey: string;
  salt: string;
}

interface LoginBody {
  username: string;
  password: string;
}

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /register
  fastify.post<{ Body: RegisterBody }>(
    '/register',
    {
      schema: {
        body: {
          type: 'object',
          required: ['username', 'password', 'publicKey', 'encryptedPrivateKey', 'salt'],
          properties: {
            username: { type: 'string', minLength: 2, maxLength: 32 },
            password: { type: 'string', minLength: 8 },
            publicKey: { type: 'string' },
            encryptedPrivateKey: { type: 'string' },
            salt: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { username, password, publicKey, encryptedPrivateKey, salt } = request.body;

      // Check if username is taken
      const existing = await prisma.user.findUnique({ where: { username } });
      if (existing) {
        return reply.status(409).send({ error: 'Username already taken' });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const user = await prisma.user.create({
        data: {
          username,
          passwordHash,
          publicKey,
          encryptedPrivateKey,
          salt,
        },
      });

      const token = fastify.jwt.sign(
        { id: user.id, username: user.username },
        { expiresIn: '30d' }
      );

      return reply.status(201).send({
        token,
        user: {
          id: user.id,
          username: user.username,
          publicKey: user.publicKey,
          createdAt: user.createdAt,
        },
        encryptedPrivateKey: user.encryptedPrivateKey,
        salt: user.salt,
      });
    }
  );

  // POST /login
  fastify.post<{ Body: LoginBody }>(
    '/login',
    {
      schema: {
        body: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: { type: 'string' },
            password: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { username, password } = request.body;

      const user = await prisma.user.findUnique({ where: { username } });
      if (!user) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      const passwordMatch = await bcrypt.compare(password, user.passwordHash);
      if (!passwordMatch) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      const token = fastify.jwt.sign(
        { id: user.id, username: user.username },
        { expiresIn: '30d' }
      );

      return reply.send({
        token,
        user: {
          id: user.id,
          username: user.username,
          publicKey: user.publicKey,
          createdAt: user.createdAt,
        },
        encryptedPrivateKey: user.encryptedPrivateKey,
        salt: user.salt,
      });
    }
  );
}
