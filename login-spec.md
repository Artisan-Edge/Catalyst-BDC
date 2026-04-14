# Login Spec: Session-Based Authentication for Datasphere VSCode Extension

## Problem

The current Catalyst-BDC library requires an OAuth client registration (`oauth.json`) with a `client-id`, `client-secret`, `authorization-url`, and `token-url`. This is provisioned in the SAP BTP cockpit and requires admin access. For a VSCode extension intended for general users, this is a barrier to adoption — users shouldn't need to provision an OAuth application just to connect.

When users access Datasphere in the browser, they authenticate via SAML through their Identity Provider (IdP). No OAuth client is involved. The extension should support the same experience.

## Goal

Allow users to authenticate with Datasphere by logging in through their browser — the same way they log in to the Datasphere web UI — without requiring an OAuth client registration.

OAuth client-based login should remain as an optional, secondary auth method for power users and CI/headless environments.

## Background: How Datasphere Browser Auth Works

1. User navigates to `https://{tenant}.{region}.hcs.cloud.sap`
2. Datasphere redirects to the configured IdP (SAP IAS, Azure AD, etc.) via SAML
3. User authenticates at the IdP (or is auto-authenticated if their IdP session cookie is still valid)
4. IdP POSTs a SAML assertion back to Datasphere
5. Datasphere validates the assertion, creates a server-side session, and sets session cookies
6. All subsequent API requests use these session cookies for auth

Key observation: when the IdP session is still alive (typically days to weeks), step 3 is invisible — the user clicks "Log On" and is immediately authenticated with no password prompt. This makes re-authentication low-friction.

## Background: What Catalyst-BDC Currently Does

The existing auth flow (in `src/core/auth/oauth.ts` and `src/client/client.ts`):

1. Opens a local HTTP server on `localhost:8080`
2. Opens the browser to the OAuth authorization URL with `response_type=code`, `client_id`, and `state`
3. User authenticates → OAuth server redirects to `localhost:8080` with an authorization `code`
4. Library exchanges the code for an `access_token` + `refresh_token` using client credentials
5. Tokens are cached at `~/.catalyst-bdc/tokens.json`, keyed by hostname
6. On subsequent runs: uses cached tokens, refreshes via `refresh_token` when expired
7. All API requests use `Authorization: Bearer {access_token}` + CSRF token

