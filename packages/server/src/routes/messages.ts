import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth';
import { broadcastToChannel } from '../websocket';
import prisma from '../db';

interface SendMessageBody {
  ciphertext: string;
  nonce: string;
}

export async function messageRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /:channelId/messages - paginated message history
  fastify.get<{
    Params: { channelId: string };
    Querystring: { before?: string; limit?: string };
  }>(
    '/:channelId/messages',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { channelId } = request.params;
      const limit = Math.min(parseInt(request.query.limit ?? '50', 10), 100);
      const before = request.query.before;
      const userId = request.user.id;

      // Check that user is a member of the server that owns this channel
      const channel = await prisma.channel.findUnique({
        where: { id: channelId },
        include: { server: { include: { members: { where: { userId } } } } },
      });

      if (!channel) {
        return reply.status(404).send({ error: 'Channel not found' });
      }

      if (channel.server.members.length === 0) {
        return reply.status(403).send({ error: 'Not a member of this server' });
      }

      const messages = await prisma.message.findMany({
        where: {
          channelId,
          ...(before ? { createdAt: { lt: new Date(before) } } : {}),
        },
        include: {
          sender: {
            select: { id: true, username: true, publicKey: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      // Return in ascending order (oldest first)
      return reply.send(messages.reverse());
    }
  );

  // POST /:channelId/messages - send a message
  fastify.post<{ Params: { channelId: string }; Body: SendMessageBody }>(
    '/:channelId/messages',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { channelId } = request.params;
      const { ciphertext, nonce } = request.body;
      const userId = request.user.id;

      // Check that user is a member of the server that owns this channel
      const channel = await prisma.channel.findUnique({
        where: { id: channelId },
        include: { server: { include: { members: { where: { userId } } } } },
      });

      if (!channel) {
        return reply.status(404).send({ error: 'Channel not found' });
      }

      if (channel.server.members.length === 0) {
        return reply.status(403).send({ error: 'Not a member of this server' });
      }

      if (!ciphertext || !nonce) {
        return reply.status(400).send({ error: 'ciphertext and nonce are required' });
      }

      const message = await prisma.message.create({
        data: {
          ciphertext,
          nonce,
          channelId,
          senderId: userId,
        },
        include: {
          sender: {
            select: { id: true, username: true, publicKey: true },
          },
        },
      });

      // Broadcast to all channel subscribers
      broadcastToChannel(channelId, {
        type: 'new_message',
        channelId,
        message: {
          id: message.id,
          ciphertext: message.ciphertext,
          nonce: message.nonce,
          channelId: message.channelId,
          senderId: message.senderId,
          sender: message.sender,
          createdAt: message.createdAt.toISOString(),
        },
      });

      return reply.status(201).send({
        ...message,
        createdAt: message.createdAt.toISOString(),
      });
    }
  );
}
