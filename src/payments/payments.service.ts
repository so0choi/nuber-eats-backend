import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity';
import { LessThan, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import {
  CreatePaymentInput,
  CreatePaymentOutput,
} from './dtos/create-payment.dto';
import { Restaurant } from '../restaurants/entities/restaurant.entity';
import { GetPaymentsOutput } from './dtos/get-payments.dto';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly payments: Repository<Payment>,
    @InjectRepository(Restaurant)
    private readonly restaurants: Repository<Restaurant>,
  ) {}

  async createPayment(
    owner: User,
    { transactionId, restaurantId }: CreatePaymentInput,
  ): Promise<CreatePaymentOutput> {
    try {
      const restaurant = await this.restaurants.findOneBy({ id: restaurantId });
      if (!restaurant) {
        return {
          ok: false,
          error: 'Restaurant not found',
        };
      }

      if (restaurant.ownerId !== owner.id) {
        return {
          ok: false,
          error: 'Unauthorized request',
        };
      }

      restaurant.isPromoted = true;
      const date = new Date();
      const PROMOTE_DATE = 7;
      date.setDate(date.getDate() + PROMOTE_DATE);
      restaurant.promotedUntil = date;

      await this.restaurants.save(restaurant);

      await this.payments.save(
        this.payments.create({
          transactionId,
          user: owner,
          restaurant,
        }),
      );

      return { ok: true };
    } catch (e) {
      console.error(e);
      return {
        ok: false,
        error: 'Could not create a payment',
      };
    }
  }

  async getPayments(user: User): Promise<GetPaymentsOutput> {
    try {
      const payments = await this.payments.find({
        where: { userId: user.id },
      });

      return {
        ok: true,
        payments,
      };
    } catch (e) {
      console.error(e);
      return {
        ok: false,
        error: 'Could not find a payment',
      };
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async checkPromotedRestaurants() {
    const restaurants = await this.restaurants.findBy({
      isPromoted: true,
      promotedUntil: LessThan(new Date()),
    });
    await Promise.all(
      restaurants.map((restaurant) => {
        restaurant.isPromoted = false;
        restaurant.promotedUntil = null;
        return this.restaurants.save(restaurant);
      }),
    );
  }
}
