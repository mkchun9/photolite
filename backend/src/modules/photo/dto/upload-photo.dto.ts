/**
 * 멀티파트 업로드 요청 검증 DTO
 * 실제 파일 검증은 Multer FileInterceptor + custom validator에서 수행하며,
 * 이 DTO는 multipart body의 추가 필드 검증용으로 사용된다.
 *
 * 파일 자체의 검증 규칙:
 * - MIME: image/jpeg, image/png, image/webp
 * - 최대 파일 크기: 15MB (15,728,640 bytes)
 * - 최대 파일 개수: 10개/요청
 * - 빈 파일(0 bytes) 거부
 * - Magic bytes 검증 필수
 */
export class UploadPhotoDto {
  /**
   * 업로드 파일 필드명 (multipart/form-data 에서 'files' 키로 전송)
   * 실제 파일 배열은 @UploadedFiles() 데코레이터로 처리됨
   */
}
