// The relay broadcasts snapshots. Encrypt secret material to an individual
// browser's ephemeral public key so spectators and other seats cannot read it.
export type Sealed = { sender: string; iv: string; ciphertext: string };
type Identity = { publicKey: string; privateKey: CryptoKey };
const encode = (data: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(data)));
const decode = (data: string) => Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
const algorithm = { name: 'ECDH', namedCurve: 'P-256' };
export const isPublicKey = (key: unknown): key is string =>
  typeof key === 'string' && /^[A-Za-z0-9+/]{87}=$/.test(key);
export async function createIdentity(): Promise<Identity> {
  const pair = await crypto.subtle.generateKey(algorithm, false, ['deriveKey']);
  return { publicKey: encode(await crypto.subtle.exportKey('raw', pair.publicKey)), privateKey: pair.privateKey };
}
async function derive(privateKey: CryptoKey, remote: string) {
  if (!isPublicKey(remote)) throw new Error('Invalid seat key.');
  const publicKey = await crypto.subtle.importKey('raw', decode(remote), algorithm, false, []);
  return crypto.subtle.deriveKey({ name: 'ECDH', public: publicKey }, privateKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function sealFor(publicKey: string, payload: unknown): Promise<Sealed> {
  const sender = await createIdentity();
  const key = await derive(sender.privateKey, publicKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  return { sender: sender.publicKey, iv: encode(iv), ciphertext: encode(ciphertext) };
}
export async function openFor(privateKey: CryptoKey, packet: Sealed): Promise<unknown> {
  if (typeof packet.iv !== 'string' || packet.iv.length !== 16 ||
      typeof packet.ciphertext !== 'string' || packet.ciphertext.length > 12000) throw new Error('Invalid private packet.');
  const key = await derive(privateKey, packet.sender);
  return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: decode(packet.iv) }, key, decode(packet.ciphertext))));
}
