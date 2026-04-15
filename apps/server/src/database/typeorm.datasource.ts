import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { getMigrationDataSourceOptions } from '../config/database.config';
import { loadEnvironmentFiles } from '../config/load-env';

loadEnvironmentFiles();

export default new DataSource(getMigrationDataSourceOptions());
