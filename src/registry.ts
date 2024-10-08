import type { Modding } from "@flamework/core";

import * as ecs from "./jecs";
import type { Signal } from "./signal";
import { createSignal } from "./signal";

export interface Wildcard {}
export interface ChildOf {}

export type Entity<T = unknown> = ecs.Entity<T>;
export type Id<T = unknown> = ecs.Id<T>;
export type Tag = ecs.Tag;
export type Pair<P = undefined, O = undefined> = ecs.Pair<P, O>;

export type FilterPair<T> = T extends Pair<infer P, unknown> ? P : T;
export type FilterPairs<T extends Array<unknown>> = {
	[K in keyof T]: FilterPair<T[K]>;
};

export interface PairDetails<P, O> {
	obj: O extends undefined ? undefined : Modding.Generic<O, "id">;
	pred: P extends undefined ? undefined : Modding.Generic<P, "id">;
}

export type SolveKey<T> =
	T extends Pair<infer P, infer O> ? Modding.Many<PairDetails<P, O>> : Modding.Generic<T, "id">;

export const registry = new ecs.World();
export const signals: {
	added: Record<Entity, Signal<[Entity]>>;
	changed: Record<Entity, Signal<[Entity, unknown]>>;
	removed: Record<Entity, Signal<[Entity]>>;
} = {
	added: {},
	changed: {},
	removed: {},
};

export function added<T>(id: Entity<T>): Signal<[Entity<T>]> {
	return signals.added[id]! as Signal<[Entity<T>]>;
}

export function removed<T>(id: Entity<T>): Signal<[Entity<T>]> {
	return signals.removed[id]! as Signal<[Entity<T>]>;
}

export function changed<T>(id: Entity<T>): Signal<[Entity<T>, T]> {
	return signals.changed[id]! as Signal<[Entity<T>, T]>;
}

const components = new Map<string, Id>();

function hookListeners<T>(id: Entity<T>): void {
	const addedSignal = createSignal<[Entity]>();
	const removedSignal = createSignal<[Entity]>();
	const changedSignal = createSignal<[Entity, T]>();
	signals.added[id] = addedSignal;
	signals.removed[id] = removedSignal;
	signals.changed[id] = changedSignal;

	registry.set(id, ecs.OnAdd, (entity) => {
		addedSignal.fire(entity);
	});
	registry.set(id, ecs.OnRemove, (entity) => {
		removedSignal.fire(entity);
	});
	registry.set(id, ecs.OnSet, (entity, data) => {
		changedSignal.fire(entity, data as T);
	});
}

/**
 * Defines a component that can be added to an entity. Components can either tag
 * an entity (e.g., "this entity is an NPC"), store data for an entity (e.g.,
 * "this entity is located at Vector3.new(10, 20, 30)"), or represent
 * relationships between entities <Pair<P, O>> (e.g., "bob Likes alice") that may also store
 * additional data (e.g., "bob Eats 10 apples").
 *
 * @template T - The type of the component.
 * @param key - Flamework autogenerated key.
 * @returns The component entity ID.
 * @metadata macro
 */
export function component<T>(key?: Modding.Generic<T, "id">): Entity<T> {
	assert(key);
	let id = components.get(key) as Entity<T> | undefined;

	if (id === undefined) {
		id = registry.component();
		components.set(key, id);
		hookListeners<T>(id);
	}

	return id;
}

/**
 * Registers an existing entity to the component registry.
 *
 * @template T - The type of the component.
 * @param runtimeId - The runtime entity to be registered.
 * @param key - Flamework autogenerated key.
 * @metadata macro
 */
export function reserve<T>(runtimeId: Entity<T>, key?: Modding.Generic<T, "id">): void {
	assert(key);
	assert(!components.has(key), `A component with the key "${key}" already exists`);
	components.set(key, runtimeId);
	hookListeners<T>(runtimeId);
}

/**
 * Retrieves the ID of a component or a pair relationship.
 *
 * @template T - The type of the component.
 * @param key - Flamework autogenerated key or pair key.
 * @returns The component or pair ID.
 */
export function getId<T>(key?: SolveKey<T>): Id<FilterPair<T>> {
	assert(key);

	if (typeIs(key, "table")) {
		const pairKey = key as PairDetails<unknown, unknown>;
		return ecs.pair(
			pairKey.pred !== undefined ? component(pairKey.pred) : ecs.Wildcard,
			pairKey.obj !== undefined ? component(pairKey.obj) : ecs.Wildcard,
		);
	}

	return component(key);
}

/**
 * Adds or updates a component for the specified entity.
 *
 * @template T - The type of the component.
 * @param entity - The entity to modify.
 * @param value - The data to set for the component.
 * @param key - Flamework autogenerated key.
 * @metadata macro
 */
