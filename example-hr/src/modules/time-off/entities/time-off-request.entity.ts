import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

export enum TimeOffStatus {
  PENDING = 'PENDING',
  SYNCED = 'SYNCED',
  REJECTED = 'REJECTED',
  FAILED = 'FAILED',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
}

@Entity('time_off_requests')
export class TimeOffRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  employeeId: string;

  @Column({ type: 'varchar' })
  locationId: string;

  @Column({ type: 'varchar', nullable: true })
  managerId: string;

  @Column({ type: 'varchar', nullable: true })
  hcmRequestId: string;

  @Column({ type: 'float' })
  requestedDays: number;

  @Column({
    type: 'varchar',
    default: TimeOffStatus.PENDING,
  })
  status: TimeOffStatus;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
