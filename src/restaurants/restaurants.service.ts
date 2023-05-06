import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Restaurant } from './entities/restaurant.entity';
import { ILike, Repository } from 'typeorm';
import {
  CreateRestaurantInput,
  CreateRestaurantOutput,
} from './dtos/create-restaurant.dto';
import { User } from '../users/entities/user.entity';
import {
  EditRestaurantInput,
  EditRestaurantOutput,
} from './dtos/edit-restaurant.dto';
import { CategoryRepository } from './repositories/category.repository';
import { Category } from './entities/category.entity';
import {
  DeleteRestaurantInput,
  DeleteRestaurantOutput,
} from './dtos/delete-restaurant.dto';
import { CoreOutput } from '../common/dtos/output.dto';
import { AllCategoriesOutput } from './dtos/all-categories.dto';
import { CategoryInput, CategoryOutput } from './dtos/category.dto';
import { RestaurantsInput, RestaurantsOutput } from './dtos/restaurants.dto';
import { RestaurantInput, RestaurantOutput } from './dtos/restaurant.dto';
import {
  SearchRestaurantInput,
  SearchRestaurantOutput,
} from './dtos/search-restaurant.dto';
import { CreateDishInput, CreateDishOutput } from './dtos/create-dish.dto';
import { Dish } from './entities/dish.entity';
import { EditDishInput, EditDishOutput } from './dtos/edit-dish.dto';
import { DeleteDishInput, DeleteDishOutput } from './dtos/delete-dish.dto';

@Injectable()
export class RestaurantsService {
  private PAGE_SIZE = 25;

  constructor(
    @InjectRepository(Restaurant)
    private readonly restaurants: Repository<Restaurant>,
    private readonly categories: CategoryRepository,
    @InjectRepository(Dish)
    private readonly dishes: Repository<Dish>,
  ) {}

  async checkRestaurantEditable(
    owner: User,
    restaurantId: number,
  ): Promise<CoreOutput & { restaurant?: Restaurant }> {
    try {
      const restaurant = await this.restaurants.findOneOrFail({
        where: {
          id: restaurantId,
        },
      });
      if (!restaurant) {
        return {
          ok: false,
          error: 'Restaurant not found',
        };
      }
      if (owner.id !== restaurant.ownerId) {
        return {
          ok: false,
          error: 'Can not edit restaurant that you do not own',
        };
      }
      return { ok: true, restaurant };
    } catch (e) {
      console.error(e);
      return {
        ok: false,
        error: 'Could not edit restaurant',
      };
    }
  }

  async createRestaurant(
    owner: User,
    createRestaurantInput: CreateRestaurantInput,
  ): Promise<CreateRestaurantOutput> {
    try {
      const newRestaurant = await this.restaurants.create({
        ...createRestaurantInput,
        owner,
      });

      newRestaurant.category = await this.categories.getOrCreate(
        createRestaurantInput.categoryName,
      );
      await this.restaurants.save(newRestaurant);
      return {
        ok: true,
      };
    } catch (err) {
      return {
        ok: false,
        error: 'Fail to create a restaurant',
      };
    }
  }

  async editRestaurant(
    owner: User,
    editRestaurantInput: EditRestaurantInput,
  ): Promise<EditRestaurantOutput> {
    try {
      const checkResult = await this.checkRestaurantEditable(
        owner,
        editRestaurantInput.restaurantId,
      );
      if (!checkResult.ok) {
        return checkResult;
      }

      let category: Category = null;
      if (editRestaurantInput.categoryName) {
        category = await this.categories.getOrCreate(
          editRestaurantInput.categoryName,
        );
      }
      await this.restaurants.save([
        {
          id: editRestaurantInput.restaurantId,
          ...editRestaurantInput,
          ...(category && { category }),
        },
      ]);

      return { ok: true };
    } catch (err) {
      console.error(err);
      return { ok: false };
    }
  }

  async deleteRestaurant(
    owner: User,
    { restaurantId }: DeleteRestaurantInput,
  ): Promise<DeleteRestaurantOutput> {
    try {
      const checkResult = await this.checkRestaurantEditable(
        owner,
        restaurantId,
      );
      if (!checkResult.ok) {
        return checkResult;
      }

      await this.restaurants.delete(checkResult.restaurant.id);
      return {
        ok: true,
      };
    } catch (err) {
      console.error(err);
      return {
        ok: false,
        error: 'Could not delete restaurant',
      };
    }
  }

  async allCategories(): Promise<AllCategoriesOutput> {
    try {
      const categories = await this.categories.find();
      return {
        ok: true,
        categories,
      };
    } catch (e) {
      console.error(e);
      return {
        ok: false,
        error: 'Could not get all categories',
      };
    }
  }

  countRestaurant(category: Category): Promise<number> {
    return this.restaurants.count({
      where: {
        category: {
          id: category.id,
        },
      },
    });
  }

