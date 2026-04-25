import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HcmController } from './hcm.controller';
import { HcmService } from './hcm.service';
import { EmployeeBalance } from './entities/employee-balance.entity';
import { LeaveRequest } from './entities/leave-request.entity';

@Module({
  imports: [TypeOrmModule.forFeature([EmployeeBalance, LeaveRequest])],
  controllers: [HcmController],
  providers: [HcmService],
})
export class HcmModule {}
