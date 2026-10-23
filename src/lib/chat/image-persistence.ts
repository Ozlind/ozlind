export type PersistedChatImage = {
  dataUrl: string;
  mimeType: "image/jpeg";
  name: string;
};

type ImageRecord = {
  conversationId: string;
  messageId: string;
  images: PersistedChatImage[];
  updatedAt: number;
};

const DATABASE_NAME = "ozlind-chat-media";
const DATABASE_VERSION = 1;
const STORE_NAME = "message-images";

// New chats do not have a server conversation ID until the first API response
// arrives. Save their images under this key first so a refresh during TTFT does
// not lose the attachment; loadMessageImages() reconciles it when history loads.
export const PENDING_CONVERSATION_ID = "__pending__";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Browser image storage is unavailable."));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: ["conversationId", "messageId"] });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open local image storage."));
    request.onblocked = () => reject(new Error("Local image storage is blocked by another tab."));
  });
}

async function readMessageImages(
  conversationId: string,
  messageId: string,
): Promise<PersistedChatImage[]> {
  const database = await openDatabase();
  try {
    return await new Promise<PersistedChatImage[]>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get([conversationId, messageId]);
      let images: PersistedChatImage[] = [];
      request.onsuccess = () => {
        const record = request.result as ImageRecord | undefined;
        images = Array.isArray(record?.images) ? record.images : [];
      };
      request.onerror = () => reject(request.error ?? new Error("Could not load image preview."));
      transaction.oncomplete = () => resolve(images);
      transaction.onerror = () => reject(transaction.error ?? new Error("Could not load image preview."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Image preview load was cancelled."));
    });
  } finally {
    database.close();
  }
}

export async function saveMessageImages(
  conversationId: string,
  messageId: string,
  images: PersistedChatImage[],
): Promise<void> {
  if (!conversationId || !messageId || images.length === 0) return;
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put({
        conversationId,
        messageId,
        images,
        updatedAt: Date.now(),
      } satisfies ImageRecord);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Could not save image preview."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Image preview save was cancelled."));
    });
  } finally {
    database.close();
  }
}

export async function savePendingMessageImages(
  messageId: string,
  images: PersistedChatImage[],
): Promise<void> {
  return saveMessageImages(PENDING_CONVERSATION_ID, messageId, images);
}

export async function deleteMessageImages(
  conversationId: string,
  messageId: string,
): Promise<void> {
  if (!conversationId || !messageId) return;
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete([conversationId, messageId]);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Could not remove image preview."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Image preview removal was cancelled."));
    });
  } finally {
    database.close();
  }
}

export async function loadMessageImages(
  conversationId: string,
  messageId: string,
): Promise<PersistedChatImage[]> {
  if (!conversationId || !messageId) return [];

  const images = await readMessageImages(conversationId, messageId);
  if (images.length || conversationId === PENDING_CONVERSATION_ID) return images;

  // Recovery path for a newly created conversation refreshed before the API
  // returned its ID. Re-key the pending preview only after reading it safely.
  const pendingImages = await readMessageImages(PENDING_CONVERSATION_ID, messageId);
  if (!pendingImages.length) return [];

  await saveMessageImages(conversationId, messageId, pendingImages);
  await deleteMessageImages(PENDING_CONVERSATION_ID, messageId);
  return pendingImages;
}
