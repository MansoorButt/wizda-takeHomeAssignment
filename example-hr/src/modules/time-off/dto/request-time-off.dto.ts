import { IsString, IsNumber, Min } from 'class-validator';

export class RequestTimeOffDto {
  @IsString()
  employeeId: string;

  @IsString()
  locationId: string;

  @IsNumber()
  @Min(0.5)
  requestedDays: number;
}
