import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth';
import prisma from '../db';

interface CreateServerBody {
  name: string;
  encryptedChannelKey?: string; // base64 encrypted channel key for "general" channel, encrypted with creator's public key
}

export async function serverRoutes(fastify: FastifyInstance): Promise<void> {
  // POST / - create server
  fastify.post<{ Body: CreateServerBody }>(
    '/',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { name, encryptedChannelKey } = request.body;
      const userId = request.user.id;

      if (!name || name.trim().length < 1) {
        return reply.status(400).send({ error: 'Server name is required' });
      }

      // Create server with default "general" channel and creator as owner
      const server = await prisma.$transaction(async (tx) => {
        const newServer = await tx.server.create({
          data: {
            name: name.trim(),
            ownerId: userId,
          },
        });

        const generalChannel = await tx.channel.create({
          data: {
            name: 'general',
            serverId: newServer.id,
            type: 'text',
          },
        });

        // Create encryptedKeys JSON for the creator
        const encryptedKeys = encryptedChannelKey
          ? JSON.stringify({ [generalChannel.id]: encryptedChannelKey })
          : '{}';

        await tx.serverMember.create({
          data: {
            userId,
            serverId: newServer.id,
            role: 'owner',
            encryptedKeys,
          },
        });

        return {
          ...newServer,
          channels: [generalChannel],
          memberCount: 1,
        };
      });

      return reply.status(201).send(server);
    }
  );

  // GET / - list servers where user is a member
  fastify.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user.id;

    const memberships = await prisma.serverMember.findMany({
      where: { userId },
      include: {
        server: {
          include: {
            channels: {
              orderBy: { createdAt: 'asc' },
            },
            _count: {
              select: { members: true },
            },
          },
        },
      },
    });

    const servers = memberships.map((m) => ({
      ...m.server,
      memberCount: m.server._count.members,
      channels: m.server.channels,
    }));

    return reply.send(servers);
  });

  // POST /:id/join - join a server by ID (invite code = server ID for MVP)
  fastify.post<{ Params: { id: string } }>(
    '/:id/join',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id: serverId } = request.params;
      const userId = request.user.id;

      const server = await prisma.server.findUnique({
        where: { id: serverId },
        include: {
          channels: { orderBy: { createdAt: 'asc' } },
          _count: { select: { members: true } },
        },
      });

      if (!server) {
        return reply.status(404).send({ error: 'Server not found' });
      }

      // Check if already a member
      const existing = await prisma.serverMember.findUnique({
        where: { userId_serverId: { userId, serverId } },
      });

      if (existing) {
        return reply.send({
          ...server,
          memberCount: server._count.members,
          alreadyMember: true,
        });
      }

      await prisma.serverMember.create({
        data: {
          userId,
          serverId,
          role: 'member',
          encryptedKeys: '{}',
        },
      });

      return reply.send({
        ...server,
        memberCount: server._count.members + 1,
        alreadyMember: false,
      });
    }
  );

  // GET /:id/members - list members with their public keys
  fastify.get<{ Params: { id: string } }>(
    '/:id/members',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id: serverId } = request.params;
      const userId = request.user.id;

      // Must be a member to see members
      const membership = await prisma.serverMember.findUnique({
        where: { userId_serverId: { userId, serverId } },
      });

      if (!membership) {
        return reply.status(403).send({ error: 'Not a member of this server' });
      }

      const members = await prisma.serverMember.findMany({
        where: { serverId },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              publicKey: true,
            },
          },
        },
      });

      return reply.send(
        members.map((m) => ({
          id: m.id,
          userId: m.userId,
          serverId: m.serverId,
          role: m.role,
          encryptedKeys: m.encryptedKeys,
          user: m.user,
        }))
      );
    }
  );
}
