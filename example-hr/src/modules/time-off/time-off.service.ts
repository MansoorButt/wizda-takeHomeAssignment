import { Injectable, Inject, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { EmployeeBalance } from './entities/employee-balance.entity';
import { TimeOffRequest, TimeOffStatus } from './entities/time-off-request.entity';
import { HcmClientService } from '../hcm-client/hcm-client.service';
import { RequestTimeOffDto } from './dto/request-time-off.dto';

@Injectable()
export class TimeOffService {
  constructor(
    @InjectRepository(EmployeeBalance)
    private readonly balanceRepo: Repository<EmployeeBalance>,
    @InjectRepository(TimeOffRequest)
    private readonly requestRepo: Repository<TimeOffRequest>,
    @Inject(HcmClientService)
    private readonly hcmClient: HcmClientService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async getBalance(employeeId: string, locationId: string): Promise<EmployeeBalance> {
    // 1. Check local DB
    let balance = await this.balanceRepo.findOne({
      where: { employeeId, locationId },
    });

    // 2. If exists locally, return
    if (balance) {
      console.log(`Cache Hit for ${employeeId} at ${locationId}`);
      return balance;
    }

    // 3. Else, fetch from HCM
    console.log(`Cache Miss for ${employeeId}. Fetching from HCM...`);
    const hcmBalanceAmount = await this.hcmClient.fetchBalance(employeeId, locationId);

    // 4. Save to local DB (cache)
    balance = this.balanceRepo.create({
      employeeId,
      locationId,
      balanceAmount: hcmBalanceAmount,
      lastSyncedAt: new Date(),
    });

    return this.balanceRepo.save(balance);
  }

  async requestTimeOff(dto: RequestTimeOffDto): Promise<TimeOffRequest> {
    const { employeeId, locationId, requestedDays } = dto;

    // 1. Ensure local balance exists and is sufficient
    const balance = await this.getBalance(employeeId, locationId);
    if (balance.balanceAmount < requestedDays) {
      throw new BadRequestException(
        `Insufficient balance. Available: ${balance.balanceAmount}, Requested: ${requestedDays}`
      );
    }

    // 2. Start Transaction for Atomic Reservation
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let savedRequest: TimeOffRequest;

    try {
      console.log(`Reserving ${requestedDays} days for ${employeeId}...`);
      
      // Decrement balance
      balance.balanceAmount -= requestedDays;
      balance.updatedAt = new Date();
      await queryRunner.manager.save(balance);

      // Create PENDING request
      const request = queryRunner.manager.create(TimeOffRequest, {
        employeeId,
        locationId,
        requestedDays,
        status: TimeOffStatus.PENDING,
      });
      savedRequest = await queryRunner.manager.save(request);

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      console.error('Local reservation failed:', err.message);
      throw new InternalServerErrorException('Failed to reserve balance locally.');
    } finally {
      await queryRunner.release();
    }

    // 3. External Sync to HCM
    try {
      console.log(`Syncing leave request ${savedRequest.id} with HCM...`);
      const hcmResponse = await this.hcmClient.submitLeave(employeeId, locationId, requestedDays);

      if (hcmResponse.status === 'APPROVED' || hcmResponse.status === 'SUCCESS') {
        console.log(`HCM Sync Success for request ${savedRequest.id}`);
        savedRequest.status = TimeOffStatus.SYNCED;
        if (hcmResponse.requestId) {
          savedRequest.hcmRequestId = hcmResponse.requestId;
        }
      } else if (hcmResponse.status === 'PENDING_MANAGER' || hcmResponse.status === 'SUBMITTED') {
        console.log(`HCM Sync: Request ${savedRequest.id} is now PENDING_APPROVAL`);
        savedRequest.status = TimeOffStatus.PENDING_APPROVAL;
        if (hcmResponse.managerId) {
          savedRequest.managerId = hcmResponse.managerId;
        }
        if (hcmResponse.requestId) {
          savedRequest.hcmRequestId = hcmResponse.requestId;
        }
      } else {
        // HCM Rejected (e.g. business logic on their end)
        console.warn(`HCM Rejected request ${savedRequest.id}: ${hcmResponse.message}`);
        await this.handleRejection(savedRequest, balance);
      }
    } catch (error) {
      // Communication Failure (Timeout, 500, etc.)
      console.error(`HCM Sync Failure for request ${savedRequest.id}:`, error.message);
      savedRequest.status = TimeOffStatus.FAILED;
    }

    // Save final status
    return this.requestRepo.save(savedRequest);
  }

  public async handleRejection(request: TimeOffRequest, balance: EmployeeBalance) {
    console.log(`Reverting ${request.requestedDays} days for ${request.employeeId} due to HCM rejection.`);
    
    request.status = TimeOffStatus.REJECTED;
    
    // Revert balance
    balance.balanceAmount += request.requestedDays;
    balance.updatedAt = new Date();
    
    await this.balanceRepo.save(balance);
  }

  async triggerAnniversary(employeeId: string, locationId: string): Promise<any> {
    console.log(`Triggering anniversary for ${employeeId} in HCM...`);
    return this.hcmClient.triggerAnniversary(employeeId, locationId);
  }
}
