import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth';
import { broadcastDM } from '../websocket';
import prisma from '../db';

interface SendDMBody {
  ciphertext: string;
  nonce: string;
}

export async function dmRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /:userId/messages - get DM history between current user and :userId
  fastify.get<{
    Params: { userId: string };
    Querystring: { before?: string; limit?: string };
  }>(
    '/:userId/messages',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { userId: otherUserId } = request.params;
      const currentUserId = request.user.id;
      const limit = Math.min(parseInt(request.query.limit ?? '50', 10), 100);
      const before = request.query.before;

      // Verify the other user exists
      const otherUser = await prisma.user.findUnique({
        where: { id: otherUserId },
        select: { id: true, username: true, publicKey: true },
      });

      if (!otherUser) {
        return reply.status(404).send({ error: 'User not found' });
      }

      const messages = await prisma.directMessage.findMany({
        where: {
          OR: [
            { senderId: currentUserId, recipientId: otherUserId },
            { senderId: otherUserId, recipientId: currentUserId },
          ],
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

      return reply.send(messages.reverse());
    }
  );

  // POST /:userId - send a DM to :userId
  fastify.post<{ Params: { userId: string }; Body: SendDMBody }>(
    '/:userId',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { userId: recipientId } = request.params;
      const { ciphertext, nonce } = request.body;
      const senderId = request.user.id;

      if (senderId === recipientId) {
        return reply.status(400).send({ error: 'Cannot DM yourself' });
      }

      // Verify the recipient exists
      const recipient = await prisma.user.findUnique({
        where: { id: recipientId },
        select: { id: true },
      });

      if (!recipient) {
        return reply.status(404).send({ error: 'Recipient not found' });
      }

      if (!ciphertext || !nonce) {
        return reply.status(400).send({ error: 'ciphertext and nonce are required' });
      }

      const dm = await prisma.directMessage.create({
        data: {
          ciphertext,
          nonce,
          senderId,
          recipientId,
        },
        include: {
          sender: {
            select: { id: true, username: true, publicKey: true },
          },
        },
      });

      const dmPayload = {
        id: dm.id,
        ciphertext: dm.ciphertext,
        nonce: dm.nonce,
        senderId: dm.senderId,
        recipientId: dm.recipientId,
        sender: dm.sender,
        createdAt: dm.createdAt.toISOString(),
      };

      // Broadcast to both sender and recipient
      broadcastDM(senderId, recipientId, {
        type: 'new_dm',
        dm: dmPayload,
      });

      return reply.status(201).send(dmPayload);
    }
  );
}