  async findCategoryBySlug({
    slug,
    page,
  }: CategoryInput): Promise<CategoryOutput> {
    try {
      const category = await this.categories.findOne({
        where: { slug },
        relations: ['restaurants'],
      });
      if (!category) {
        return {
          ok: false,
          error: 'Could not find category',
        };
      }
      category.restaurants = await this.restaurants.find({
        where: {
          category: {
            id: category.id,
          },
        },
        take: this.PAGE_SIZE,
        skip: (page - 1) * this.PAGE_SIZE,
        order: {
          isPromoted: 'DESC',
        },
      });

      const totalResults = await this.countRestaurant(category);

      return {
        ok: true,
        category,
        totalPages: Math.ceil(totalResults / this.PAGE_SIZE),
      };
    } catch (e) {
      return {
        ok: false,
        error: `Could not load category`,
      };
    }
  }

  async allRestaurants({ page }: RestaurantsInput): Promise<RestaurantsOutput> {
    try {
      const [restaurants, totalResults] = await this.restaurants.findAndCount({
        take: this.PAGE_SIZE,
        skip: (page - 1) * this.PAGE_SIZE,
        relations: ['owner'],
        order: {
          isPromoted: 'DESC',
        },
      });
      return {
        ok: true,
        results: restaurants,
        totalPages: Math.ceil(totalResults / this.PAGE_SIZE),
        totalResults,
      };
    } catch (err) {
      console.error(err);
      return {
        ok: false,
        error: 'Could not find restaurants',
      };
    }
  }

  async findRestaurantById({
    restaurantId,
  }: RestaurantInput): Promise<RestaurantOutput> {
    try {
      const restaurant = await this.restaurants.findOne({
        where: { id: restaurantId },
        relations: ['menu'],
      });
      if (!restaurant) {
        return {
          ok: false,
          error: 'Restaurant does not exist',
        };
      }
      return {
        ok: true,
        restaurant,
      };
    } catch (err) {
      return {
        ok: false,
        error: 'Could not find restaurant',
      };
    }
  }

  async searchRestaurantByName({
    query,
    page,
  }: SearchRestaurantInput): Promise<SearchRestaurantOutput> {
    try {
      const [restaurants, totalResults] = await this.restaurants.findAndCount({
        take: this.PAGE_SIZE,
        skip: (page - 1) * this.PAGE_SIZE,
        where: {
          name: ILike(`%${query}%`),
        },
        order: {
          isPromoted: 'DESC',
        },
      });
      return {
        ok: true,
        restaurants,
        totalPages: Math.ceil(totalResults / this.PAGE_SIZE),
        totalResults,
      };
    } catch (e) {
      return {
        ok: false,
        error: 'Could not search restaurant',
      };
    }
  }

  async createDish(
    owner: User,
    createDishInput: CreateDishInput,
  ): Promise<CreateDishOutput> {
    try {
      const restaurant = await this.restaurants.findOne({
        where: { id: createDishInput.restaurantId },
      });
      if (!restaurant) {
        return { ok: false, error: 'There is no restaurant with that id' };
      }
      if (owner.id !== restaurant.ownerId) {
        return { ok: false, error: 'Not allowed account to do this' };
      }
      await this.dishes.save(
        this.dishes.create({ ...createDishInput, restaurant }),
      );

      return {
        ok: true,
      };
    } catch (e) {
      console.error(e);
      return {
        ok: false,
        error: 'Could not create a dish',
      };
    }
  }

  async editDish(
    owner: User,
    editDishInput: EditDishInput,
  ): Promise<EditDishOutput> {
    try {
      const dish = await this.dishes.findOne({
        where: { id: editDishInput.dishId },
        relations: ['restaurant'],
      });
      if (!dish) {
        return {
          ok: false,
          error: 'There is no dish',
        };
      }
      if (dish.restaurant.ownerId !== owner.id) {
        return { ok: false, error: 'Unauthorized user' };
      }

      await this.dishes.save([
        {
          id: editDishInput.dishId,
          ...editDishInput,
        },
      ]);
      return {
        ok: true,
      };
    } catch (e) {
      console.error(e);
      return {
        ok: false,
        error: 'Could not edit dish',
      };
    }
  }

  async deleteDish(
    owner: User,
    { dishId }: DeleteDishInput,
  ): Promise<DeleteDishOutput> {
    try {
      const dish = await this.dishes.findOne({
        where: { id: dishId },
        relations: ['restaurant'],
      });
      if (!dish) {
        return {
          ok: false,
          error: 'There is no dish',
        };
      }
      if (dish.restaurant.ownerId !== owner.id) {
        return { ok: false, error: 'Unauthorized user' };
      }

      await this.dishes.delete({ id: dishId });
      return {
        ok: true,
      };
    } catch (e) {
      console.error(e);
      return {
        ok: false,
        error: 'Could not delete the dish',
      };
    }
  }
}
