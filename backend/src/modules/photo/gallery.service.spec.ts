import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { GalleryService } from './gallery.service';
import { Photo } from './entities/photo.entity';
import { GalleryQueryDto } from './dto/gallery-query.dto';

describe('GalleryService', () => {
  let service: GalleryService;

  const mockPhotos: Photo[] = Array.from({ length: 5 }, (_, i) => ({
    id: `uuid-${i + 1}`,
    fileName: `photo-${i + 1}.jpg`,
    hash: i < 3 ? 'aabbccdd11223344' : `uniquehash0000000${i}`,
    originalBytes: 1000000,
    optimizedBytes: 700000,
    width: 1920,
    height: 1080,
    createdAt: new Date(`2024-01-0${5 - i}T00:00:00Z`),
  }));

  const mockRepository = {
    count: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    having: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
  };

  beforeEach(async () => {
    mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.getRawMany.mockResolvedValue([
      { hash: 'aabbccdd11223344' },
    ]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GalleryService,
        {
          provide: getRepositoryToken(Photo),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<GalleryService>(GalleryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getGallery', () => {
    it('should return paginated gallery with correct metadata', async () => {
      mockRepository.count.mockResolvedValue(50);
      mockRepository.find.mockResolvedValue(mockPhotos);

      const query: GalleryQueryDto = { page: 1, pageSize: 20 };
      const result = await service.getGallery(query);

      expect(result.pagination).toEqual({
        totalCount: 50,
        currentPage: 1,
        totalPages: 3,
        pageSize: 20,
      });
      expect(result.images).toHaveLength(5);
      expect(mockRepository.find).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 20,
      });
    });

    it('should return empty images for out-of-range page (page > totalPages)', async () => {
      mockRepository.count.mockResolvedValue(10);

      const query: GalleryQueryDto = { page: 5, pageSize: 20 };
      const result = await service.getGallery(query);

      expect(result.images).toEqual([]);
      expect(result.pagination).toEqual({
        totalCount: 10,
        currentPage: 5,
        totalPages: 1,
        pageSize: 20,
      });
      expect(mockRepository.find).not.toHaveBeenCalled();
    });

    it('should return empty images when totalCount is 0', async () => {
      mockRepository.count.mockResolvedValue(0);

      const query: GalleryQueryDto = { page: 1, pageSize: 20 };
      const result = await service.getGallery(query);

      expect(result.images).toEqual([]);
      expect(result.pagination.totalPages).toBe(0);
      expect(result.pagination.totalCount).toBe(0);
    });

    it('should correctly calculate skip for page 2', async () => {
      mockRepository.count.mockResolvedValue(50);
      mockRepository.find.mockResolvedValue([]);

      const query: GalleryQueryDto = { page: 2, pageSize: 20 };
      await service.getGallery(query);

      expect(mockRepository.find).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
        skip: 20,
        take: 20,
      });
    });

    it('should map photos to PhotoResponse with correct fields', async () => {
      mockRepository.count.mockResolvedValue(5);
      mockRepository.find.mockResolvedValue([mockPhotos[0]]);

      const query: GalleryQueryDto = { page: 1, pageSize: 20 };
      const result = await service.getGallery(query);

      const image = result.images[0];
      expect(image.id).toBe('uuid-1');
      expect(image.fileName).toBe('photo-1.jpg');
      expect(image.thumbnailUrl).toBe('/uploads/thumbnails/uuid-1.webp');
      expect(image.fullUrl).toBe('/uploads/uuid-1.webp');
      expect(image.savingsPercent).toBe(30);
      expect(image.isDuplicate).toBe(true);
    });

    it('should mark non-duplicate photos correctly', async () => {
      mockRepository.count.mockResolvedValue(5);
      mockRepository.find.mockResolvedValue([mockPhotos[3]]);

      const query: GalleryQueryDto = { page: 1, pageSize: 20 };
      const result = await service.getGallery(query);

      expect(result.images[0].isDuplicate).toBe(false);
    });
  });

  describe('getPhotoDetail', () => {
    it('should return photo detail with all fields', async () => {
      mockRepository.findOne.mockResolvedValue(mockPhotos[0]);

      const result = await service.getPhotoDetail('uuid-1');

      expect(result.id).toBe('uuid-1');
      expect(result.fileName).toBe('photo-1.jpg');
      expect(result.originalBytes).toBe(1000000);
      expect(result.optimizedBytes).toBe(700000);
      expect(result.savingsPercent).toBe(30);
      expect(result.thumbnailUrl).toBe('/uploads/thumbnails/uuid-1.webp');
      expect(result.fullUrl).toBe('/uploads/uuid-1.webp');
      expect(result.isDuplicate).toBe(true);
    });

    it('should throw NotFoundException for non-existent photo', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.getPhotoDetail('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('savingsPercent calculation', () => {
    it('should round to 1 decimal place', async () => {
      const photo: Photo = {
        ...mockPhotos[0],
        originalBytes: 3000,
        optimizedBytes: 1000,
      };
      mockRepository.count.mockResolvedValue(1);
      mockRepository.find.mockResolvedValue([photo]);

      const query: GalleryQueryDto = { page: 1, pageSize: 20 };
      const result = await service.getGallery(query);

      // (3000 - 1000) / 3000 * 100 = 66.6666... → 66.7
      expect(result.images[0].savingsPercent).toBe(66.7);
    });

    it('should return 0 when originalBytes is 0', async () => {
      const photo: Photo = {
        ...mockPhotos[0],
        originalBytes: 0,
        optimizedBytes: 0,
      };
      mockRepository.count.mockResolvedValue(1);
      mockRepository.find.mockResolvedValue([photo]);

      const query: GalleryQueryDto = { page: 1, pageSize: 20 };
      const result = await service.getGallery(query);

      expect(result.images[0].savingsPercent).toBe(0);
    });
  });
});
