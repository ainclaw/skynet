import * as nacl from 'tweetnacl';
import * as util from 'tweetnacl-util';
import { CONFIG } from './config';

export class Identity {
  private keyPair: nacl.SignKeyPair;

  constructor() {
    if (CONFIG.PRIVATE_KEY) {
      try {
        const secretKey = util.decodeBase64(CONFIG.PRIVATE_KEY);
        this.keyPair = nacl.sign.keyPair.fromSecretKey(secretKey);
      } catch (e) {
        console.error('❌ 私钥格式错误，生成临时身份');
        this.keyPair = nacl.sign.keyPair();
      }
    } else {
      this.keyPair = nacl.sign.keyPair();
      console.log('⚠️ 未配置私钥，使用临时身份');
    }
    console.log(`🔑 节点公钥: ${util.encodeBase64(this.keyPair.publicKey)}`);
  }

  getPublicKey(): string {
    return util.encodeBase64(this.keyPair.publicKey);
  }

  sign(message: string): string {
    const msgBytes = util.decodeUTF8(message);
    const signature = nacl.sign.detached(msgBytes, this.keyPair.secretKey);
    return util.encodeBase64(signature);
  }
}
