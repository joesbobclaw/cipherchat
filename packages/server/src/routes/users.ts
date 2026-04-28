import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth';
import prisma from '../db';

export async function userRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /users/search?q=username
  fastify.get<{ Querystring: { q: string } }>(
    '/search',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const q = request.query.q ?? '';
      if (q.length < 1) {
        return reply.send([]);
      }

      const users = await prisma.user.findMany({
        where: {
          username: {
            startsWith: q,
            mode: 'insensitive',
          },
        },
        select: {
          id: true,
          username: true,
          publicKey: true,
          createdAt: true,
        },
        take: 10,
      });

      return reply.send(users);
    }
  );

  // GET /users/:id
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = request.params;

      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          username: true,
          publicKey: true,
          createdAt: true,
        },
      });

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      return reply.send(user);
    }
  );
}
