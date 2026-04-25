import { Injectable, Inject, forwardRef, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { EmployeeBalance } from './entities/employee-balance.entity';
import { TimeOffRequest, TimeOffStatus } from './entities/time-off-request.entity';
import { HcmClientService } from '../hcm-client/hcm-client.service';
import { TimeOffService } from './time-off.service';

@Injectable()
export class SyncService implements OnModuleInit {
  constructor(
    @InjectRepository(EmployeeBalance)
    private readonly balanceRepo: Repository<EmployeeBalance>,
    @InjectRepository(TimeOffRequest)
    private readonly requestRepo: Repository<TimeOffRequest>,
    @Inject(HcmClientService)
    private readonly hcmClient: HcmClientService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @Inject(forwardRef(() => TimeOffService))
    private readonly timeOffService: TimeOffService,
  ) {}

  async onModuleInit() {
    console.log('[SyncService] Initializing. Triggering startup Batch Sync Sweep...');
    // We run it as a background task to not block application bootstrap too much
    this.processDailySweep().catch(err => {
      console.error('[SyncService] Startup sweep failed:', err.message);
    });
  }

  @Cron('0 2 * * *')
  async handleDailySweep() {
    return this.processDailySweep();
  }

  async processDailySweep() {
    console.log('Starting Batch Sync Sweep...');
    
    // 1. Fetch full corpus from HCM
    let corpus: { balances: any[], requests: any[] };
    try {
      const response = await this.hcmClient.fetchBatchCorpus() as any;
      corpus = response;
    } catch (err) {
      console.error('Sweep aborted: HCM unreachable.');
      return { success: false, message: 'HCM unreachable' };
    }

    let updatesCount = 0;
    let reconciledRequestsCount = 0;

    // 2. Reconciliation Loop within a transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Sync Balances
      for (const hcmRecord of corpus.balances) {
        const { employeeId, locationId, annualLeaveBalance } = hcmRecord;

        let localBalance = await queryRunner.manager.findOne(EmployeeBalance, {
          where: { employeeId, locationId },
        });

        if (localBalance) {
          const pendingRequests = await queryRunner.manager.find(TimeOffRequest, {
            where: { employeeId, locationId, status: TimeOffStatus.PENDING_APPROVAL },
          });
          const pendingDays = pendingRequests.reduce((sum, r) => sum + r.requestedDays, 0);
          const expectedHcmBalance = localBalance.balanceAmount + pendingDays;

          if (annualLeaveBalance !== expectedHcmBalance) {
            console.log(`Syncing balance for ${employeeId}: [Local: ${localBalance.balanceAmount}] [Pending: ${pendingDays}] -> [HCM: ${annualLeaveBalance}]`);
            localBalance.balanceAmount = annualLeaveBalance - pendingDays;
            localBalance.lastSyncedAt = new Date();
            await queryRunner.manager.save(localBalance);
            updatesCount++;
          }
        } else {
          const newBalance = queryRunner.manager.create(EmployeeBalance, {
            employeeId,
            locationId,
            balanceAmount: annualLeaveBalance,
            lastSyncedAt: new Date(),
          });
          await queryRunner.manager.save(newBalance);
          updatesCount++;
        }
      }

      // Sync Requests based on HCM status
      const localInDoubtRequests = await queryRunner.manager.find(TimeOffRequest, {
        where: [
          { status: TimeOffStatus.FAILED },
          { status: TimeOffStatus.PENDING_APPROVAL },
        ],
      });

      for (const req of localInDoubtRequests) {
        // Find corresponding request in HCM corpus
        // Note: In a real app we'd sync by an external reference ID. 
        // Here we'll search by employee, location, and requested days as a heuristic if ID is not synced.
        // But wait, our mock server's submitLeave returns a requestId. 
        // If we didn't save that requestId in ExampleHR, we should.
        
        // Check if we can find a matching record in HCM that is REJECTED
        const hcmMatch = corpus.requests.find(r => 
          r.employeeId === req.employeeId && 
          r.locationId === req.locationId && 
          r.daysRequested === req.requestedDays &&
          (r.status === 'REJECTED' || r.status === 'APPROVED')
        );

        if (hcmMatch) {
          const localBalance = await queryRunner.manager.findOne(EmployeeBalance, {
            where: { employeeId: req.employeeId, locationId: req.locationId },
          });

          if (hcmMatch.status === 'REJECTED') {
            console.log(`[Sweep] Request ${req.id} confirmed REJECTED in HCM. Reverting.`);
            if (localBalance) {
              await this.timeOffService.handleRejection(req, localBalance);
              reconciledRequestsCount++;
            }
          } else if (hcmMatch.status === 'APPROVED') {
            console.log(`[Sweep] Request ${req.id} confirmed APPROVED in HCM. Finalizing.`);
            req.status = TimeOffStatus.SYNCED;
            await queryRunner.manager.save(req);
            reconciledRequestsCount++;
          }
        }
      }

      await queryRunner.commitTransaction();
      console.log(`Sweep completed. Updated Balances: ${updatesCount}, Reconciled Requests: ${reconciledRequestsCount}`);
      return { success: true, updatesCount, reconciledRequestsCount };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      console.error('Sweep transaction failed:', err.message);
      return { success: false, error: err.message };
    } finally {
      await queryRunner.release();
    }
  }
}
