import { IsString, IsNumber, Min } from 'class-validator';

export class LeaveRequestDto {
  @IsString()
  employeeId: string;

  @IsString()
  locationId: string;

  @IsNumber()
  @Min(0.5)
  daysRequested: number;
}
