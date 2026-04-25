import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HcmModule } from './hcm/hcm.module';
import { EmployeeBalance } from './hcm/entities/employee-balance.entity';
import { LeaveRequest } from './hcm/entities/leave-request.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'hcm-mock.sqlite',
      entities: [EmployeeBalance, LeaveRequest],
      synchronize: true,
    }),
    HcmModule,
  ],
})
export class AppModule {}
