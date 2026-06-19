# Requirements Document

## Introduction

PhotoLite는 사진 최적화 및 정리 웹 서비스이다. 사용자가 사진을 업로드하면 자동으로 WebP 변환 및 리사이즈를 통해 용량을 최적화하고, 비슷한 사진의 중복을 감지하며, 갤러리 보기와 절약된 총 용량 통계를 제공한다. 사진이 많아 용량이 부족한 일반 사용자와 블로거를 타겟으로 한다.

**기술 스택:**
- 프론트엔드: Next.js + shadcn/ui (frontend/)
- 백엔드: NestJS + pnpm (backend/)
- 데이터베이스: PostgreSQL
- 이미지 처리: sharp
- 배포: EC2(m.large) 1대 + Docker Compose, 백엔드는 프록시 뒤(외부 비노출)

## Glossary

- **Upload_Service**: 사용자가 업로드한 이미지 파일을 수신하고 검증하는 백엔드 서비스 모듈
- **Optimization_Engine**: sharp 라이브러리를 활용하여 이미지를 WebP로 변환하고 리사이즈하는 처리 엔진
- **Duplicate_Detector**: 업로드된 이미지와 기존 이미지 간의 유사도를 비교하여 중복을 감지하는 모듈
- **Gallery_Service**: 최적화된 이미지를 갤러리 형태로 조회하고 관리하는 서비스 모듈
- **Statistics_Service**: 최적화를 통해 절약된 용량 등 통계 정보를 계산하고 제공하는 서비스 모듈
- **User**: PhotoLite 서비스를 사용하는 일반 사용자 또는 블로거
- **Original_Image**: 사용자가 업로드한 원본 상태의 이미지 파일
- **Optimized_Image**: WebP 변환 및 리사이즈 처리가 완료된 이미지 파일
- **Perceptual_Hash**: 이미지의 시각적 특성을 기반으로 생성된 해시값으로 유사 이미지 비교에 사용됨
- **Similarity_Threshold**: 두 이미지가 중복으로 판단되는 유사도 기준값 (0~1 범위, 기본값 0.9)

## Requirements

### Requirement 1: 이미지 업로드 검증

**User Story:** As a User, I want to upload photos with proper validation, so that only supported and appropriate-sized files are accepted by the system.

#### Acceptance Criteria

1. WHEN a User uploads a file, THE Upload_Service SHALL accept only files with MIME type of image/jpeg, image/png, or image/webp
2. WHEN a User uploads a file exceeding 15MB (15,728,640 bytes) in size, THE Upload_Service SHALL reject the file and return an error message indicating the maximum allowed size is 15MB
3. WHEN a User uploads a file with an unsupported format, THE Upload_Service SHALL reject the file and return an error message listing the supported formats (JPEG, PNG, WebP)
4. WHEN a User uploads multiple files in a single request, THE Upload_Service SHALL validate each file independently, report validation results per file, and accept a maximum of 10 files per request
5. WHEN a User uploads a file, THE Upload_Service SHALL verify the actual file content type by inspecting file magic bytes, and IF the magic bytes do not match any of the supported image types (JPEG, PNG, WebP), THEN THE Upload_Service SHALL reject the file and return an error message indicating the file content does not match a supported image format
6. WHEN a User uploads a file with zero bytes, THE Upload_Service SHALL reject the file and return an error message indicating the file is empty
7. IF a User uploads more than 10 files in a single request, THEN THE Upload_Service SHALL reject the entire request and return an error message indicating the maximum number of files per request is 10

### Requirement 2: 이미지 최적화 (WebP 변환 및 리사이즈)

**User Story:** As a User, I want my uploaded photos to be automatically optimized, so that storage space is saved without significant quality loss.

#### Acceptance Criteria

1. WHEN a valid image file (JPEG, PNG, or WebP format, file size 15MB 이하) is uploaded, THE Optimization_Engine SHALL convert the image to WebP format
2. WHEN converting to WebP, THE Optimization_Engine SHALL use a quality setting of 80 to balance file size and visual quality
3. WHEN an image width exceeds 1920 pixels, THE Optimization_Engine SHALL resize the image to a maximum width of 1920 pixels while maintaining the original aspect ratio
4. WHEN an image height exceeds 1080 pixels and width is within 1920 pixels, THE Optimization_Engine SHALL resize the image to a maximum height of 1080 pixels while maintaining the original aspect ratio
5. WHEN optimization is complete, THE Optimization_Engine SHALL store the Original_Image metadata (original file size in bytes, original width in pixels, original height in pixels, original format) and the Optimized_Image in the system
6. WHEN a User uploads a WebP file that is already smaller in file size (bytes) than its re-encoded equivalent at quality 80, THE Optimization_Engine SHALL retain the original file without re-encoding
7. WHEN a valid image file of 15MB or less is uploaded, THE Optimization_Engine SHALL complete processing within 5 seconds on the target EC2(m.large) instance
8. IF image conversion or resizing fails due to a corrupted or unreadable image file, THEN THE Optimization_Engine SHALL reject the file, return an error message indicating the image could not be processed, and not store any partial result

### Requirement 3: 중복 사진 감지

**User Story:** As a User, I want the system to detect similar or duplicate photos, so that I can avoid storing redundant images and save storage space.

#### Acceptance Criteria

