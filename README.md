# fake-cas

A small, fake CAS 1.0 server for local development and integration tests.
It accepts any non-empty, single-line username. There is no user directory:
this is a simulator, not a production authentication server.

![Screenshot](fake-cas.png)

## Run with Docker

Start the server with Docker:

```sh
docker run --rm --name fake-cas -p 3000:3000 ghcr.io/eskan/fake-cas:latest
```

Open http://localhost:3000/login. Favourite logins are saved in the browser's
localStorage.

The image supports `linux/amd64` and `linux/arm64`; Docker selects the matching
architecture automatically. Tickets and sessions are stored in memory and lost
when the container restarts.

To require a password and expose the server on port 3001:

```sh
docker run --rm --name fake-cas -p 3001:3000 \
  -e CAS_PASSWORD=secret ghcr.io/eskan/fake-cas:latest
```

To disable the SSO cookie, add `-e NO_COOKIE=1`. The left side of `-p` is the
host port; the right side must match the server's `PORT` (3000 by default).

To update, stop the running container and pull the image before starting it again:

```sh
docker pull ghcr.io/eskan/fake-cas:latest
```

For repeatable integrations, replace `latest` with a specific available image tag.

### Docker Compose

```yaml
services:
  fake-cas:
    image: ghcr.io/eskan/fake-cas:latest
    ports:
      - "3000:3000"
    environment:
      CAS_PASSWORD: secret
      # NO_COOKIE: "1"
```

Save this as `compose.yaml`, then run `docker compose up -d`.
Update with `docker compose pull && docker compose up -d`.

When your CAS client also runs in Docker, validation can use the Compose service
hostname `http://fake-cas:3000/validate`. Browser redirects must use URLs reachable
from the browser, such as `http://localhost:3000/login` and your application's
public callback URL. Always pass the exact same `service` value to login and validation.

## Run locally

Requires Node.js 24.12 or newer and npm.

```sh
git clone https://github.com/eskan/fake-cas.git
cd fake-cas
npm ci
npm start
```

If you use nvm, run `nvm install` and `nvm use` in the project directory to
select the Node.js version from `.nvmrc`.

Open http://localhost:3000/login. Stop the server with `Ctrl+C`.
Tickets and sessions are stored in memory and lost when the server restarts.

Environment variables also apply when running locally. For example, in a
POSIX shell (Linux or macOS):

```sh
CAS_PASSWORD=secret PORT=3001 npm start
NO_COOKIE=1 npm start
```

## Development

After installing dependencies with `npm ci`, start the server in watch mode:

```sh
npm run dev
```

Changes to the server code restart it automatically. Refresh the browser after
editing `form.html` or `already.html` to see the updated pages. No compilation
step is required.

Run the integration tests with:

```sh
npm test
```

To build and try a Docker image from your local source:

```sh
docker build -t fake-cas .
docker run --rm -p 3000:3000 fake-cas
```

## Configuration

| Variable | Default | Behaviour |
| --- | --- | --- |
| `PORT` | `3000` | HTTP listening port |
| `CAS_PASSWORD` | Unset | When non-empty, require this password for every login; otherwise accept any password, including blank |
| `NO_COOKIE` | Unset | When present (even empty or `0`), disable the SSO session cookie |

```sh
docker run --rm -p 3000:3000 -e CAS_PASSWORD=secret ghcr.io/eskan/fake-cas:latest
docker run --rm -p 3000:3000 -e NO_COOKIE=1 ghcr.io/eskan/fake-cas:latest
```

## CAS flow

1. Navigate to `/login?service=http%3A%2F%2Flocalhost%3A8080%2Fcallback`.
2. Submit the login form. The server redirects to the service URL with a
   `ticket=ST-...` parameter, preserving existing query parameters and fragments.
3. The client calls `/validate?service=http%3A%2F%2Flocalhost%3A8080%2Fcallback&ticket=ST-...`.
   Pass the **exact same service string** used at login, without the added ticket.
4. Successful validation returns `yes\n<login>\n`; failure returns `no\n`,
   both as plain text. Every validation attempt consumes the ticket, even if
   the service is wrong or missing. Tickets expire after five minutes.
5. `GET /logout` or `POST /logout` clears the SSO session and redirects to `/login`.

Without a service, `/login` displays the login or authenticated page. Service
URLs must be absolute HTTP(S) URLs without embedded credentials. Any such
service is accepted, to make local integration easy.

SSO sessions last eight hours. `/login?renew=true` forces the login form;
`/validate?renew=true` only accepts tickets issued after submitting credentials.
`/login?gateway=true&service=...` returns to the service without a ticket when
there is no session. `renew` takes precedence over `gateway`.

Only the CAS 1.0 endpoints `/login`, `/logout` and `/validate` are implemented.
CAS 2/3 XML validation, proxy tickets and single logout callbacks are not supported.

Empty usernames are rejected. When `CAS_PASSWORD` is configured, an incorrect
password returns HTTP 401.

Protocol reference: [Apereo CAS specification](https://apereo.github.io/cas/development/protocol/CAS-Protocol-Specification.html).
