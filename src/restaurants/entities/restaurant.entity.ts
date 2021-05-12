import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// @InputType({ isAbstract: true })
@ObjectType() //graphql schema
@Entity() // typeorm schema
export class Restaurant {
  @Field(type => Number)
  @PrimaryGeneratedColumn()
  id: number;

  @Field(type => String)
  @Column()
  @Length(5)
  @IsString()
  name: string;

  @Field(type => Boolean, { defaultValue: true })
  @Column({ default: true })
  @IsOptional()
  @IsBoolean()
  isVegan: boolean;

  @Field(type => String)
  @Column()
  @IsString()
  address: string;

  @Field(type => String)
  @Column()
  @IsString()
  ownerName: string;

  @Field(type => String)
  @Column()
  @IsString()
  categoryName: string;
}
