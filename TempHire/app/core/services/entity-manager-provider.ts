import { Injectable } from '@angular/core';
import {
    config, DataProperty, DataService, DataServiceOptions, DataType, EntityManager,
    EntityQuery, EntityType, MetadataStore, NamingConvention, NavigationProperty
} from 'breeze-client';
import includes from 'lodash-es/includes';
import remove from 'lodash-es/remove';

// Import required breeze adapters. Rollup.js requires the use of breeze.base.debug.js, which doesn't include
// the breeze adapters.
import 'breeze-client/breeze.dataService.webApi';
import 'breeze-client/breeze.modelLibrary.backingStore';
import 'breeze-client/breeze.uriBuilder.json';
import 'breeze-client/breeze.uriBuilder.odata';

import { EntityTypeAnnotation } from '../entities/entity-type-annotation';
import { RegistrationHelper } from '../entities/registration-helper';

// The EntityManagerProvider manages a static master manager and a per instance sandbox manager.
@Injectable()
export class EntityManagerProvider {

    private static _preparePromise: Promise<any>;
    private static _masterManager: EntityManager;

    constructor() { }

    prepare(): Promise<any> {
        if (!EntityManagerProvider._preparePromise) {
            // Configure breeze adapaters. See rollup.js comment above
            config.initializeAdapterInstances({ dataService: 'webApi', uriBuilder: 'odata' });
            NamingConvention.camelCase.setAsDefault();
            const dsconfig: DataServiceOptions = {
                serviceName: 'breeze'
            };
            if (location.port == '3000') {
                // Configure the json uriBuilder. See rollup.js comment above
                config.initializeAdapterInstance('uriBuilder', 'json', false);
                dsconfig.uriBuilderName = 'json'; // for breeze-sequelize server
            }
            const dataService = new DataService(dsconfig);

            const masterManager = EntityManagerProvider._masterManager = new EntityManager({
                dataService
            });
            return EntityManagerProvider._preparePromise = masterManager.fetchMetadata().then(() => {
                RegistrationHelper.register(masterManager.metadataStore);
                this.registerAnnotations(masterManager.metadataStore);

                // Load lockups
                const query = EntityQuery.from('lookups');
                return masterManager.executeQuery(query);
            }).catch(e => {
                // If there's an error, we need to ensure prepare can be called fresh
                EntityManagerProvider._preparePromise = null;
                throw e;
            });
        }

        return EntityManagerProvider._preparePromise;
    }

    reset(manager: EntityManager): void {
        if (manager) {
            manager.clear();
            this.seedManager(manager);
        }
    }

    newManager(): EntityManager {
        const manager = EntityManagerProvider._masterManager.createEmptyCopy();
        this.seedManager(manager);
        return manager;
    }

    private seedManager(manager: EntityManager) {
        manager.importEntities(EntityManagerProvider._masterManager.exportEntities(null, { asString: false, includeMetadata: false }));
    }

    private registerAnnotations(metadataStore: MetadataStore) {
        metadataStore.getEntityTypes().forEach((t: EntityType) => {
            const et = t as EntityType;
            const ctor = et.getCtor() as any;
            if (ctor && ctor.getEntityTypeAnnotation) {
                const etAnnotation = ctor.getEntityTypeAnnotation() as EntityTypeAnnotation;
                et.validators.push(...etAnnotation.validators);
                etAnnotation.propertyAnnotations.forEach(pa => {
                    const prop = et.getProperty(pa.propertyName);
                    prop.validators.push(...pa.validators);
                    prop.displayName = pa.displayName;
                });
                this.ignoreForSerialization(metadataStore, t, ...etAnnotation.ignoreForSerialization);
            }
        });
    }

    private ignoreForSerialization(metadataStore: MetadataStore, typeInfo: string | EntityType, ...propertyNames: string[]) {
        if (!propertyNames || propertyNames.length == 0) { return; }

        const entityType = typeof (typeInfo) === 'string' ? metadataStore.getEntityType(typeInfo as string) as EntityType : typeInfo as EntityType;

        // Recursivley walk the inheritance tree and ignore the same properties for all parent types
        const parentTypes = metadataStore.getEntityTypes().filter(type => {
            const parentType = type as EntityType;
            return parentType.baseEntityType && parentType.baseEntityType === entityType;
        });
        parentTypes.forEach((parentType: EntityType) => this.ignoreForSerialization(metadataStore, parentType, ...propertyNames));

        // Now ignore for current type
        const dps = propertyNames.map(propertyName => {
            const dp = entityType.getDataProperty(propertyName);
            if (!dp) {
                console.warn(`No data property with name ${propertyName} found in entity type ${entityType.shortName}`);
            }
            return dp;
        });
        // Get all the nulls out
        remove(dps, dp => !dp);

        // Get existing ignored properties
        let ignoredProperties: DataProperty[] = (entityType as any).$ignoredProperties;

        // Signals that we've already installed our custom serializerFn
        if (ignoredProperties) {
            remove(dps, dp => includes(ignoredProperties, dp));
            ignoredProperties = ignoredProperties.concat(dps);
        } else {
            // First ignored properties for this entity type
            ignoredProperties = dps;
            const origSerializerFn: (dataProperty: DataProperty, value: any) => any = (entityType as any).serializerFn;
            entityType.setProperties({
                serializerFn: (dp, value) => {
                    if (includes((entityType as any).$ignoredProperties, dp)) {
                        // Return undefined if property is ignored for serialization
                        return undefined;
                    }

                    return origSerializerFn ? origSerializerFn(dp, value) : value;
                }
            });
        }
        (entityType as any).$ignoredProperties = ignoredProperties;
    }
}
