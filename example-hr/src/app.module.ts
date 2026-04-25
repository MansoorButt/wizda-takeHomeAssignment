import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { EmployeeBalance } from './modules/time-off/entities/employee-balance.entity';
import { TimeOffRequest } from './modules/time-off/entities/time-off-request.entity';
import { TimeOffModule } from './modules/time-off/time-off.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'example-hr.sqlite',
      entities: [EmployeeBalance, TimeOffRequest],
      synchronize: true, // Auto-sync for dev
      logging: false,
    }),
    ScheduleModule.forRoot(),
    TimeOffModule,
  ],
})
export class AppModule {}
