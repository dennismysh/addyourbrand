import { getStore } from "@netlify/blobs";

// Stores files by namespace. On Netlify, credentials are auto-injected.
// Locally, point NETLIFY_BLOBS_CONTEXT at a local sandbox or skip blob calls.
export const brandAssetsStore = () => getStore({ name: "brand-assets" });
export const templatesStore = () => getStore({ name: "templates" });
export const outputsStore = () => getStore({ name: "outputs" });
