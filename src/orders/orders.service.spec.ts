import { Test, TestingModule } from '@nestjs/testing';
import { OrderService } from './orders.service';
import { mockRepository, MockRepository } from '../mocks/mock.repository';
import { Order } from './entities/order.entity';
import { Restaurant } from '../restaurants/entities/restaurant.entity';
import { Dish } from '../restaurants/entities/dish.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OrderItem } from './entities/order-item.entity';
import { User } from '../users/entities/user.entity';

describe('OrderService', () => {
  let service: OrderService;
  let orders: MockRepository<Order>;
  let restaurants: MockRepository<Restaurant>;
  let dishes: MockRepository<Dish>;
  let orderItems: MockRepository<OrderItem>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        {
          provide: getRepositoryToken(Order),
          useValue: mockRepository(),
        },
        {
          provide: getRepositoryToken(Restaurant),
          useValue: mockRepository(),
        },
        {
          provide: getRepositoryToken(Dish),
          useValue: mockRepository(),
        },
        {
          provide: getRepositoryToken(OrderItem),
          useValue: mockRepository(),
        },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
    orders = module.get(getRepositoryToken(Order));
    restaurants = module.get(getRepositoryToken(Restaurant));
    dishes = module.get(getRepositoryToken(Dish));
    orderItems = module.get(getRepositoryToken(OrderItem));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createOrder', () => {
    const user = new User();

    it('should create an order', async () => {
      const restaurant = {};
      restaurants.findOne.mockResolvedValue(restaurant);
      const dish = {
        price: 100,
        options: [
          {
            name: 'sauce',
            choices: [
              {
                name: 'hot sauce',
                extra: 50,
              },
            ],
          },
          { name: 'pickle', extra: 30 },
        ],
      };
      dishes.findOne.mockResolvedValue(dish);

      const createOrderInput = {
        restaurantId: 999,
        items: [
          {
            dishId: 1,
            choices: [
              {
                name: 'sauce',
                choice: 'hot sauce',
              },
            ],
          },
        ],
      };
      const res = await service.createOrder(user, createOrderInput);
      expect(res).toMatchObject({
        ok: true,
      });
    });
    it('should fail if restaurantId does not exist', async () => {
      const createOrderInput = { restaurantId: 999, items: [] };

      const res = await service.createOrder(user, createOrderInput);
      expect(res).toMatchObject({
        ok: false,
        error: 'Could not find restaurant',
      });
    });
    it('should fail if dishId does not exist', async () => {
      const restaurant = {};
      restaurants.findOne.mockResolvedValue(restaurant);
      dishes.findOne.mockResolvedValue(null);

      const createOrderInput = {
        restaurantId: 999,
        items: [
          {
            dishId: 1,
            choices: [
              {
                name: 'sauce',
                choice: 'hot sauce',
              },
            ],
          },
        ],
      };
      const res = await service.createOrder(user, createOrderInput);
      expect(res).toMatchObject({
        ok: false,
        error: 'Could not find dish',
      });
    });
    it('should fail on error', async () => {
      restaurants.findOne.mockRejectedValue(new Error());
      const createOrderInput = {
        restaurantId: 999,
        items: [
          {
            dishId: 1,
            choices: [
              {
                name: 'sauce',
                choice: 'hot sauce',
              },
            ],
          },
        ],
      };
      const res = await service.createOrder(user, createOrderInput);
      expect(res).toMatchObject({
        ok: false,
        error: 'Could not create an order',
      });
    });
  });
});
