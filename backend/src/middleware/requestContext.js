import { AsyncLocalStorage } from "node:async_hooks";
import { createSupabaseUserClient } from "../config/supabaseUser.js";

const storage = new AsyncLocalStorage();

export function requestContext(_request, _response, next) {
  storage.run({ accessToken: null, dataClient: null }, next);
}

export function setRequestAccessToken(accessToken) {
  const context = storage.getStore();
  if (context) context.accessToken = accessToken;
}

export function getSupabaseDataClient() {
  const context = storage.getStore();
  if (!context?.accessToken) throw new Error("User-scoped Supabase client is unavailable outside an authenticated request");
  if (!context.dataClient) context.dataClient = createSupabaseUserClient(context.accessToken);
  return context.dataClient;
}

export function getRequestAccessToken() {
  const token = storage.getStore()?.accessToken;
  if (!token) throw new Error("Authenticated access token is unavailable outside a request");
  return token;
}
