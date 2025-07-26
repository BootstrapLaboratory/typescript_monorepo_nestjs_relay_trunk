import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { AutoMap } from '@automapper/classes';

@Entity('message')
export class MessageEntity {
  @PrimaryGeneratedColumn()
  @AutoMap()
  id: number;

  @Column({ nullable: true })
  @AutoMap()
  author?: string;

  @Column({ nullable: false })
  @AutoMap()
  body: string;
}
