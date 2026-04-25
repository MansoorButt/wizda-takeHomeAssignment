import { Controller, Get, Post, Body, Param, NotFoundException, Inject } from '@nestjs/common';
import { HcmService } from './hcm.service';
import { LeaveRequestDto } from './dto/leave-request.dto';

@Controller('hcm')
export class HcmController {
  constructor(
    @Inject(HcmService)
    private readonly hcmService: HcmService
  ) {}

  @Get('balance/:employeeId/:locationId')
  async getBalance(
    @Param('employeeId') employeeId: string,
    @Param('locationId') locationId: string,
  ) {
    const balance = await this.hcmService.getBalance(employeeId, locationId);
    if (!balance) {
      throw new NotFoundException('Employee balance not found in HCM');
    }
    return balance;
  }

  @Post('leave')
  async submitLeave(@Body() dto: LeaveRequestDto) {
    return this.hcmService.submitLeave(dto);
  }

  @Get('corpus')
  async getCorpus() {
    return this.hcmService.getCorpus();
  }

  // Part 2: Approval Engine endpoints
  @Get('manager/tasks')
  async getPendingTasks() {
    return this.hcmService.getPendingTasks();
  }

  @Post('manager/approve')
  async approveTask(@Body() body: { requestId: string }) {
    return this.hcmService.approveTask(body.requestId);
  }

  @Post('manager/reject')
  async rejectTask(@Body() body: { requestId: string }) {
    return this.hcmService.rejectTask(body.requestId);
  }

  @Get('request/:id')
  async getRequest(@Param('id') id: string) {
    return this.hcmService.getRequest(id);
  }

  @Post('anniversary')
  async triggerAnniversary(@Body() body: { employeeId: string; locationId: string }) {
    return this.hcmService.triggerAnniversary(body.employeeId, body.locationId);
  }

  @Get('health')
  health() {
    return { status: 'HCM Mock is healthy' };
  }
}
