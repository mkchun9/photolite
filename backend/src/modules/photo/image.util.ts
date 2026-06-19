import sharp from 'sharp';
import { MAX_WIDTH, WEBP_QUALITY } from './photo.constants';

/**
 * 이미지 최적화 결과 인터페이스
 */
export interface OptimizeResult {
  /** 최적화된 이미지 버퍼 */
  buffer: Buffer;
  /** 최적화 후 너비 (px) */
  width: number;
  /** 최적화 후 높이 (px) */
  height: number;
  /** 최적화 후 파일 크기 (bytes) */
  bytes: number;
  /** 출력 포맷 */
  format: 'webp';
}

/**
 * sharp 기반 이미지 최적화
 * - EXIF 자동회전 (sharp .rotate())
 * - MAX_WIDTH(2000px) 리사이즈 (fit: 'inside', withoutEnlargement: true)
 * - WebP 변환 (quality: 80)
 *
 * @param buffer - 원본 이미지 바이너리 데이터
 * @returns 최적화된 이미지 결과
 */
export async function optimizeImage(buffer: Buffer): Promise<OptimizeResult> {
  const optimizedBuffer = await sharp(buffer)
    .rotate() // EXIF 자동회전
    .resize(MAX_WIDTH, undefined, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  const metadata = await sharp(optimizedBuffer).metadata();

  return {
    buffer: optimizedBuffer,
    width: metadata.width!,
    height: metadata.height!,
    bytes: optimizedBuffer.length,
    format: 'webp',
  };
}

/**
 * Average Hash (aHash) - 64-bit perceptual hash 생성
 *
 * 알고리즘:
 * 1. sharp로 8x8 리사이즈, grayscale 변환
 * 2. 64개 픽셀의 평균 밝기 계산
 * 3. 각 픽셀 >= 평균이면 1, 아니면 0
 * 4. 64-bit hash를 16자 hex string으로 반환
 *
 * @param buffer - 이미지 바이너리 데이터
 * @returns 16자 hex string (64-bit hash)
 */
export async function averageHash(buffer: Buffer): Promise<string> {
  const pixels = await sharp(buffer)
    .resize(8, 8, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer();

  // 64개 픽셀의 평균 밝기 계산
  let sum = 0;
  for (let i = 0; i < 64; i++) {
    sum += pixels[i];
  }
  const avg = sum / 64;

  // 각 픽셀이 평균 이상이면 1, 미만이면 0 → 64-bit hash
  let hash = BigInt(0);
  for (let i = 0; i < 64; i++) {
    if (pixels[i] >= avg) {
      hash |= BigInt(1) << BigInt(63 - i);
    }
  }

  return hash.toString(16).padStart(16, '0');
}

/**
 * 두 hex hash 간 Hamming Distance 계산
 * 서로 다른 비트 수를 반환한다.
 *
 * @param hash1 - 16자 hex string (64-bit hash)
 * @param hash2 - 16자 hex string (64-bit hash)
 * @returns 다른 비트 수 (0~64)
 */
export function hammingDistance(hash1: string, hash2: string): number {
  const h1 = BigInt('0x' + hash1);
  const h2 = BigInt('0x' + hash2);
  let xor = h1 ^ h2;
  let distance = 0;

  while (xor > 0n) {
    distance += Number(xor & 1n);
    xor >>= 1n;
  }

  return distance;
}
