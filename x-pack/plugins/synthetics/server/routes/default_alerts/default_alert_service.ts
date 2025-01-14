/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { SavedObjectsClientContract } from '@kbn/core-saved-objects-api-server';
import { FindActionResult } from '@kbn/actions-plugin/server';
import { savedObjectsAdapter } from '../../saved_objects';
import { populateAlertActions } from '../../../common/rules/alert_actions';
import { SyntheticsMonitorStatusTranslations } from '../../../common/rules/synthetics/translations';
import { SyntheticsServerSetup, UptimeRequestHandlerContext } from '../../types';
import {
  ACTION_GROUP_DEFINITIONS,
  SYNTHETICS_STATUS_RULE,
  SYNTHETICS_TLS_RULE,
} from '../../../common/constants/synthetics_alerts';

type DefaultRuleType = typeof SYNTHETICS_STATUS_RULE | typeof SYNTHETICS_TLS_RULE;
export class DefaultAlertService {
  context: UptimeRequestHandlerContext;
  soClient: SavedObjectsClientContract;
  server: SyntheticsServerSetup;

  constructor(
    context: UptimeRequestHandlerContext,
    server: SyntheticsServerSetup,
    soClient: SavedObjectsClientContract
  ) {
    this.context = context;
    this.server = server;
    this.soClient = soClient;
  }

  async setupDefaultAlerts() {
    const [statusRule, tlsRule] = await Promise.allSettled([
      this.setupStatusRule(),
      this.setupTlsRule(),
    ]);

    if (statusRule.status === 'rejected') {
      throw statusRule.reason;
    }
    if (tlsRule.status === 'rejected') {
      throw tlsRule.reason;
    }

    return {
      statusRule: statusRule.status === 'fulfilled' ? statusRule.value : null,
      tlsRule: tlsRule.status === 'fulfilled' ? tlsRule.value : null,
    };
  }

  setupStatusRule() {
    return this.createDefaultAlertIfNotExist(
      SYNTHETICS_STATUS_RULE,
      `Synthetics status internal alert`,
      '1m'
    );
  }

  setupTlsRule() {
    return this.createDefaultAlertIfNotExist(
      SYNTHETICS_TLS_RULE,
      `Synthetics internal TLS alert`,
      '10m'
    );
  }

  async getExistingAlert(ruleType: DefaultRuleType) {
    const rulesClient = (await this.context.alerting)?.getRulesClient();

    const { data } = await rulesClient.find({
      options: {
        page: 1,
        perPage: 1,
        filter: `alert.attributes.alertTypeId:(${ruleType})`,
      },
    });

    const alert = data?.[0];
    if (!alert) {
      return;
    }

    return { ...alert, ruleTypeId: alert.alertTypeId };
  }
  async createDefaultAlertIfNotExist(ruleType: DefaultRuleType, name: string, interval: string) {
    const alert = await this.getExistingAlert(ruleType);
    if (alert) {
      return alert;
    }

    const actions = await this.getAlertActions();

    const rulesClient = (await this.context.alerting)?.getRulesClient();
    const newAlert = await rulesClient.create<{}>({
      data: {
        actions,
        params: {},
        consumer: 'uptime',
        alertTypeId: ruleType,
        schedule: { interval },
        tags: ['SYNTHETICS_DEFAULT_ALERT'],
        name,
        enabled: true,
        throttle: null,
      },
    });
    return { ...newAlert, ruleTypeId: newAlert.alertTypeId };
  }

  updateStatusRule() {
    return this.updateDefaultAlert(
      SYNTHETICS_STATUS_RULE,
      `Synthetics status internal alert`,
      '1m'
    );
  }
  updateTlsRule() {
    return this.updateDefaultAlert(SYNTHETICS_TLS_RULE, `Synthetics internal TLS alert`, '10m');
  }

  async updateDefaultAlert(ruleType: DefaultRuleType, name: string, interval: string) {
    const rulesClient = (await this.context.alerting)?.getRulesClient();

    const alert = await this.getExistingAlert(ruleType);
    if (alert) {
      const actions = await this.getAlertActions();
      const updatedAlert = await rulesClient.update({
        id: alert.id,
        data: {
          actions,
          name: alert.name,
          tags: alert.tags,
          schedule: alert.schedule,
          params: alert.params,
          notifyWhen: alert.notifyWhen,
        },
      });
      return { ...updatedAlert, ruleTypeId: updatedAlert.alertTypeId };
    }

    return await this.createDefaultAlertIfNotExist(ruleType, name, interval);
  }

  async getAlertActions() {
    const { actionConnectors, settings } = await this.getActionConnectors();

    const defaultActions = (actionConnectors ?? []).filter((act) =>
      settings?.defaultConnectors?.includes(act.id)
    );

    return populateAlertActions({
      groupId: ACTION_GROUP_DEFINITIONS.MONITOR_STATUS.id,
      defaultActions,
      defaultEmail: settings?.defaultEmail!,
      translations: {
        defaultActionMessage: SyntheticsMonitorStatusTranslations.defaultActionMessage,
        defaultRecoveryMessage: SyntheticsMonitorStatusTranslations.defaultRecoveryMessage,
        defaultSubjectMessage: SyntheticsMonitorStatusTranslations.defaultSubjectMessage,
        defaultRecoverySubjectMessage:
          SyntheticsMonitorStatusTranslations.defaultRecoverySubjectMessage,
      },
    });
  }

  async getActionConnectors() {
    const actionsClient = (await this.context.actions)?.getActionsClient();

    const settings = await savedObjectsAdapter.getUptimeDynamicSettings(this.soClient);
    let actionConnectors: FindActionResult[] = [];
    try {
      actionConnectors = await actionsClient.getAll();
    } catch (e) {
      this.server.logger.error(e);
    }
    return { actionConnectors, settings };
  }
}