export function set<T>(entity: Entity, value: FilterPair<T>, key?: SolveKey<T>): void {
	const id = getId<T>(key);
	registry.set(entity, id, value);
}

/**
 * Adds or updates multiple components for the specified entity.
 *
 * @template T - The type of the components.
 * @param entity - The entity to modify.
 * @param values - The values to set for the components.
 * @param keys - Flamework autogenerated keys.
 * @metadata macro
 */
export function insert<T extends Array<unknown>>(
	entity: Entity,
	values: FilterPairs<T>,
	keys?: Modding.Many<{ [K in keyof T]: SolveKey<T[K]> }>,
): void {
	assert(keys);
	for (const key of keys) {
		const id = getId(key);
		registry.set(entity, id, values);
	}
}

/**
 * Adds a component to an entity.
 *
 * @template T - The type of the component.
 * @param entity - The entity to which the component will be added.
 * @param key - Flamework autogenerated key.
 * @info This function is idempotent, meaning if the entity already has the component, this operation will have no side effects.
 * @metadata macro
 */
export function add<T>(entity: Entity, key?: SolveKey<T>): void {
	const id = getId(key);
	registry.add(entity, id);
}

/**
 * Removes a component from an entity.
 *
 * @template T - The type of the component.
 * @param entity - The entity from which to remove the component.
 * @param key - Flamework autogenerated key.
 * @metadata macro
 */
export function remove<T>(entity: Entity, key?: SolveKey<T>): void {
	const id = getId(key);
	registry.remove(entity, id);
}

/**
 * Checks if an entity has a component.
 *
 * @template T - The type of the component.
 * @param entity - The entity to check.
 * @param key - Flamework autogenerated key.
 * @returns Whether the entity has the specified component.
 * @metadata macro
 */
export function has<T>(entity: Entity, key?: SolveKey<T>): boolean {
	const id = getId(key);
	return registry.has(entity, id);
}

/**
 * Retrieves the component data for an entity, or returns undefined if the
 * component is not present.
 *
 * @template T - The type of the component.
 * @param entity - The entity to retrieve the component data from.
 * @param key - Flamework autogenerated key.
 * @returns The component data for the specified entity, or undefined if not
 *   present.
 * @metadata macro
 */
export function get<T>(entity: Entity, key?: SolveKey<T>): FilterPair<T> | undefined {
	const id = getId(key);
	return registry.get(entity, id);
}

/**
 * Creates a new entity with the specified components.
 *
 * @template T - The type of the components.
 * @param bundle - The components to add to the entity.
 * @param keys - Flamework autogenerated keys.
 * @returns The created entity.
 * @metadata macro
 */
export function spawn<T extends Array<unknown>>(
	bundle?: FilterPairs<T>,
	keys?: Modding.Many<{ [K in keyof T]: SolveKey<T[K]> }>,
): Entity {
	const entity = registry.entity();
	if (bundle && keys) {
		for (let i = 0; i < keys.size(); i++) {
			const id = getId(keys[i]);
			registry.set(entity, id, bundle[i]);
		}
	}

	return entity;
}

/**
 * Retrieves the target entity of a relationship involving the specified entity
 * and component.
 *
 * @template T - The type of the component.
 * @param entity - The entity to get the target for.
 * @param key - Flamework autogenerated key.
 * @returns The target entity if a relationship exists, or undefined otherwise.
 * @metadata macro
 */
export function target<T>(entity: Entity, key?: Modding.Generic<T, "id">): Entity | undefined {
	const id = component(key);
	return registry.target(entity, id);
}

/**
 * Creates a pair relationship between a component and an entity.
 *
 * @template P - The type of the predicate component.
 * @template O - The type of the object component.
 * @param object - The object entity.
 * @param predicate - The predicate component key.
 * @returns The pair ID.
 * @metadata macro
 */
export function pair<P>(object: Entity, predicate?: Modding.Generic<P, "id">): Pair<P, unknown> {
	const predicateId = component(predicate);
	return ecs.pair(predicateId, object);
}

/**
 * Deletes the specified entity and all associated components.
 *
 * @param entity - The entity to delete.
 */
export function despawn(entity: Entity): void {
	registry.delete(entity);
}

/**
 * Retrieves the parent entity (target of the ChildOf relationship) for the
 * given entity.
 *
 * @param entity - The entity for which to get the parent.
 * @returns The parent entity, or undefined if no parent exists.
 */
export function parent(entity: Entity): Entity | undefined {
	return target<ChildOf>(entity);
}

reserve<Wildcard>(ecs.Wildcard as Entity<Wildcard>);
reserve<ChildOf>(ecs.ChildOf as Entity<ChildOf>);
