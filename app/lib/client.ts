import { Issuer, generators } from "openid-client";

/**
 * Sets up the OpenID Connect client using server-side environment variables.
 *
 * Note on CLIENT_SECRET: Although this app uses PKCE, it is a confidential
 * client (Next.js server-side) — the CLIENT_SECRET is used exclusively in
 * server-side API routes (/api/auth, /api/auth/authURL) and is never sent
 * to or accessible by the browser. PKCE provides an additional security
 * layer on top of the confidential client flow.
 */
export async function setUpOIDC() {
  let tenantURL = process.env.TENANT_URL;

  if(tenantURL?.endsWith('/')) {
    tenantURL = `${tenantURL}oauth2/.well-known/openid-configuration`
  } else {
    tenantURL = `${tenantURL}/oauth2/.well-known/openid-configuration`
  }
  const issuer = await Issuer.discover(tenantURL);
  return new issuer.Client({
    client_id: process.env.CLIENT_ID as string,
    redirect_uri: process.env.REDIRECT_URI,
    response_type: process.env.RESPONSE_TYPE,
    client_secret: process.env.CLIENT_SECRET,
  });
}

export const nonce = generators.nonce();
