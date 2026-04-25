import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

export enum LeaveStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity('leave_requests')
export class LeaveRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  employeeId!: string;

  @Column({ type: 'varchar' })
  locationId!: string;

  @Column({ type: 'float' })
  daysRequested!: number;

  @Column({ type: 'varchar', nullable: true })
  managerId?: string;

  @Column({ type: 'varchar', default: LeaveStatus.PENDING })
  status!: string;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
