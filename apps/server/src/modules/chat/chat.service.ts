import { Inject, Injectable } from '@nestjs/common';
import { NewMessageInput } from './dto/new-message.input';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Mapper } from '@automapper/core';
// import { RecipesArgs } from './dto/chat.args';
import { Message } from './dto/message.model';
import { MessageEntity } from './entities/message.entity';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(MessageEntity)
    private readonly repo: Repository<MessageEntity>,
    @Inject('MESSAGE_MAPPER')
    private readonly mapper: Mapper,
  ) {}
  /**
   * MOCK
   * Put some real business logic here
   * Left for demonstration purposes
   */

  async create(input: NewMessageInput): Promise<Message> {
    // map input → entity
    const entity = this.mapper.map(input, NewMessageInput, MessageEntity);
    // persist
    const saved = await this.repo.save(entity);
    // map saved entity → DTO
    return this.mapper.map(saved, MessageEntity, Message);
  }

  async findOneById(id: string): Promise<Message> {
    const entity = await this.repo.findOneBy({ id: +id });
    return this.mapper.map(entity, MessageEntity, Message);
  }

  async findAll(): Promise<Message[]> {
    const entities = await this.repo.find();
    return this.mapper.mapArray(entities, MessageEntity, Message);
  }

  async remove(id: number): Promise<boolean> {
    const result = await this.repo.delete(id);
    return (result.affected || 0) > 0;
  }
}
