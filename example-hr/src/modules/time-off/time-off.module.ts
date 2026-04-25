import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeBalance } from './entities/employee-balance.entity';
import { TimeOffRequest } from './entities/time-off-request.entity';
import { TimeOffService } from './time-off.service';
import { SyncService } from './sync.service';
import { WatchdogService } from './watchdog.service';
import { TimeOffController } from './time-off.controller';
import { HcmClientModule } from '../hcm-client/hcm-client.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmployeeBalance, TimeOffRequest]),
    HcmClientModule,
  ],
  controllers: [TimeOffController],
  providers: [TimeOffService, SyncService, WatchdogService],
  exports: [TimeOffService],
})
export class TimeOffModule {}
