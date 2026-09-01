import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { OrderCurrency, ServiceType } from '@prisma/client';

const SERVICE_TYPES = [
  'cleaning',
  'watering',
  'flowers',
  'full_package',
  'subscription',
] as const satisfies readonly ServiceType[];
const CURRENCIES = [
  'TRY',
  'EUR',
  'USD',
  'GBP',
] as const satisfies readonly OrderCurrency[];

export class CreateOrderDto {
  // Mezar konumu bu sipariş yaratılmadan önce zaten var olmalı — konumu
  // sipariş sihirbazından çözümleme/oluşturma akışı ADIM 5'in kapsamı.
  @IsUUID()
  graveLocationId!: string;

  @IsIn(SERVICE_TYPES)
  serviceType!: ServiceType;

  @IsOptional()
  @IsDateString()
  preferredDate?: string;

  @IsOptional()
  @MaxLength(500)
  specialNotes?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(999999.99)
  priceAmount!: number;

  @IsIn(CURRENCIES)
  currency!: OrderCurrency;

  @IsOptional()
  @IsUUID()
  subscriptionId?: string;
}