The request layer (`BdcClientImpl.request()`) attaches:
- `Authorization: Bearer {access_token}`
- `X-Csrf-Token` (fetched from `/api/v1/csrf`)
- `Cookie` (from the CSRF fetch response's `Set-Cookie`)
- `X-Requested-With: XMLHttpRequest`

## Proposed Design: Session-Based Auth

### Core Concept

Instead of obtaining an OAuth access token, capture the **session cookies** that Datasphere sets after a successful SAML login. Use those cookies directly for API requests — the same way the browser does.

### Auth Flow

```
1. Open browser to: https://{host}/dwaas-ui/index.html
   (or any Datasphere page that triggers the SAML redirect)

2. Datasphere redirects to IdP → user authenticates (or auto-authenticates)

3. IdP redirects back to Datasphere → Datasphere sets session cookies

4. Capture the session cookies
   (see "Cookie Capture Strategy" below)

5. Store cookies in VSCode SecretStorage (or ~/.catalyst-bdc/session.json for CLI)

6. Use cookies for all API requests — no Bearer token needed

7. When cookies expire (API returns 401/302 redirect to IdP):
   re-trigger the flow — usually invisible if IdP session is alive
```

### Cookie Capture Strategy

The challenge: the SAML login happens entirely between the browser and Datasphere/IdP. There's no OAuth redirect to `localhost` with a code — the session cookies are set on the Datasphere domain.

**Approach: Redirect interception via localhost callback**

1. Start a local HTTP server on `localhost:{port}`
2. Open the browser to a custom endpoint on Datasphere that, after successful SAML auth, redirects to `localhost:{port}` — **but Datasphere doesn't have such an endpoint natively**

Since Datasphere doesn't support a post-login redirect to localhost, alternative approaches:

**Approach A: Polling with a temporary probe request**

1. Start local HTTP server on `localhost:{port}`
2. Open browser to `https://{host}/dwaas-ui/index.html` — user logs in normally
3. Meanwhile, poll `https://{host}/api/v1/csrf` with `credentials: include` from a page served by localhost — **won't work, cookies are on the Datasphere domain, not accessible from localhost**

**Approach B: Browser extension or injected script**

Too invasive. Not viable for a VSCode extension.

**Approach C: Embedded webview (VSCode approach)**

1. Use `vscode.env.asExternalUri` + VSCode's built-in browser, OR
2. Use a **VSCode Webview** panel that loads the Datasphere login page
3. The webview can intercept `Set-Cookie` headers or read cookies after navigation completes
4. Extract session cookies → pass to the extension backend

This is the **recommended approach for the VSCode extension**. VSCode webviews run in an Electron context where you have access to the session/cookie store.

**Approach D: Manual cookie entry (fallback)**

1. User logs in to Datasphere in their browser
2. User copies cookies from DevTools (or a helper bookmarklet extracts them)
3. Pastes into the extension

Ugly, but works as a fallback. Could be streamlined with a browser bookmarklet.

**Approach E: Headless browser (Playwright/Puppeteer)**

1. Launch a headless (or headed) Chromium instance
2. Navigate to Datasphere → user authenticates in the real browser window
3. After auth completes, extract cookies from the browser context
4. Close the browser

This works for both VSCode and CLI use cases. The user sees a real browser window, authenticates normally, and the library captures cookies programmatically.

### Recommended Strategy

| Context | Primary Approach | Fallback |
|---------|-----------------|----------|
| VSCode Extension | **Approach C** (Webview) | Approach D (manual paste) |
| CLI / Standalone | **Approach E** (Playwright) | Approach D (manual paste) |
| CI / Headless | OAuth client auth (existing) | Token config (existing) |

### Implementation: VSCode AuthenticationProvider

Register a custom `vscode.AuthenticationProvider` so that:
- The Datasphere account appears in VSCode's account menu (status bar)
- Sessions are managed by VSCode's built-in lifecycle
- Credentials are stored in VSCode's `SecretStorage` (OS keychain)
- Other extensions could potentially consume the session

```typescript
interface DatasphereSession {
    host: string;
    cookies: string;        // semicolon-delimited session cookies
    csrfToken: string;      // from /api/v1/csrf
    csrfCookies: string;    // cookies from CSRF response
    obtainedAt: number;     // epoch ms — for staleness detection
}
```

**Provider responsibilities:**
- `createSession()`: open webview → SAML login → capture cookies → fetch CSRF → return session
- `removeSession()`: clear stored cookies
- Session expiry detection: when an API call returns 401 or a 302 redirect to the IdP, mark session as expired and trigger `createSession()` again

### Request Layer Changes

The current `BdcClientImpl.request()` always uses `Authorization: Bearer {token}`. The session-based approach uses cookies instead.

The request layer needs to support two auth modes:

**Mode 1: Bearer token (existing — OAuth or pre-provided tokens)**
```
Authorization: Bearer {accessToken}
X-Csrf-Token: {csrf}
Cookie: {csrfCookies}
```

**Mode 2: Session cookies (new — SAML login)**
```
Cookie: {sessionCookies}; {csrfCookies}
X-Csrf-Token: {csrf}
```

No `Authorization` header in session mode — the session cookies authenticate the request.

### CSRF in Session Mode

CSRF tokens should still work with session cookies. The flow:

1. `GET /api/v1/csrf` with `Cookie: {sessionCookies}` and `X-Csrf-Token: Fetch`
2. Response includes `x-csrf-token` header and may set additional cookies
3. Combine session cookies + CSRF cookies for subsequent mutation requests

If the CSRF fetch fails with a redirect (302 to IdP), the session has expired → re-authenticate.

### Session Expiry & Re-Auth

| Signal | Meaning | Action |
|--------|---------|--------|
| API returns 401 | Session expired | Re-auth |
| API returns 302 (redirect to IdP) | Session expired | Re-auth |
| CSRF fetch fails | Session or CSRF stale | Re-auth |
| `obtainedAt` older than 8 hours | Proactive staleness check | Try CSRF fetch; re-auth if it fails |

Re-auth in the VSCode extension context should:
1. Show a notification: "Datasphere session expired. Click to re-authenticate."
2. On click, open the webview → SAML flow → usually instant if IdP session is alive
3. Resume the failed operation

### Config Changes

The library config should accept sessions without OAuth:

```typescript
interface BdcConfig {
    host: string;
    space: string;
    verbose?: boolean;

    // Auth — one of these must be provided:
    oauth?: OAuthConfig | { optionsFile: string };  // existing, now optional
    tokens?: TokenConfig;                             // existing
    session?: SessionConfig;                          // new
}

interface SessionConfig {
    cookies: string;
    obtainedAt?: number;
}
```

When `session` is provided, the client skips OAuth entirely and uses cookie-based auth. The `oauth` field becomes optional (currently required).

### What the VSCode Extension Provides to Catalyst-BDC

The extension owns the auth UI. It passes credentials to `createClient()`:

```typescript
// After SAML login in webview, extension has cookies
const client = createClient({
    host: 'https://mytenant.us10.hcs.cloud.sap',
    space: 'MY_SPACE',
    session: {
        cookies: capturedCookies,
        obtainedAt: Date.now(),
    },
});

// No login() call needed — session is already established
const [objects, err] = await client.listObjects();
```

When the client detects session expiry (401/302), it should emit an event or call a callback so the extension can trigger re-auth:

```typescript
const client = createClient({
    host: '...',
    space: '...',
    session: { cookies: '...' },
    onSessionExpired: async () => {
        // Extension triggers webview re-auth, returns new cookies
        const newCookies = await reauthenticate();
        return { cookies: newCookies, obtainedAt: Date.now() };
    },
});
```

## Migration Path

1. **Phase 1**: Add `SessionConfig` support to `BdcConfig` and the request layer in Catalyst-BDC. Make `oauth` optional when `session` is provided. No breaking changes — OAuth continues to work.

2. **Phase 2**: Build the VSCode extension with the webview-based SAML login. Use `SessionConfig` to pass cookies to the client.

3. **Phase 3** (optional): Add Playwright-based SAML login for CLI use cases, as an alternative to OAuth.

## Open Questions

1. **Which cookies does Datasphere require?** Need to test which cookies from the SAML flow are necessary for API auth. Likely `JSESSIONID` and possibly SAP-specific cookies like `sap-usercontext`.

2. **Webview cookie access**: VSCode webviews run in iframes. Verify that cookies set by the Datasphere domain during SAML login can be read by the extension. May need to use `vscode.env.openExternal` + localhost callback instead if webview sandboxing prevents cookie access.

3. **Cross-origin restrictions**: SAML involves redirects across domains (Datasphere → IdP → Datasphere). Verify the webview allows this navigation chain.

4. **Session duration**: Empirically measure how long Datasphere session cookies remain valid under different IdP configurations. This determines how often re-auth is needed.

5. **Multi-tenant support**: Users may work with multiple Datasphere tenants. The session store should be keyed by host, similar to the existing token cache.
