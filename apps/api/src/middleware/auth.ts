import { FastifyRequest, FastifyReply } from 'fastify';

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    reply.status(401).send({ error: 'Unauthorized' });
  }
}

export async function optionalAuth(request: FastifyRequest) {
  try {
    await request.jwtVerify();
  } catch {
    // No-op — user stays unauthenticated
  }
}
