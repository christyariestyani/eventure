import { FastifyInstance } from 'fastify';
import { supabase } from '../../lib/db';
import { requireAuth } from '../../middleware/auth';
import bcrypt from 'bcryptjs';

export async function authRoutes(fastify: FastifyInstance) {

  // POST /api/v1/auth/register
  fastify.post('/register', async (request, reply) => {
    const { full_name, email, phone, password } = request.body as any;

    if (!full_name || !email || !password) {
      return reply.status(400).send({ error: 'VALIDATION', message: 'Nama, email, dan password wajib diisi' });
    }
    if (password.length < 8) {
      return reply.status(400).send({ error: 'VALIDATION', message: 'Password minimal 8 karakter' });
    }

    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (existing) {
      return reply.status(409).send({ error: 'EMAIL_TAKEN', message: 'Email sudah terdaftar' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const { data: user, error } = await supabase
      .from('users')
      .insert({
        full_name,
        email: email.toLowerCase().trim(),
        phone: phone ?? null,
        preferences: { password_hash: passwordHash },
      })
      .select('id, email, full_name, avatar_url')
      .single();

    if (error || !user) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'SERVER_ERROR', message: 'Gagal membuat akun' });
    }

    const token = fastify.jwt.sign({ id: user.id, email: user.email }, { expiresIn: '30d' });

    return reply.status(201).send({ data: { user, token } });
  });

  // POST /api/v1/auth/login
  fastify.post('/login', async (request, reply) => {
    const { email, password } = request.body as any;

    if (!email || !password) {
      return reply.status(400).send({ error: 'VALIDATION', message: 'Email dan password wajib diisi' });
    }

    const { data: user } = await supabase
      .from('users')
      .select('id, email, full_name, avatar_url, preferences')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (!user) {
      return reply.status(401).send({ error: 'INVALID_CREDENTIALS', message: 'Email atau password salah' });
    }

    const passwordHash = (user.preferences as any)?.password_hash;
    if (!passwordHash) {
      return reply.status(401).send({ error: 'INVALID_CREDENTIALS', message: 'Email atau password salah' });
    }

    const valid = await bcrypt.compare(password, passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: 'INVALID_CREDENTIALS', message: 'Email atau password salah' });
    }

    const token = fastify.jwt.sign({ id: user.id, email: user.email }, { expiresIn: '30d' });
    const { preferences: _, ...safeUser } = user;

    return reply.send({ data: { user: safeUser, token } });
  });

  // GET /api/v1/auth/me
  fastify.get('/me', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = (request as any).user as { id: string };

    const { data: user } = await supabase
      .from('users')
      .select('id, email, full_name, avatar_url, phone, created_at')
      .eq('id', id)
      .single();

    if (!user) return reply.status(404).send({ error: 'USER_NOT_FOUND' });

    return reply.send({ data: user });
  });
}
