import { randomUUID } from 'node:crypto';
import express from 'express';
import cookieParser from 'cookie-parser';

const cookieName = 'fake-cas';
const cookieOptions = { httpOnly: true, sameSite: 'lax', path: '/' };
const ticketLifetime = 5 * 60 * 1000;
const sessionLifetime = 8 * 60 * 60 * 1000;

export function createApp({ password = process.env.CAS_PASSWORD, noCookie = process.env.NO_COOKIE !== undefined } = {}) {
  const app = express();
  const tickets = new Map();
  const sessions = new Map();

  app.disable('x-powered-by');
  app.use(cookieParser());
  app.use(express.urlencoded({ extended: false, limit: '8kb' }));
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const now = Date.now();
    for (const store of [tickets, sessions]) {
      for (const [id, entry] of store) {
        if (entry.expiresAt <= now) store.delete(id);
      }
    }
    next();
  });

  function finishLogin(req, res, login, primary) {
    if (!req.query.service) return res.sendFile('already.html', { root: import.meta.dirname });
    const ticket = `ST-${randomUUID()}`;
    tickets.set(ticket, { login, service: req.query.service, primary, expiresAt: Date.now() + ticketLifetime });
    const redirect = new URL(req.query.service);
    redirect.searchParams.set('ticket', ticket);
    res.redirect(redirect.href);
  }

  app.all('/login', (req, res, next) => {
    if (req.query.service !== undefined) {
      try {
        if (typeof req.query.service !== 'string') throw new Error();
        const service = new URL(req.query.service);
        if (!['http:', 'https:'].includes(service.protocol) || service.username || service.password) throw new Error();
      } catch {
        return res.status(400).type('text').send('service must be an absolute HTTP(S) URL.');
      }
    }
    next();
  });

  app.get('/login', (req, res) => {
    const session = !noCookie && sessions.get(req.cookies[cookieName]);
    if (session && req.query.renew === undefined) return finishLogin(req, res, session.login, false);
    if (req.query.gateway !== undefined && req.query.renew === undefined && req.query.service) {
      return res.redirect(req.query.service);
    }
    res.sendFile('form.html', { root: import.meta.dirname });
  });

  app.post('/login', (req, res) => {
    const login = req.body?.login;
    if (typeof login !== 'string' || !login.trim() || /[\r\n]/.test(login)) {
      return res.status(400).type('text').send('A non-empty, single-line login is required.');
    }
    if (password && req.body.password !== password) {
      return res.status(401).sendFile('form.html', { root: import.meta.dirname });
    }
    if (!noCookie) {
      sessions.delete(req.cookies[cookieName]);
      const session = randomUUID();
      sessions.set(session, { login, expiresAt: Date.now() + sessionLifetime });
      res.cookie(cookieName, session, { ...cookieOptions, maxAge: sessionLifetime });
    }
    finishLogin(req, res, login, true);
  });

  app.all('/logout', (req, res) => {
    sessions.delete(req.cookies[cookieName]);
    res.clearCookie(cookieName, cookieOptions);
    res.redirect('/login');
  });

  app.get('/validate', (req, res) => {
    const ticket = tickets.get(req.query.ticket);
    tickets.delete(req.query.ticket);
    const valid = ticket && ticket.service === req.query.service &&
      (req.query.renew === undefined || ticket.primary);
    res.type('text').send(valid ? `yes\n${ticket.login}\n` : 'no\n');
  });

  return app;
}

if (import.meta.main) {
  const port = process.env.PORT || 3000;
  createApp().listen(port, () => {
    console.log(`Fake-cas available on http://localhost:${port}`);
  });
}
