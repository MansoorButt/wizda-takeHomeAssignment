import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimeOffRequest, TimeOffStatus } from './entities/time-off-request.entity';
import { EmployeeBalance } from './entities/employee-balance.entity';
import { HcmClientService } from '../hcm-client/hcm-client.service';
import { TimeOffService } from './time-off.service';

@Injectable()
export class WatchdogService {
  constructor(
    @InjectRepository(EmployeeBalance)
    private readonly balanceRepo: Repository<EmployeeBalance>,
    @InjectRepository(TimeOffRequest)
    private readonly requestRepo: Repository<TimeOffRequest>,
    @Inject(HcmClientService)
    private readonly hcmClient: HcmClientService,
    @Inject(forwardRef(() => TimeOffService))
    private readonly timeOffService: TimeOffService,
  ) {}

  @Cron('*/2 * * * *')
  async handleWatchdog() {
    await this.processFailedRequests();
    await this.listenToPendingApprovals();
  }

  async processFailedRequests() {
    const failedRequests = await this.requestRepo.find({
      where: { status: TimeOffStatus.FAILED },
    });

    if (failedRequests.length === 0) {
      return;
    }

    console.log(`[Watchdog] Found ${failedRequests.length} failed requests. Starting retries...`);

    for (const req of failedRequests) {
      try {
        console.log(`[Watchdog] Attempting retry for request ${req.id} (Emp: ${req.employeeId})...`);
        const hcmResponse = await this.hcmClient.submitLeave(req.employeeId, req.locationId, req.requestedDays);

        if (hcmResponse.status === 'APPROVED' || hcmResponse.status === 'SUCCESS') {
          console.log(`[Watchdog] Retry successful for request ${req.id}.`);
          req.status = TimeOffStatus.SYNCED;
          if (hcmResponse.requestId) req.hcmRequestId = hcmResponse.requestId;
          await this.requestRepo.save(req);
        } else if (hcmResponse.status === 'PENDING_MANAGER' || hcmResponse.status === 'SUBMITTED') {
          console.log(`[Watchdog] Retry resulted in PENDING_APPROVAL for request ${req.id}.`);
          req.status = TimeOffStatus.PENDING_APPROVAL;
          if (hcmResponse.managerId) req.managerId = hcmResponse.managerId;
          if (hcmResponse.requestId) req.hcmRequestId = hcmResponse.requestId;
          await this.requestRepo.save(req);
        } else {
          // Business Rejection (400)
          console.warn(`[Watchdog] HCM Rejected retry for ${req.id}: ${hcmResponse.message}`);
          
          const balance = await this.balanceRepo.findOne({
            where: { employeeId: req.employeeId, locationId: req.locationId },
          });

          if (balance) {
            await this.timeOffService.handleRejection(req, balance);
            await this.requestRepo.save(req);
          }
        }
      } catch (error) {
        // Still failing (503/Timeout)
        console.error(`[Watchdog] Retry failed for request ${req.id}:`, error.message);
        // Status remains FAILED for next cycle
      }
    }
  }

  async listenToPendingApprovals() {
    const pendingRequests = await this.requestRepo.find({
      where: { status: TimeOffStatus.PENDING_APPROVAL },
    });

    if (pendingRequests.length === 0) {
      return;
    }

    console.log(`[SmartListener] Polling status for ${pendingRequests.length} pending requests from HCM...`);

    for (const req of pendingRequests) {
      if (!req.hcmRequestId) {
        console.warn(`[SmartListener] Request ${req.id} is PENDING_APPROVAL but has no hcmRequestId. Wait for manual sync.`);
        continue;
      }

      try {
        const hcmRequest = await this.hcmClient.getLeaveRequest(req.hcmRequestId);
        
        if (hcmRequest.status === 'APPROVED') {
          console.log(`[SmartListener] Request ${req.id} was APPROVED in HCM.`);
          req.status = TimeOffStatus.SYNCED;
          await this.requestRepo.save(req);
        } else if (hcmRequest.status === 'REJECTED') {
          console.log(`[SmartListener] Request ${req.id} was REJECTED in HCM. Reverting locals.`);
          
          const balance = await this.balanceRepo.findOne({
            where: { employeeId: req.employeeId, locationId: req.locationId },
          });

          if (balance) {
            await this.timeOffService.handleRejection(req, balance);
            await this.requestRepo.save(req);
          }
        } else {
          console.log(`[SmartListener] Request ${req.id} still PENDING in HCM.`);
        }
      } catch (error) {
        console.error(`[SmartListener] Failed to poll status for ${req.id}:`, error.message);
      }
    }
  }
}