1. WHEN an image is uploaded, THE Duplicate_Detector SHALL generate a Perceptual_Hash for the Optimized_Image within 3 seconds
2. WHEN a Perceptual_Hash is generated, THE Duplicate_Detector SHALL compare the hash against all existing Perceptual_Hash values in the database and return comparison results within 5 seconds
3. WHEN the similarity score (range 0.0 to 1.0) between two images meets or exceeds the Similarity_Threshold of 0.9, THE Duplicate_Detector SHALL flag the uploaded image as a potential duplicate
4. WHEN a duplicate is detected, THE Duplicate_Detector SHALL return the duplicate status along with a list of similar existing images (maximum 10 items) including each image's ID and similarity score, sorted by similarity score in descending order
5. WHEN a duplicate is detected, THE Upload_Service SHALL still store the uploaded image but mark the duplicate relationship in the database
6. WHEN no similar image exists in the database, THE Duplicate_Detector SHALL mark the image as unique
7. IF the Perceptual_Hash generation fails due to a corrupted or unreadable image, THEN THE Duplicate_Detector SHALL skip duplicate detection, return a status indicating hash generation failure, and allow the upload process to continue without duplicate marking
8. IF the database is unavailable during hash comparison, THEN THE Duplicate_Detector SHALL skip duplicate detection, return a status indicating comparison was not performed, and allow the upload process to continue marking the image as unique by default

### Requirement 4: 갤러리 조회

**User Story:** As a User, I want to view my optimized photos in a gallery layout, so that I can browse and manage my photo collection easily.

#### Acceptance Criteria

1. WHEN a User requests the gallery view, THE Gallery_Service SHALL return a paginated list of Optimized_Image records sorted by upload date in descending order
2. IF a User does not specify a page size, THEN THE Gallery_Service SHALL return a default page size of 20 images per page, and the maximum configurable page size SHALL be 100
3. WHEN a User requests a specific page, THE Gallery_Service SHALL return the corresponding subset of images with pagination metadata (total count, current page, total pages, page size)
4. IF a User requests a page number less than 1 or greater than total pages, THEN THE Gallery_Service SHALL return an empty image list with the pagination metadata indicating zero results
5. WHEN an image has been flagged as a duplicate, THE Gallery_Service SHALL include a duplicate indicator containing the duplicate group identifier in the image metadata
6. WHEN a User requests image details, THE Gallery_Service SHALL return the original file name, upload date, original size in bytes, optimized size in bytes, and savings percentage (rounded to one decimal place)
7. THE Gallery_Service SHALL provide thumbnail URLs (maximum dimension 300px, preserving aspect ratio) for gallery grid display and full-resolution URLs for detail view
8. IF the User has no Optimized_Image records, THEN THE Gallery_Service SHALL return an empty image list with pagination metadata indicating total count of zero

### Requirement 5: 절약 용량 통계

**User Story:** As a User, I want to see how much storage space has been saved through optimization, so that I can understand the value of the service.

#### Acceptance Criteria

1. WHEN a User requests statistics, THE Statistics_Service SHALL calculate and return the total original size of all uploaded images in bytes
2. WHEN a User requests statistics, THE Statistics_Service SHALL calculate and return the total optimized size of all stored images in bytes
3. WHEN a User requests statistics, THE Statistics_Service SHALL calculate and return the total saved bytes (total original size minus total optimized size)
4. WHEN a User requests statistics, THE Statistics_Service SHALL calculate and return the savings percentage ((total saved bytes / total original size) × 100), rounded to two decimal places
5. WHEN a User requests statistics, THE Statistics_Service SHALL return the total number of uploaded images and the number of detected duplicates
6. IF no images have been uploaded (total original size is 0), THEN THE Statistics_Service SHALL return 0 for total original size, total optimized size, total saved bytes, and savings percentage without performing division
7. THE Statistics_Service SHALL return statistics within 2 seconds for up to 1,000,000 stored images
8. IF the Statistics_Service fails to retrieve data from the database, THEN THE Statistics_Service SHALL return an error response indicating that statistics are temporarily unavailable

### Requirement 6: 에러 처리 및 엣지 케이스

**User Story:** As a User, I want the system to handle errors gracefully, so that I receive clear feedback when something goes wrong and my data remains safe.

#### Acceptance Criteria

1. IF the Optimization_Engine fails to process an image due to a corrupted file (파일 헤더가 유효하지 않거나 바이트 스트림 디코딩 실패), THEN THE Upload_Service SHALL return an error message indicating the file is corrupted and cannot be processed within 3 seconds of detection
2. IF the database connection is lost during upload processing, THEN THE Upload_Service SHALL return a 503 Service Unavailable response, discard any partially processed data (임시 파일 및 미완료 DB 레코드), and free associated temporary storage within 5 seconds
3. IF the server storage exceeds 90% capacity, THEN THE Upload_Service SHALL reject new uploads and return an error message indicating insufficient storage
4. IF the Duplicate_Detector does not complete hash comparison within 5 seconds, THEN THE Upload_Service SHALL complete the upload without duplicate detection, mark the image for deferred duplicate checking, and process the deferred check within 10 minutes
5. IF a User uploads an image with identical file name to an existing image, THEN THE Upload_Service SHALL assign a unique identifier and store both images independently
6. WHEN a network interruption occurs during file upload, THE Upload_Service SHALL discard the incomplete upload data and free associated temporary storage within 30 seconds of interruption detection
7. IF the Optimization_Engine encounters an out-of-memory condition, THEN THE Optimization_Engine SHALL reject the current image processing, return a 503 response to the User within 3 seconds, and free all memory allocated for the rejected processing
8. IF any error occurs during upload processing, THEN THE Upload_Service SHALL remove all temporary files created for that upload within 60 seconds of error occurrence
