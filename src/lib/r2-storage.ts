type R2Key = `raw-responses/${string}` | `briefings/${string}`;

export const r2Storage = {
  async put(bucket: R2Bucket, key: R2Key, value: unknown): Promise<void> {
    await bucket.put(key, JSON.stringify(value));
  },

  async get<T>(bucket: R2Bucket, key: R2Key): Promise<T | null> {
    const obj = await bucket.get(key);
    if (!obj) return null;
    return obj.json<T>();
  },

  async delete(bucket: R2Bucket, key: R2Key): Promise<void> {
    await bucket.delete(key);
  },
};
