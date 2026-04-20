import 'reflect-metadata';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { NestFactory } from '@nestjs/core';
import {
  GraphQLSchemaBuilderModule,
  GraphQLSchemaFactory,
} from '@nestjs/graphql';
import { lexicographicSortSchema, printSchema } from 'graphql';
import {
  GRAPHQL_SCHEMA_BUILD_OPTIONS,
  GRAPHQL_SCHEMA_RESOLVERS,
  GRAPHQL_SCHEMA_SCALARS,
} from '../graphql/schema-manifest';

const SERVER_ROOT = resolve(__dirname, '../..');
const OUTPUT_PATH = resolve(SERVER_ROOT, '__generated__/schema.gql');

async function generateSchema(): Promise<void> {
  const app = await NestFactory.createApplicationContext(
    GraphQLSchemaBuilderModule,
    {
    logger: false,
    },
  );

  try {
    await app.init();

    const gqlSchemaFactory = app.get(GraphQLSchemaFactory);
    const schema = await gqlSchemaFactory.create(
      GRAPHQL_SCHEMA_RESOLVERS,
      GRAPHQL_SCHEMA_SCALARS,
      GRAPHQL_SCHEMA_BUILD_OPTIONS,
    );

    await mkdir(dirname(OUTPUT_PATH), { recursive: true });
    await writeFile(
      OUTPUT_PATH,
      `${printSchema(lexicographicSortSchema(schema))}\n`,
      'utf8',
    );
  } finally {
    await app.close();
  }
}

void generateSchema().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
