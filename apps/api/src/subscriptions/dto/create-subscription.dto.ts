import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';
import { OrderCurrency, SubscriptionPlan } from '@prisma/client';

const PLANS = [
  'monthly',
  'annual',
] as const satisfies readonly SubscriptionPlan[];
const CURRENCIES = [
  'TRY',
  'EUR',
  'USD',
  'GBP',
] as const satisfies readonly OrderCurrency[];

export class CreateSubscriptionDto {
  @IsUUID()
  graveLocationId!: string;

  @IsIn(PLANS)
  plan!: SubscriptionPlan;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceAmount!: number;

  @IsIn(CURRENCIES)
  currency!: OrderCurrency;

  @IsOptional()
  @IsDateString()
  nextBillingDate?: string;
}
