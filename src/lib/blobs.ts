import { getStore } from "@netlify/blobs";

// Stores files by namespace. On Netlify, credentials are auto-injected.
// Locally, point NETLIFY_BLOBS_CONTEXT at a local sandbox or skip blob calls.
export const brandAssetsStore = () => getStore({ name: "brand-assets" });
// Source template images uploaded by users for rebrand. Keyed
// `<userId>/<designId>-<filename>`.
export const templatesStore = () => getStore({ name: "templates" });
// Generated decorative motifs from Gemini. Keyed by hash(prompt + brand)
// so identical requests across users / sessions reuse cached bytes.
export const motifsStore = () => getStore({ name: "motifs" });
export const outputsStore = () => getStore({ name: "outputs" });
