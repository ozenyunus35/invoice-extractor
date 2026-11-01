"use client";

import type { DocType } from "./classify";
import type { Doc } from "./documents";
import type { Invoice } from "./types";

/*
 * Keeps the reviewer's work in IndexedDB, on this device only: uploaded
 * documents (with their image) and edits or type changes made to samples.
 * Every call fails soft, so private windows still work, just without memory.
 */

const DB = "tally";
const STORE = "docs";

export type Saved = {
  id: string;
  sample: boolean;
  type: DocType;
  invoice: Invoice;
  /** Only for uploaded documents: everything needed to show them again. */
  doc?: Omit<Doc, "imageUrl" | "image">;
  /** Stored as bytes: WebKit cannot keep Blobs in IndexedDB in private windows. */
  image?: { data: ArrayBuffer; type: string };
};

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  try {
    const db = await open();
    return await new Promise<T>((resolve, reject) => {
      const req = run(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export const loadAll = async () => (await tx<Saved[]>("readonly", (s) => s.getAll() as IDBRequest<Saved[]>)) ?? [];
export const save = (record: Saved) => tx("readwrite", (s) => s.put(record));

export async function saveDoc(d: Doc) {
  const { imageUrl: _url, image, ...rest } = d;
  void _url;
  if (d.sample) return save({ id: d.id, sample: true, type: d.type, invoice: d.invoice });
  const bytes = image ? { data: await image.arrayBuffer(), type: image.type } : undefined;
  return save({ id: d.id, sample: false, type: d.type, invoice: d.invoice, doc: rest, image: bytes });
}
export const remove = (id: string) => tx("readwrite", (s) => s.delete(id));
export const clearAll = () => tx("readwrite", (s) => s.clear());
