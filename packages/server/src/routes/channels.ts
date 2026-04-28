import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth';
import prisma from '../db';

interface CreateChannelBody {
  name: string;
  encryptedChannelKey?: string; // encrypted for the creating user
}

interface UpdateKeysBody {
  encryptedKeys: string; // JSON string of channelId -> encryptedKey
}

export async function channelRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /:serverId/channels - list channels
  fastify.get<{ Params: { serverId: string } }>(
    '/:serverId/channels',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { serverId } = request.params;
      const userId = request.user.id;

      const membership = await prisma.serverMember.findUnique({
        where: { userId_serverId: { userId, serverId } },
      });

      if (!membership) {
        return reply.status(403).send({ error: 'Not a member of this server' });
      }

      const channels = await prisma.channel.findMany({
        where: { serverId },
        orderBy: { createdAt: 'asc' },
      });

      return reply.send(channels);
    }
  );

  // POST /:serverId/channels - create channel
  fastify.post<{ Params: { serverId: string }; Body: CreateChannelBody }>(
    '/:serverId/channels',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { serverId } = request.params;
      const { name, encryptedChannelKey } = request.body;
      const userId = request.user.id;

      const membership = await prisma.serverMember.findUnique({
        where: { userId_serverId: { userId, serverId } },
      });

      if (!membership) {
        return reply.status(403).send({ error: 'Not a member of this server' });
      }

      if (!['owner', 'admin'].includes(membership.role)) {
        return reply.status(403).send({ error: 'Only admins can create channels' });
      }

      if (!name || name.trim().length < 1) {
        return reply.status(400).send({ error: 'Channel name is required' });
      }

      const channel = await prisma.$transaction(async (tx) => {
        const newChannel = await tx.channel.create({
          data: {
            name: name.trim().toLowerCase().replace(/\s+/g, '-'),
            serverId,
            type: 'text',
          },
        });

        // Store the encrypted channel key for the creator
        if (encryptedChannelKey) {
          const currentKeys = JSON.parse(membership.encryptedKeys) as Record<string, string>;
          currentKeys[newChannel.id] = encryptedChannelKey;
          await tx.serverMember.update({
            where: { id: membership.id },
            data: { encryptedKeys: JSON.stringify(currentKeys) },
          });
        }

        return newChannel;
      });

      return reply.status(201).send(channel);
    }
  );

  // POST /:serverId/members/keys - update your OWN encrypted keys
  fastify.post<{ Params: { serverId: string }; Body: UpdateKeysBody }>(
    '/:serverId/members/keys',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { serverId } = request.params;
      const { encryptedKeys } = request.body;
      const userId = request.user.id;

      const membership = await prisma.serverMember.findUnique({
        where: { userId_serverId: { userId, serverId } },
      });

      if (!membership) {
        return reply.status(403).send({ error: 'Not a member of this server' });
      }

      // Validate it's valid JSON
      try {
        JSON.parse(encryptedKeys);
      } catch {
        return reply.status(400).send({ error: 'encryptedKeys must be valid JSON' });
      }

      const updated = await prisma.serverMember.update({
        where: { id: membership.id },
        data: { encryptedKeys },
      });

      return reply.send({ encryptedKeys: updated.encryptedKeys });
    }
  );

  // POST /:serverId/members/:userId/keys - admin pushes encrypted keys for a specific user
  fastify.post<{
    Params: { serverId: string; userId: string };
    Body: UpdateKeysBody;
  }>(
    '/:serverId/members/:userId/keys',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { serverId, userId: targetUserId } = request.params;
      const { encryptedKeys } = request.body;
      const requesterId = request.user.id;

      // Requester must be owner or admin
      const requesterMembership = await prisma.serverMember.findUnique({
        where: { userId_serverId: { userId: requesterId, serverId } },
      });

      if (!requesterMembership || !['owner', 'admin'].includes(requesterMembership.role)) {
        return reply.status(403).send({ error: 'Only admins can distribute keys' });
      }

      // Target user must be a member
      const targetMembership = await prisma.serverMember.findUnique({
        where: { userId_serverId: { userId: targetUserId, serverId } },
      });

      if (!targetMembership) {
        return reply.status(404).send({ error: 'Target user is not a member of this server' });
      }

      // Validate JSON
      try {
        JSON.parse(encryptedKeys);
      } catch {
        return reply.status(400).send({ error: 'encryptedKeys must be valid JSON' });
      }

      const updated = await prisma.serverMember.update({
        where: { id: targetMembership.id },
        data: { encryptedKeys },
      });

      return reply.send({ encryptedKeys: updated.encryptedKeys });
    }
  );

  // GET /:serverId/members/me/keys - get your own encrypted channel keys
  fastify.get<{ Params: { serverId: string } }>(
    '/:serverId/members/me/keys',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { serverId } = request.params;
      const userId = request.user.id;

      const membership = await prisma.serverMember.findUnique({
        where: { userId_serverId: { userId, serverId } },
      });

      if (!membership) {
        return reply.status(403).send({ error: 'Not a member of this server' });
      }

      return reply.send({ encryptedKeys: membership.encryptedKeys });
    }
  );
}
