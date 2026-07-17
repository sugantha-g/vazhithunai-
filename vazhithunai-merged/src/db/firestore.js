// src/db/firestore.js
//
// Initializes Firestore. Falls back to an in-memory store when no service
// account is configured, so the whole backend can run and be demoed
// (`npm run demo`) without needing real Firebase credentials set up yet.
// Swap to real Firestore any time by dropping a serviceAccountKey.json
// into the project root and setting USE_REAL_FIREBASE=true.

import { readFileSync, existsSync } from "fs";

const USE_REAL_FIREBASE =
  process.env.USE_REAL_FIREBASE === "true" &&
  existsSync("./serviceAccountKey.json");

let db;

if (USE_REAL_FIREBASE) {
  const { initializeApp, cert } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");

  const serviceAccount = JSON.parse(
    readFileSync("./serviceAccountKey.json", "utf-8")
  );

  initializeApp({ credential: cert(serviceAccount) });
  db = getFirestore();
  console.log("[db] Connected to real Firestore.");
} else {
  // --- In-memory Firestore-like mock ---
  // Mimics the small subset of the Firestore API this project uses:
  // db.collection(name).doc(id).set/get/update, and .add()
  const collections = new Map();

  function getCollection(name) {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name);
  }

  db = {
    collection(name) {
      const store = getCollection(name);
      return {
        doc(id) {
          return {
            async set(data) {
              store.set(id, { ...(store.get(id) || {}), ...data });
              return true;
            },
            async update(data) {
              if (!store.has(id)) throw new Error(`No doc ${id} in ${name}`);
              store.set(id, { ...store.get(id), ...data });
              return true;
            },
            async get() {
              const data = store.get(id);
              return {
                exists: !!data,
                id,
                data: () => data,
              };
            },
          };
        },
        async add(data) {
          const id = `${name}_${Math.random().toString(36).slice(2, 10)}`;
          store.set(id, data);
          return { id };
        },
        async where() {
          // Minimal support: returns all docs, caller filters in JS.
          // Good enough for hackathon scale; swap for real Firestore
          // queries once on production Firestore.
          return {
            docs: Array.from(store.entries()).map(([id, data]) => ({
              id,
              data: () => data,
            })),
          };
        },
        async listAll() {
          return Array.from(store.entries()).map(([id, data]) => ({
            id,
            data: () => data,
          }));
        },
      };
    },
  };

  console.log(
    "[db] No serviceAccountKey.json found — running on in-memory mock DB (fine for demo/dev)."
  );
}

export { db };
