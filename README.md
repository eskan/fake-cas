# fake-cas

![ScreenShot](https://raw.github.com/eskan/fake-cas/master/fake-cas.png)

Handle a simple and **fake** CAS Authentication SSO in V1 with :

  - /login
  - /logout
  - /validate

Prefered login can be persist in localStorage

```
babel-node server.js
```

# Development

```
npm start
```

# ENV

- PORT
- CAS_PASSWORD : if undefined, any password (even blank) will be allowed
- NO_COOKIE : don't store cookie on the browser.
