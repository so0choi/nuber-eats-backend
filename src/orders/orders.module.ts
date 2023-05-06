import { Module } from '@nestjs/common';
import { OrderService } from './orders.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { OrderResolver } from './orders.resolver';
import { Restaurant } from '../restaurants/entities/restaurant.entity';
import { OrderItem } from './entities/order-item.entity';
import { Dish } from '../restaurants/entities/dish.entity';

@Module({
  providers: [OrderService, OrderResolver],
  imports: [TypeOrmModule.forFeature([Order, Restaurant, OrderItem, Dish])],
})
export class OrdersModule {}
