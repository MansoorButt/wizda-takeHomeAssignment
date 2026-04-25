import { Injectable, ServiceUnavailableException, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class HcmClientService {
  // In a real app, this would be in .env
  private readonly hcmBaseUrl = 'http://localhost:3001'; 

  constructor(
    @Inject(HttpService)
    private readonly httpService: HttpService
  ) {}

  async fetchBalance(employeeId: string, locationId: string): Promise<number> {
    try {
      const url = `${this.hcmBaseUrl}/hcm/balance/${employeeId}/${locationId}`;
      const response = await firstValueFrom(this.httpService.get(url));
      return response.data.annualLeaveBalance;
    } catch (error) {
      console.error('HCM Sync Error:', error.message);
      throw new ServiceUnavailableException('HCM Mock server is unreachable or returned an error.');
    }
  }

  async submitLeave(employeeId: string, locationId: string, daysRequested: number): Promise<any> {
    try {
      const url = `${this.hcmBaseUrl}/hcm/leave`;
      const response = await firstValueFrom(this.httpService.post(url, {
        employeeId,
        locationId,
        daysRequested,
        leaveType: 'Annual',
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
      }));
      return response.data;
    } catch (error) {
      console.error('HCM Submit Error:', error.message);
      throw new ServiceUnavailableException('Failed to communicate with HCM for leave submission.');
    }
  }

  async fetchBatchCorpus(): Promise<any[]> {
    try {
      const url = `${this.hcmBaseUrl}/hcm/corpus`; // Use corpus endpoint for batch sync
      const response = await firstValueFrom(this.httpService.get(url));
      return response.data;
    } catch (error) {
      console.error('HCM Corpus Fetch Error:', error.message);
      throw new ServiceUnavailableException('Failed to fetch batch corpus from HCM.');
    }
  }

  async triggerAnniversary(employeeId: string, locationId: string): Promise<any> {
    try {
      const url = `${this.hcmBaseUrl}/hcm/anniversary`;
      const response = await firstValueFrom(this.httpService.post(url, { employeeId, locationId }));
      return response.data;
    } catch (error) {
      console.error('HCM Anniversary Error:', error.message);
      throw new ServiceUnavailableException('Failed to trigger anniversary in HCM.');
    }
  }

  async rejectLeaveRequest(requestId: string): Promise<any> {
    try {
      const url = `${this.hcmBaseUrl}/hcm/manager/reject`;
      const response = await firstValueFrom(this.httpService.post(url, { requestId }));
      return response.data;
    } catch (error) {
      console.error('HCM Reject Error:', error.message);
      throw new ServiceUnavailableException('Failed to reject leave request in HCM.');
    }
  }

  async getLeaveRequest(requestId: string): Promise<any> {
    try {
      const url = `${this.hcmBaseUrl}/hcm/request/${requestId}`;
      const response = await firstValueFrom(this.httpService.get(url));
      return response.data;
    } catch (error) {
      console.error('HCM Get Request Error:', error.message);
      // If 404, we might want to know, but for polling let's assume it failed if we can't reach it
      throw new ServiceUnavailableException('Failed to fetch leave request status from HCM.');
    }
  }
}
