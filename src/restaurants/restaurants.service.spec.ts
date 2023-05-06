import { Test, TestingModule } from '@nestjs/testing';
import { RestaurantsService } from './restaurants.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Restaurant } from './entities/restaurant.entity';
import { MockRepository, mockRepository } from '../mocks/mock.repository';
import { Dish } from './entities/dish.entity';
import { CategoryRepository } from './repositories/category.repository';
import { User } from '../users/entities/user.entity';
import { Category } from './entities/category.entity';

const mockCategoryRepository = () => {
  return {
    ...mockRepository(),
    getOrCreate: jest.fn(),
  };
};

describe('RestaurantsService', () => {
  let service: RestaurantsService;
  let restaurantRepository: MockRepository<Restaurant>;
  let dishRepository: MockRepository<Dish>;
  let categoryRepository: MockRepository<Category> & { getOrCreate: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RestaurantsService,
        {
          provide: getRepositoryToken(Restaurant),
          useValue: mockRepository(),
        },
        { provide: CategoryRepository, useValue: mockCategoryRepository() },
        { provide: getRepositoryToken(Dish), useValue: mockRepository() },
      ],
    }).compile();

    service = module.get<RestaurantsService>(RestaurantsService);
    restaurantRepository = module.get(getRepositoryToken(Restaurant));
    dishRepository = module.get(getRepositoryToken(Dish));
    categoryRepository = module.get(CategoryRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  let user = new User();
  user.id = 1;
  const category = { id: 1, name: 'fake_category', slug: 'fake_slug' };
  const restaurant = new Restaurant();
  restaurant.id = 1;
  restaurant.ownerId = 1;
  restaurant.owner = user;

  describe('checkRestaurantEditable', () => {
    const restaurantId = 1;
    it('should check restaurant editable', async () => {
      restaurantRepository.findOneOrFail.mockResolvedValue(restaurant);
      const res = await service.checkRestaurantEditable(user, restaurantId);
      expect(restaurantRepository.findOneOrFail).toHaveBeenCalled();
      expect(restaurantRepository.findOneOrFail).toHaveBeenCalledWith({
        where: {
          id: restaurantId,
        },
      });

      expect(res).toMatchObject({
        ok: true,
        restaurant,
      });
    });
    it('should fail if there is no restaurant', async () => {
      restaurantRepository.findOneOrFail.mockResolvedValue(null);
      const res = await service.checkRestaurantEditable(user, restaurantId);
      expect(res).toMatchObject({
        ok: false,
        error: 'Restaurant not found',
      });
    });
    it('should fail if unauthorized user', async () => {
      const restaurant = {
        ownerId: 2,
      };
      restaurantRepository.findOneOrFail.mockResolvedValue(restaurant);
      const res = await service.checkRestaurantEditable(user, restaurantId);
      expect(res).toMatchObject({
        ok: false,
        error: 'Can not edit restaurant that you do not own',
      });
    });
    it('should fail on error', async () => {
      restaurantRepository.findOneOrFail.mockRejectedValue(new Error());
      const res = await service.checkRestaurantEditable(user, restaurantId);
      expect(res).toMatchObject({
        ok: false,
        error: 'Could not edit restaurant',
      });
    });
  });

  describe('createRestaurant', () => {
    const createRestaurantInput = {
      name: 'my_restaurant',
      categoryName: 'fake_category',
      slug: 'fake_slug',
      address: 'Korea',
    };
    it('should create restaurant', async () => {
      restaurantRepository.create.mockResolvedValue(restaurant);
      categoryRepository.getOrCreate.mockResolvedValue(category);
      const res = await service.createRestaurant(user, createRestaurantInput);

      expect(restaurantRepository.create).toHaveBeenCalled();
      expect(restaurantRepository.create).toHaveBeenCalledWith({
        ...createRestaurantInput,
        owner: user,
      });
      expect(categoryRepository.getOrCreate).toHaveBeenCalled();
      expect(categoryRepository.getOrCreate).toHaveBeenCalledWith(
        createRestaurantInput.categoryName,
      );
      expect(restaurantRepository.save).toHaveBeenCalled();

      expect(res).toMatchObject({
        ok: true,
      });
    });
    it('should fail on error', async () => {
      restaurantRepository.create.mockRejectedValue(new Error());
      const res = await service.createRestaurant(user, createRestaurantInput);
      expect(res).toMatchObject({
        ok: false,
        error: 'Fail to create a restaurant',
      });
    });

    describe('editRestaurant', () => {
      const editRestaurantInput = {
        restaurantId: 1,
        categoryName: 'new_ct_name',
      };
      it('should edit restaurant', async () => {
        jest
          .spyOn(service, 'checkRestaurantEditable')
          .mockImplementation((owner: User, restaurantId: number) => {
            return new Promise((resolve) => {
              resolve({ ok: true });
            });
          });
        categoryRepository.getOrCreate.mockResolvedValue(category);
        const res = await service.editRestaurant(user, editRestaurantInput);
        expect(service.checkRestaurantEditable).toHaveBeenCalled();
        expect(service.checkRestaurantEditable).toHaveBeenCalledWith(
          user,
          editRestaurantInput.restaurantId,
        );
        expect(categoryRepository.getOrCreate).toHaveBeenCalled();
        expect(categoryRepository.getOrCreate).toHaveBeenCalledWith(
          editRestaurantInput.categoryName,
        );
        expect(restaurantRepository.save).toHaveBeenCalled();
        expect(restaurantRepository.save).toHaveBeenCalledWith([
          {
            id: editRestaurantInput.restaurantId,
            ...editRestaurantInput,
            category,
          },
        ]);
        expect(res).toMatchObject({ ok: true });
      });
      it('should fail if not editable', async () => {
        const checkEditableFailResult = {
          ok: false,
        };
        jest
          .spyOn(service, 'checkRestaurantEditable')
          .mockImplementation((owner: User, restaurantId: number) => {
            return new Promise((resolve) => {
              resolve(checkEditableFailResult);
            });
          });

        const res = await service.editRestaurant(user, editRestaurantInput);
        expect(res).toMatchObject(checkEditableFailResult);
      });
      it('should fail on error', async () => {
        restaurantRepository.save.mockRejectedValue(new Error());
        const res = await service.editRestaurant(user, editRestaurantInput);
        expect(res).toMatchObject({
          ok: false,
        });
      });
    });

    describe('deleteRestaurant', () => {
      const deleteRestaurantInput = { restaurantId: 1 };
      it('should fail if not editable', async () => {
        const checkEditableFailResult = {
          ok: false,
        };
        jest
          .spyOn(service, 'checkRestaurantEditable')
          .mockImplementation((owner: User, restaurantId: number) => {
            return new Promise((resolve) => {
              resolve(checkEditableFailResult);
            });
          });

        const res = await service.deleteRestaurant(user, deleteRestaurantInput);
        expect(res).toMatchObject(checkEditableFailResult);
      });

      it('should delete restaurant', async () => {
        const checkEditableResult = {
          ok: true,
          restaurant,
        };
        jest
          .spyOn(service, 'checkRestaurantEditable')
          .mockImplementation((owner: User, restaurantId: number) => {
            return new Promise((resolve) => {
              resolve(checkEditableResult);
            });
          });
        const res = await service.deleteRestaurant(user, deleteRestaurantInput);
        expect(restaurantRepository.delete).toHaveBeenCalled();
        expect(restaurantRepository.delete).toHaveBeenCalledWith(
          checkEditableResult.restaurant.id,
        );
        expect(res).toMatchObject({ ok: true });
      });
      it('should fail on error', async () => {
        const checkEditableResult = {
          ok: true,
          restaurant,
        };
        jest
          .spyOn(service, 'checkRestaurantEditable')
          .mockImplementation((owner: User, restaurantId: number) => {
            return new Promise((resolve) => {
              resolve(checkEditableResult);
            });
          });
        restaurantRepository.delete.mockRejectedValue(new Error());
        const res = await service.deleteRestaurant(user, deleteRestaurantInput);
        expect(res).toMatchObject({
          ok: false,
          error: 'Could not delete restaurant',
        });
      });
    });
    describe('allCategories', () => {
      it('should return all categories', async () => {
        const categories = [];
        categoryRepository.find.mockResolvedValue(categories);
        const res = await service.allCategories();
        expect(categoryRepository.find).toHaveBeenCalled();
        expect(categoryRepository.find).toHaveBeenCalledWith();
        expect(res).toMatchObject({ ok: true, categories });
      });
      it('should fail on error', async () => {
        categoryRepository.find.mockRejectedValue(new Error());
        const res = await service.allCategories();
        expect(res).toMatchObject({
          ok: false,
          error: 'Could not get all categories',
        });
      });
    });
  });
});
