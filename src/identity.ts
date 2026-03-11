// ============================================
// 鹰爪技能 · 密钥对管理
// ============================================
//
// 功能：
// 1. 生成 Ed25519 密钥对
// 2. 从 hex 加载密钥对
// 3. 签名 SignedEnvelope
//
// 命令行：tsx src/identity.ts --generate
// ============================================

import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';
import { randomBytes } from 'node:crypto';
import { nanoid } from 'nanoid';
import type { SignedEnvelope, KeyPair } from './types.js';

// ed25519 需要 sha512
ed.etc.sha512Sync = (...m: Uint8Array[]) => {
  const h = sha512.create();
  for (const msg of m) h.update(msg);
  return h.digest();
};

/**
 * 生成新的 Ed25519 密钥对
 */
export function generateKeyPair(): KeyPair {
  const privateKeyBytes = randomBytes(32);
  const publicKeyBytes = ed.getPublicKey(privateKeyBytes);

  return {
    privateKey: Buffer.from(privateKeyBytes).toString('hex'),
    publicKey: Buffer.from(publicKeyBytes).toString('hex'),
  };
}

/**
 * 从 hex 字符串加载密钥对
 */
export function loadKeyPair(privateKeyHex: string): KeyPair {
  const privateKeyBytes = Buffer.from(privateKeyHex, 'hex');
  const publicKeyBytes = ed.getPublicKey(privateKeyBytes);

  return {
    privateKey: privateKeyHex,
    publicKey: Buffer.from(publicKeyBytes).toString('hex'),
  };
}

/**
 * 构造并签名一个 SignedEnvelope
 */
export async function signEnvelope<T>(
  privateKeyHex: string,
  publicKeyHex: string,
  action: string,
  payload: T,
): Promise<SignedEnvelope<T>> {
  const envelope: Omit<SignedEnvelope<T>, 'signature'> = {
    publicKey: publicKeyHex,
    action,
    payload,
    timestamp: Date.now(),
    nonce: nanoid(16),
  };

  // 签名内容 = action + publicKey + timestamp + nonce + JSON(payload)
  const message = `${envelope.action}:${envelope.publicKey}:${envelope.timestamp}:${envelope.nonce}:${JSON.stringify(envelope.payload)}`;
  const messageBytes = new TextEncoder().encode(message);
  const privateKeyBytes = Buffer.from(privateKeyHex, 'hex');

  const signatureBytes = await ed.signAsync(messageBytes, privateKeyBytes);
  const signature = Buffer.from(signatureBytes).toString('hex');

  return {
    ...envelope,
    signature,
  };
}

// ---- CLI：密钥生成 ----
if (process.argv.includes('--generate')) {
  const kp = generateKeyPair();
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║       鹰爪技能 · Ed25519 密钥对生成              ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║ Private Key: ${kp.privateKey}`);
  console.log(`║ Public Key:  ${kp.publicKey}`);
  console.log('╠══════════════════════════════════════════════════╣');
  console.log('║ 请将以上密钥填入 .env 文件：                      ║');
  console.log(`║ NODE_PRIVATE_KEY=${kp.privateKey}`);
  console.log(`║ NODE_PUBLIC_KEY=${kp.publicKey}`);
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
}
