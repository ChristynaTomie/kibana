/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { schema } from '@kbn/config-schema';
import type { IRouter } from '@kbn/core/server';
import type { SavedQueryResponse } from './types';
import type { SavedQuerySavedObject } from '../../common/types';
import { isSavedQueryPrebuilt } from './utils';
import type { OsqueryAppContext } from '../../lib/osquery_app_context_services';
import { PLUGIN_ID } from '../../../common';
import { savedQuerySavedObjectType } from '../../../common/types';
import { convertECSMappingToObject } from '../utils';

export const readSavedQueryRoute = (router: IRouter, osqueryContext: OsqueryAppContext) => {
  router.get(
    {
      path: '/api/osquery/saved_queries/{id}',
      validate: {
        params: schema.object({
          id: schema.string(),
        }),
      },
      options: { tags: [`access:${PLUGIN_ID}-readSavedQueries`] },
    },
    async (context, request, response) => {
      const coreContext = await context.core;
      const savedObjectsClient = coreContext.savedObjects.client;

      const savedQuery = await savedObjectsClient.get<SavedQuerySavedObject>(
        savedQuerySavedObjectType,
        request.params.id
      );

      if (savedQuery.attributes.ecs_mapping) {
        // @ts-expect-error update types
        savedQuery.attributes.ecs_mapping = convertECSMappingToObject(
          savedQuery.attributes.ecs_mapping
        );
      }

      savedQuery.attributes.prebuilt = await isSavedQueryPrebuilt(
        osqueryContext.service.getPackageService()?.asInternalUser,
        savedQuery.id
      );

      const {
        created_at: createdAt,
        created_by: createdBy,
        description,
        id,
        interval,
        platform,
        query,
        removed,
        snapshot,
        version,
        ecs_mapping: ecsMapping,
        updated_at: updatedAt,
        updated_by: updatedBy,
        prebuilt,
      } = savedQuery.attributes;

      const data: SavedQueryResponse = {
        created_at: createdAt,
        created_by: createdBy,
        description,
        id,
        removed,
        snapshot,
        version,
        ecs_mapping: ecsMapping,
        interval,
        platform,
        query,
        updated_at: updatedAt,
        updated_by: updatedBy,
        prebuilt,
        saved_object_id: savedQuery.id,
      };

      return response.ok({
        body: {
          data,
        },
      });
    }
  );
};
