import { Controller, Get, Post, Body, Query, BadRequestException, Inject } from '@nestjs/common';
import { TimeOffService } from './time-off.service';
import { SyncService } from './sync.service';
import { WatchdogService } from './watchdog.service';
import { RequestTimeOffDto } from './dto/request-time-off.dto';

@Controller('time-off')
export class TimeOffController {
  constructor(
    @Inject(TimeOffService)
    private readonly timeOffService: TimeOffService,
    @Inject(SyncService)
    private readonly syncService: SyncService,
    @Inject(WatchdogService)
    private readonly watchdogService: WatchdogService,
  ) {}

  @Get('balance')
  async getBalance(
    @Query('employeeId') employeeId: string,
    @Query('locationId') locationId: string,
  ) {
    if (!employeeId || !locationId) {
      throw new BadRequestException('employeeId and locationId are required query parameters.');
    }
    return this.timeOffService.getBalance(employeeId, locationId);
  }

  @Post('request')
  async requestTimeOff(@Body() dto: RequestTimeOffDto) {
    return this.timeOffService.requestTimeOff(dto);
  }

  @Post('sync/trigger')
  async triggerSync() {
    return this.syncService.processDailySweep();
  }

  @Post('watchdog/trigger')
  async triggerWatchdog() {
    return this.watchdogService.processFailedRequests();
  }

  @Post('anniversary')
  async triggerAnniversary(@Body() body: { employeeId: string; locationId: string }) {
    if (!body.employeeId || !body.locationId) {
      throw new BadRequestException('employeeId and locationId are required.');
    }
    // We call the HCM client directly to trigger the anniversary on the source of truth
    // The next sync cycle will pick up the updated balance
    return this.timeOffService.triggerAnniversary(body.employeeId, body.locationId);
  }
}
