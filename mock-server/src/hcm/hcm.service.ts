import { Injectable, OnModuleInit, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeeBalance } from './entities/employee-balance.entity';
import { LeaveRequest, LeaveStatus } from './entities/leave-request.entity';
import { LeaveRequestDto } from './dto/leave-request.dto';

@Injectable()
export class HcmService implements OnModuleInit {
  constructor(
    @InjectRepository(EmployeeBalance)
    private balanceRepo: Repository<EmployeeBalance>,
    @InjectRepository(LeaveRequest)
    private leaveRepo: Repository<LeaveRequest>,
  ) {}

  async onModuleInit() {
    const count = await this.balanceRepo.count();
    if (count === 0) {
      await this.balanceRepo.save([
        { employeeId: 'employee001', locationId: 'NYC', annualLeaveBalance: 25 },
        { employeeId: 'employee002', locationId: 'LON', annualLeaveBalance: 20 },
        { employeeId: 'employee003', locationId: 'NYC', annualLeaveBalance: 15 },
      ]);
      console.log('Seeded HCM initial balances.');
    }
  }

  async getBalance(employeeId: string, locationId: string): Promise<EmployeeBalance> {
    return this.balanceRepo.findOne({
      where: { employeeId, locationId },
    });
  }

  async submitLeave(dto: LeaveRequestDto): Promise<any> {
    const balance = await this.getBalance(dto.employeeId, dto.locationId);

    // Initial check: if they don't have enough, reject immediately
    if (!balance || balance.annualLeaveBalance < dto.daysRequested) {
      const rejectedRequest = this.leaveRepo.create({
        ...dto,
        status: LeaveStatus.REJECTED,
      });
      await this.leaveRepo.save(rejectedRequest);
      return { status: 'REJECTED', message: 'Insufficient balance' };
    }

    // Part 2: DO NOT subtract balance yet. Create a PENDING request.
    const pendingRequest = this.leaveRepo.create({
      ...dto,
      status: LeaveStatus.PENDING,
      managerId: 'mgr-101',
    });
    
    const saved = await this.leaveRepo.save(pendingRequest);

    console.log(`[HCM Mock] Request received for ${dto.employeeId}. Status: PENDING_MANAGER (RequestID: ${saved.id})`);

    return {
      status: 'PENDING_MANAGER',
      managerId: 'mgr-101',
      message: 'Request sent to manager for approval',
      requestId: saved.id
    };
  }

  async getCorpus(): Promise<any> {
    console.log('[HCM Mock] Corpus requested. Returning current employee state.');
    const balances = await this.balanceRepo.find();
    const requests = await this.leaveRepo.find();
    return { balances, requests };
  }

  // Part 2: Approval Engine logic
  async getPendingTasks(): Promise<LeaveRequest[]> {
    return this.leaveRepo.find({
      where: { status: LeaveStatus.PENDING },
    });
  }

  async approveTask(requestId: string): Promise<any> {
    const request = await this.leaveRepo.findOne({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Pending request not found');

    const balance = await this.balanceRepo.findOne({
      where: { employeeId: request.employeeId, locationId: request.locationId },
    });

    if (balance) {
      // Finally subtract the balance upon manager approval
      const previousBalance = balance.annualLeaveBalance;
      balance.annualLeaveBalance -= request.daysRequested;
      await this.balanceRepo.save(balance);
      
      console.log(`[HCM Mock] Request ${request.id} APPROVED by manager. ${balance.employeeId} balance: ${previousBalance} -> ${balance.annualLeaveBalance}`);
    }

    // Update request status
    request.status = LeaveStatus.APPROVED;
    await this.leaveRepo.save(request);

    return {
      status: 'SUCCESS',
      message: 'Request approved successfully',
      updatedBalance: balance ? balance.annualLeaveBalance : null
    };
  }

  async rejectTask(requestId: string): Promise<any> {
    const request = await this.leaveRepo.findOne({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Pending request not found');

    // Update request status to REJECTED
    // Note: Balance was never deducted for PENDING status
    request.status = LeaveStatus.REJECTED;
    await this.leaveRepo.save(request);

    console.log(`[HCM Mock] Request ${request.id} REJECTED by manager.`);

    return {
      status: 'SUCCESS',
      message: 'Request rejected successfully'
    };
  }

  async getRequest(requestId: string): Promise<LeaveRequest> {
    const request = await this.leaveRepo.findOne({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Request not found in HCM');
    return request;
  }

  async triggerAnniversary(employeeId: string, locationId: string): Promise<any> {
    const balance = await this.balanceRepo.findOne({
      where: { employeeId, locationId },
    });

    if (!balance) {
      throw new NotFoundException('Employee not found in HCM');
    }

    const previousBalance = balance.annualLeaveBalance;
    balance.annualLeaveBalance += 5;
    await this.balanceRepo.save(balance);

    console.log(`[HCM Mock] Anniversary triggered for ${employeeId} at ${locationId}. Balance: ${previousBalance} -> ${balance.annualLeaveBalance}`);

    return {
      status: 'SUCCESS',
      message: 'Anniversary bonus of 5 days applied',
      updatedBalance: balance.annualLeaveBalance
    };
  }
}
