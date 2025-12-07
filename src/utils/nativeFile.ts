import { invoke } from '@tauri-apps/api/core';

interface LRUCacheNode<K, V> {
  key: K;
  value: V;
  prev: LRUCacheNode<K, V> | null;
  next: LRUCacheNode<K, V> | null;
}

class LRUCache<K, V> {
  private capacity: number;
  private maxSize: number;
  private currentSize: number = 0;
  private cache: Map<K, LRUCacheNode<K, V>> = new Map();
  private head: LRUCacheNode<K, V> | null = null;
  private tail: LRUCacheNode<K, V> | null = null;
  private sizeOf: (value: V) => number;

  constructor(options: { max: number; maxSize: number; sizeOf?: (value: V) => number }) {
    this.capacity = options.max;
    this.maxSize = options.maxSize;
    this.sizeOf = options.sizeOf || (() => 1);
  }

  get(key: K): V | undefined {
    const node = this.cache.get(key);
    if (!node) return undefined;

    // Move to front (most recently used)
    this.moveToFront(node);
    return node.value;
  }

  set(key: K, value: V): void {
    const size = this.sizeOf(value);

    // Remove old node if exists
    const existingNode = this.cache.get(key);
    if (existingNode) {
      this.currentSize -= this.sizeOf(existingNode.value);
      this.removeNode(existingNode);
    }

    // Create new node
    const newNode: LRUCacheNode<K, V> = {
      key,
      value,
      prev: null,
      next: null,
    };

    // Add to front
    this.addToFront(newNode);
    this.cache.set(key, newNode);
    this.currentSize += size;

    // Evict if necessary
    while (this.cache.size > this.capacity || this.currentSize > this.maxSize) {
      if (!this.tail) break;
      const evicted = this.tail;
      this.currentSize -= this.sizeOf(evicted.value);
      this.removeNode(evicted);
      this.cache.delete(evicted.key);
    }
  }

  private moveToFront(node: LRUCacheNode<K, V>): void {
    this.removeNode(node);
    this.addToFront(node);
  }

  private addToFront(node: LRUCacheNode<K, V>): void {
    node.next = this.head;
    node.prev = null;

    if (this.head) {
      this.head.prev = node;
    }
    this.head = node;

    if (!this.tail) {
      this.tail = node;
    }
  }

  private removeNode(node: LRUCacheNode<K, V>): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
  }

  clear(): void {
    this.cache.clear();
    this.head = null;
    this.tail = null;
    this.currentSize = 0;
  }
}

// Deferred Blob that loads data on demand
class DeferredBlob extends Blob {
  private dataPromise: Promise<ArrayBuffer>;

  constructor(dataPromise: Promise<ArrayBuffer>, type?: string) {
    super([], { type });
    this.dataPromise = dataPromise;
  }

  override async arrayBuffer(): Promise<ArrayBuffer> {
    return this.dataPromise;
  }

  override async text(): Promise<string> {
    const buffer = await this.dataPromise;
    return new TextDecoder().decode(buffer);
  }
}

export class NativeFile extends File {
  private filePath: string;
  private fileSize: number;
  private lru: LRUCache<string, Promise<ArrayBuffer>>;
  private chunkSize = 1024 * 1024; // 1MB chunks

  constructor(filePath: string, name: string, size: number, type: string) {
    super([], name, { type });
    this.filePath = filePath;
    this.fileSize = size;

    // LRU cache for file chunks
    this.lru = new LRUCache<string, Promise<ArrayBuffer>>({
      max: 50,
      maxSize: 50 * 1024 * 1024, // 50MB max cache
      sizeOf: () => this.chunkSize,
    });
  }

  override get size(): number {
    return this.fileSize;
  }

  private getCacheKey(start: number, end: number): string {
    return `${start}-${end}`;
  }

  private async readData(start: number, end: number): Promise<ArrayBuffer> {
    const cacheKey = this.getCacheKey(start, end);

    // Check cache first
    const cached = this.lru.get(cacheKey);
    if (cached) {
      console.log(`NativeFile: Cache hit for ${cacheKey}`);
      return cached;
    }

    // Read from file
    console.log(`NativeFile: Reading chunk ${cacheKey} from ${this.filePath}`);
    const promise = invoke<number[]>('read_file_chunk', {
      filePath: this.filePath,
      start,
      end,
    }).then((data) => new Uint8Array(data).buffer);

    // Cache the promise
    this.lru.set(cacheKey, promise);

    return promise;
  }

  override slice(start = 0, end = this.size): Blob {
    const actualStart = Math.max(0, start < 0 ? this.size + start : start);
    const actualEnd = Math.min(this.size, end < 0 ? this.size + end : end);

    // Return a deferred blob that loads data on demand
    const dataPromise = this.readData(actualStart, actualEnd);
    return new DeferredBlob(dataPromise, this.type);
  }

  override async arrayBuffer(): Promise<ArrayBuffer> {
    // For full file reads, we still use chunks but combine them
    const chunks: ArrayBuffer[] = [];
    const chunkCount = Math.ceil(this.size / this.chunkSize);

    for (let i = 0; i < chunkCount; i++) {
      const start = i * this.chunkSize;
      const end = Math.min((i + 1) * this.chunkSize, this.size);
      const chunk = await this.readData(start, end);
      chunks.push(chunk);
    }

    // Combine all chunks
    const totalSize = chunks.reduce((acc, chunk) => acc + chunk.byteLength, 0);
    const result = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }

    return result.buffer;
  }

  override async text(): Promise<string> {
    const buffer = await this.arrayBuffer();
    return new TextDecoder().decode(buffer);
  }

  // Clean up cache when done
  dispose(): void {
    this.lru.clear();
  }
}

// Factory function to create NativeFile from a file path
export async function createNativeFile(filePath: string): Promise<NativeFile> {
  // Get file metadata
  const metadata = await invoke<{ name: string; size: number; mime_type: string }>('get_file_metadata', {
    filePath,
  });

  return new NativeFile(
    filePath,
    metadata.name,
    metadata.size,
    metadata.mime_type
  );
}
