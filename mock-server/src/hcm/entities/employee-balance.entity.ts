import { Entity, Column, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('employee_balances')
@Unique(['employeeId', 'locationId'])
export class EmployeeBalance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  employeeId: string;

  @Column({ type: 'varchar' })
  locationId: string;

  @Column({ type: 'float', default: 20 })
  annualLeaveBalance: number;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  lastSyncedAt: Date;
}
