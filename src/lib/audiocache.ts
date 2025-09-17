
'use client';

import localforage from 'localforage';

const CACHE_VERSION = 'v2';
const DB_NAME = 'audioCacheDB';
const STORE_NAME = 'audioBuffers';

// Configura una instancia de localforage
const audioStore = localforage.createInstance({
  name: DB_NAME,
  storeName: STORE_NAME,
  description: 'Cache for audio ArrayBuffers',
});

// Función para obtener un ArrayBuffer del caché
export const getCachedArrayBuffer = async (url: string): Promise<ArrayBuffer | null> => {
  try {
    const key = `${CACHE_VERSION}-${url}`;
    const data = await audioStore.getItem<ArrayBuffer>(key);
    if (data) {
      console.log(`Cache HIT for: ${url}`);
      return data;
    }
    console.log(`Cache MISS for: ${url}`);
    return null;
  } catch (error) {
    console.error('Error getting from cache:', error);
    return null;
  }
};

// Función para guardar un ArrayBuffer en el caché
export const cacheArrayBuffer = async (url: string, buffer: ArrayBuffer): Promise<void> => {
  try {
    const key = `${CACHE_VERSION}-${url}`;
    await audioStore.setItem(key, buffer.slice(0)); // Use slice(0) to store a copy
    console.log(`Cached: ${url}`);
  } catch (error) {
    console.error('Error setting to cache:', error);
  }
};


// Función para limpiar el caché (útil para mantenimiento)
export const clearCache = async (): Promise<void> => {
  try {
    await audioStore.clear();
    console.log('Audio cache cleared.');
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
};
