# API Route Authentication & Authorization

## Purpose
Outlines security filters, token decoders, and session managers safeguarding our API routes.

## Scope
Applies to secure routing pipelines, authorization headers, and token middleware.

## Token-Based Middleware (Bearer Flow)
We utilize Firebase Authentication ID Tokens as Bearer credentials.

```
React Client                          Express Server
   |                                        |
   |-- [GET /api/pos (Auth Header)] ------->| (Check token validity)
   |                                        |-- Decode JWT claims
   |                                        |-- Verify roles & permissions
   |                                        |-- Access Firestore
   |<-- [JSON Response] --------------------|
```

## Middleware Logic
All secured API paths are protected using an authentication checker:
```ts
export async function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ error: "Access token is required" });

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    return res.status(403).json({ error: "Invalid or expired session token" });
  }
}
```

## Best Practices
* **Short Expirations:** ID tokens should live for a maximum of 60 minutes. Clients must refresh tokens in the background automatically.

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** Must be revised when integrating OAuth single-sign-on or changing auth token providers.
