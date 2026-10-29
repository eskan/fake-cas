import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createApp } from './server.js';

const service = 'http://localhost:8080/callback?next=%2Fhome#section';

async function start(t, options = {}) {
  const server = createApp({ password: '', noCookie: false, ...options }).listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  await once(server, 'listening');
  return (path, options) => fetch(`http://127.0.0.1:${server.address().port}${path}`, {
    redirect: 'manual', ...options,
  });
}

function login(request, fields = { login: 'alice' }, target = service) {
  return request(`/login?${new URLSearchParams({ service: target })}`, {
    method: 'POST', body: new URLSearchParams(fields),
  });
}

function ticketFrom(response) {
  assert.equal(response.status, 302);
  return new URL(response.headers.get('location')).searchParams.get('ticket');
}

async function validate(request, ticket, target = service, extra = {}) {
  const response = await request(`/validate?${new URLSearchParams({ ticket, service: target, ...extra })}`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^text\/plain/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  return response.text();
}

test('login redirects with existing query and fragment; validation is single-use', async t => {
  const request = await start(t);
  const response = await login(request);
  const redirect = new URL(response.headers.get('location'));
  assert.equal(redirect.searchParams.get('next'), '/home');
  assert.equal(redirect.hash, '#section');
  const ticket = ticketFrom(response);
  assert.match(ticket, /^ST-/);
  assert.equal(await validate(request, ticket), 'yes\nalice\n');
  assert.equal(await validate(request, ticket), 'no\n');
});

test('a wrong or missing service consumes the ticket', async t => {
  const request = await start(t);
  for (const target of ['https://other.example', '']) {
    const ticket = ticketFrom(await login(request));
    const path = `/validate?ticket=${ticket}` + (target ? `&service=${encodeURIComponent(target)}` : '');
    assert.equal(await (await request(path)).text(), 'no\n');
    assert.equal(await validate(request, ticket), 'no\n');
  }
  assert.equal(await (await request('/validate')).text(), 'no\n');
  assert.equal(await validate(request, 'ST-unknown'), 'no\n');
});

test('SSO reuses the session and logout invalidates it', async t => {
  const request = await start(t);
  const response = await login(request);
  const setCookie = response.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Lax/);
  const headers = { cookie: setCookie.split(';')[0] };
  const sso = await request(`/login?service=${encodeURIComponent(service)}`, { headers });
  assert.equal(await validate(request, ticketFrom(sso)), 'yes\nalice\n');
  assert.match(await (await request('/login', { headers })).text(), /You're authenticated/);
  const logout = await request('/logout', { method: 'POST', headers });
  assert.equal(logout.headers.get('location'), '/login');
  assert.match(logout.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/);
  assert.match(await (await request('/login', { headers })).text(), /id="login"/);
});

test('password and NO_COOKIE configuration', async t => {
  const request = await start(t, { password: 'secret', noCookie: true });
  for (const fields of [{ login: 'alice' }, { login: 'alice', password: 'wrong' }]) {
    const response = await login(request, fields);
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('set-cookie'), null);
    assert.equal(response.headers.get('location'), null);
  }
  const response = await login(request, { login: 'alice', password: 'secret' });
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal(await validate(request, ticketFrom(response)), 'yes\nalice\n');
});

test('invalid logins and service URLs are rejected without a session', async t => {
  const request = await start(t);
  for (const value of ['', '  ', 'alice\nbob', 'alice\rbob']) {
    assert.equal((await login(request, { login: value })).status, 400);
  }
  assert.equal((await request('/login', { method: 'POST' })).status, 400);
  assert.equal((await request('/login', { method: 'POST', body: new URLSearchParams([['login', 'a'], ['login', 'b']]) })).status, 400);
  for (const target of ['', '/relative', 'javascript:alert(1)', 'https://user:pass@example.com']) {
    const response = await login(request, { login: 'alice' }, target);
    assert.equal(response.status, 400);
    assert.equal(response.headers.get('set-cookie'), null);
  }
  assert.equal((await request('/login?service=http://a.test&service=http://b.test')).status, 400);
});

test('login without a service displays the confirmation page', async t => {
  const request = await start(t);
  assert.match(await (await request('/login')).text(), /id="login"/);
  const response = await request('/login', { method: 'POST', body: new URLSearchParams({ login: 'alice' }) });
  assert.equal(response.status, 200);
  assert.match(await response.text(), /You're authenticated/);
});

test('renew requires credentials and gateway skips the form', async t => {
  const request = await start(t);
  const primary = await login(request);
  assert.equal(await validate(request, ticketFrom(primary), service, { renew: 'true' }), 'yes\nalice\n');
  const headers = { cookie: primary.headers.get('set-cookie').split(';')[0] };
  const path = `/login?service=${encodeURIComponent(service)}`;
  assert.equal((await request(`${path}&renew=true`, { headers })).status, 200);
  const sso = await request(path, { headers });
  assert.equal(await validate(request, ticketFrom(sso), service, { renew: 'true' }), 'no\n');
  const gateway = await request(`${path}&gateway=true`);
  assert.equal(gateway.headers.get('location'), service);
  assert.equal(gateway.headers.get('set-cookie'), null);
  assert.equal((await request(`${path}&gateway=true&renew=true`)).status, 200);
});

test('tickets and sessions expire', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.now() });
  const request = await start(t);
  const response = await login(request);
  const ticket = ticketFrom(response);
  const headers = { cookie: response.headers.get('set-cookie').split(';')[0] };
  t.mock.timers.tick(5 * 60 * 1000);
  assert.equal(await validate(request, ticket), 'no\n');
  assert.equal((await request(`/login?service=${encodeURIComponent(service)}`, { headers })).status, 302);
  t.mock.timers.tick(8 * 60 * 60 * 1000);
  assert.equal((await request(`/login?service=${encodeURIComponent(service)}`, { headers })).status, 200);
});
