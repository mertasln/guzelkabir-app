import { IsIn, IsString, MaxLength } from 'class-validator';
import { ComplaintCategory } from '@prisma/client';

const CATEGORIES = [
  'quality',
  'disrespect',
  'no_show',
  'other',
] as const satisfies readonly ComplaintCategory[];

export class CreateComplaintDto {
  @IsIn(CATEGORIES)
  category!: ComplaintCategory;

  @IsString()
  @MaxLength(2000)
  description!: string;
}
