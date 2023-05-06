import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Order, OrderStatus } from './entities/order.entity';
import { Repository } from 'typeorm';
import { User, UserRole } from '../users/entities/user.entity';
import { CreateOrderInput, CreateOrderOutput } from './dtos/create-order.dto';
import { Restaurant } from '../restaurants/entities/restaurant.entity';
import { OrderItem } from './entities/order-item.entity';
import { Dish } from '../restaurants/entities/dish.entity';
import { GetOrdersInput, GetOrdersOutput } from './dtos/get-orders.dto';
import { GetOrderInput, GetOrderOutput } from './dtos/get-order.dto';
import { EditOrderInput, EditOrderOutput } from './dtos/edit-order.dto';
import {
  NEW_COOKED_ORDER,
  NEW_ORDER_UPDATE,
  NEW_PENDING_ORDER,
  PUB_SUB,
} from '../common/common.constants';
import { PubSub } from 'graphql-subscriptions';
import { OrderUpdatesInput } from './dtos/order-updates.dto';
import { TakeOrderInput, TakeOrderOutput } from './dtos/take-order.dto';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orders: Repository<Order>,
    @InjectRepository(Restaurant)
    private readonly restaurants: Repository<Restaurant>,
    @InjectRepository(OrderItem)
    private readonly orderItems: Repository<OrderItem>,
    @InjectRepository(Dish)
    private readonly dishes: Repository<Dish>,
    @Inject(PUB_SUB)
    private readonly pubSub: PubSub,
  ) {}

  canSeeOrder(user: User, order: Order): boolean {
    let isAllowed = false;
    switch (user.role) {
      case UserRole.Client:
        isAllowed = order.customerId === user.id;
        break;
      case UserRole.Delivery:
        isAllowed = order.driverId === user.id;
        break;

      case UserRole.Owner:
        isAllowed = order.restaurant.ownerId === user.id;
        break;
    }
    return isAllowed;
  }

  async createOrder(
    customer: User,
    { restaurantId, items }: CreateOrderInput,
  ): Promise<CreateOrderOutput> {
    try {
      const restaurant = await this.restaurants.findOne({
        where: { id: restaurantId },
      });
      if (!restaurant) {
        return { ok: false, error: 'Could not find restaurant' };
      }

      let orderTotalPrice = 0;
      const orderItems = [];

      for (const item of items) {
        const dish = await this.dishes.findOne({
          where: { id: item.dishId },
        });
        if (!dish) {
          //abort whole operation
          return {
            ok: false,
            error: 'Could not find dish',
          };
        }
        let dishTotalPrice = dish.price;

        for (const itemOption of item.choices) {
          const dishOption = dish.options.find(
            (option) => option.name === itemOption.name,
          );
          if (!dishOption) continue;

          if (dishOption.extra) {
            dishTotalPrice += dishOption.extra;
          } else {
            const dishOptionChoice = dishOption.choices.find(
              (optionChoice) => optionChoice.name === itemOption.choice,
            );
            if (dishOptionChoice && dishOptionChoice.extra) {
              dishTotalPrice += dishOptionChoice.extra;
            }
          }
        }

        orderItems.push(
          await this.orderItems.save(
            this.orderItems.create({
              dish,
              choices: item.choices,
            }),
          ),
        );

        orderTotalPrice += dishTotalPrice;
      }

      const order = await this.orders.save(
        this.orders.create({
          customer,
          restaurant,
          total: orderTotalPrice,
          items: orderItems,
        }),
      );

      await this.pubSub.publish(NEW_PENDING_ORDER, {
        pendingOrders: { order, ownerId: restaurant.ownerId },
      });

      return {
        ok: true,
      };
    } catch (e) {
      console.error(e);
      return {
        ok: false,
        error: 'Could not create an order',
      };
    }
  }

  async getOrders(
    user: User,
    { status }: GetOrdersInput,
  ): Promise<GetOrdersOutput> {
    try {
      let orders: Order[] = [];
      switch (user.role) {
        case UserRole.Client:
          orders = await this.orders.find({
            where: {
              customer: {
                id: user.id,
              },
              ...(status && { status }),
            },
          });
          break;
        case UserRole.Delivery:
          orders = await this.orders.find({
            where: {
              driver: {
                id: user.id,
              },
              ...(status && { status }),
            },
          });
          break;
        case UserRole.Owner:
          const restaurants = await this.restaurants.find({
            where: {
              ownerId: user.id,
            },
            relations: ['orders'],
          });
          orders = restaurants
            .map((restaurant) => {
              return restaurant.orders;
            })
            .flat(1);
          if (status) {
            orders = orders.filter((order) => order.status === status);
          }
      }
      return {
        ok: true,
        orders,
      };
    } catch (e) {
      console.error(e);
      return {
        ok: false,
        error: 'Could not get orders',
      };
    }
  }

  async getOrder(
    user: User,
    { id: orderId }: GetOrderInput,
  ): Promise<GetOrderOutput> {
    try {
      const order = await this.orders.findOne({
        where: { id: orderId },
      });
      if (!order) {
        return { ok: false, error: 'Order not found' };
      }

      if (!this.canSeeOrder(user, order)) {
        return { ok: false, error: 'Unauthorized user' };
      }

      return { ok: true, order };
    } catch (e) {
      console.error(e);
      return { ok: false, error: 'Could not get an order' };
    }
  }

  async editOrder(
    user: User,
    { id: orderId, status }: EditOrderInput,
  ): Promise<EditOrderOutput> {
    try {
      const order = await this.orders.findOne({
        where: { id: orderId },
      });
      if (!order) {
        return {
          ok: false,
          error: 'Could not find an order',
        };
      }
      if (!this.canSeeOrder(user, order)) {
        return {
          ok: false,
          error: 'Unauthorized user',
        };
      }

      let canEdit = true;

      if (user.role === UserRole.Owner) {
        if (
          status !== OrderStatus.Cooking &&
          status !== OrderStatus.Cooked &&
          status !== OrderStatus.Canceled
        ) {
          canEdit = false;
        }
      } else if (user.role === UserRole.Delivery) {
        if (
          status !== OrderStatus.PickedUp &&
          status !== OrderStatus.Delivered
        ) {
          canEdit = false;
        }
      } else if (user.role === UserRole.Client) {
        if (status !== OrderStatus.Canceled) {
          canEdit = false;
        }
      }
      if (!canEdit) {
        return {
          ok: false,
          error: 'Unauthorized user',
        };
      }

      await this.orders.save({
        id: orderId,
        status,
      });
      // save로 이미 저장된 데이터를 update하는 경우 save는 전체 데이터를 반환하지 않고 갱신된 데이터만 반환한다.

      const newOrder = {
        ...order,
        status,
      };
      if (user.role === UserRole.Owner && status === OrderStatus.Cooked) {
        await this.pubSub.publish(NEW_COOKED_ORDER, {
          cookedOrders: newOrder,
        });
      }

      await this.pubSub.publish(NEW_ORDER_UPDATE, {
        orderUpdates: newOrder,
      });

      return { ok: true };
    } catch (e) {
      console.error(e);
      return { ok: false, error: 'Could not edit an order' };
    }
  }

  async subscribeOrder(
    user: User,
    { id: orderId }: OrderUpdatesInput,
  ): Promise<AsyncIterator<Order> | UnauthorizedException> {
    try {
      const order = await this.orders.findOne({
        where: { id: orderId },
      });
      if (!order) return new UnauthorizedException();

      if (this.canSeeOrder(user, order)) {
        return this.pubSub.asyncIterator(NEW_ORDER_UPDATE);
      } else {
        return new UnauthorizedException();
      }
    } catch (e) {
      console.error(e);
      throw new UnauthorizedException();
    }
  }

  async takeOrder(
    driver: User,
    { id: orderId }: TakeOrderInput,
  ): Promise<TakeOrderOutput> {
    try {
      const order = await this.orders.findOneBy({ id: orderId });
      if (!order) {
        return { ok: false, error: 'Order not found' };
      }
      if (order.driver) {
        return { ok: false, error: 'Order already has a driver' };
      }
      await this.orders.save({
        id: orderId,
        driver,
      });
      await this.pubSub.publish(NEW_ORDER_UPDATE, {
        orderUpdates: { ...order, driver },
      });
      return { ok: true };
    } catch (e) {
      console.error(`Error from takeOrder function. Error - ${e}`);
      return { ok: false, error: 'Could not update an order' };
    }
  }
}
